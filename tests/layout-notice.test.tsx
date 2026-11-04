/**
 * Mixed page orientation, stage 1: the viewer draws one page setup, so a document
 * asking for more keeps drawing and says it is not shown. Per-page geometry is
 * stage 2 (.ai/plans/mixed-page-orientation.md).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, LAYOUT_NOTICE, unshownLayout, type DocViewerLayout } from "../src";
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
/** Past the local types on purpose: these keys arrive from other writers' JSON. */
const asDoc = (doc: unknown) => doc as Doc;
const withPage = asDoc({ blocks: [para("one"), { type: "pageBreak", page: { orientation: "landscape" } }, para("two")] });

const notice = () => host.querySelector<HTMLElement>("[data-lw-layout-notice]");
const WORDS =
  "Mixed page orientation isn't shown yet. This document asks for different page settings partway through; every page here uses the document's one page setup.";

it("exports the words fancy-docs uses", () => {
  expect(LAYOUT_NOTICE).toBe(WORDS);
});

describe("unshownLayout", () => {
  it("is empty for a document with one page setup", () => {
    expect(unshownLayout({ page: { orientation: "landscape" }, blocks: [para("a"), { type: "pageBreak" }, para("b")] })).toEqual([]);
  });

  it("is safe on what a viewer may be handed", () => {
    expect(unshownLayout(asDoc(null))).toEqual([]);
    expect(unshownLayout(asDoc({}))).toEqual([]);
    expect(unshownLayout(asDoc({ blocks: "nope" }))).toEqual([]);
    expect(unshownLayout(asDoc({ blocks: [null, 3, { type: "quote", blocks: "nope" }, { type: "table", rows: [null, { cells: [null] }] }] }))).toEqual([]);
  });

  it("names pageBreak.page, the empty one too", () => {
    expect(unshownLayout(withPage)).toEqual(["/blocks/1/page"]);
    expect(unshownLayout(asDoc({ blocks: [{ type: "pageBreak", page: {} }] }))).toEqual(["/blocks/0/page"]);
  });

  it.each(["size", "orientation", "margins", "header", "footer", "firstHeader", "firstFooter", "evenHeader", "evenFooter", "background", "border"])(
    "names the near-miss key %s",
    (key) => {
      expect(unshownLayout(asDoc({ blocks: [{ type: "pageBreak", [key]: "x" }] }))).toEqual([`/blocks/0/${key}`]);
    },
  );

  it("names a top-level sections key", () => {
    expect(unshownLayout(asDoc({ sections: [], blocks: [] }))).toEqual(["/sections"]);
  });

  it("finds them in a quote and a table cell", () => {
    const pb = { type: "pageBreak", page: {} };
    const found = unshownLayout(
      asDoc({
        blocks: [
          { type: "quote", blocks: [pb] },
          { type: "table", rows: [{ cells: [{ blocks: [pb] }] }] },
        ],
      }),
    );
    expect(found.sort()).toEqual(["/blocks/0/blocks/0/page", "/blocks/1/rows/0/cells/0/blocks/0/page"]);
  });

  it("leaves other extra keys on a break alone, and a page key on other blocks", () => {
    expect(unshownLayout(asDoc({ blocks: [{ type: "pageBreak", note: "mine" }, { ...para("x"), orientation: "landscape" }] }))).toEqual([]);
  });
});

describe("DocViewer", () => {
  it("draws no notice for a document with one page setup", () => {
    act(() => root.render(<DocViewer doc={{ blocks: [para("one"), { type: "pageBreak" }, para("two")] }} />));
    expect(notice()).toBeNull();
    expect(host.querySelector("[data-react-fancy-callout]")).toBeNull();
    expect(host.querySelectorAll("[data-page]").length).toBe(2);
  });

  it.each([
    ["pageBreak.page", withPage],
    ["a near-miss key", asDoc({ blocks: [para("one"), { type: "pageBreak", orientation: "landscape" }, para("two")] })],
    ["top-level sections", asDoc({ sections: [{}], blocks: [para("one"), { type: "pageBreak" }, para("two")] })],
  ])("keeps drawing with a visible notice: %s", (_name, doc) => {
    act(() => root.render(<DocViewer doc={doc} />));

    expect(notice()?.textContent).toBe(WORDS);
    const pages = Array.from(host.querySelectorAll<HTMLElement>("[data-page]"));
    expect(pages.length).toBe(2);
    expect(pages[0]!.textContent).toContain("one");
    expect(pages[1]!.textContent).toContain("two");
  });

  it("the notice is outside the measuring copy and the sheets, so it moves no page break", () => {
    act(() => root.render(<DocViewer doc={withPage} />));

    expect(notice()!.closest("[data-lw-measure]")).toBeNull();
    expect(notice()!.closest("[data-lw-sheet]")).toBeNull();
    expect(host.querySelector("[data-lw-measure]")!.textContent).not.toContain(LAYOUT_NOTICE);
  });

  it("is a react-fancy Callout, styled for both light and dark", () => {
    act(() => root.render(<DocViewer doc={withPage} />));

    const callout = notice()!.querySelector<HTMLElement>("[data-react-fancy-callout]")!;
    expect(callout.getAttribute("role")).toBe("alert");
    expect(callout.className).toContain("bg-amber-50");
    expect(callout.className).toContain("dark:bg-amber-950/50");
    expect(callout.className).toContain("text-amber-900");
    expect(callout.className).toContain("dark:text-amber-100");
  });

  it("onLayout carries what was not shown", () => {
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    act(() => root.render(<DocViewer doc={withPage} onLayout={onLayout} />));

    expect(onLayout).toHaveBeenCalled();
    const layout = onLayout.mock.calls.at(-1)![0];
    expect(layout.notShown).toEqual(["/blocks/1/page"]);
    expect(layout.pages).toBe(2);
    expect(() => JSON.stringify(layout)).not.toThrow();
  });

  it("onLayout gains no key for a document with one page setup", () => {
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    act(() => root.render(<DocViewer doc={{ blocks: [para("one")] }} onLayout={onLayout} />));

    expect(onLayout.mock.calls.at(-1)![0]).not.toHaveProperty("notShown");
  });
});
