import { BAND_SLOTS, type BandHeights } from "./bands";
import { tableGrid } from "./table-grid";
import type { PackItem } from "./paginate";
import type { Block } from "./types";

/**
 * DOM measurement: rendered blocks in, packer items out.
 *
 * Every block is rendered once into a hidden container at the page's text
 * width, with the same typography the pages use; this reads that container.
 * It is the only part of pagination that needs a browser, and it does nothing
 * but read rectangles -- every decision about where a page ends is made by the
 * pure `paginate()`.
 */

/** Blocks whose text may be cut between lines. */
const SPLITTABLE = new Set(["paragraph", "heading", "list", "quote", "code"]);

export const blockId = (index: number): string => `b${index}`;

function height(el: Element | null | undefined): number {
  return el ? el.getBoundingClientRect().height : 0;
}

/**
 * Offsets (from the element's top) of the bottom of every text line but the
 * last: the places a page may cut the block without slicing a line. Lines are
 * found by merging the vertical extents of every text fragment's client rects,
 * so a line holding mixed sizes is still one line, and a cut can only fall
 * where NO text crosses -- inside a quote holding a table, too.
 */
export function lineBreakpoints(el: HTMLElement): number[] {
  if (typeof document === "undefined" || typeof document.createRange !== "function") return [];
  const top = el.getBoundingClientRect().top;
  const total = el.getBoundingClientRect().height;
  const range = document.createRange();
  if (typeof range.getClientRects !== "function") return [];
  const spans: Array<[number, number]> = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue) continue;
    range.selectNodeContents(node);
    for (const r of Array.from(range.getClientRects())) {
      if (r.height > 0) spans.push([r.top - top, r.bottom - top]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const lines: Array<[number, number]> = [];
  for (const s of spans) {
    const last = lines[lines.length - 1];
    if (last && s[0] < last[1] - 0.5) last[1] = Math.max(last[1], s[1]);
    else lines.push([s[0], s[1]]);
  }
  return lines
    .slice(0, -1)
    .map((l) => l[1])
    .filter((b) => b > 0 && b < total - 0.5);
}

export interface Measured {
  items: PackItem[];
  /** px: the default header (`bands.header.default`). */
  headerHeight: number;
  /** px: the default footer (`bands.footer.default`). */
  footerHeight: number;
  /** px, every header and footer slot; 0 for one not drawn. */
  bands: BandHeights;
  /** px */
  footnoteSeparator: number;
}

/**
 * Read the measuring container `root`. It holds `[data-lw-measure-block=i]`
 * per block, `[data-lw-measure-footnote=id]` per note,
 * `[data-lw-measure-band="header:first"]` (kind:slot) per drawn band, and the
 * separator under `data-lw-measure-separator`.
 */
export function measure(root: HTMLElement, blocks: Block[]): Measured {
  const noteHeights = new Map<number, number>();
  root.querySelectorAll<HTMLElement>("[data-lw-measure-footnote]").forEach((el) => {
    noteHeights.set(Number(el.dataset.lwMeasureFootnote), height(el));
  });
  const marksIn = (el: Element) =>
    Array.from(el.querySelectorAll<HTMLElement>("[data-lw-footnote-ref]")).map((m) => {
      const id = Number(m.dataset.lwFootnoteRef);
      return { id, el: m, height: noteHeights.get(id) ?? 0 };
    });

  const items: PackItem[] = blocks.map((block, i): PackItem => {
    if (block?.type === "pageBreak") return { type: "break" };
    const wrap = root.querySelector<HTMLElement>(`[data-lw-measure-block="${i}"]`);
    if (!wrap) return { type: "block", id: blockId(i), height: 0 };

    if (block.type === "table") {
      const grid = tableGrid(Array.isArray(block.rows) ? block.rows : []);
      const rows = Array.from(wrap.querySelectorAll<HTMLElement>("tr[data-lw-row]")).map((tr) => {
        const r = Number(tr.dataset.lwRow);
        const notes = marksIn(tr).map(({ id, height: h }) => ({ id, height: h }));
        return {
          height: height(tr),
          ...(grid.joinPrevious[r] ? { joinPrevious: true } : {}),
          ...(notes.length ? { footnotes: notes } : {}),
        };
      });
      return { type: "table", id: blockId(i), rows, headerRows: grid.headerRows };
    }

    const top = wrap.getBoundingClientRect().top;
    const h = height(wrap);
    let breakpoints = SPLITTABLE.has(block.type) ? lineBreakpoints(wrap) : [];
    // Widow and orphan control, as Word's default: never leave one line of a
    // paragraph alone at the foot or the head of a page.
    if (block.type === "paragraph" || block.type === "heading") breakpoints = breakpoints.slice(1, -1);
    // A mark belongs to the line it sits on: take its vertical centre, which
    // stays inside that line even though the superscript rises above it.
    const notes = marksIn(wrap).map(({ id, el, height: nh }) => {
      const r = el.getBoundingClientRect();
      return { id, at: Math.min(h, Math.max(0, (r.top + r.bottom) / 2 - top)), height: nh };
    });
    const keepNext = block.type === "heading" || (block as { keepNext?: unknown }).keepNext === true;
    return {
      type: "block",
      id: blockId(i),
      height: h,
      ...(breakpoints.length ? { breakpoints } : {}),
      ...(keepNext ? { keepNext: true } : {}),
      ...(notes.length ? { footnotes: notes } : {}),
    };
  });

  const bands = { header: {}, footer: {} } as BandHeights;
  for (const kind of ["header", "footer"] as const) {
    for (const slot of BAND_SLOTS) {
      bands[kind][slot] = height(root.querySelector(`[data-lw-measure-band="${kind}:${slot}"]`));
    }
  }

  return {
    items,
    headerHeight: bands.header.default,
    footerHeight: bands.footer.default,
    bands,
    footnoteSeparator: height(root.querySelector("[data-lw-measure-separator]")),
  };
}
