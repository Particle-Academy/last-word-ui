import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { Heading, ImageViewer, Separator, Table, Text } from "@particle-academy/react-fancy";
import { substituteFields, type PageFields } from "./fields";
import { resolveImageSize } from "./image-size";
import { safeHref } from "./links";
import { PX_PER_PT } from "./geometry";
import {
  BAND_COLOR,
  BAND_SIZE,
  CODE_FILL,
  DEFAULT_SPACE_AFTER,
  FOOTNOTE_SIZE,
  HEADER_FILL,
  HEADING_SIZES,
  LINK_COLOR,
  MONO,
  QUOTE_COLOR,
  SINGLE_LINE,
  borderCss,
  fontStack,
  hex,
  num,
  paragraphStyle,
  pt,
  spacingStyle,
} from "./style";
import { columnPercents, tableGrid } from "./table-grid";
import type {
  Band,
  Block,
  BlocksBand,
  Border,
  BoxSides,
  ChartBlock,
  Footnote,
  ImageBlock,
  ListItem,
  Run,
  TableBlock,
  TableBorders,
} from "./types";

/** What a block needs from where it is drawn. */
export interface RenderContext {
  /** Footnote numbering for the body; empty in bands and in the notes themselves. */
  marks: Map<Run, number>;
  /** Set in headers and footers: `{page}` / `{pages}` become these numbers. */
  fields?: PageFields;
  /** Point size a paragraph inherits. */
  size: number;
  /** Space after a paragraph that does not say. */
  spaceAfter: number;
  /** Text column in points. */
  contentWidth: number;
  /** Runs draw bold (a table header row). */
  bold?: boolean;
}

const EMPTY_MARKS = new Map<Run, number>();
const ZWSP = String.fromCharCode(0x200b);

export const RenderCtx = createContext<RenderContext>({
  marks: EMPTY_MARKS,
  size: 11,
  spaceAfter: DEFAULT_SPACE_AFTER,
  contentWidth: 468,
});

export function WithContext({ value, children }: { value: Partial<RenderContext>; children: ReactNode }) {
  const parent = useContext(RenderCtx);
  return <RenderCtx.Provider value={{ ...parent, ...value }}>{children}</RenderCtx.Provider>;
}

// ── Runs ───────────────────────────────────────────────────────────────────

function RunView({ run }: { run: Run }) {
  const ctx = useContext(RenderCtx);
  const mark = ctx.marks.get(run);
  let text = typeof run.text === "string" ? run.text : "";
  if (ctx.fields) text = substituteFields(text, ctx.fields);

  const s: CSSProperties = {};
  if (run.bold || ctx.bold) s.fontWeight = 700;
  if (run.italic) s.fontStyle = "italic";
  const deco = [run.underline ? "underline" : "", run.strike ? "line-through" : ""].filter(Boolean).join(" ");
  if (run.smallCaps) s.fontVariant = "small-caps";
  if (typeof run.size === "number" && run.size > 0) s.fontSize = pt(run.size);
  if (typeof run.font === "string" && run.font !== "") s.fontFamily = fontStack(run.font);
  if (typeof run.letterSpacing === "number" && Number.isFinite(run.letterSpacing)) s.letterSpacing = pt(run.letterSpacing);
  if (run.code) {
    s.fontFamily = MONO;
    s.backgroundColor = CODE_FILL;
  }
  const highlight = hex(run.highlight);
  if (highlight) s.backgroundColor = highlight;
  const color = hex(run.color);
  if (color) s.color = color;

  const href = safeHref(run.link);
  let body: ReactNode = text;
  if (href) {
    body = (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: color ?? LINK_COLOR, textDecoration: "underline" }}
      >
        {text}
      </a>
    );
  } else if (deco) {
    s.textDecoration = deco;
  }
  if (href && deco.includes("line-through")) s.textDecoration = "line-through";

  return (
    <>
      {text !== "" && <span style={s}>{body}</span>}
      {mark !== undefined && (
        <sup data-lw-footnote-ref={mark} style={{ fontSize: "0.65em", lineHeight: 0 }}>
          {mark}
        </sup>
      )}
    </>
  );
}

export function Runs({ runs }: { runs: unknown }) {
  const list = Array.isArray(runs) ? (runs as Run[]) : [];
  const visible = list.some((r) => (typeof r?.text === "string" && r.text !== "") || r?.footnote);
  return (
    <>
      {list.map((run, i) => (run && typeof run === "object" ? <RunView key={i} run={run} /> : null))}
      {!visible && ZWSP}
    </>
  );
}

// ── Blocks ─────────────────────────────────────────────────────────────────

export function BlockView({ block }: { block: Block }) {
  const ctx = useContext(RenderCtx);
  switch (block?.type) {
    case "paragraph":
      return (
        <div data-lw-kind="paragraph" style={spacingStyle(block, ctx.spaceAfter)}>
          <Text as="p" style={paragraphStyle(block, ctx.size)}>
            <Runs runs={block.runs} />
          </Text>
        </div>
      );
    case "heading": {
      const level = [1, 2, 3, 4, 5, 6].includes(block.level) ? block.level : 1;
      const Tag = `h${level}` as "h1";
      return (
        <div data-lw-kind="heading" style={spacingStyle(block, 6, 12)}>
          <Heading as={Tag} weight="bold" style={{ ...paragraphStyle(block, HEADING_SIZES[level - 1]!), fontWeight: 700 }}>
            <Runs runs={block.runs} />
          </Heading>
        </div>
      );
    }
    case "list":
      return (
        <div data-lw-kind="list" style={{ display: "flow-root" }}>
          <ListLevel items={block.items} ordered={block.ordered === true} />
        </div>
      );
    case "table":
      return <TableView block={block} />;
    case "code":
      return (
        <div data-lw-kind="code" style={{ display: "flow-root" }}>
          <Text
            as="div"
            style={{
              margin: 0,
              fontFamily: MONO,
              fontSize: pt(10),
              lineHeight: SINGLE_LINE,
              backgroundColor: CODE_FILL,
              color: "inherit",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            }}
          >
            {typeof block.text === "string" && block.text !== "" ? block.text : ZWSP}
          </Text>
        </div>
      );
    case "quote":
      return (
        <div data-lw-kind="quote" style={{ display: "flow-root", marginLeft: pt(36), fontStyle: "italic", color: QUOTE_COLOR }}>
          <WithContext value={{ contentWidth: ctx.contentWidth - 36 }}>
            {(Array.isArray(block.blocks) ? block.blocks : []).map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </WithContext>
        </div>
      );
    case "image":
      return <ImageView block={block} />;
    case "chart":
      return <ChartPlaceholder block={block} />;
    case "hr":
      return (
        <div data-lw-kind="hr" style={{ display: "flow-root", paddingBottom: pt(ctx.spaceAfter) }}>
          <div style={{ height: pt(ctx.size * SINGLE_LINE), display: "flex", alignItems: "flex-end" }}>
            <Separator className="w-full" />
          </div>
        </div>
      );
    case "pageBreak":
      return null;
    default:
      return null;
  }
}

function ListLevel({ items, ordered }: { items: unknown; ordered: boolean }) {
  const ctx = useContext(RenderCtx);
  const list = Array.isArray(items) ? (items as ListItem[]) : [];
  const style: CSSProperties = {
    margin: 0,
    paddingLeft: pt(36),
    listStyleType: ordered ? "decimal" : "disc",
    fontSize: pt(ctx.size),
  };
  const children = list.map((item, i) => (
    <li key={i} style={{ paddingLeft: pt(0) }}>
      <div style={spacingStyle(item, ctx.spaceAfter)}>
        <Text as="div" style={paragraphStyle({ ...item, indentLeft: 0 }, ctx.size)}>
          <Runs runs={item?.runs} />
        </Text>
      </div>
      {Array.isArray(item?.children) && item.children.length > 0 && <ListLevel items={item.children} ordered={ordered} />}
    </li>
  ));
  return ordered ? <ol style={style}>{children}</ol> : <ul style={style}>{children}</ul>;
}

const IMAGE_SRC = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i;

function ImageView({ block }: { block: ImageBlock }) {
  const ctx = useContext(RenderCtx);
  const maxPx = ctx.contentWidth * PX_PER_PT;
  const size = resolveImageSize({ src: String(block.src ?? ""), widthPx: block.widthPx, heightPx: block.heightPx }, maxPx);
  // Only an embedded image is drawn. A remote URL in an untrusted document is
  // a request the reader never agreed to make (a tracking pixel).
  const src = typeof block.src === "string" && IMAGE_SRC.test(block.src) ? block.src : null;
  return (
    <div data-lw-kind="image" style={{ display: "flow-root", paddingBottom: pt(ctx.spaceAfter) }}>
      {src ? (
        <ImageViewer
          src={src}
          alt={typeof block.alt === "string" ? block.alt : ""}
          fit="contain"
          zoomable={false}
          pannable={false}
          controls={false}
          checkerboard={false}
          className="rounded-none bg-transparent dark:bg-transparent"
          style={{ width: size.width, height: size.height, background: "transparent", borderRadius: 0 }}
        />
      ) : (
        <div
          data-lw-image-missing=""
          style={{ width: size.width, height: size.height, border: "0.75pt dashed #9CA3AF", color: "#6B7280", fontSize: pt(9), padding: pt(4), boxSizing: "border-box" }}
        >
          {typeof block.alt === "string" && block.alt !== "" ? block.alt : "Image"}
        </div>
      )}
    </div>
  );
}

function ChartPlaceholder({ block }: { block: ChartBlock }) {
  const ctx = useContext(RenderCtx);
  const maxPx = ctx.contentWidth * PX_PER_PT;
  const width = Math.min(
    maxPx,
    num(block.widthPx, typeof block.width === "number" && block.width > 0 ? (maxPx * Math.min(100, block.width)) / 100 : maxPx),
  );
  const height = num(block.heightPx, width * 0.6);
  const option = (block.option ?? {}) as { title?: unknown };
  const title =
    typeof option.title === "string"
      ? option.title
      : option.title && typeof (option.title as { text?: unknown }).text === "string"
        ? ((option.title as { text: string }).text)
        : typeof block.alt === "string"
          ? block.alt
          : "";
  return (
    <div data-lw-kind="chart" style={{ display: "flow-root", paddingBottom: pt(ctx.spaceAfter) }}>
      <div
        data-lw-chart-placeholder=""
        style={{
          width,
          height,
          border: "0.75pt dashed #9CA3AF",
          color: "#6B7280",
          fontSize: pt(9),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        {title ? `Chart: ${title}` : "Chart"}
      </div>
    </div>
  );
}

// ── Tables ─────────────────────────────────────────────────────────────────

const DEFAULT_TABLE_BORDER: Border = { style: "single", width: 0.5 };
const DEFAULT_CELL_PADDING = { top: 3, right: 5.4, bottom: 3, left: 5.4 };
/** Word's own cell margins, for the sides a table's `cellPadding` leaves out. */
const WORD_CELL_PADDING = { top: 0, right: 5.4, bottom: 0, left: 5.4 };

function sides(base: Required<BoxSides>, over: unknown): Required<BoxSides> {
  if (!over || typeof over !== "object") return base;
  const o = over as BoxSides;
  return {
    top: num(o.top, base.top),
    right: num(o.right, base.right),
    bottom: num(o.bottom, base.bottom),
    left: num(o.left, base.left),
  };
}

/**
 * A table, or the rows of it one page shows. `rows` lists the row indices to
 * draw (header rows first on a continuation page); absent means every row.
 */
export function TableView({ block, rows }: { block: TableBlock; rows?: number[] }) {
  const ctx = useContext(RenderCtx);
  const all = Array.isArray(block.rows) ? block.rows : [];
  const grid = tableGrid(all);
  const pct = columnPercents(grid.colCount, block.widths);
  const tb: TableBorders =
    block.borders && typeof block.borders === "object"
      ? block.borders
      : {
          top: DEFAULT_TABLE_BORDER,
          right: DEFAULT_TABLE_BORDER,
          bottom: DEFAULT_TABLE_BORDER,
          left: DEFAULT_TABLE_BORDER,
          insideH: DEFAULT_TABLE_BORDER,
          insideV: DEFAULT_TABLE_BORDER,
        };
  const basePad =
    block.cellPadding && typeof block.cellPadding === "object" ? sides(WORD_CELL_PADDING, block.cellPadding) : DEFAULT_CELL_PADDING;
  const widthPct = typeof block.width === "number" && block.width > 0 ? Math.min(100, block.width) : 100;
  const show = rows ?? all.map((_, i) => i);

  return (
    <div
      data-lw-kind="table"
      style={{
        width: `${widthPct}%`,
        marginLeft: block.align === "center" || block.align === "right" ? "auto" : undefined,
        marginRight: block.align === "center" ? "auto" : undefined,
      }}
    >
      <Table data-lw-table="" className="rounded-none border-0 overflow-visible">
        <Table.Body className="divide-y-0">
          <tr data-lw-sizer="" aria-hidden="true">
            {pct.map((p, i) => (
              <td key={i} style={{ width: `${p}%`, padding: 0, border: "none", height: 0 }} />
            ))}
          </tr>
          {show.map((r) => {
            const row = all[r];
            if (!row) return null;
            const header = row.header === true;
            return (
              <Table.Row key={r} data-lw-row={r} className="hover:bg-transparent dark:hover:bg-transparent">
                {(grid.rows[r] ?? []).map((gc) => {
                  const cell = row.cells[gc.cell]!;
                  const cb = cell.borders && typeof cell.borders === "object" ? cell.borders : {};
                  const edge = (own: Border | undefined, outer: Border | undefined, inner: Border | undefined, isOuter: boolean) =>
                    borderCss(own ?? (isOuter ? outer : inner)) ?? "none";
                  const pad = sides(basePad, cell.padding);
                  const fill = hex(cell.shading) ?? (header ? HEADER_FILL : undefined);
                  const style: CSSProperties = {
                    borderTop: edge(cb.top, tb.top, tb.insideH, gc.row === 0),
                    borderBottom: edge(cb.bottom, tb.bottom, tb.insideH, gc.row + gc.rowSpan >= all.length),
                    borderLeft: edge(cb.left, tb.left, tb.insideV, gc.col === 0),
                    borderRight: edge(cb.right, tb.right, tb.insideV, gc.col + gc.colSpan >= grid.colCount),
                    padding: `${pt(pad.top)} ${pt(pad.right)} ${pt(pad.bottom)} ${pt(pad.left)}`,
                    verticalAlign: cell.valign === "center" ? "middle" : cell.valign === "bottom" ? "bottom" : "top",
                    backgroundColor: fill ?? "transparent",
                    color: "inherit",
                    fontSize: "inherit",
                    fontWeight: "inherit",
                    textAlign: "left",
                    overflowWrap: "break-word",
                  };
                  return (
                    <Table.Cell
                      key={gc.cell}
                      header={header}
                      colSpan={gc.colSpan > 1 ? gc.colSpan : undefined}
                      rowSpan={gc.rowSpan > 1 ? gc.rowSpan : undefined}
                      data-lw-cell={`${r}:${gc.cell}`}
                      style={style}
                    >
                      <WithContext
                        value={{
                          bold: header || ctx.bold,
                          contentWidth: (ctx.contentWidth * widthPct * (pct.slice(gc.col, gc.col + gc.colSpan).reduce((a, b) => a + b, 0) / 100)) / 100,
                        }}
                      >
                        {(Array.isArray(cell.blocks) ? cell.blocks : []).map((b, i) => (
                          <BlockView key={i} block={b} />
                        ))}
                      </WithContext>
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </div>
  );
}

// ── Bands + footnotes ──────────────────────────────────────────────────────

export function isBlocksBand(band: unknown): band is BlocksBand {
  return !!band && typeof band === "object" && Array.isArray((band as BlocksBand).blocks);
}

export function hasBand(band: unknown): band is Band | BlocksBand {
  if (isBlocksBand(band)) return band.blocks.length > 0;
  if (!band || typeof band !== "object") return false;
  const b = band as Band;
  return [b.left, b.center, b.right].some((s) => typeof s === "string" && s !== "");
}

/** A header or footer: a one-line band on Word's centre and right tab stops, or blocks. */
export function BandView({ band }: { band: Band | BlocksBand }) {
  const ctx = useContext(RenderCtx);
  if (isBlocksBand(band)) {
    return (
      <WithContext value={{ marks: EMPTY_MARKS }}>
        {band.blocks.map((b, i) => (b?.type === "pageBreak" || b?.type === "chart" ? null : <BlockView key={i} block={b} />))}
      </WithContext>
    );
  }
  const slot = (v: unknown): string => (typeof v === "string" ? (ctx.fields ? substituteFields(v, ctx.fields) : v) : "");
  return (
    <Text
      as="div"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        fontSize: pt(num(band.size, BAND_SIZE)),
        lineHeight: SINGLE_LINE,
        color: hex(band.color) ?? BAND_COLOR,
        whiteSpace: "pre",
      }}
    >
      <span data-lw-slot="left" style={{ textAlign: "left" }}>{slot(band.left)}</span>
      <span data-lw-slot="center" style={{ textAlign: "center" }}>{slot(band.center)}</span>
      <span data-lw-slot="right" style={{ textAlign: "right", justifySelf: "end" }}>{slot(band.right)}</span>
    </Text>
  );
}

/** One footnote as it sits at the foot of a page: its number, then its blocks at 10pt. */
export function FootnoteView({ id, footnote }: { id: number; footnote: Footnote }) {
  return (
    <div data-footnote={id} style={{ display: "flex", gap: pt(3) }}>
      <sup style={{ fontSize: pt(FOOTNOTE_SIZE * 0.65), lineHeight: 1, paddingTop: pt(2) }}>{id}</sup>
      <div style={{ flex: 1, minWidth: 0 }}>
        <WithContext value={{ marks: EMPTY_MARKS, size: FOOTNOTE_SIZE, spaceAfter: 0 }}>
          {(Array.isArray(footnote.blocks) ? footnote.blocks : []).map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </WithContext>
      </div>
    </div>
  );
}

/** The short rule above a page's footnotes; its box is FOOTNOTE_SEPARATOR_PT tall. */
export function FootnoteSeparator({ height }: { height: string }) {
  return (
    <div data-lw-footnote-separator="" style={{ height, display: "flex", alignItems: "center" }}>
      <div style={{ width: pt(144), borderTop: `${pt(0.5)} solid #000000` }} />
    </div>
  );
}
