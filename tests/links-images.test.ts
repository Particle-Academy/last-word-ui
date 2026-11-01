import { describe, expect, it } from "vitest";
import { imageSizeFromDataUrl, resolveImageSize } from "../src/image-size";
import { safeHref } from "../src/links";

describe("safeHref: a document's links are untrusted input", () => {
  it.each(["https://example.com/a?b=1", "http://example.org", "mailto:someone@example.com", "tel:+15555550100", "#section-2"])(
    "keeps %s",
    (url) => {
      expect(safeHref(url)).toBe(url);
    },
  );

  it.each([
    "javascript:alert(1)",
    "  JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox",
    "file:///etc/passwd",
    "/relative/path",
    "",
  ])("refuses %j", (url) => {
    expect(safeHref(url)).toBeUndefined();
  });

  it("refuses a non-string", () => {
    expect(safeHref(42)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});

// A 3x2 PNG and a 4x5 JPEG header -- only the bytes the sniffers read.
const png3x2 =
  "data:image/png;base64," +
  btoa(String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 3, 0, 0, 0, 2, 8, 6, 0, 0, 0));
const jpeg4x5 =
  "data:image/jpeg;base64," +
  btoa(String.fromCharCode(0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 5, 0, 4, 3, 1, 0x22, 0));

describe("image sizing", () => {
  it("reads a PNG's intrinsic size", () => {
    expect(imageSizeFromDataUrl(png3x2)).toEqual({ width: 3, height: 2 });
  });

  it("reads a JPEG's intrinsic size from its SOF marker", () => {
    expect(imageSizeFromDataUrl(jpeg4x5)).toEqual({ width: 4, height: 5 });
  });

  it("returns null for anything else", () => {
    expect(imageSizeFromDataUrl("https://example.com/x.png")).toBeNull();
    expect(imageSizeFromDataUrl("data:image/png;base64,AAAA")).toBeNull();
  });

  it("uses the block's own size when given", () => {
    expect(resolveImageSize({ src: png3x2, widthPx: 120, heightPx: 40 }, 600)).toEqual({ width: 120, height: 40 });
  });

  it("derives the missing side from the intrinsic aspect, as the writer does", () => {
    expect(resolveImageSize({ src: png3x2, widthPx: 90 }, 600)).toEqual({ width: 90, height: 60 });
    expect(resolveImageSize({ src: png3x2, heightPx: 60 }, 600)).toEqual({ width: 90, height: 60 });
  });

  it("caps the width at the text column, keeping the aspect", () => {
    expect(resolveImageSize({ src: png3x2, widthPx: 1200, heightPx: 800 }, 600)).toEqual({ width: 600, height: 400 });
  });

  it("falls back to 300x200 when nothing is known", () => {
    expect(resolveImageSize({ src: "data:image/png;base64,AAAA" }, 600)).toEqual({ width: 300, height: 200 });
  });
});
