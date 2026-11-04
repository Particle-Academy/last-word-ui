import type { Doc } from "./types";

/**
 * What the viewer says when a document asks for more than one page setup. It draws
 * one until per-page geometry lands; drawing nothing, or drawing it wrong in
 * silence, are the two worse answers. The same words as fancy-docs.
 */
export const LAYOUT_NOTICE =
  "Mixed page orientation isn't shown yet. This document asks for different page settings partway through; every page here uses the document's one page setup.";

/** The page object's own keys, written straight on a break when `page` was meant. */
const NEAR_MISS_KEYS = ["size", "orientation", "margins", "header", "footer", "firstHeader", "firstFooter", "evenHeader", "evenFooter", "background", "border"];

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null;

/**
 * JSON Pointers to what this viewer ignores about page layout: `pageBreak.page`,
 * the near-miss keys on a break and a top-level `sections`, at any depth. Empty for
 * a document with one page setup. The Doc arrives as JSON from any writer, so
 * nothing here trusts its shape. A walk, not a recursion: the nesting is the file's.
 */
export function unshownLayout(doc: Doc): string[] {
  const found: string[] = [];
  if (!isObject(doc)) return found;
  if ((doc as Loose).sections !== undefined) found.push("/sections");

  const stack: Array<{ blocks: unknown; at: string }> = [{ blocks: doc.blocks, at: "/blocks" }];
  while (stack.length > 0) {
    const { blocks, at } = stack.pop()!;
    if (!Array.isArray(blocks)) continue;
    blocks.forEach((block: unknown, i) => {
      if (!isObject(block)) return;
      const path = `${at}/${i}`;
      if (block.type === "pageBreak") {
        for (const key of ["page", ...NEAR_MISS_KEYS]) {
          if (block[key] !== undefined) found.push(`${path}/${key}`);
        }
      } else if (block.type === "quote") {
        stack.push({ blocks: block.blocks, at: `${path}/blocks` });
      } else if (block.type === "table" && Array.isArray(block.rows)) {
        block.rows.forEach((row: unknown, r) => {
          if (!isObject(row) || !Array.isArray(row.cells)) return;
          row.cells.forEach((cell: unknown, c) => {
            if (isObject(cell)) stack.push({ blocks: cell.blocks, at: `${path}/rows/${r}/cells/${c}/blocks` });
          });
        });
      }
    });
  }
  return found;
}
