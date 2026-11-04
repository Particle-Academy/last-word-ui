/**
 * The agreement harness: renders a Doc in the real DocViewer and reports what
 * it drew, for the goldens last-word's `layout()` is held to.
 *
 * Driven from Playwright: `await window.lwRender(doc)` resolves once the
 * viewer has laid out in the bundled Carlito (`font: "carlito"`), with the
 * page count, the top-level block each page starts with, and the measured
 * inputs the packer saw (block heights, line breakpoints, band heights), so a
 * disagreement can be traced to the block that caused it.
 */
import { createRoot } from "react-dom/client";
import { DocViewer, docStretches, packInput, type Doc, type DocViewerLayout, type PackItem, type PackOptions } from "../src";
import { lineBreakpoints, measure } from "../src/measure";

interface Result {
  pages: number;
  font: DocViewerLayout["font"];
  pageStarts: Array<number | null>;
  pageBlocks: number[][];
  continued: boolean[];
  heights: Record<string, number>;
  bands: Record<string, number>;
  breakpoints: Record<string, number[]>;
  rows: Record<string, number[]>;
  /** The packer's input exactly as DocViewer builds it: what paginate() was given. */
  items: PackItem[];
  options: PackOptions;
}

const host = document.getElementById("root")!;
const root = createRoot(host);

function collect(layout: DocViewerLayout, doc: Doc): Result {
  // Re-measure the measuring copy the way DocViewer does, for the packer input.
  const stretches = docStretches(doc);
  const m = measure(host.querySelector<HTMLElement>("[data-lw-measure]")!, Array.isArray(doc.blocks) ? doc.blocks : [], stretches.length);
  const { items, options } = packInput(stretches, m);
  const pages = Array.from(host.querySelectorAll<HTMLElement>("[data-page]"));
  const pageBlocks = pages.map((p) =>
    Array.from(p.querySelectorAll<HTMLElement>("[data-lw-content] > [data-block]")).map((b) => Number(b.dataset.block!.slice(1))),
  );
  const continued = pages.map((p) => {
    const first = p.querySelector<HTMLElement>("[data-lw-content] > [data-block]");
    if (!first) return false;
    const frag = first.dataset.lwFragment;
    if (frag) return !frag.startsWith("0-");
    return first.hasAttribute("data-lw-repeated-header");
  });
  const heights: Record<string, number> = {};
  const breakpoints: Record<string, number[]> = {};
  const rowHeights: Record<string, number[]> = {};
  host.querySelectorAll<HTMLElement>("[data-lw-measure-block]").forEach((el) => {
    const i = el.dataset.lwMeasureBlock!;
    const r = el.getBoundingClientRect();
    heights[i] = r.height;
    const rows = Array.from(el.querySelectorAll<HTMLElement>("tr[data-lw-row]"));
    if (rows.length) rowHeights[i] = rows.map((tr) => tr.getBoundingClientRect().height);
    else breakpoints[i] = lineBreakpoints(el);
  });
  const bands: Record<string, number> = {};
  host.querySelectorAll<HTMLElement>("[data-lw-measure-band]").forEach((el) => {
    bands[el.dataset.lwMeasureBand!] = el.getBoundingClientRect().height;
  });
  const sep = host.querySelector<HTMLElement>("[data-lw-measure-separator]");
  if (sep) bands.separator = sep.getBoundingClientRect().height;
  host.querySelectorAll<HTMLElement>("[data-lw-measure-footnote]").forEach((el) => {
    bands[`footnote:${el.dataset.lwMeasureFootnote}`] = el.getBoundingClientRect().height;
  });
  return {
    pages: layout.pages,
    font: layout.font,
    pageStarts: pageBlocks.map((b) => (b.length ? b[0]! : null)),
    pageBlocks,
    continued,
    heights,
    bands,
    breakpoints,
    rows: rowHeights,
    items,
    options,
  };
}

(window as unknown as { lwRender: (doc: Doc) => Promise<Result> }).lwRender = (doc: Doc) =>
  new Promise<Result>((resolve) => {
    let done = false;
    const onLayout = (layout: DocViewerLayout) => {
      if (done) return;
      // Wait for the bundled font; a fallback layout is not a golden.
      if (layout.font === "carlito" || layout.font === "unused") {
        done = true;
        // Let the pages commit before reading them.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(collect(layout, doc))));
      }
    };
    root.render(<DocViewer key={Math.random()} doc={doc} fit="none" now="2026-11-01T09:00:00Z" onLayout={onLayout} />);
  });
