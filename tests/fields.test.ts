import { describe, expect, it } from "vitest";
import { substituteFields } from "../src/fields";

describe("substituteFields: {page} / {pages} as live numbers", () => {
  it("replaces both fields with the page's own numbers", () => {
    expect(substituteFields("Page {page} of {pages}", { page: 2, pages: 5 })).toBe("Page 2 of 5");
  });

  it("gives every page its own number", () => {
    const text = "Q3 2026 Board Memo · Page {page} of {pages}";
    const rendered = [1, 2, 3].map((page) => substituteFields(text, { page, pages: 3 }));
    expect(rendered).toEqual([
      "Q3 2026 Board Memo · Page 1 of 3",
      "Q3 2026 Board Memo · Page 2 of 3",
      "Q3 2026 Board Memo · Page 3 of 3",
    ]);
  });

  it("replaces every occurrence", () => {
    expect(substituteFields("{page}/{page}/{pages}", { page: 4, pages: 9 })).toBe("4/4/9");
  });

  it("does not touch near-misses", () => {
    expect(substituteFields("{Page} {pagesx} {page }", { page: 1, pages: 1 })).toBe("{Page} {pagesx} {page }");
  });

  it("returns text without fields unchanged", () => {
    expect(substituteFields("Confidential", { page: 1, pages: 1 })).toBe("Confidential");
  });
});
