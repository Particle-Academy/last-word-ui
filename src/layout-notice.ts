import { isPageObject } from "./stretches";
import type { Doc } from "./types";

/**
 * What the viewer says when a document asks for page settings in a form it does not
 * honour. A `page` on a top-level break is drawn; what is left here is what the writers
 * refuse too. Drawing nothing, or drawing it wrong in silence, are the two worse answers.
 * The same words as fancy-docs.
 */
export const LAYOUT_NOTICE =
  "Some page settings in this document aren't shown. It sets them somewhere they don't apply: on a page break directly, in a quote or a table cell, or under a sections key.";

/** The page object's own keys, written straight on a break when `page` was meant. */
const NEAR_MISS_KEYS = ["size", "orientation", "margins", "header", "footer", "firstHeader", "firstFooter", "evenHeader", "evenFooter", "background", "border"];

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null;

/**
 * JSON Pointers to what this viewer ignores about page layout: `page` on a nested
 * break or one that is not an object, a background on a break, the near-miss keys on a
 * break and a top-level `sections`, at any depth. The Doc arrives as JSON from any
 * writer, so nothing here trusts its shape. A walk, not a recursion: the nesting is
 * the file's.
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
        for (const key of NEAR_MISS_KEYS) {
          if (block[key] !== undefined) found.push(`${path}/${key}`);
        }
        if (block.page !== undefined) {
          if (at !== "/blocks" || !isPageObject(block.page)) found.push(`${path}/page`);
          else if (isObject(block.page) && (block.page as Loose).background !== undefined) found.push(`${path}/page/background`);
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
