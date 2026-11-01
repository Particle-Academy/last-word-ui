/**
 * The header/footer field tokens last-word 0.16.0 writes, beside {page} and
 * {pages}: {section}, {sectionpages}, {author}, {title}, {filename}, {date},
 * {time} and {date:FORMAT} / {time:FORMAT} with a Word date-time picture.
 */
import { describe, expect, it } from "vitest";
import { formatDatePicture, resolveNow, substituteFields, type PageFields } from "../src/fields";

// Local time, so the assertions do not depend on the machine's time zone.
const NOW = new Date(2026, 10, 1, 14, 5, 9); // Sunday 1 November 2026, 14:05:09
const MORNING = new Date(2026, 0, 7, 0, 3, 4); // Wednesday 7 January 2026, 00:03:04

const f = (over: Partial<PageFields> = {}): PageFields => ({ page: 2, pages: 5, now: NOW, ...over });

describe("substituteFields: section tokens", () => {
  it("{section} is 1 and {sectionpages} the page total: the Doc is one section", () => {
    expect(substituteFields("Section {section}, {sectionpages} pages", f())).toBe("Section 1, 5 pages");
  });
});

describe("substituteFields: document properties", () => {
  it("{author} is the author, empty when unset", () => {
    expect(substituteFields("By {author}", f({ author: "A. Writer" }))).toBe("By A. Writer");
    expect(substituteFields("By {author}.", f())).toBe("By .");
  });

  it("{title} is the title, empty when unset", () => {
    expect(substituteFields("{title} - {page}", f({ title: "Board Memo" }))).toBe("Board Memo - 2");
    expect(substituteFields("[{title}]", f())).toBe("[]");
  });

  it("{filename} is the filename, empty when unset", () => {
    expect(substituteFields("{filename}", f({ filename: "memo.docx" }))).toBe("memo.docx");
    expect(substituteFields("<{filename}>", f())).toBe("<>");
  });

  it("does not re-expand a token inside a substituted value", () => {
    expect(substituteFields("{title}", f({ title: "{page} {author}", author: "x" }))).toBe("{page} {author}");
  });
});

describe("substituteFields: date and time", () => {
  it("{date} / {time} with no FORMAT use the browser locale", () => {
    expect(substituteFields("{date}", f())).toBe(NOW.toLocaleDateString());
    expect(substituteFields("{time}", f())).toBe(NOW.toLocaleTimeString());
  });

  it("{date:FORMAT} formats with a Word picture", () => {
    expect(substituteFields("{date:d MMMM yyyy}", f())).toBe("1 November 2026");
    expect(substituteFields("{date:dd/MM/yy}", f())).toBe("01/11/26");
    expect(substituteFields("{date:dddd, MMM d}", f())).toBe("Sunday, Nov 1");
  });

  it("{time:FORMAT} formats with a Word picture", () => {
    expect(substituteFields("{time:HH:mm}", f())).toBe("14:05");
    expect(substituteFields("{time:h:mm am/pm}", f())).toBe("2:05 pm");
    expect(substituteFields("{time:hh:mm:ss AM/PM}", f())).toBe("02:05:09 PM");
  });

  it("several tokens in one band each take their value", () => {
    expect(substituteFields("{title} | {date:yyyy-MM-dd} {time:HH:mm} | {page}/{pages}", f({ title: "T" }))).toBe(
      "T | 2026-11-01 14:05 | 2/5",
    );
  });
});

describe("formatDatePicture: the Word date-time picture", () => {
  it.each([
    ["d", "7"],
    ["dd", "07"],
    ["ddd", "Wed"],
    ["dddd", "Wednesday"],
    ["M", "1"],
    ["MM", "01"],
    ["MMM", "Jan"],
    ["MMMM", "January"],
    ["yy", "26"],
    ["yyyy", "2026"],
    ["h", "12"],
    ["hh", "12"],
    ["H", "0"],
    ["HH", "00"],
    ["m", "3"],
    ["mm", "03"],
    ["s", "4"],
    ["ss", "04"],
    ["am/pm", "am"],
    ["AM/PM", "AM"],
  ])("%s -> %s", (picture, out) => {
    expect(formatDatePicture(MORNING, picture)).toBe(out);
  });

  it("keeps text in single quotes literal", () => {
    expect(formatDatePicture(NOW, "'Printed on' d MMMM")).toBe("Printed on 1 November");
    expect(formatDatePicture(NOW, "HH'h'mm")).toBe("14h05");
  });

  it("keeps other characters literal", () => {
    expect(formatDatePicture(NOW, "yyyy.MM.dd at HH:mm")).toBe("2026.11.01 at 14:05");
  });

  it("treats an unterminated quote as literal to the end", () => {
    expect(formatDatePicture(NOW, "d 'of MMMM")).toBe("1 of MMMM");
  });

  it("tells months (M) from minutes (m) and 24h (H) from 12h (h)", () => {
    expect(formatDatePicture(NOW, "M m H h")).toBe("11 5 14 2");
  });
});

describe("substituteFields: the grammar -- anything else stays literal", () => {
  it.each([
    "{Page}",
    "{PAGES}",
    "{Author}",
    "{page }",
    "{ page}",
    "{pagesx}",
    "{date:}",
    "{date:a\"b}",
    "{date:a\\b}",
    "{date:a{b}",
    "{time:}",
    "{unknown}",
    "{meta.author}",
    "{page:1}",
    "{title:x}",
    "{}",
  ])("%s stays literal", (token) => {
    expect(substituteFields(token, f({ author: "A", title: "T" }))).toBe(token);
  });

  it("a FORMAT may not contain a closing brace, so the token ends at the first one", () => {
    expect(substituteFields("{date:yyyy}}", f())).toBe("2026}");
  });
});

describe("resolveNow: the `now` prop", () => {
  it("takes a Date", () => {
    expect(resolveNow(NOW).getTime()).toBe(NOW.getTime());
  });

  it("takes an ISO string (JSON-friendly)", () => {
    expect(resolveNow("2026-11-01T14:05:09").getTime()).toBe(NOW.getTime());
  });

  it("falls back to the current time for nothing or an invalid value", () => {
    const before = Date.now();
    for (const v of [undefined, "not a date", new Date(Number.NaN)]) {
      const t = resolveNow(v).getTime();
      expect(t).toBeGreaterThanOrEqual(before);
      expect(t).toBeLessThanOrEqual(Date.now());
    }
  });
});
