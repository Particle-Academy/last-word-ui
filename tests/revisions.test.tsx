/**
 * Tracked changes are a FAIL-SAFE here, not a feature. last-word's model can carry a
 * `revision` key (runs, paragraph and heading blocks, list items). This viewer cannot
 * show revisions, so a document carrying one draws with a visible notice, and a run
 * whose text was deleted (or moved away) is never drawn as live text.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, TRACKED_CHANGES_NOTICE, hasRevisions, isDeletedRun, numberFootnotes, revisionPaths, type DocViewerLayout } from "../src";
import type { Doc, Run } from "../src/types";

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

/** Past the local types on purpose: `revision` arrives from a writer's JSON. */
const asDoc = (doc: unknown) => doc as Doc;
const rev = (type: string) => ({ type, author: "Ada", date: "2026-11-20T10:00:00Z" });

const tracked = () =>
  asDoc({
    blocks: [
      {
        type: "paragraph",
        runs: [{ text: "Pay within " }, { text: "thirty", revision: rev("delete") }, { text: "sixty", revision: rev("insert") }, { text: " days." }],
      },
      { type: "paragraph", runs: [{ text: "Old clause.", revision: rev("moveFrom") }] },
      { type: "paragraph", runs: [{ text: "Moved clause.", revision: rev("moveTo") }] },
    ],
  });

const notice = () => host.querySelector<HTMLElement>("[data-lw-tracked-changes-notice]");
const pagesText = () =>
  Array.from(host.querySelectorAll<HTMLElement>("[data-page]"))
    .map((p) => p.textContent)
    .join("\n");

describe("hasRevisions / revisionPaths", () => {
  it("is false and empty for a document without revisions", () => {
    const doc = asDoc({ blocks: [{ type: "paragraph", runs: [{ text: "a" }] }, { type: "list", items: [{ runs: [{ text: "b" }] }] }] });
    expect(hasRevisions(doc)).toBe(false);
    expect(revisionPaths(doc)).toEqual([]);
  });

  it("is safe on what a viewer may be handed", () => {
    for (const doc of [null, undefined, 3, "x", {}, { blocks: "nope" }, { blocks: [null, 3, { type: "quote", blocks: "nope" }] }]) {
      expect(hasRevisions(asDoc(doc))).toBe(false);
      expect(revisionPaths(asDoc(doc))).toEqual([]);
    }
  });

  it("finds a revision on a run, a paragraph, a heading and a list item, at any depth", () => {
    const doc = asDoc({
      blocks: [
        { type: "paragraph", runs: [{ text: "a", revision: rev("delete") }] },
        { type: "heading", level: 1, revision: rev("format"), runs: [{ text: "H" }] },
        { type: "paragraph", revision: rev("insert"), runs: [{ text: "p" }] },
        { type: "list", items: [{ runs: [{ text: "i" }], children: [{ runs: [{ text: "j" }], revision: rev("delete") }] }] },
        { type: "quote", blocks: [{ type: "paragraph", runs: [{ text: "q", revision: rev("insert") }] }] },
        { type: "table", rows: [{ cells: [{ blocks: [{ type: "paragraph", runs: [{ text: "c", revision: rev("delete") }] }] }] }] },
        { type: "paragraph", runs: [{ text: "", footnote: { blocks: [{ type: "paragraph", runs: [{ text: "n", revision: rev("delete") }] }] } }] },
      ],
      page: { header: { blocks: [{ type: "paragraph", runs: [{ text: "hd", revision: rev("insert") }] }] } },
    });
    expect(hasRevisions(doc)).toBe(true);
    expect(revisionPaths(doc).sort()).toEqual(
      [
        "/blocks/0/runs/0/revision",
        "/blocks/1/revision",
        "/blocks/2/revision",
        "/blocks/3/items/0/children/0/revision",
        "/blocks/4/blocks/0/runs/0/revision",
        "/blocks/5/rows/0/cells/0/blocks/0/runs/0/revision",
        "/blocks/6/runs/0/footnote/blocks/0/runs/0/revision",
        "/page/header/blocks/0/runs/0/revision",
      ].sort(),
    );
  });

  it("does not read a chart's option, which is arbitrary chart data", () => {
    expect(hasRevisions(asDoc({ blocks: [{ type: "chart", option: { series: [{ revision: 3 }] } }] }))).toBe(false);
  });
});

describe("isDeletedRun", () => {
  it("is true for deleted and moved-away text, false for kept text", () => {
    expect(isDeletedRun({ text: "x", revision: rev("delete") } as Run)).toBe(true);
    expect(isDeletedRun({ text: "x", revision: rev("moveFrom") } as Run)).toBe(true);
    expect(isDeletedRun({ text: "x", revision: rev("insert") } as Run)).toBe(false);
    expect(isDeletedRun({ text: "x", revision: rev("moveTo") } as Run)).toBe(false);
    expect(isDeletedRun({ text: "x", revision: rev("format") } as Run)).toBe(false);
    expect(isDeletedRun({ text: "x" } as Run)).toBe(false);
  });

  it("fails safe: a revision it cannot read is treated as deleted text", () => {
    expect(isDeletedRun({ text: "x", revision: { type: "something-new" } } as Run)).toBe(true);
    expect(isDeletedRun({ text: "x", revision: "garbled" } as Run)).toBe(true);
    expect(isDeletedRun({ text: "x", revision: null } as Run)).toBe(true);
  });
});

describe("DocViewer with tracked changes", () => {
  it("does not draw deleted or moved-away text as live text, on the pages or in the measuring copy", () => {
    act(() => root.render(<DocViewer doc={tracked()} />));

    const text = pagesText();
    expect(text).toContain("Pay within sixty days.");
    expect(text).toContain("Moved clause.");
    expect(text).not.toContain("thirty");
    expect(text).not.toContain("Old clause.");
    const measured = host.querySelector("[data-lw-measure]")!.textContent;
    expect(measured).not.toContain("thirty");
    expect(measured).not.toContain("Old clause.");
  });

  it("shows the notice, with stable handles, outside the measuring copy and the sheets", () => {
    act(() => root.render(<DocViewer doc={tracked()} />));

    const n = notice()!;
    expect(n).not.toBeNull();
    expect(n.textContent).toBe(TRACKED_CHANGES_NOTICE);
    expect(TRACKED_CHANGES_NOTICE).toContain("tracked changes");
    expect(TRACKED_CHANGES_NOTICE).toContain("Accept them first");
    expect(n.getAttribute("data-lw-revisions")).toBe("4");
    expect(n.querySelector("[data-react-fancy-callout]")).not.toBeNull();
    expect(n.closest("[data-lw-measure]")).toBeNull();
    expect(n.closest("[data-lw-sheet]")).toBeNull();
    expect(host.querySelector("[data-lw-viewer]")!.hasAttribute("data-lw-tracked-changes")).toBe(true);
  });

  it("shows the notice for a block-level mark alone, and keeps that block's text", () => {
    const doc = asDoc({ blocks: [{ type: "paragraph", revision: rev("delete"), runs: [{ text: "kept text" }] }] });
    act(() => root.render(<DocViewer doc={doc} />));

    expect(notice()).not.toBeNull();
    expect(pagesText()).toContain("kept text");
  });

  it("draws no footnote for a deleted footnote reference", () => {
    const doc = asDoc({
      blocks: [
        {
          type: "paragraph",
          runs: [{ text: "Body" }, { text: "", revision: rev("delete"), footnote: { blocks: [{ type: "paragraph", runs: [{ text: "gone note" }] }] } }],
        },
      ],
    });
    expect(numberFootnotes(doc).notes).toEqual([]);
    act(() => root.render(<DocViewer doc={doc} />));
    expect(host.querySelector("[data-footnote]")).toBeNull();
    expect(host.textContent).not.toContain("gone note");
  });

  it("leaves the model exactly as it was given: revisions are never dropped or rewritten", () => {
    const doc = tracked();
    const before = JSON.stringify(doc);
    act(() => root.render(<DocViewer doc={doc} />));
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("onLayout carries the revisions it did not show", () => {
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    act(() => root.render(<DocViewer doc={tracked()} onLayout={onLayout} />));

    const layout = onLayout.mock.calls.at(-1)![0];
    expect(layout.revisions).toEqual(["/blocks/0/runs/1/revision", "/blocks/0/runs/2/revision", "/blocks/1/runs/0/revision", "/blocks/2/runs/0/revision"]);
    expect(() => JSON.stringify(layout)).not.toThrow();
  });

  it("a document without revisions is unaffected: no notice, no handle, no onLayout key, all text drawn", () => {
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    const doc = asDoc({ blocks: [{ type: "paragraph", runs: [{ text: "thirty", strike: true }, { text: " days" }] }] });
    act(() => root.render(<DocViewer doc={doc} onLayout={onLayout} />));

    expect(notice()).toBeNull();
    expect(host.querySelector("[data-lw-viewer]")!.hasAttribute("data-lw-tracked-changes")).toBe(false);
    expect(pagesText()).toContain("thirty days");
    expect(onLayout.mock.calls.at(-1)![0]).not.toHaveProperty("revisions");
  });
});
