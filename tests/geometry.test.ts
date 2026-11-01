import { describe, expect, it } from "vitest";
import { bodyBox, pageGeometry, pageMargins } from "../src/geometry";
import type { Doc } from "../src/types";

const doc = (page?: Doc["page"]): Doc => ({ blocks: [], ...(page ? { page } : {}) });

describe("pageGeometry: paper size and orientation", () => {
  it.each([
    ["letter", "portrait", 612, 792],
    ["letter", "landscape", 792, 612],
    ["legal", "portrait", 612, 1008],
    ["legal", "landscape", 1008, 612],
    ["a4", "portrait", 595.3, 841.9],
    ["a4", "landscape", 841.9, 595.3],
  ] as const)("%s %s is %s x %s pt", (size, orientation, width, height) => {
    const g = pageGeometry(doc({ size, orientation }));
    expect(g.size).toBe(size);
    expect(g.orientation).toBe(orientation);
    expect(g.width).toBe(width);
    expect(g.height).toBe(height);
  });

  it("is Letter portrait when the document has no page at all", () => {
    const g = pageGeometry(doc());
    expect([g.size, g.orientation, g.width, g.height]).toEqual(["letter", "portrait", 612, 792]);
  });

  it("falls back to Letter for a size it does not know, rather than throwing", () => {
    const g = pageGeometry(doc({ size: "tabloid" as never }));
    expect([g.size, g.width]).toEqual(["letter", 612]);
  });

  it("content width is the page width less the side margins", () => {
    expect(pageGeometry(doc()).contentWidth).toBe(468);
    expect(pageGeometry(doc({ size: "a4", orientation: "landscape", margins: { left: 36, right: 54 } })).contentWidth)
      .toBeCloseTo(841.9 - 90, 6);
  });
});

describe("pageMargins: the single source of margin defaults", () => {
  it("defaults every side to 72pt and both band distances to 36pt", () => {
    expect(pageMargins(doc())).toEqual({ top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 });
  });

  it("a MISSING side means the default; a given side wins (the reader omits 1in sides)", () => {
    // DocxReader drops every side equal to 1440 twips, so a file with only a
    // narrow left margin reads back as { left: 54 }.
    expect(pageMargins(doc({ margins: { left: 54 } }))).toEqual({
      top: 72,
      right: 72,
      bottom: 72,
      left: 54,
      header: 36,
      footer: 36,
    });
  });

  it("reads the header and footer distances when the model carries them", () => {
    const m = pageMargins(doc({ margins: { header: 18, footer: 24.5 } }));
    expect([m.header, m.footer]).toEqual([18, 24.5]);
  });

  it("keeps an explicit zero rather than treating it as absent", () => {
    expect(pageMargins(doc({ margins: { top: 0, header: 0 } })).top).toBe(0);
    expect(pageMargins(doc({ margins: { top: 0, header: 0 } })).header).toBe(0);
  });

  it("ignores values that are not finite numbers", () => {
    const m = pageMargins(doc({ margins: { top: "1in" as never, left: Number.NaN, right: Infinity } }));
    expect([m.top, m.left, m.right]).toEqual([72, 72, 72]);
  });
});

describe("bodyBox: where the body sits once the bands are measured", () => {
  const g = pageGeometry(doc());

  it("is the margin box when the bands fit inside the margins", () => {
    // Header at 36 + 14 tall = 50 < 72.
    expect(bodyBox(g, 14, 14)).toEqual({ top: 72, bottom: 72, height: 792 - 144 });
  });

  it("pushes the body down when the header is taller than the margin leaves room for, as Word does", () => {
    // A letterhead 60pt tall at the 36pt distance ends at 96 > 72.
    expect(bodyBox(g, 60, 0)).toEqual({ top: 96, bottom: 72, height: 792 - 96 - 72 });
  });

  it("pushes the body up when the footer is taller than the bottom margin", () => {
    expect(bodyBox(g, 0, 50).bottom).toBe(86);
  });
});
