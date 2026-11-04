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

/**
 * The most columns one cell may span: last-word's `Schema::MAX_COL_SPAN`. The
 * viewer never refuses a document, so here it is a clamp. Without it a few bytes
 * of JSON could ask the browser for any number of columns (one sizer cell each).
 */
export const MAX_COL_SPAN = 1000;

const span = (v: unknown): number => (typeof v === "number" && Number.isInteger(v) && v > 1 ? v : 1);

/**
 * Where each cell sits on the column grid. Spans are HTML-style (the cell
 * appears once; the rows it covers list only their remaining cells), so a slot
 * a row span from above occupies is skipped when placing a row's cells.
 */
export function tableGrid(rows: TableRow[]): TableGrid {
  const joinPrevious = rows.map(() => false);
  let colCount = 0;
  // Row spans from rows above, as [lastRow, start, end). Covered slots are
  // intervals and never enumerated: a cell costs the same at any span.
  let active: Array<[number, number, number]> = [];
  let reach = -1; // the last row any span so far extends into

  const out = rows.map((row, r) => {
    joinPrevious[r] = r <= reach;
    active = active.filter((s) => s[0] >= r).sort((a, b) => a[1] - b[1]);
    const above = active.length;
    let j = 0;
    const placed: GridCell[] = [];
    let col = 0;
    (Array.isArray(row?.cells) ? row.cells : []).forEach((cell, c) => {
      while (j < above && active[j]![1] <= col) {
        col = Math.max(col, active[j]![2]);
        j++;
      }
      const colSpan = Math.min(MAX_COL_SPAN, span(cell?.colSpan));
      const rowSpan = Math.min(span(cell?.rowSpan), rows.length - r);
      if (rowSpan > 1) {
        active.push([r + rowSpan - 1, col, col + colSpan]);
        reach = Math.max(reach, r + rowSpan - 1);
      }
      placed.push({ row: r, cell: c, col, colSpan, rowSpan });
      col += colSpan;
      colCount = Math.max(colCount, col);
    });
    return placed;
  });

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
