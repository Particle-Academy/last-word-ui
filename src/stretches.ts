import { pageBodyBoxes, type BandHeights, type BandKind, type BandSlot, type PageClass } from "./bands";
import { PX_PER_PT, pageGeometry, type BodyBox, type PageGeometry } from "./geometry";
import type { BreakItem, PackItem, PackOptions } from "./paginate";
import type { Block, Doc, Page } from "./types";

/**
 * A document's runs of pages of one setup: what is before the first `pageBreak`
 * carrying a `page`, then what follows each one. Word calls each a section. A plain
 * break, or one nested in a quote or a table cell, starts no stretch. The same reading
 * as last-word and fine-print's `Schema::stretches()`.
 */
export interface Stretch {
  /** The page as this stretch sees it: margins merged, every other key replaced whole. */
  page: Page | undefined;
  geometry: PageGeometry;
  /** Index of the break that starts it; null for the first. */
  breakAt: number | null;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Whether a break's `page` is a page object. `{}` that came through PHP's JSON arrives as `[]`. */
export function isPageObject(page: unknown): boolean {
  return isObject(page) || (Array.isArray(page) && page.length === 0);
}

function mergePage(page: Page | undefined, change: Record<string, unknown>): Page {
  const out: Record<string, unknown> = { ...(page ?? {}) };
  delete out.firstHeader;
  delete out.firstFooter;
  for (const [key, value] of Object.entries(change)) {
    if (value === undefined || value === null || key === "background") continue;
    if (key === "margins" && isObject(value) && isObject(out.margins)) {
      const merged: Record<string, unknown> = { ...out.margins };
      for (const [side, v] of Object.entries(value)) {
        if (v !== undefined && v !== null) merged[side] = v;
      }
      out.margins = merged;
    } else {
      out[key] = value;
    }
  }
  return out as Page;
}

export function docStretches(doc: Doc): Stretch[] {
  let page: Page | undefined = doc?.page && typeof doc.page === "object" ? doc.page : undefined;
  const make = (breakAt: number | null): Stretch => ({
    page,
    geometry: pageGeometry({ ...(page ? { page } : {}), blocks: [] } as Doc),
    breakAt,
  });
  const out: Stretch[] = [make(null)];
  (Array.isArray(doc?.blocks) ? doc.blocks : []).forEach((block: Block, i: number) => {
    const b = block as unknown as { type?: unknown; page?: unknown } | null;
    if (!isObject(b) || b.type !== "pageBreak" || !isPageObject(b.page)) return;
    page = mergePage(page, isObject(b.page) ? b.page : {});
    out.push(make(i));
  });
  return out;
}

/** Which stretch each top-level block is in. A break carrying `page` opens the one after it. */
export function blockStretches(stretches: Stretch[], count: number): number[] {
  const out: number[] = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    while (k + 1 < stretches.length && stretches[k + 1]!.breakAt! <= i) k++;
    out.push(k);
  }
  return out;
}

const toPt = (h: Record<BandSlot, number>): Record<BandSlot, number> => ({
  default: h.default / PX_PER_PT,
  first: h.first / PX_PER_PT,
  even: h.even / PX_PER_PT,
});

/** One stretch's measured band heights, px to pt. */
const heightsPt = (h: BandHeights): BandHeights => ({ header: toPt(h.header), footer: toPt(h.footer) } as Record<BandKind, Record<BandSlot, number>>);

export interface PackInput {
  items: PackItem[];
  options: PackOptions;
  /** The body box of each page class, per stretch. */
  boxes: Record<PageClass, BodyBox>[];
}

/**
 * What the packer is given: the first stretch's heights as its options, and each later
 * stretch's on the break that starts it, because which page class its first page falls
 * in depends on how many pages the stretches before it took.
 */
export function packInput(
  stretches: Stretch[],
  measured: { items: PackItem[]; stretchBands: BandHeights[]; footnoteSeparator: number },
): PackInput {
  const boxes = stretches.map((s, k) => pageBodyBoxes(s.geometry, s.page, heightsPt(measured.stretchBands[k]!)));
  const items = measured.items.map((item, i): PackItem => {
    const k = stretches.findIndex((s) => s.breakAt === i);
    if (k <= 0) return item;
    const b = boxes[k]!;
    const stretch: NonNullable<BreakItem["stretch"]> = {
      pageHeight: b.odd.height * PX_PER_PT,
      firstPageHeight: b.first.height * PX_PER_PT,
      firstEvenPageHeight: b.firstEven.height * PX_PER_PT,
      evenPageHeight: b.even.height * PX_PER_PT,
    };
    return { type: "break", stretch };
  });
  const first = boxes[0]!;
  return {
    items,
    boxes,
    options: {
      pageHeight: first.odd.height * PX_PER_PT,
      firstPageHeight: first.first.height * PX_PER_PT,
      evenPageHeight: first.even.height * PX_PER_PT,
      footnoteSeparator: measured.footnoteSeparator,
    },
  };
}
