/**
 * Which header and footer a page gets (last-word 0.16.0): page 1 takes
 * `firstHeader` / `firstFooter` when present, even pages `evenHeader` /
 * `evenFooter`, everything else the default; `{"blocks": []}` as a variant
 * blanks that page's band. And the body box that follows, per page class.
 */
import { describe, expect, it } from "vitest";
import { pageBand, pageBodyBoxes, pageClass, type BandHeights } from "../src/bands";
import { pageGeometry } from "../src/geometry";
import type { Page } from "../src/types";

const H = { left: "default header" };
const F = { center: "default footer" };
const FH = { blocks: [{ type: "paragraph" as const, runs: [{ text: "Letterhead" }] }] };
const FF = { right: "first footer" };
const EH = { left: "even header" };
const EF = { right: "even footer" };

const label = (b: ReturnType<typeof pageBand>): string | null =>
  b === null ? null : "blocks" in b ? "blocks:" + b.blocks.length : (b.left ?? b.center ?? b.right ?? "");

describe("pageClass", () => {
  it("is first for page 1, even for pages 2, 4, ... and odd for 3, 5, ...", () => {
    expect([0, 1, 2, 3, 4].map(pageClass)).toEqual(["first", "even", "odd", "even", "odd"]);
  });
});

describe("pageBand: variant selection per page", () => {
  const all: Page = { header: H, footer: F, firstHeader: FH, firstFooter: FF, evenHeader: EH, evenFooter: EF };

  it("gives page 1 the first variants", () => {
    expect(label(pageBand(all, "header", 0))).toBe("blocks:1");
    expect(label(pageBand(all, "footer", 0))).toBe("first footer");
  });

  it("gives even pages the even variants", () => {
    expect(label(pageBand(all, "header", 1))).toBe("even header");
    expect(label(pageBand(all, "footer", 3))).toBe("even footer");
  });

  it("gives odd pages after the first the default", () => {
    expect(label(pageBand(all, "header", 2))).toBe("default header");
    expect(label(pageBand(all, "footer", 4))).toBe("default footer");
  });

  it("falls back to the default where a variant is absent", () => {
    const page: Page = { header: H, footer: F, firstHeader: FH };
    expect(label(pageBand(page, "footer", 0))).toBe("default footer");
    expect(label(pageBand(page, "header", 1))).toBe("default header");
  });

  it("gives a single-page document its first variant", () => {
    expect(label(pageBand({ header: H, firstHeader: FH }, "header", 0))).toBe("blocks:1");
    expect(label(pageBand({ header: H }, "header", 0))).toBe("default header");
  });

  it("does not give page 1 the even variant: page 1 is odd", () => {
    expect(label(pageBand({ header: H, evenHeader: EH }, "header", 0))).toBe("default header");
  });

  it("blanks a page whose variant is {blocks: []}", () => {
    const page: Page = { header: H, firstHeader: { blocks: [] }, evenHeader: { blocks: [] } };
    expect(pageBand(page, "header", 0)).toBeNull();
    expect(pageBand(page, "header", 1)).toBeNull();
    expect(label(pageBand(page, "header", 2))).toBe("default header");
  });

  it("shows a first-only letterhead on page 1 and nothing after", () => {
    const page: Page = { firstHeader: FH };
    expect(label(pageBand(page, "header", 0))).toBe("blocks:1");
    expect(pageBand(page, "header", 1)).toBeNull();
    expect(pageBand(page, "header", 2)).toBeNull();
  });

  it("treats a variant that is not an object as absent (untrusted input)", () => {
    const page = { header: H, firstHeader: "nope", evenHeader: null } as unknown as Page;
    expect(label(pageBand(page, "header", 0))).toBe("default header");
    expect(label(pageBand(page, "header", 1))).toBe("default header");
  });

  it("returns null for no page at all", () => {
    expect(pageBand(undefined, "header", 0)).toBeNull();
  });
});

describe("pageBodyBoxes: the body box of each page class", () => {
  const g = pageGeometry({ blocks: [], page: { size: "letter" } }); // margins 72, distances 36
  const heights = (over: Partial<BandHeights["header"]>, footer: Partial<BandHeights["footer"]> = {}): BandHeights => ({
    header: { default: 0, first: 0, even: 0, ...over },
    footer: { default: 0, first: 0, even: 0, ...footer },
  });

  it("moves page 1's body down under a tall first-page letterhead only", () => {
    const page: Page = { header: H, firstHeader: FH };
    const boxes = pageBodyBoxes(g, page, heights({ default: 12, first: 100 }));
    expect(boxes.first.top).toBe(136);
    expect(boxes.even.top).toBe(72);
    expect(boxes.odd.top).toBe(72);
    expect(boxes.first.height).toBe(792 - 136 - 72);
  });

  it("uses each class's footer too", () => {
    const page: Page = { footer: F, evenFooter: EF };
    const boxes = pageBodyBoxes(g, page, heights({}, { default: 10, even: 60 }));
    expect([boxes.first.bottom, boxes.even.bottom, boxes.odd.bottom]).toEqual([72, 96, 72]);
  });

  it("takes no header height on a page whose variant is blank", () => {
    const page: Page = { header: H, firstHeader: { blocks: [] } };
    const boxes = pageBodyBoxes(g, page, heights({ default: 100, first: 0 }));
    expect(boxes.first.top).toBe(72);
    expect(boxes.odd.top).toBe(136);
  });
});
