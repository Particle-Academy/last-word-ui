import type { Doc, Orientation, PageSize } from "./types";

/**
 * Paper sizes in points, portrait. A4 is 11906 x 16838 twips, which is what
 * every last-word writer emits and every reader matches against.
 */
export const PAGE_SIZES_PT: Record<PageSize, readonly [number, number]> = {
  letter: [612, 792],
  legal: [612, 1008],
  a4: [595.3, 841.9],
};

/** One inch a side, as every last-word writer emits unasked. */
export const PAGE_MARGIN_DEFAULT = 72;
/** Half an inch from the page edge to the header and to the footer (Word's default). */
export const PAGE_BAND_DISTANCE_DEFAULT = 36;

/** CSS pixels per point (96 dpi). */
export const PX_PER_PT = 96 / 72;

export interface ResolvedMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Points from the top page edge to the top of the header. */
  header: number;
  /** Points from the bottom page edge to the bottom of the footer. */
  footer: number;
}

export interface PageGeometry {
  size: PageSize;
  orientation: Orientation;
  /** Points, orientation applied. */
  width: number;
  height: number;
  margins: ResolvedMargins;
  /** The text column, in points. */
  contentWidth: number;
}

export interface BodyBox {
  /** Points from the top page edge to the top of the body. */
  top: number;
  /** Points from the bottom page edge to the bottom of the body. */
  bottom: number;
  /** The body's height in points. */
  height: number;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Every page margin and both header/footer distances, defaults filled in.
 *
 * This is the ONE place the defaults are applied, mirroring PHP last-word's
 * `Schema::pageMargins()` (0.15.0): a reader omits any value equal to its
 * default -- DocxReader drops a side of exactly 1440 twips -- so a missing
 * value means the default, never zero. `page.margins.header` / `.footer` are
 * the distances the reference leg added in 0.15.0; until the JS reader returns
 * them they are absent and resolve to Word's half inch.
 */
export function pageMargins(doc: Doc): ResolvedMargins {
  const m = (doc.page && typeof doc.page.margins === "object" && doc.page.margins) || {};
  const value = (key: keyof ResolvedMargins, fallback: number): number => {
    const v = (m as Record<string, unknown>)[key];
    return finite(v) ? v : fallback;
  };
  return {
    top: value("top", PAGE_MARGIN_DEFAULT),
    right: value("right", PAGE_MARGIN_DEFAULT),
    bottom: value("bottom", PAGE_MARGIN_DEFAULT),
    left: value("left", PAGE_MARGIN_DEFAULT),
    header: value("header", PAGE_BAND_DISTANCE_DEFAULT),
    footer: value("footer", PAGE_BAND_DISTANCE_DEFAULT),
  };
}

/** The page a Doc lays out on: paper, orientation, margins and text column. */
export function pageGeometry(doc: Doc): PageGeometry {
  const page = doc.page ?? {};
  const size: PageSize =
    typeof page.size === "string" && page.size in PAGE_SIZES_PT ? (page.size as PageSize) : "letter";
  const orientation: Orientation = page.orientation === "landscape" ? "landscape" : "portrait";
  const [w, h] = PAGE_SIZES_PT[size];
  const [width, height] = orientation === "landscape" ? [h, w] : [w, h];
  const margins = pageMargins(doc);
  return {
    size,
    orientation,
    width,
    height,
    margins,
    contentWidth: Math.max(1, width - margins.left - margins.right),
  };
}

/**
 * The body box once the header and footer have been measured (points).
 *
 * Word moves the body down when the header, set at its distance from the top
 * edge, is taller than the top margin leaves room for -- and up, for a footer.
 * A letterhead with a logo is the usual case.
 */
export function bodyBox(g: PageGeometry, headerHeight: number, footerHeight: number): BodyBox {
  const top = Math.max(g.margins.top, headerHeight > 0 ? g.margins.header + headerHeight : 0);
  const bottom = Math.max(g.margins.bottom, footerHeight > 0 ? g.margins.footer + footerHeight : 0);
  return { top, bottom, height: Math.max(1, g.height - top - bottom) };
}
