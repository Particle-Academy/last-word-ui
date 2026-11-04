import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Callout } from "@particle-academy/react-fancy";
import { BAND_SLOTS, bandSlot, pageBand, pageClassIn, slotBand, type BandKind, type PageClass } from "./bands";
import { resolveNow, type PageFields } from "./fields";
import { numberFootnotes, type FootnoteNumbering } from "./footnotes";
import { LAYOUT_NOTICE, unshownLayout } from "./layout-notice";
import { PX_PER_PT, type BodyBox, type PageGeometry } from "./geometry";
import { blockId, measure } from "./measure";
import { paginate, type Fragment, type PageLayout } from "./paginate";
import { blockStretches, docStretches, packInput, type Stretch } from "./stretches";
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
import { carlitoUrls } from "./font-urls";
import { carlitoFaces, fontFaceCss } from "./fonts";
import { DEFAULT_SIZE, DEFAULT_SPACE_AFTER, FOOTNOTE_SEPARATOR_PT, num, pt, px, typography as typographyStyle } from "./style";
import { VIEWER_CSS } from "./viewer-css";
import type { Block, Doc, TableBlock } from "./types";

export interface DocViewerLayout {
  /** Number of pages the document laid out to. */
  pages: number;
  /** The first page's size in points, orientation applied. */
  pageWidth: number;
  pageHeight: number;
  /** Every page's size, when the document's page changes partway. */
  pageSizes?: Array<{ width: number; height: number }>;
  /** The scale the pages are drawn at. */
  scale: number;
  /**
   * What Calibri and unspecified text was measured in. `"carlito"`: the
   * bundled font, so the page count is the same on every machine (and agrees
   * with last-word's `layout()`). `"fallback"`: it could not load (or the
   * runtime has no FontFaceSet), so the count depends on this machine's fonts.
   * `"unused"`: the document has no such text.
   */
  font: ViewerFont;
  /**
   * JSON Pointers to page layout the document asks for and this viewer does not
   * show (`page` on a nested break, page keys straight on a break, a top-level `sections`).
   * Absent when there is none. The visible notice says the same thing.
   */
  notShown?: string[];
}

export type ViewerFont = "carlito" | "fallback" | "unused";

/** How long the viewer waits for the bundled font before laying out without it. */
export const FONT_LOAD_TIMEOUT_MS = 3000;

/** The injected @font-face rules, or null where the font URLs cannot be resolved (CommonJS). */
const FONT_CSS: string | null = (() => {
  const urls = carlitoUrls();
  return urls ? fontFaceCss((file) => urls[file]!) : null;
})();

type FontState = ViewerFont | "pending";

function initialFontState(faces: string[]): FontState {
  if (faces.length === 0) return "unused";
  const fonts = typeof document !== "undefined" ? document.fonts : undefined;
  return fonts && typeof fonts.load === "function" ? "pending" : "fallback";
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
  /**
   * What a `{filename}` field in a header or footer shows. The viewer cannot
   * know the file's name, so it is empty unless given.
   */
  filename?: string;
  /**
   * The moment `{date}` / `{time}` fields show: a Date or an ISO-8601 string
   * (JSON-friendly). Default: the time of the first render. Pass it for
   * deterministic output (tests, agents, a print preview "as of" a date).
   */
  now?: Date | string;
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
  /** Per stretch, the body box of each page class: its bands can differ, so its body can too. */
  boxes: Record<PageClass, BodyBox>[];
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
 * document order); each footnote `data-footnote`; bands `data-lw-band`, with
 * `data-lw-band-variant` naming the one drawn (`default`, `first`, `even`);
 * `data-lw-layout-notice` when the document asks for page layout it does not show.
 * A `pageBreak` carrying `page` changes the page from there on, each page drawn and
 * its text measured at its own size.
 *
 * Header and footer text takes field tokens -- `{page}`, `{pages}`,
 * `{section}`, `{sectionpages}`, `{author}`, `{title}`, `{filename}`, `{date}`,
 * `{time}`, `{date:FORMAT}`, `{time:FORMAT}` -- drawn as plain text. In the
 * body they stay literal.
 */
export function DocViewer({
  doc,
  fit = "width",
  scale: fixedScale,
  maxScale = 1,
  gap = 16,
  filename,
  now,
  onLayout,
  injectStyles = true,
  id,
  className,
  style,
}: DocViewerProps) {
  const stretches = useMemo(() => docStretches(doc), [doc]);
  const geometry = stretches[0]!.geometry;
  const numbering = useMemo(() => numberFootnotes(doc), [doc]);
  const blocks: Block[] = useMemo(() => (Array.isArray(doc?.blocks) ? doc.blocks : []), [doc]);
  const blockStretch = useMemo(() => blockStretches(stretches, blocks.length), [stretches, blocks]);
  // Which stretch each footnote is in: it sets at the width of the page holding its mark.
  const noteStretch = useMemo(() => {
    const out = new Map<number, number>();
    let id = 0;
    blocks.forEach((block, i) => {
      for (let n = numberFootnotes({ blocks: [block] } as Doc).notes.length; n > 0; n--) out.set(++id, blockStretch[i]!);
    });
    return out;
  }, [blocks, blockStretch]);
  // Keyed by value, so a parent passing a fresh Date each render does not re-lay out.
  const nowKey = now instanceof Date ? now.getTime() : now;
  const nowDate = useMemo(() => resolveNow(nowKey === undefined ? undefined : typeof nowKey === "number" ? new Date(nowKey) : nowKey), [nowKey]);
  const author = doc?.meta && typeof doc.meta === "object" ? doc.meta.author : undefined;
  const title = doc?.title;
  // Everything a band field shows except the page numbers. Shared by the
  // measuring copy and the pages, so both render the same text.
  const docFields: Omit<PageFields, "page" | "pages"> = useMemo(
    () => ({
      ...(typeof author === "string" ? { author } : {}),
      ...(typeof title === "string" ? { title } : {}),
      ...(typeof filename === "string" ? { filename } : {}),
      now: nowDate,
    }),
    [author, title, filename, nowDate],
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  // The bundled Carlito faces this document draws. Nothing is measured until
  // they have loaded: measuring with the fallback first would report a page
  // count that changes a moment later.
  const faces = useMemo(() => carlitoFaces(doc), [doc]);
  const facesKey = faces.join("|");
  const [font, setFont] = useState<FontState>(() => initialFontState(faces));
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
  // The context a stretch's blocks render in: the same marks, its own text width.
  const ctxOf = (k: number): RenderContext => ({ ...ctx, contentWidth: stretches[k]!.geometry.contentWidth });

  useEffect(() => {
    const state = initialFontState(faces);
    setFont(state);
    if (state !== "pending") return;
    let live = true;
    const timer = setTimeout(() => live && setFont((f) => (f === "pending" ? "fallback" : f)), FONT_LOAD_TIMEOUT_MS);
    Promise.all(faces.map((f) => document.fonts.load(f)))
      .then((loaded) => live && setFont(loaded.every((l) => l.length > 0) ? "carlito" : "fallback"))
      .catch(() => live && setFont("fallback"));
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // facesKey stands for faces: a new Doc object with the same faces does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facesKey]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el || font === "pending") return;
    const m = measure(el, blocks, stretches.length);
    // One body box per page class, from the bands that class actually draws.
    const input = packInput(stretches, m);
    const pages = paginate(input.items, input.options);
    const heights = m.items.map((it) => (it.type === "block" ? it.height : 0));
    setLayout({ pages, boxes: input.boxes, heights });
  }, [blocks, stretches, numbering, fontEpoch, docFields, font]);

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

  // One scale for every page, so a landscape sheet fits and the text stays one size.
  const pageWpx = Math.max(...stretches.map((s) => s.geometry.width)) * PX_PER_PT;
  const scale =
    typeof fixedScale === "number" && fixedScale > 0
      ? fixedScale
      : fit === "none" || !width
        ? 1
        : Math.min(maxScale, width / pageWpx);

  const notShown = useMemo(() => unshownLayout(doc), [doc]);

  const pageCount = layout?.pages.length ?? 0;
  useEffect(() => {
    if (layout && font !== "pending") {
      onLayout?.({
        pages: layout.pages.length,
        pageWidth: geometry.width,
        pageHeight: geometry.height,
        ...(stretches.length > 1
          ? { pageSizes: layout.pages.map((p) => ({ width: stretches[p.stretch ?? 0]!.geometry.width, height: stretches[p.stretch ?? 0]!.geometry.height })) }
          : {}),
        scale,
        font,
        ...(notShown.length > 0 ? { notShown } : {}),
      });
    }
  }, [layout, geometry, stretches, scale, onLayout, font, notShown]);

  const typography: CSSProperties = typographyStyle(doc?.defaultFont, ctx.size);
  const ready = layout !== null && font !== "pending";

  return (
    <div
      ref={rootRef}
      id={id}
      data-lw-viewer=""
      data-lw-pages={(ready && pageCount) || undefined}
      data-lw-font={ready ? font : undefined}
      className={className}
      style={{ position: "relative", ...style }}
    >
      {injectStyles && (
        <style href="particle-academy-last-word-ui" precedence="default">
          {VIEWER_CSS}
        </style>
      )}
      {injectStyles && FONT_CSS && (
        <style href="particle-academy-last-word-ui-fonts" precedence="default">
          {FONT_CSS}
        </style>
      )}

      {/* Outside the measuring copy and the sheets, so it moves no page break. */}
      {notShown.length > 0 && (
        <div data-lw-layout-notice="" style={{ marginBottom: gap }}>
          <Callout color="amber">{LAYOUT_NOTICE}</Callout>
        </div>
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
          {stretches.flatMap((stretch, k) =>
            (["header", "footer"] as const).flatMap((kind) =>
              BAND_SLOTS.map((slot) => {
                const band = slotBand(stretch.page, kind, slot);
                if (!hasBand(band)) return null;
                // Measured as a page of its class draws it: page 1, or page 2 for an even band.
                const n = slot === "even" ? 2 : 1;
                const at = k === 0 ? `${kind}:${slot}` : `${k + 1}:${kind}:${slot}`;
                return (
                  <div key={at} data-lw-measure-band={at} style={stretches.length > 1 ? { width: pt(stretch.geometry.contentWidth) } : undefined}>
                    <RenderCtx.Provider value={{ ...ctxOf(k), fields: { ...docFields, section: k + 1, page: n, pages: n } }}>
                      <BandView band={band} />
                    </RenderCtx.Provider>
                  </div>
                );
              }),
            ),
          )}
          {blocks.map((b, i) => {
            const k = blockStretch[i]!;
            return (
              <div
                key={i}
                data-lw-measure-block={i}
                style={{ display: "flow-root", ...(stretches.length > 1 ? { width: pt(stretches[k]!.geometry.contentWidth) } : {}) }}
              >
                <RenderCtx.Provider value={ctxOf(k)}>
                  <BlockView block={b} />
                </RenderCtx.Provider>
              </div>
            );
          })}
          {numbering.notes.map((n) => {
            const k = noteStretch.get(n.id) ?? 0;
            return (
              <div key={n.id} data-lw-measure-footnote={n.id} style={stretches.length > 1 ? { width: pt(stretches[k]!.geometry.contentWidth) } : undefined}>
                <RenderCtx.Provider value={ctxOf(k)}>
                  <FootnoteView id={n.id} footnote={n.footnote} />
                </RenderCtx.Provider>
              </div>
            );
          })}
          {numbering.notes.length > 0 && (
            <div data-lw-measure-separator="">
              <FootnoteSeparator height={pt(FOOTNOTE_SEPARATOR_PT)} />
            </div>
          )}
        </RenderCtx.Provider>
      </div>

      {ready && layout && (
        <div data-lw-page-stack="" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap }}>
          {layout.pages.map((p) => {
            const k = p.stretch ?? 0;
            const inStretch = layout.pages.filter((x) => (x.stretch ?? 0) === k);
            const start = inStretch[0]!.index;
            return (
              <PageView
                key={p.index}
                page={p}
                pages={layout.pages.length}
                section={k + 1}
                sectionPages={inStretch.length}
                start={start}
                stretch={stretches[k]!}
                box={layout.boxes[k]![pageClassIn(p.index, start)]}
                scale={scale}
                typography={typography}
                ctx={ctxOf(k)}
                docFields={docFields}
                numbering={numbering}
                blocks={blocks}
                heights={layout.heights}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PageViewProps {
  page: PageLayout;
  pages: number;
  section: number;
  sectionPages: number;
  /** The index of the first page of this page's stretch. */
  start: number;
  stretch: Stretch;
  box: BodyBox;
  scale: number;
  typography: CSSProperties;
  ctx: RenderContext;
  docFields: Omit<PageFields, "page" | "pages">;
  numbering: FootnoteNumbering;
  blocks: Block[];
  heights: number[];
}

function PageView({ page, pages, section, sectionPages, start, stretch, box, scale, typography, ctx, docFields, numbering, blocks, heights }: PageViewProps) {
  const n = page.index + 1;
  const g: PageGeometry = stretch.geometry;
  const docPage = stretch.page;
  const bandCtx = { ...ctx, fields: { ...docFields, page: n, pages, section, sectionPages } };
  const cls = pageClassIn(page.index, start);
  const header = pageBand(docPage, "header", page.index, start);
  const footer = pageBand(docPage, "footer", page.index, start);
  const variant = (kind: BandKind) => bandSlot(docPage, kind, cls);
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
            data-lw-band-variant={variant("header")}
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
            data-lw-band-variant={variant("footer")}
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
