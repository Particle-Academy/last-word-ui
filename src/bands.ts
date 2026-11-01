import { bodyBox, type BodyBox, type PageGeometry } from "./geometry";
import { hasBand } from "./render";
import type { Band, BlocksBand, Page } from "./types";

/**
 * Which header and footer each page draws (last-word 0.16.0).
 *
 * `page.header` / `page.footer` are the defaults. Beside them:
 * - `firstHeader` / `firstFooter`: page 1 only (Word's "Different first page");
 * - `evenHeader` / `evenFooter`: pages 2, 4, ... (Word's "Different odd and
 *   even pages"), the default then being the odd pages'.
 * A kind with no variant shows its default on those pages too. A variant of
 * `{"blocks": []}` (or a one-line band with no text) is present but empty, so
 * it BLANKS that page's band rather than falling back.
 *
 * So pages fall in three classes -- page 1, even pages, other odd pages --
 * and every page of a class draws the same bands, at the same heights. The
 * packer takes one body height per class (`PackOptions.firstPageHeight` /
 * `evenPageHeight` / `pageHeight`) and `pageBodyBoxes` derives them.
 */

export type BandKind = "header" | "footer";
/** Which of a kind's bands applies: the default, the first-page or the even-page one. */
export type BandSlot = "default" | "first" | "even";
/** Page 1, an even page, or an odd page after the first. */
export type PageClass = "first" | "even" | "odd";

/** Measured band heights per kind and slot, in any one unit; 0 when absent or blank. */
export type BandHeights = Record<BandKind, Record<BandSlot, number>>;

export const BAND_SLOTS: readonly BandSlot[] = ["default", "first", "even"];

const VARIANT_KEY: Record<BandKind, Record<Exclude<BandSlot, "default">, keyof Page>> = {
  header: { first: "firstHeader", even: "evenHeader" },
  footer: { first: "firstFooter", even: "evenFooter" },
};

/** The class of the page at 0-based `index`. */
export function pageClass(index: number): PageClass {
  if (index === 0) return "first";
  return index % 2 === 1 ? "even" : "odd";
}

const isBandObject = (v: unknown): v is Band | BlocksBand => !!v && typeof v === "object" && !Array.isArray(v);

/** The raw band stored in a slot, or undefined when the slot is not set (a non-object counts as unset). */
export function slotBand(page: Page | undefined, kind: BandKind, slot: BandSlot): Band | BlocksBand | undefined {
  if (!page || typeof page !== "object") return undefined;
  const key = slot === "default" ? kind : VARIANT_KEY[kind][slot];
  const v = (page as Record<string, unknown>)[key];
  return isBandObject(v) ? v : undefined;
}

/** The slot a page class draws for one kind: its variant when that is set, else the default. */
export function bandSlot(page: Page | undefined, kind: BandKind, cls: PageClass): BandSlot {
  if (cls === "first" && slotBand(page, kind, "first") !== undefined) return "first";
  if (cls === "even" && slotBand(page, kind, "even") !== undefined) return "even";
  return "default";
}

/**
 * The band the page at 0-based `index` draws for `kind`, or null when it
 * draws none (no band, or a blank variant).
 */
export function pageBand(page: Page | undefined, kind: BandKind, index: number): Band | BlocksBand | null {
  const band = slotBand(page, kind, bandSlot(page, kind, pageClass(index)));
  return hasBand(band) ? band : null;
}

/**
 * The body box of each page class from the measured band heights (points):
 * each class uses the header and footer it actually draws, so a tall
 * first-page letterhead moves only page 1's body down.
 */
export function pageBodyBoxes(g: PageGeometry, page: Page | undefined, heights: BandHeights): Record<PageClass, BodyBox> {
  const height = (kind: BandKind, cls: PageClass): number => {
    const slot = bandSlot(page, kind, cls);
    return hasBand(slotBand(page, kind, slot)) ? Math.max(0, heights[kind][slot] || 0) : 0;
  };
  const box = (cls: PageClass) => bodyBox(g, height("header", cls), height("footer", cls));
  return { first: box("first"), even: box("even"), odd: box("odd") };
}
