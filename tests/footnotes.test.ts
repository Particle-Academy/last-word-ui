import { describe, expect, it } from "vitest";
import { numberFootnotes } from "../src/footnotes";
import type { Doc, Run } from "../src/types";

const note = (text: string): Run => ({
  text: "",
  footnote: { blocks: [{ type: "paragraph", runs: [{ text }] }] },
});
const noteText = (n: { footnote: { blocks: unknown[] } }): string =>
  ((n.footnote.blocks[0] as { runs: Run[] }).runs[0] as Run).text;

describe("numberFootnotes: 1, 2, 3 in document order", () => {
  it("numbers marks across paragraphs, list items, table cells and quotes, in reading order", () => {
    const a = note("A");
    const b = note("B");
    const c = note("C");
    const d = note("D");
    const e = note("E");
    const doc: Doc = {
      blocks: [
        { type: "heading", level: 1, runs: [{ text: "Title" }, a] },
        { type: "list", items: [{ runs: [{ text: "x" }], children: [{ runs: [b] }] }] },
        { type: "table", rows: [{ cells: [{ blocks: [{ type: "paragraph", runs: [c] }] }] }] },
        { type: "quote", blocks: [{ type: "paragraph", runs: [d] }] },
        { type: "paragraph", runs: [{ text: "end" }, e] },
      ],
    };
    const { marks, notes } = numberFootnotes(doc);
    expect([a, b, c, d, e].map((r) => marks.get(r))).toEqual([1, 2, 3, 4, 5]);
    expect(notes.map((n) => [n.id, noteText(n)])).toEqual([
      [1, "A"],
      [2, "B"],
      [3, "C"],
      [4, "D"],
      [5, "E"],
    ]);
  });

  it("ignores a footnote in a header or footer (Word cannot hold one there)", () => {
    const inBand = note("band");
    const body = note("body");
    const doc: Doc = {
      blocks: [{ type: "paragraph", runs: [body] }],
      page: { header: { blocks: [{ type: "paragraph", runs: [inBand] }] } },
    };
    const { marks, notes } = numberFootnotes(doc);
    expect(marks.get(body)).toBe(1);
    expect(marks.has(inBand)).toBe(false);
    expect(notes).toHaveLength(1);
  });

  it("does not number a footnote nested inside a footnote", () => {
    const inner = note("inner");
    const outer: Run = { text: "", footnote: { blocks: [{ type: "paragraph", runs: [{ text: "o" }, inner] }] } };
    const { marks, notes } = numberFootnotes({ blocks: [{ type: "paragraph", runs: [outer] }] });
    expect(marks.get(outer)).toBe(1);
    expect(marks.has(inner)).toBe(false);
    expect(notes).toHaveLength(1);
  });

  it("ignores a malformed footnote with no blocks array", () => {
    const bad: Run = { text: "", footnote: { blocks: "nope" as never } };
    expect(numberFootnotes({ blocks: [{ type: "paragraph", runs: [bad] }] }).notes).toEqual([]);
  });
});
