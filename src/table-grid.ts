import type { TableRow } from "./types";

export interface GridCell {
  /** Row index. */
  row: number;
  /** Index of the cell within its row's `cells`. */
  cell: number;
  /** First grid column the cell occupies. */
  col: number;
  colSpan: number;
  /** Clamped to the rows that exist. */
  rowSpan: number;
}

export interface TableGrid {
  colCount: number;
  rows: GridCell[][];
  /** True for a row a row span from above reaches into: no page break before it. */
  joinPrevious: boolean[];
  /** The leading run of `header: true` rows -- the rows Word repeats on each page. */
  headerRows: number;
}

const span = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v > 1 ? v : 1);

/**
 * Where each cell sits on the column grid. Spans are HTML-style (the cell
 * appears once; the rows it covers list only their remaining cells), so a slot
 * a row span from above occupies is skipped when placing a row's cells.
 */
export function tableGrid(rows: TableRow[]): TableGrid {
  const occupied: Array<Set<number>> = rows.map(() => new Set<number>());
  const joinPrevious = rows.map(() => false);
  let colCount = 0;

  const out = rows.map((row, r) => {
    const placed: GridCell[] = [];
    let col = 0;
    (Array.isArray(row?.cells) ? row.cells : []).forEach((cell, c) => {
      while (occupied[r]!.has(col)) col++;
      const colSpan = span(cell?.colSpan);
      const rowSpan = Math.min(span(cell?.rowSpan), rows.length - r);
      for (let dr = 0; dr < rowSpan; dr++) {
        for (let dc = 0; dc < colSpan; dc++) occupied[r + dr]!.add(col + dc);
        if (dr > 0) joinPrevious[r + dr] = true;
      }
      placed.push({ row: r, cell: c, col, colSpan, rowSpan });
      col += colSpan;
    });
    return placed;
  });

  for (const set of occupied) for (const c of set) colCount = Math.max(colCount, c + 1);

  let headerRows = 0;
  while (headerRows < rows.length && rows[headerRows]?.header === true) headerRows++;

  return { colCount: Math.max(1, colCount), rows: out, joinPrevious, headerRows };
}

/**
 * Column widths as percentages of the table. The weights are relative and
 * apply only when there is one per column; otherwise the columns are equal --
 * the writer's own rule, so the preview matches the file.
 */
export function columnPercents(colCount: number, widths?: number[]): number[] {
  const n = Math.max(1, colCount);
  const even = Array.from({ length: n }, () => 100 / n);
  if (!Array.isArray(widths) || widths.length !== n) return even;
  const w = widths.map((x) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return even;
  return w.map((x) => Math.round((x / total) * 100 * 1e6) / 1e6);
}
