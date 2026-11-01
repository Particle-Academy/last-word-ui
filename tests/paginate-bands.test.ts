/**
 * Per-page band heights (last-word 0.16.0): a first-page letterhead and
 * different even-page bands give pages different body heights, so the packer
 * takes a capacity per page CLASS -- page 1, even pages, the other odd pages --
 * and every rule it already had applies at the capacity of the page it is
 * filling.
 */
import { describe, expect, it } from "vitest";
import { pageCapacity, paginate, type PackItem, type PageLayout } from "../src/paginate";

const block = (id: string, height: number, extra: Partial<Extract<PackItem, { type: "block" }>> = {}): PackItem => ({
  type: "block",
  id,
  height,
  ...extra,
});

function summary(pages: PageLayout[]): string[][] {
  return pages.map((p) =>
    p.fragments.map((f) =>
      f.type === "table"
        ? `${f.id}[${f.rows.join(",")}]${f.repeatedHeader ? "+h" : ""}${f.overflow ? "!" : ""}`
        : `${f.id}:${f.start}-${f.end}${f.forced ? "!" : ""}`,
    ),
  );
}

const tens = (n: number, h = 30): PackItem[] => Array.from({ length: n }, (_, i) => block(`b${i}`, h));

describe("pageCapacity: which body height a page gets", () => {
  it("is pageHeight everywhere when no variant is given", () => {
    expect([0, 1, 2, 3].map((i) => pageCapacity({ pageHeight: 100 }, i))).toEqual([100, 100, 100, 100]);
  });

  it("uses firstPageHeight for page 1 only", () => {
    expect([0, 1, 2, 3].map((i) => pageCapacity({ pageHeight: 100, firstPageHeight: 60 }, i))).toEqual([60, 100, 100, 100]);
  });

  it("uses evenPageHeight for pages 2, 4, ... (0-based odd indices)", () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => pageCapacity({ pageHeight: 100, evenPageHeight: 50 }, i))).toEqual([
      100, 50, 100, 50, 100, 50,
    ]);
  });

  it("gives page 1 the first height even when even pages differ", () => {
    expect([0, 1, 2].map((i) => pageCapacity({ pageHeight: 100, firstPageHeight: 40, evenPageHeight: 70 }, i))).toEqual([
      40, 70, 100,
    ]);
  });
});

describe("paginate: per-page body heights", () => {
  it("packs fewer blocks under a taller first-page letterhead", () => {
    const pages = paginate(tens(8), { pageHeight: 100, firstPageHeight: 60 });
    expect(summary(pages)).toEqual([
      ["b0:0-30", "b1:0-30"],
      ["b2:0-30", "b3:0-30", "b4:0-30"],
      ["b5:0-30", "b6:0-30", "b7:0-30"],
    ]);
    expect(pages.map((p) => p.capacity)).toEqual([60, 100, 100]);
  });

  it("packs even pages to their own height", () => {
    const pages = paginate(tens(9), { pageHeight: 100, evenPageHeight: 60 });
    expect(summary(pages).map((p) => p.length)).toEqual([3, 2, 3, 1]);
    expect(pages.map((p) => p.capacity)).toEqual([100, 60, 100, 60]);
  });

  it("combines a first-page and an even-page height deterministically", () => {
    const opts = { pageHeight: 100, firstPageHeight: 40, evenPageHeight: 70 };
    const a = paginate(tens(10), opts);
    const b = paginate(tens(10), opts);
    expect(summary(a).map((p) => p.length)).toEqual([1, 2, 3, 2, 2]);
    expect(a.map((p) => p.capacity)).toEqual([40, 70, 100, 70, 100]);
    expect(summary(b)).toEqual(summary(a));
  });

  it("splits a paragraph at the deepest breakpoint that fits THAT page", () => {
    const para = block("p", 180, { breakpoints: [20, 40, 60, 80, 100, 120, 140, 160] });
    const pages = paginate([para], { pageHeight: 100, firstPageHeight: 50 });
    expect(summary(pages)).toEqual([["p:0-40"], ["p:40-140"], ["p:140-180"]]);
  });

  it("forces a cut at the page's own height for an unbreakable block", () => {
    const pages = paginate([block("img", 150)], { pageHeight: 100, firstPageHeight: 60 });
    expect(summary(pages)).toEqual([["img:0-60!"], ["img:60-150"]]);
  });

  it("breaks a table between rows at each page's height, repeating the header", () => {
    const table: PackItem = {
      type: "table",
      id: "t",
      headerRows: 1,
      rows: Array.from({ length: 7 }, () => ({ height: 20 })),
    };
    const pages = paginate([table], { pageHeight: 100, firstPageHeight: 60 });
    expect(summary(pages)).toEqual([["t[0,1,2]"], ["t[0,3,4,5,6]+h"]]);
  });

  it("moves a keep-with-next chain when it fits the NEXT page, judged at that page's height", () => {
    // Page 1 holds 60. The heading + first line (50) does not fit after 30
    // used, and the next page (an even page of 45) cannot hold it either, so
    // it stays where it is and splits rather than leaving page 1 short.
    const items = [block("a", 30), block("h", 20, { keepNext: true }), block("p", 90, { breakpoints: [30, 60] })];
    const stay = paginate(items, { pageHeight: 100, firstPageHeight: 60, evenPageHeight: 45 });
    expect(summary(stay)[0]).toEqual(["a:0-30", "h:0-20"]);
    // With a roomy even page, the chain moves together.
    const move = paginate(items, { pageHeight: 100, firstPageHeight: 60, evenPageHeight: 100 });
    expect(summary(move)[0]).toEqual(["a:0-30"]);
    expect(summary(move)[1]![0]).toBe("h:0-20");
  });

  it("reserves footnotes against the page's own height", () => {
    const items = [block("a", 40, { footnotes: [{ id: 1, at: 10, height: 15 }] }), block("b", 10)];
    // Page 1 holds 60: 40 + note 15 + separator 5 = 60, so b goes to page 2.
    const pages = paginate(items, { pageHeight: 100, firstPageHeight: 60, footnoteSeparator: 5 });
    expect(summary(pages)).toEqual([["a:0-40"], ["b:0-10"]]);
    expect(pages[0]!.used).toBe(60);
  });

  it("is unchanged from 0.1.x when only pageHeight is given", () => {
    const pages = paginate(tens(7), { pageHeight: 100 });
    expect(summary(pages).map((p) => p.length)).toEqual([3, 3, 1]);
    expect(pages.map((p) => p.capacity)).toEqual([100, 100, 100]);
  });

  it("ignores a non-finite or non-positive variant and uses pageHeight", () => {
    expect(pageCapacity({ pageHeight: 100, firstPageHeight: Number.NaN, evenPageHeight: -5 }, 0)).toBe(100);
    expect(pageCapacity({ pageHeight: 100, firstPageHeight: Number.NaN, evenPageHeight: -5 }, 1)).toBe(100);
  });
});
