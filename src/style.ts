import type { CSSProperties } from "react";
import type { Border, BoxBorders, ParagraphProps } from "./types";

/** A length in points, as CSS. The page is laid out in pt so it matches the file 1:1. */
export const pt = (n: number): string => `${Math.round(n * 1000) / 1000}pt`;
export const px = (n: number): string => `${Math.round(n * 1000) / 1000}px`;

/**
 * Word's single line spacing for a body font is about 1.17 of its size; a
 * last-word `lineHeight` is a multiple of that. 259/240 is the writer's
 * default ("1.08 auto").
 */
export const SINGLE_LINE = 1.17;
export const DEFAULT_LINE_MULTIPLE = 259 / 240;
/** The writer's paragraph spacing after, unasked: 160 twips. */
export const DEFAULT_SPACE_AFTER = 8;
export const DEFAULT_FONT = "Calibri";
export const DEFAULT_SIZE = 11;
export const HEADING_SIZES = [20, 16, 14, 13, 12, 11] as const;
export const HEADER_FILL = "#E7E7E7";
export const CODE_FILL = "#F2F2F2";
export const LINK_COLOR = "#0563C1";
export const QUOTE_COLOR = "#595959";
export const BAND_SIZE = 9;
export const BAND_COLOR = "#6B7280";
export const FOOTNOTE_SIZE = 10;
/** The rule above a page's footnotes, and the space it takes. */
export const FOOTNOTE_SEPARATOR_PT = 12;

/** #RRGGBB or undefined. Doc values are untrusted: only a hex colour reaches a style. */
export function hex(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const num = (v: unknown, fallback: number): number => (finite(v) ? v : fallback);

/** Metric-compatible open fallbacks first, so line breaks match Word's as closely as possible. */
const FALLBACKS: Record<string, string> = {
  calibri: 'Carlito, "Segoe UI", Arial, sans-serif',
  cambria: 'Caladea, Georgia, serif',
  arial: '"Liberation Sans", Arimo, Helvetica, sans-serif',
  "times new roman": '"Liberation Serif", Tinos, Times, serif',
  "courier new": '"Liberation Mono", Cousine, monospace',
  consolas: '"Liberation Mono", Menlo, monospace',
};

/** The package-unique family the bundled Carlito is declared under (`fonts.ts`). */
export const CARLITO_FAMILY = "LW Carlito";

/**
 * A font-family stack. The name is untrusted, so it is reduced to safe
 * characters and quoted.
 *
 * Calibri, and text with no font at all, draws in the BUNDLED Carlito first:
 * it is metric-compatible with Calibri and identical on every machine, so the
 * page count is too. Every other font keeps the stack it always had, and its
 * line breaks still depend on what the machine has installed.
 */
export function fontStack(name: unknown): string {
  const clean = typeof name === "string" ? name.replace(/[^A-Za-z0-9 _-]/g, "").trim() : "";
  const font = clean === "" ? DEFAULT_FONT : clean;
  const fallback = FALLBACKS[font.toLowerCase()] ?? 'Carlito, "Segoe UI", Arial, sans-serif';
  const first = font.toLowerCase() === "calibri" ? `"${CARLITO_FAMILY}", ` : "";
  return `${first}"${font}", ${fallback}`;
}

/**
 * The typography every page and the measuring copy share.
 *
 * Kerning and ligatures are OFF, as they are in Word by default (no `w:kern`,
 * no `w14:ligatures`): a line is then exactly the sum of its glyph advances,
 * which is what lets a server-side estimate (last-word `layout()`) agree with
 * this viewer. `geometricPrecision` asks for unhinted advances where a
 * platform would otherwise round them.
 */
export function typography(defaultFont: unknown, size: number): CSSProperties {
  return {
    fontFamily: fontStack(defaultFont),
    fontSize: pt(size),
    lineHeight: SINGLE_LINE,
    color: "#000000",
    textAlign: "left",
    fontKerning: "none",
    fontVariantLigatures: "none",
    textRendering: "geometricPrecision",
  };
}

export const MONO = fontStack("Consolas");

const CSS_STYLE: Record<string, string> = {
  single: "solid",
  double: "double",
  dashed: "dashed",
  dotted: "dotted",
};

/** One border edge as CSS; `none`, absent or unknown draws nothing. */
export function borderCss(b: Border | undefined): string | undefined {
  if (!b || typeof b !== "object") return undefined;
  const style = CSS_STYLE[b.style ?? "single"];
  if (!style) return "none";
  // A double rule needs room for two lines and a gap to be visible at all.
  const width = Math.max(style === "double" ? 2.25 : 0.25, num(b.width, 0.5));
  return `${pt(width)} ${style} ${hex(b.color) ?? "#000000"}`;
}

/** The paragraph box: indents, alignment, shading, borders and line height. */
export function paragraphStyle(p: ParagraphProps, size: number): CSSProperties {
  const s: CSSProperties = {
    margin: 0,
    marginLeft: pt(num(p.indentLeft, 0)),
    marginRight: pt(num(p.indentRight, 0)),
    fontSize: pt(size),
    lineHeight: num(p.lineHeight, DEFAULT_LINE_MULTIPLE) * SINGLE_LINE,
    color: "inherit",
    fontWeight: "inherit",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  };
  if (p.align === "left" || p.align === "center" || p.align === "right" || p.align === "justify") s.textAlign = p.align;
  const fill = hex(p.shading);
  if (fill) s.backgroundColor = fill;
  Object.assign(s, boxBorders(p.borders));
  return s;
}

/** Paragraph borders: the edge, plus a little padding so text does not touch the rule. */
export function boxBorders(b: BoxBorders | undefined): CSSProperties {
  if (!b || typeof b !== "object") return {};
  const s: CSSProperties = {};
  const top = borderCss(b.top);
  const right = borderCss(b.right);
  const bottom = borderCss(b.bottom);
  const left = borderCss(b.left);
  if (top) {
    s.borderTop = top;
    if (top !== "none") s.paddingTop = pt(1);
  }
  if (bottom) {
    s.borderBottom = bottom;
    if (bottom !== "none") s.paddingBottom = pt(1);
  }
  if (left) {
    s.borderLeft = left;
    if (left !== "none") s.paddingLeft = pt(4);
  }
  if (right) {
    s.borderRight = right;
    if (right !== "none") s.paddingRight = pt(4);
  }
  return s;
}

/** The space a paragraph-shaped block takes above and below its box. */
export function spacingStyle(p: ParagraphProps, defaultAfter: number, defaultBefore = 0): CSSProperties {
  return {
    display: "flow-root",
    paddingTop: pt(Math.max(0, num(p.spaceBefore, defaultBefore))),
    paddingBottom: pt(Math.max(0, num(p.spaceAfter, defaultAfter))),
  };
}
