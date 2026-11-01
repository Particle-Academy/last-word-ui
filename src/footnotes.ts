import type { Block, Doc, Footnote, ListItem, Run } from "./types";

export interface FootnoteNumbering {
  /** Run object -> its mark number. Keyed by identity, so the Doc must not be cloned between numbering and render. */
  marks: Map<Run, number>;
  /** Every footnote in mark order. */
  notes: Array<{ id: number; footnote: Footnote }>;
}

/**
 * Number the document's footnote marks 1, 2, 3 in reading order, as Word does
 * (last-word 0.15.0 carries no number in the model).
 *
 * Walks the BODY only. A footnote in a header or footer, or inside another
 * footnote, is something Word cannot hold and last-word's repairer drops; if
 * one arrives anyway it is not numbered and renders no mark.
 */
export function numberFootnotes(doc: Doc): FootnoteNumbering {
  const marks = new Map<Run, number>();
  const notes: FootnoteNumbering["notes"] = [];

  const runs = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const run of list as Run[]) {
      const fn = run?.footnote;
      if (fn && typeof fn === "object" && Array.isArray(fn.blocks)) {
        const id = notes.length + 1;
        marks.set(run, id);
        notes.push({ id, footnote: fn });
      }
    }
  };
  const items = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const item of list as ListItem[]) {
      runs(item?.runs);
      items(item?.children);
    }
  };
  const blocks = (list: unknown): void => {
    if (!Array.isArray(list)) return;
    for (const block of list as Block[]) {
      switch (block?.type) {
        case "heading":
        case "paragraph":
          runs(block.runs);
          break;
        case "list":
          items(block.items);
          break;
        case "quote":
          blocks(block.blocks);
          break;
        case "table":
          for (const row of Array.isArray(block.rows) ? block.rows : []) {
            for (const cell of Array.isArray(row?.cells) ? row.cells : []) blocks(cell?.blocks);
          }
          break;
        default:
          break;
      }
    }
  };

  blocks(doc.blocks);
  return { marks, notes };
}
