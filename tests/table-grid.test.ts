import { describe, expect, it } from "vitest";
import { columnPercents, tableGrid } from "../src/table-grid";
import type { TableRow } from "../src/types";

const cell = (extra: Record<string, unknown> = {}) => ({ blocks: [], ...extra });

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
