import { describe, expect, it, vi } from "vitest";
import { columnPercents, MAX_COL_SPAN, tableGrid } from "../src/table-grid";
import type { TableRow } from "../src/types";

const cell = (extra: Record<string, unknown> = {}) => ({ blocks: [], ...extra });

/** The slot-by-slot placement tableGrid must keep agreeing with. */
function referenceGrid(rows: TableRow[]) {
  const occupied = rows.map(() => new Set<number>());
  const joinPrevious = rows.map(() => false);
  const out = rows.map((row, r) => {
    let col = 0;
    return row.cells.map((c, i) => {
      while (occupied[r]!.has(col)) col++;
      const colSpan = c.colSpan ?? 1;
      const rowSpan = Math.min(c.rowSpan ?? 1, rows.length - r);
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) occupied[r + dr]!.add(col + dc);
        if (dr > 0) joinPrevious[r + dr] = true;
      }
      const placed = { row: r, cell: i, col, colSpan, rowSpan };
      col += colSpan;
      return placed;
    });
  });
  let colCount = 0;
  for (const set of occupied) for (const c of set) colCount = Math.max(colCount, c + 1);
  return { colCount: Math.max(1, colCount), rows: out, joinPrevious };
}

describe("tableGrid spans", () => {
  it("clamps a colSpan to the ceiling, whatever the document says", () => {
    expect(MAX_COL_SPAN).toBe(1000);
    for (const colSpan of [1001, 1e9, 1e308]) {
      const g = tableGrid([{ cells: [cell({ colSpan })] }]);
      expect(g.colCount).toBe(1000);
      expect(g.rows[0]![0]!.colSpan).toBe(1000);
    }
    expect(columnPercents(tableGrid([{ cells: [cell({ colSpan: 1e9 })] }]).colCount)).toHaveLength(1000);
  });

  it("leaves a real span alone, at the ceiling included", () => {
    expect(tableGrid([{ cells: [cell({ colSpan: 1000 })] }]).colCount).toBe(1000);
    expect(tableGrid([{ cells: [cell({ colSpan: 64 })] }]).colCount).toBe(64);
  });

  it("never enumerates the slots a span covers", () => {
    const add = vi.spyOn(Set.prototype, "add");
    const rows: TableRow[] = [{ cells: Array.from({ length: 10 }, () => cell({ colSpan: 1000, rowSpan: 100 })) }];
    for (let i = 1; i < 100; i++) rows.push({ cells: [] });
    const g = tableGrid(rows);
    const calls = add.mock.calls.length;
    add.mockRestore();
    expect(g.colCount).toBe(10000);
    expect(calls).toBe(0);
  });

  it("places cells exactly as slot-by-slot placement does", () => {
    // A fixed linear congruential sequence, so a failure reproduces.
    let seed = 20261104;
    const pick = (lo: number, hi: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return lo + (seed >> 8) % (hi - lo + 1);
    };
    for (let t = 0; t < 400; t++) {
      const rows: TableRow[] = Array.from({ length: pick(1, 6) }, () => ({
        cells: Array.from({ length: pick(0, 5) }, () => cell({ colSpan: pick(1, 4), rowSpan: pick(1, 5) })) as TableRow["cells"],
      }));
      const g = tableGrid(rows);
      expect({ colCount: g.colCount, rows: g.rows, joinPrevious: g.joinPrevious }).toEqual(referenceGrid(rows));
    }
  });
});

describe("tableGrid", () => {
  it("places plain cells in their columns", () => {
    const g = tableGrid([{ cells: [cell(), cell(), cell()] }, { cells: [cell(), cell(), cell()] }]);
    expect(g.colCount).toBe(3);
    expect(g.rows[1]!.map((c) => c.col)).toEqual([0, 1, 2]);
    expect(g.joinPrevious).toEqual([false, false]);
  });

  it("skips the slots a row span from above covers (HTML-style spans)", () => {
    const rows: TableRow[] = [
      { cells: [cell({ rowSpan: 2 }), cell(), cell()] },
      { cells: [cell(), cell()] },
      { cells: [cell(), cell(), cell()] },
    ];
    const g = tableGrid(rows);
    expect(g.rows[1]!.map((c) => c.col)).toEqual([1, 2]);
    expect(g.joinPrevious).toEqual([false, true, false]);
  });

  it("counts column spans", () => {
    const g = tableGrid([{ cells: [cell({ colSpan: 2 }), cell()] }, { cells: [cell(), cell(), cell()] }]);
    expect(g.colCount).toBe(3);
    expect(g.rows[0]!.map((c) => [c.col, c.colSpan])).toEqual([
      [0, 2],
      [2, 1],
    ]);
  });

  it("counts the leading header rows only", () => {
    const g = tableGrid([
      { header: true, cells: [cell()] },
      { header: true, cells: [cell()] },
      { cells: [cell()] },
      { header: true, cells: [cell()] },
    ]);
    expect(g.headerRows).toBe(2);
  });

  it("clamps a row span that runs past the last row", () => {
    const g = tableGrid([{ cells: [cell({ rowSpan: 9 })] }, { cells: [] }]);
    expect(g.rows[0]![0]!.rowSpan).toBe(2);
  });
});

describe("columnPercents", () => {
  it("normalises relative weights: [30,40,30] and [3,4,3] are the same table", () => {
    expect(columnPercents(3, [30, 40, 30])).toEqual([30, 40, 30]);
    expect(columnPercents(3, [3, 4, 3])).toEqual([30, 40, 30]);
  });

  it("splits evenly when the weights do not match the column count, as the writer does", () => {
    expect(columnPercents(4, [1, 2])).toEqual([25, 25, 25, 25]);
    expect(columnPercents(2)).toEqual([50, 50]);
  });

  it("splits evenly when the weights sum to nothing", () => {
    expect(columnPercents(2, [0, 0])).toEqual([50, 50]);
  });
});
