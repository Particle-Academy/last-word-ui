import { describe, expect, it } from "vitest";
import { paginate, type PackItem, type PageLayout } from "../src/paginate";

const block = (id: string, height: number, extra: Partial<Extract<PackItem, { type: "block" }>> = {}): PackItem => ({
  type: "block",
  id,
  height,
  ...extra,
});

/** Page -> the ids (with ranges for partial blocks / rows for tables) it holds. */
function summary(pages: PageLayout[]): string[][] {
  return pages.map((p) =>
    p.fragments.map((f) =>
      f.type === "table"
        ? `${f.id}[${f.rows.join(",")}]${f.repeatedHeader ? "+h" : ""}${f.overflow ? "!" : ""}`
        : `${f.id}:${f.start}-${f.end}${f.forced ? "!" : ""}`,
    ),
  );
}

describe("paginate: whole blocks", () => {
  it("always returns at least one page, even for an empty document", () => {
    const pages = paginate([], { pageHeight: 100 });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.fragments).toEqual([]);
    expect(pages[0]!.index).toBe(0);
  });

  it("keeps blocks that fit on one page together", () => {
    const pages = paginate([block("a", 30), block("b", 30), block("c", 40)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["a:0-30", "b:0-30", "c:0-40"]]);
    expect(pages[0]!.used).toBe(100);
  });

  it("moves a block that overflows onto a new page", () => {
    const pages = paginate([block("a", 60), block("b", 30), block("c", 20)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["a:0-60", "b:0-30"], ["c:0-20"]]);
    expect(pages.map((p) => p.index)).toEqual([0, 1]);
  });

  it("packs a long run of blocks over many pages, by height alone", () => {
    const items = Array.from({ length: 10 }, (_, i) => block(`b${i}`, 45));
    const pages = paginate(items, { pageHeight: 100 });
    expect(pages.map((p) => p.fragments.length)).toEqual([2, 2, 2, 2, 2]);
  });
});

describe("paginate: explicit page breaks", () => {
  it("starts a new page at a break even when the next block would fit", () => {
    const pages = paginate([block("a", 10), { type: "break" }, block("b", 10)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["a:0-10"], ["b:0-10"]]);
  });

  it("two breaks in a row leave a blank page between, as Word does", () => {
    const pages = paginate([block("a", 10), { type: "break" }, { type: "break" }, block("b", 10)], {
      pageHeight: 100,
    });
    expect(summary(pages)).toEqual([["a:0-10"], [], ["b:0-10"]]);
  });

  it("a break as the last item yields a trailing blank page", () => {
    const pages = paginate([block("a", 10), { type: "break" }], { pageHeight: 100 });
    expect(pages).toHaveLength(2);
  });
});

describe("paginate: splitting a block at its line breakpoints", () => {
  it("splits at the deepest breakpoint that fits, and continues on the next page", () => {
    // 10 lines of 12: breakpoints after each line but the last.
    const bps = [12, 24, 36, 48, 60, 72, 84, 96, 108];
    const pages = paginate([block("x", 50), block("p", 120, { breakpoints: bps })], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["x:0-50", "p:0-48"], ["p:48-120"]]);
  });

  it("moves the whole block when no breakpoint fits in the space left", () => {
    const pages = paginate([block("x", 95), block("p", 40, { breakpoints: [20] })], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["x:0-95"], ["p:0-40"]]);
  });

  it("a splittable block longer than several pages continues across all of them", () => {
    const bps = Array.from({ length: 24 }, (_, i) => (i + 1) * 10);
    const pages = paginate([block("p", 250, { breakpoints: bps })], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["p:0-100"], ["p:100-200"], ["p:200-250"]]);
  });
});

describe("paginate: a block taller than a page", () => {
  it("with no breakpoints, starts on a fresh page and is cut at the page height (flagged forced)", () => {
    const pages = paginate([block("a", 30), block("img", 250)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["a:0-30"], ["img:0-100!"], ["img:100-200!"], ["img:200-250"]]);
  });

  it("never loops forever and never loses height: fragments tile the block exactly", () => {
    const pages = paginate([block("tall", 1234.5)], { pageHeight: 100 });
    const frags = pages.flatMap((p) => p.fragments).filter((f) => f.type === "block");
    let at = 0;
    for (const f of frags) {
      expect(f.type === "block" && f.start).toBe(at);
      at = f.type === "block" ? f.end : at;
    }
    expect(at).toBe(1234.5);
  });

  it("a block exactly one page tall fits without a cut", () => {
    const pages = paginate([block("a", 100)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["a:0-100"]]);
  });
});

describe("paginate: keep with next", () => {
  it("moves a heading to the next page rather than strand it at the foot", () => {
    const pages = paginate([block("x", 80), block("h", 15, { keepNext: true }), block("p", 30)], {
      pageHeight: 100,
    });
    expect(summary(pages)).toEqual([["x:0-80"], ["h:0-15", "p:0-30"]]);
  });

  it("is satisfied by the next block's first line when that block can split", () => {
    const pages = paginate(
      [block("x", 60), block("h", 15, { keepNext: true }), block("p", 60, { breakpoints: [12, 24, 36, 48] })],
      { pageHeight: 100 },
    );
    expect(summary(pages)).toEqual([["x:0-60", "h:0-15", "p:0-24"], ["p:24-60"]]);
  });

  it("is ignored when the chain could not fit on any page", () => {
    const pages = paginate([block("x", 10), block("h", 15, { keepNext: true }), block("big", 200)], {
      pageHeight: 100,
    });
    expect(summary(pages)[0]).toEqual(["x:0-10", "h:0-15"]);
  });
});

describe("paginate: tables split by row, header repeated", () => {
  const table = (rows: number[], headerRows = 1, joinPrevious: number[] = []): PackItem => ({
    type: "table",
    id: "t",
    headerRows,
    rows: rows.map((height, i) => ({ height, joinPrevious: joinPrevious.includes(i) })),
  });

  it("a table that fits is one fragment holding every row", () => {
    const pages = paginate([table([10, 20, 20])], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["t[0,1,2]"]]);
  });

  it("splits between rows and repeats the header row on the continuation page", () => {
    const pages = paginate([block("x", 40), table([10, 20, 20, 20, 20])], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["x:0-40", "t[0,1,2]"], ["t[0,3,4]+h"]]);
  });

  it("repeats several header rows", () => {
    const pages = paginate([table([10, 10, 30, 30, 30, 30], 2)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["t[0,1,2,3]"], ["t[0,1,4,5]+h"]]);
  });

  it("a table with no header rows splits without repeating anything", () => {
    const pages = paginate([table([40, 40, 40], 0)], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["t[0,1]"], ["t[2]"]]);
  });

  it("never strands a header row alone at the foot of a page", () => {
    const pages = paginate([block("x", 85), table([10, 20, 20])], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["x:0-85"], ["t[0,1,2]"]]);
  });

  it("does not break inside a row span (joinPrevious keeps the rows together)", () => {
    const pages = paginate([table([10, 30, 30, 40], 1, [3])], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["t[0,1]"], ["t[0,2,3]+h"]]);
  });

  it("a single row taller than the page is placed alone and flagged, never dropped", () => {
    const pages = paginate([table([10, 150, 20])], { pageHeight: 100 });
    expect(summary(pages)).toEqual([["t[0,1]!"], ["t[0,2]+h"]]);
  });
});

describe("paginate: footnotes reduce the body height of the page they land on", () => {
  it("reserves the note and the separator on the page holding its mark", () => {
    const pages = paginate(
      [block("a", 40, { footnotes: [{ id: 1, at: 10, height: 20 }] }), block("b", 40)],
      { pageHeight: 100, footnoteSeparator: 10 },
    );
    // 40 + 40 + 20 + 10 = 110 > 100, so b moves.
    expect(summary(pages)).toEqual([["a:0-40"], ["b:0-40"]]);
    expect(pages[0]!.footnotes).toEqual([1]);
    expect(pages[1]!.footnotes).toEqual([]);
  });

  it("a split puts the note on the page of the fragment holding the mark", () => {
    const bps = [20, 40, 60, 80, 100, 120];
    const pages = paginate([block("p", 140, { breakpoints: bps, footnotes: [{ id: 1, at: 105, height: 15 }] })], {
      pageHeight: 100,
      footnoteSeparator: 5,
    });
    expect(summary(pages)).toEqual([["p:0-100"], ["p:100-140"]]);
    expect(pages.map((p) => p.footnotes)).toEqual([[], [1]]);
  });

  it("shortens a split so the mark's own note still fits on its page", () => {
    const bps = [20, 40, 60, 80];
    const pages = paginate([block("p", 100, { breakpoints: bps, footnotes: [{ id: 1, at: 70, height: 25 }] })], {
      pageHeight: 100,
      footnoteSeparator: 5,
    });
    // Cutting at 80 would need 80 + 25 + 5 = 110. At 60 the mark (70) moves on.
    expect(summary(pages)).toEqual([["p:0-60"], ["p:60-100"]]);
    expect(pages.map((p) => p.footnotes)).toEqual([[], [1]]);
  });

  it("keeps a mark measured just outside its block (a superscript rising above line one)", () => {
    // Found in the browser: a mark on the first line measured at -0.89px, and
    // the note was dropped from every page.
    const pages = paginate(
      [
        block("a", 40, { footnotes: [{ id: 1, at: -0.89, height: 10 }] }),
        block("b", 40, { footnotes: [{ id: 2, at: 40.5, height: 10 }] }),
      ],
      { pageHeight: 200, footnoteSeparator: 5 },
    );
    expect(pages[0]!.footnotes).toEqual([1, 2]);
  });

  it("never drops or duplicates a note across a split, whatever its offset", () => {
    const bps = [20, 40, 60, 80];
    const notes = [-3, 0, 20, 39.9, 40, 99, 101].map((at, i) => ({ id: i + 1, at, height: 1 }));
    const pages = paginate([block("p", 100, { breakpoints: bps, footnotes: notes })], { pageHeight: 45 });
    expect(pages.flatMap((p) => p.footnotes).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("counts the separator once per page however many notes it holds", () => {
    const pages = paginate(
      [
        block("a", 30, { footnotes: [{ id: 1, at: 0, height: 10 }] }),
        block("b", 30, { footnotes: [{ id: 2, at: 0, height: 10 }] }),
      ],
      { pageHeight: 100, footnoteSeparator: 10 },
    );
    // 30 + 30 + 10 + 10 + 10 = 90.
    expect(pages).toHaveLength(1);
    expect(pages[0]!.footnotes).toEqual([1, 2]);
  });

  it("table rows carry their notes to the fragment holding the row", () => {
    const pages = paginate(
      [
        {
          type: "table",
          id: "t",
          headerRows: 1,
          rows: [{ height: 10 }, { height: 40 }, { height: 40, footnotes: [{ id: 1, height: 20 }] }],
        },
      ],
      { pageHeight: 100, footnoteSeparator: 5 },
    );
    expect(summary(pages)).toEqual([["t[0,1]"], ["t[0,2]+h"]]);
    expect(pages.map((p) => p.footnotes)).toEqual([[], [1]]);
  });
});

describe("paginate: determinism", () => {
  it("returns identical layouts for identical input", () => {
    const items: PackItem[] = [
      block("a", 33.3, { breakpoints: [11.1, 22.2] }),
      { type: "table", id: "t", headerRows: 1, rows: [{ height: 9 }, { height: 41 }, { height: 41 }] },
      { type: "break" },
      block("z", 5),
    ];
    expect(paginate(items, { pageHeight: 80 })).toEqual(paginate(items, { pageHeight: 80 }));
  });
});
