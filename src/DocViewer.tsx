import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { numberFootnotes, type FootnoteNumbering } from "./footnotes";
import { PX_PER_PT, bodyBox, pageGeometry, type BodyBox, type PageGeometry } from "./geometry";
import { blockId, measure } from "./measure";
import { paginate, type Fragment, type PageLayout } from "./paginate";
import {
  BandView,
  BlockView,
  FootnoteSeparator,
  FootnoteView,
  RenderCtx,
  TableView,
  hasBand,
  type RenderContext,
} from "./render";
import { DEFAULT_SIZE, DEFAULT_SPACE_AFTER, FOOTNOTE_SEPARATOR_PT, SINGLE_LINE, fontStack, num, pt, px } from "./style";
import { VIEWER_CSS } from "./viewer-css";
import type { Band, Block, BlocksBand, Doc, TableBlock } from "./types";

export interface DocViewerLayout {
  /** Number of pages the document laid out to. */
  pages: number;
  /** Page size in points, orientation applied. */
  pageWidth: number;
  pageHeight: number;
  /** The scale the pages are drawn at. */
  scale: number;
}

export interface DocViewerProps {
  /** The document: last-word JSON, e.g. `new DocxReader().read(bytes)`. */
  doc: Doc;
  /**
   * `"width"` (default) scales each page down to the viewer's width -- a
   * narrow preview panel shows whole pages, never reflowed text. `"none"`
   * draws pages at 100%.
   */
  fit?: "width" | "none";
  /** A fixed scale (1 = 100%). Overrides `fit`. */
  scale?: number;
  /** The largest scale `fit: "width"` will use. Default 1, so a wide panel does not enlarge the page. */
  maxScale?: number;
  /** Space between pages, in CSS px. Default 16. */
  gap?: number;
  /** Called after every layout with JSON-serializable facts about it. */
  onLayout?: (layout: DocViewerLayout) => void;
  /**
   * Render the viewer's small stylesheet as a React 19 hoisted `<style>`.
   * Default true. Set false under a strict CSP and import
   * `@particle-academy/last-word-ui/styles.css` instead.
   */
  injectStyles?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

interface Layout {
  pages: PageLayout[];
  box: BodyBox;
  /** Measured block heights (px), by item index, to tell a whole block from a fragment. */
  heights: number[];
}

/**
 * A read-only, paged view of a last-word Doc: every page at its paper size,
 * broken by content height, with the header and footer at their distances,
 * live page numbers and footnotes at the foot of the page that holds the mark.
 *
 * Stable handles: the root carries `data-lw-viewer`; each page `data-page`
 * (1-based); each block or fragment of one `data-block` (`b0`, `b1`, ... in
 * document order); each footnote `data-footnote`; bands `data-lw-band`.
 */
export function DocViewer({
  doc,
  fit = "width",
  scale: fixedScale,
  maxScale = 1,
  gap = 16,
  onLayout,
  injectStyles = true,
  id,
  className,
  style,
}: DocViewerProps) {
  const geometry = useMemo(() => pageGeometry(doc), [doc]);
  const numbering = useMemo(() => numberFootnotes(doc), [doc]);
  const blocks: Block[] = useMemo(() => (Array.isArray(doc?.blocks) ? doc.blocks : []), [doc]);
  const header = hasBand(doc?.page?.header) ? doc.page!.header! : null;
  const footer = hasBand(doc?.page?.footer) ? doc.page!.footer! : null;

  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [width, setWidth] = useState<number | null>(null);

  const ctx: RenderContext = useMemo(
    () => ({
      marks: numbering.marks,
      size: num(doc?.defaultSize, DEFAULT_SIZE),
      spaceAfter: DEFAULT_SPACE_AFTER,
      contentWidth: geometry.contentWidth,
    }),
    [numbering, doc, geometry],
  );

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const m = measure(el, blocks);
    const box = bodyBox(geometry, m.headerHeight / PX_PER_PT, m.footerHeight / PX_PER_PT);
    const pages = paginate(m.items, { pageHeight: box.height * PX_PER_PT, footnoteSeparator: m.footnoteSeparator });
    const heights = m.items.map((it) => (it.type === "block" ? it.height : 0));
    setLayout({ pages, box, heights });
  }, [blocks, geometry, numbering, fontEpoch, header, footer]);

  // Web fonts change line breaks; lay out again once they have loaded.
  useEffect(() => {
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    let live = true;
    fonts?.ready?.then(() => live && setFontEpoch((e) => e + 1)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setWidth(el.clientWidth || null);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWpx = geometry.width * PX_PER_PT;
  const scale =
    typeof fixedScale === "number" && fixedScale > 0
      ? fixedScale
      : fit === "none" || !width
        ? 1
        : Math.min(maxScale, width / pageWpx);

  const pageCount = layout?.pages.length ?? 0;
  useEffect(() => {
    if (layout) onLayout?.({ pages: layout.pages.length, pageWidth: geometry.width, pageHeight: geometry.height, scale });
  }, [layout, geometry, scale, onLayout]);

  const typography: CSSProperties = {
    fontFamily: fontStack(doc?.defaultFont),
    fontSize: pt(ctx.size),
    lineHeight: SINGLE_LINE,
    color: "#000000",
    textAlign: "left",
  };

  return (
    <div
      ref={rootRef}
      id={id}
      data-lw-viewer=""
      data-lw-pages={pageCount || undefined}
      className={className}
      style={{ position: "relative", ...style }}
    >
      {injectStyles && (
        <style href="particle-academy-last-word-ui" precedence="default">
          {VIEWER_CSS}
        </style>
      )}

      {/* Hidden measuring copy at the text width: the packer's only input. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        data-lw-measure=""
        style={{
          ...typography,
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          left: -100000,
          top: 0,
          width: pt(geometry.contentWidth),
        }}
      >
        <RenderCtx.Provider value={ctx}>
          {header && (
            <div data-lw-measure-header="">
              <RenderCtx.Provider value={{ ...ctx, fields: { page: 1, pages: 1 } }}>
                <BandView band={header} />
              </RenderCtx.Provider>
            </div>
          )}
          {footer && (
            <div data-lw-measure-footer="">
              <RenderCtx.Provider value={{ ...ctx, fields: { page: 1, pages: 1 } }}>
                <BandView band={footer} />
              </RenderCtx.Provider>
            </div>
          )}
          {blocks.map((b, i) => (
            <div key={i} data-lw-measure-block={i} style={{ display: "flow-root" }}>
              <BlockView block={b} />
            </div>
          ))}
          {numbering.notes.map((n) => (
            <div key={n.id} data-lw-measure-footnote={n.id}>
              <FootnoteView id={n.id} footnote={n.footnote} />
            </div>
          ))}
          {numbering.notes.length > 0 && (
            <div data-lw-measure-separator="">
              <FootnoteSeparator height={pt(FOOTNOTE_SEPARATOR_PT)} />
            </div>
          )}
        </RenderCtx.Provider>
      </div>

      {layout && (
        <div data-lw-page-stack="" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap }}>
          {layout.pages.map((page) => (
            <PageView
              key={page.index}
              page={page}
              pages={layout.pages.length}
              geometry={geometry}
              box={layout.box}
              scale={scale}
              typography={typography}
              ctx={ctx}
              header={header}
              footer={footer}
              numbering={numbering}
              blocks={blocks}
              heights={layout.heights}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PageViewProps {
  page: PageLayout;
  pages: number;
  geometry: PageGeometry;
  box: BodyBox;
  scale: number;
  typography: CSSProperties;
  ctx: RenderContext;
  header: Band | BlocksBand | null;
  footer: Band | BlocksBand | null;
  numbering: FootnoteNumbering;
  blocks: Block[];
  heights: number[];
}

function PageView({ page, pages, geometry, box, scale, typography, ctx, header, footer, numbering, blocks, heights }: PageViewProps) {
  const n = page.index + 1;
  const g = geometry;
  const bandCtx = { ...ctx, fields: { page: n, pages } };
  const notes = page.footnotes
    .map((fid) => numbering.notes.find((x) => x.id === fid))
    .filter((x): x is FootnoteNumbering["notes"][number] => !!x);
  return (
    <div
      data-page={n}
      data-lw-page-of={pages}
      style={{ width: px(g.width * PX_PER_PT * scale), height: px(g.height * PX_PER_PT * scale), flex: "none" }}
    >
      <div
        data-lw-sheet=""
        style={{
          ...typography,
          position: "relative",
          width: pt(g.width),
          height: pt(g.height),
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: "top left",
          backgroundColor: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {header && (
          <div
            data-lw-band="header"
            style={{ position: "absolute", top: pt(g.margins.header), left: pt(g.margins.left), width: pt(g.contentWidth) }}
          >
            <RenderCtx.Provider value={bandCtx}>
              <BandView band={header} />
            </RenderCtx.Provider>
          </div>
        )}

        <div
          data-lw-body=""
          style={{
            position: "absolute",
            top: pt(box.top),
            left: pt(g.margins.left),
            width: pt(g.contentWidth),
            height: pt(box.height),
            display: "flex",
            flexDirection: "column",
          }}
        >
          <RenderCtx.Provider value={ctx}>
            <div data-lw-content="">
              {page.fragments.map((f, i) => (
                <FragmentView key={i} fragment={f} block={blocks[f.item]!} whole={heights[f.item] ?? 0} />
              ))}
            </div>
            {notes.length > 0 && (
              <div data-lw-footnotes="" style={{ marginTop: "auto" }}>
                <FootnoteSeparator height={pt(FOOTNOTE_SEPARATOR_PT)} />
                {notes.map((x) => (
                  <FootnoteView key={x.id} id={x.id} footnote={x.footnote} />
                ))}
              </div>
            )}
          </RenderCtx.Provider>
        </div>

        {footer && (
          <div
            data-lw-band="footer"
            style={{ position: "absolute", bottom: pt(g.margins.footer), left: pt(g.margins.left), width: pt(g.contentWidth) }}
          >
            <RenderCtx.Provider value={bandCtx}>
              <BandView band={footer} />
            </RenderCtx.Provider>
          </div>
        )}
      </div>
    </div>
  );
}

function FragmentView({ fragment, block, whole }: { fragment: Fragment; block: Block; whole: number }): ReactNode {
  const id = blockId(fragment.item);
  if (fragment.type === "table") {
    return (
      <div
        data-block={id}
        data-lw-rows={fragment.rows.join(",")}
        data-lw-repeated-header={fragment.repeatedHeader ? "" : undefined}
        data-lw-overflow={fragment.overflow ? "" : undefined}
      >
        <TableView block={block as TableBlock} rows={fragment.rows} />
      </div>
    );
  }
  const isWhole = fragment.start <= 0.001 && fragment.end >= whole - 0.001;
  if (isWhole) {
    return (
      <div data-block={id} style={{ display: "flow-root" }}>
        <BlockView block={block} />
      </div>
    );
  }
  // A piece of a block split across pages: the whole block, windowed.
  return (
    <div
      data-block={id}
      data-lw-fragment={`${Math.round(fragment.start)}-${Math.round(fragment.end)}`}
      data-lw-forced={fragment.forced ? "" : undefined}
      style={{ height: px(fragment.end - fragment.start), overflow: "hidden" }}
    >
      <div style={{ display: "flow-root", marginTop: px(-fragment.start) }}>
        <BlockView block={block} />
      </div>
    </div>
  );
}
