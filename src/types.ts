/**
 * The last-word Doc as this viewer reads it.
 *
 * Declared HERE rather than imported from `@particle-academy/last-word`, for
 * two reasons. The JS package's `Page` type does not yet carry the header and
 * footer bands its own reader returns, nor the header/footer distances and
 * footnotes the PHP reference leg defined in 0.15.0, so importing it would type
 * the viewer against a narrower model than the files it renders. And a type
 * import would make last-word a dependency of every consumer for no runtime
 * benefit. These types are a structural SUPERSET: a last-word `Doc` is
 * assignable to `Doc` here (tests/compat.test.ts proves it against the real
 * package), so `<DocViewer doc={reader.read(bytes)} />` typechecks unchanged.
 *
 * Lengths are POINTS unless a name says Px.
 */

export type PageSize = "letter" | "legal" | "a4";
export type Orientation = "portrait" | "landscape";
export type Align = "left" | "center" | "right" | "justify";
export type VAlign = "top" | "center" | "bottom";
export type BorderStyle = "single" | "double" | "dashed" | "dotted" | "none";

export interface Border {
  style?: BorderStyle;
  /** Points. 0.5 (a hairline) when absent. */
  width?: number;
  /** #RRGGBB. Black when absent. */
  color?: string;
}

export interface BoxBorders {
  top?: Border;
  right?: Border;
  bottom?: Border;
  left?: Border;
}

export interface TableBorders extends BoxBorders {
  insideH?: Border;
  insideV?: Border;
}

export interface BoxSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * A footnote (last-word 0.15.0): carried by a run whose `text` is "" and which
 * sits where the reference mark goes. The model carries no number; marks are
 * numbered 1, 2, 3 in document order, as Word draws them.
 */
export interface Footnote {
  blocks: Block[];
}

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  smallCaps?: boolean;
  link?: string;
  color?: string;
  highlight?: string;
  size?: number;
  font?: string;
  letterSpacing?: number;
  footnote?: Footnote;
  [key: string]: unknown;
}

export interface ParagraphProps {
  align?: Align;
  spaceBefore?: number;
  spaceAfter?: number;
  /** A multiple of single spacing. */
  lineHeight?: number;
  indentLeft?: number;
  indentRight?: number;
  keepNext?: boolean;
  shading?: string;
  borders?: BoxBorders;
}

export interface ListItem extends ParagraphProps {
  runs: Run[];
  children?: ListItem[];
  [key: string]: unknown;
}

export interface HeadingBlock extends ParagraphProps {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  runs: Run[];
}

export interface ParagraphBlock extends ParagraphProps {
  type: "paragraph";
  runs: Run[];
}

export interface ListBlock {
  type: "list";
  ordered?: boolean;
  items: ListItem[];
}

export interface TableCell {
  blocks: Block[];
  shading?: string;
  borders?: BoxBorders;
  padding?: BoxSides;
  valign?: VAlign;
  colSpan?: number;
  /** HTML-style: the cell appears once; covered rows list only their own cells. */
  rowSpan?: number;
  [key: string]: unknown;
}

export interface TableRow {
  header?: boolean;
  cells: TableCell[];
  [key: string]: unknown;
}

export interface TableBlock {
  type: "table";
  rows: TableRow[];
  /** Relative column weights. Used only when there is one per column. */
  widths?: number[];
  /** Percent of the text column. */
  width?: number;
  align?: "left" | "center" | "right";
  borders?: TableBorders;
  cellPadding?: BoxSides;
}

export interface CodeBlock {
  type: "code";
  language?: string;
  text: string;
}

export interface QuoteBlock {
  type: "quote";
  blocks: Block[];
}

export interface ImageBlock {
  type: "image";
  src: string;
  widthPx?: number;
  heightPx?: number;
  alt?: string;
}

export interface ChartBlock {
  type: "chart";
  option: { [key: string]: unknown };
  widthPx?: number;
  heightPx?: number;
  width?: number;
  numberFormat?: string;
  alt?: string;
}

export interface PageBreakBlock {
  type: "pageBreak";
  /** Change the page from here on: see `docStretches()`. */
  page?: Page;
}

export interface HrBlock {
  type: "hr";
}

export type Block =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | CodeBlock
  | QuoteBlock
  | ImageBlock
  | ChartBlock
  | PageBreakBlock
  | HrBlock;

/** A one-line running band: left / centre / right, as Word's two tab stops lay it. */
export interface Band {
  left?: string;
  center?: string;
  right?: string;
  /** Points. 9 when absent. */
  size?: number;
  /** #RRGGBB. #6B7280 when absent. */
  color?: string;
}

/** A header or footer that holds blocks: a letterhead logo, address lines, a table. */
export interface BlocksBand {
  blocks: Block[];
}

/**
 * Page margins and the header/footer DISTANCES, in points. Anything absent is
 * the default: 72 a side, 36 to the header and the footer (Word's half inch).
 */
export interface PageMargins extends BoxSides {
  /** Points from the top edge of the page to the top of the header. */
  header?: number;
  /** Points from the bottom edge of the page to the bottom of the footer. */
  footer?: number;
}

export interface Page {
  size?: PageSize;
  orientation?: Orientation;
  margins?: PageMargins;
  /** Every page, unless a variant below covers it. */
  header?: Band | BlocksBand;
  footer?: Band | BlocksBand;
  /**
   * Page 1 only, in place of `header` / `footer` (last-word 0.16.0, Word's
   * "Different first page"). `{"blocks": []}` blanks page 1's band.
   */
  firstHeader?: Band | BlocksBand;
  firstFooter?: Band | BlocksBand;
  /**
   * Even pages (2, 4, ...), in place of `header` / `footer` (last-word 0.16.0,
   * Word's "Different odd and even pages"). `{"blocks": []}` blanks them.
   */
  evenHeader?: Band | BlocksBand;
  evenFooter?: Band | BlocksBand;
}

/** Document properties (last-word 0.16.0). */
export interface DocMeta {
  /** Word's Author property: what an `{author}` field in a band shows. */
  author?: string;
  [key: string]: unknown;
}

export interface Doc {
  /** The document title: what a `{title}` field in a band shows. */
  title?: string;
  meta?: DocMeta;
  blocks: Block[];
  page?: Page;
  defaultFont?: string;
  defaultSize?: number;
  [key: string]: unknown;
}
