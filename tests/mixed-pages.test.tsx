/**
 * Mixed page orientation, stage 2: a `pageBreak` carrying `page` changes the page from
 * there on. jsdom has no layout, so structure and the packer are pinned here and real
 * breaks by the agreement fixture recorded in Chromium.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, paginate, pageCapacity, unshownLayout, type DocViewerLayout, type PackItem, type PackOptions } from "../src";
import { bandSlot, pageBand, pageClass, pageClassIn } from "../src/bands";
import { blockStretches, docStretches } from "../src/stretches";
import type { Doc } from "../src/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const para = (text: string) => ({ type: "paragraph" as const, runs: [{ text }] });
const asDoc = (doc: unknown) => doc as Doc;
const mixed = asDoc({
  title: "T",
  page: { header: { left: "H" }, footer: { left: "{section}/{sectionpages}", right: "{page}/{pages}" } },
  blocks: [
    para("one"),
    { type: "pageBreak" },
    para("two"),
    { type: "pageBreak", page: { orientation: "landscape", margins: { left: 36, right: 36 } } },
    para("three"),
  ],
});

async function render(doc: Doc): Promise<DocViewerLayout> {
  const onLayout = vi.fn();
  await act(async () => {
    root.render(<DocViewer doc={doc} fit="none" onLayout={onLayout} />);
  });
  return onLayout.mock.calls.at(-1)![0] as DocViewerLayout;
}

describe("docStretches", () => {
  it("merges margins side by side and replaces every other key whole", () => {
    const s = docStretches(
      asDoc({
        page: { margins: { top: 10, left: 20 }, header: { left: "a", right: "b" } },
        blocks: [{ type: "pageBreak", page: { margins: { left: 30 }, header: { right: "c" } } }],
      }),
    );
    expect(s[1]!.page!.margins).toEqual({ top: 10, left: 30 });
    expect(s[1]!.page!.header).toEqual({ right: "c" });
    expect(s[1]!.breakAt).toBe(0);
  });

  it("never inherits the first bands", () => {
    const s = docStretches(
      asDoc({
        page: { firstHeader: { left: "cover" }, firstFooter: { left: "cf" }, header: { left: "run" } },
        blocks: [{ type: "pageBreak", page: {} }, { type: "pageBreak", page: { firstHeader: { left: "x" } } }, { type: "pageBreak", page: {} }],
      }),
    );
    expect(Object.keys(s[1]!.page!)).toEqual(["header"]);
    expect(s[2]!.page!.firstHeader).toEqual({ left: "x" });
    expect(s[3]!.page!.firstHeader).toBeUndefined();
  });

  it("takes an empty page that came through PHP's JSON as []", () => {
    expect(docStretches(asDoc({ blocks: [{ type: "pageBreak", page: [] }] }))).toHaveLength(2);
  });

  it("a plain or a nested break starts no stretch", () => {
    expect(docStretches(asDoc({ blocks: [{ type: "pageBreak" }, { type: "quote", blocks: [{ type: "pageBreak", page: {} }] }] }))).toHaveLength(1);
  });

  it("gives each stretch its geometry, and portrait does not return by itself", () => {
    const s = docStretches(asDoc({ blocks: [{ type: "pageBreak", page: { orientation: "landscape" } }, { type: "pageBreak", page: {} }] }));
    expect(s.map((x) => [x.geometry.width, x.geometry.height])).toEqual([[612, 792], [792, 612], [792, 612]]);
  });

  it("knows which stretch each block is in", () => {
    expect(blockStretches(docStretches(mixed), 5)).toEqual([0, 0, 0, 1, 1]);
  });
});

describe("page classes", () => {
  it("a stretch's first page is first, or first-and-even, whatever its number", () => {
    expect(pageClass(0)).toBe("first");
    expect(pageClass(1)).toBe("even");
    expect(pageClass(2)).toBe("odd");
    expect(pageClassIn(2, 2)).toBe("first");
    expect(pageClassIn(3, 3)).toBe("firstEven");
    expect(pageClassIn(4, 3)).toBe("odd");
  });

  it("a first page on an even number takes the first band, else the even one, per kind", () => {
    const page = asDoc({ page: { header: { left: "d" }, evenHeader: { left: "e" }, firstHeader: { left: "f" }, footer: { left: "d" }, evenFooter: { left: "e" } } }).page;
    expect(bandSlot(page, "header", "firstEven")).toBe("first");
    expect(bandSlot(page, "footer", "firstEven")).toBe("even");
    expect(pageBand(page, "footer", 3, 3)).toEqual({ left: "e" });
    expect(pageBand(page, "header", 3, 3)).toEqual({ left: "f" });
  });
});

describe("the packer", () => {
  const block = (id: string, height: number): PackItem => ({ type: "block", id, height });
  const stretch = { pageHeight: 100, firstPageHeight: 50, firstEvenPageHeight: 40, evenPageHeight: 70 };

  it("a break with a stretch moves to its heights, numbering pages on", () => {
    const items: PackItem[] = [block("a", 10), { type: "break", stretch }, block("b", 10), block("c", 45), block("d", 40)];
    const pages = paginate(items, { pageHeight: 500, firstPageHeight: 500, evenPageHeight: 500 });
    expect(pages.map((p) => p.capacity)).toEqual([500, 40, 100]);
    expect(pages.map((p) => p.stretch ?? 0)).toEqual([0, 1, 1]);
    expect(pages.map((p) => p.fragments.map((f) => f.item))).toEqual([[0], [2], [3, 4]]);
  });

  it("an odd page takes firstPageHeight, an even one firstEvenPageHeight", () => {
    const opts: PackOptions = { pageHeight: 100, firstPageHeight: 50, firstEvenPageHeight: 40, evenPageHeight: 70 };
    expect(pageCapacity(opts, 2, 2)).toBe(50);
    expect(pageCapacity(opts, 3, 3)).toBe(40);
    expect(pageCapacity(opts, 3, 2)).toBe(70);
    expect(pageCapacity(opts, 4, 2)).toBe(100);
  });

  it("a plain break keeps the heights it had, and a document with none packs as it did", () => {
    const pages = paginate([block("a", 10), { type: "break" }, block("b", 10)], { pageHeight: 100, firstPageHeight: 50, evenPageHeight: 70 });
    expect(pages.map((p) => p.capacity)).toEqual([50, 70]);
    expect(pages[1]!.stretch).toBeUndefined();
  });
});

describe("the viewer", () => {
  it("draws each page at its own size, and says so", async () => {
    const layout = await render(mixed);
    const sheets = Array.from(host.querySelectorAll<HTMLElement>("[data-lw-sheet]"));
    expect(sheets.map((s) => [s.style.width, s.style.height])).toEqual([["612pt", "792pt"], ["612pt", "792pt"], ["792pt", "612pt"]]);
    expect(layout.pages).toBe(3);
    expect(layout.pageWidth).toBe(612);
    expect(layout.pageSizes).toEqual([{ width: 612, height: 792 }, { width: 612, height: 792 }, { width: 792, height: 612 }]);
  });

  it("a document of one stretch reports no pageSizes", async () => {
    expect((await render(asDoc({ blocks: [para("x")] }))).pageSizes).toBeUndefined();
  });

  it("sets each block in the measuring copy at its stretch's width", async () => {
    await render(mixed);
    const width = (i: number) => host.querySelector<HTMLElement>(`[data-lw-measure-block="${i}"]`)!.style.width;
    expect(width(0)).toBe("468pt");
    expect(width(4)).toBe("720pt");
  });

  it("draws the body and bands at the page's margins", async () => {
    await render(mixed);
    const page = host.querySelector<HTMLElement>('[data-page="3"]')!;
    expect(page.querySelector<HTMLElement>("[data-lw-body]")!.style.width).toBe("720pt");
    expect(page.querySelector<HTMLElement>("[data-lw-body]")!.style.left).toBe("36pt");
    expect(page.querySelector<HTMLElement>('[data-lw-band="header"]')!.style.width).toBe("720pt");
  });

  it("{section} counts the stretches and {sectionpages} the pages of this one", async () => {
    await render(mixed);
    const footer = (n: number) => host.querySelector<HTMLElement>(`[data-page="${n}"] [data-lw-band="footer"]`)!.textContent;
    expect(footer(1)).toContain("1/2");
    expect(footer(2)).toContain("1/2");
    expect(footer(3)).toContain("2/1");
    expect(footer(3)).toContain("3/3");
  });

  it("a first band applies to the first page after its break, and is not inherited", async () => {
    await render(
      asDoc({
        page: { header: { left: "run" } },
        blocks: [para("a"), { type: "pageBreak", page: { firstHeader: { left: "cover" } } }, para("b"), { type: "pageBreak" }, para("c"), { type: "pageBreak", page: {} }, para("d")],
      }),
    );
    const header = (n: number) => host.querySelector<HTMLElement>(`[data-page="${n}"] [data-lw-band="header"]`)!;
    expect(header(1).textContent).toContain("run");
    expect(header(2).textContent).toContain("cover");
    expect(header(2).dataset.lwBandVariant).toBe("first");
    expect(header(3).textContent).toContain("run");
    expect(header(4).textContent).toContain("run");
  });

  it("scales to the widest page, so a landscape sheet fits too", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 528 });
    try {
      const onLayout = vi.fn();
      await act(async () => {
        root.render(<DocViewer doc={mixed} onLayout={onLayout} />);
      });
      expect((onLayout.mock.calls.at(-1)![0] as DocViewerLayout).scale).toBeCloseTo(0.5);
    } finally {
      delete (HTMLElement.prototype as unknown as { clientWidth?: number }).clientWidth;
    }
  });
});

describe("what is still not shown", () => {
  it("a top-level break's page is shown: no notice", async () => {
    expect(unshownLayout(mixed)).toEqual([]);
    const layout = await render(mixed);
    expect(layout.notShown).toBeUndefined();
    expect(host.querySelector("[data-lw-layout-notice]")).toBeNull();
  });

  it("a nested break's page, a background on a break, page keys on a break and sections are not", () => {
    const nested = { type: "pageBreak", page: { orientation: "landscape" } };
    expect(unshownLayout(asDoc({ blocks: [{ type: "quote", blocks: [nested] }] }))).toEqual(["/blocks/0/blocks/0/page"]);
    expect(unshownLayout(asDoc({ blocks: [{ type: "pageBreak", page: { background: "#FFFFFF" } }] }))).toEqual(["/blocks/0/page/background"]);
    expect(unshownLayout(asDoc({ blocks: [{ type: "pageBreak", orientation: "landscape" }] }))).toEqual(["/blocks/0/orientation"]);
    expect(unshownLayout(asDoc({ sections: [], blocks: [] }))).toEqual(["/sections"]);
  });
});
