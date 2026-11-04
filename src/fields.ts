/**
 * The live values a header or footer's field tokens take on one page.
 *
 * Only `page` and `pages` are required, so a 0.1.x caller of
 * `substituteFields(text, { page, pages })` is unchanged; every other value
 * has a documented fallback.
 */
export interface PageFields {
  /** 1-based. */
  page: number;
  pages: number;
  /** `{section}`: which stretch the page is in, 1-based, as Word's SECTION. 1 when absent. */
  section?: number;
  /** `{sectionpages}`: the pages of that stretch, as Word's SECTIONPAGES. The page total when absent. */
  sectionPages?: number;
  /** `{author}`: `doc.meta.author`. Empty when absent. */
  author?: string;
  /** `{title}`: the top-level `doc.title` (there is deliberately no `meta.title`). Empty when absent. */
  title?: string;
  /** `{filename}`: the viewer cannot know it, so it is a prop. Empty when absent. */
  filename?: string;
  /** `{date}` / `{time}` are "as of" this moment. The current time when absent. */
  now?: Date;
}

/**
 * The token grammar, matching PHP last-word 0.16.0's `Schema::FIELD_TOKEN`:
 * lower-case names, exact; `{date}` / `{time}` may take `:FORMAT`, one or
 * more characters that are not a brace, a double quote or a backslash.
 * Anything else in braces is literal text.
 */
const FIELD = /\{(?:(page|pages|section|sectionpages|author|title|filename)|(date|time)(?::([^{}"\\]+))?)\}/g;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Text with its field tokens replaced by this page's values -- the PAGE,
 * NUMPAGES, SECTION, SECTIONPAGES, AUTHOR, TITLE, FILENAME, DATE and TIME
 * fields last-word writes into a band. Only in bands: in the body the same
 * characters are literal text, as they are in the written file.
 *
 * Returns a plain string; the caller renders it as a React text node, so a
 * value full of markup (an untrusted author) stays text.
 */
export function substituteFields(text: string, fields: PageFields): string {
  return text.replace(FIELD, (_m, name: string | undefined, dt: string | undefined, format: string | undefined) => {
    switch (name) {
      case "page":
        return String(fields.page);
      case "pages":
        return String(fields.pages);
      case "section":
        return String(fields.section ?? 1);
      case "sectionpages":
        return String(fields.sectionPages ?? fields.pages);
      case "author":
        return str(fields.author);
      case "title":
        return str(fields.title);
      case "filename":
        return str(fields.filename);
    }
    const now = fields.now instanceof Date && Number.isFinite(fields.now.getTime()) ? fields.now : new Date();
    if (format !== undefined) return formatDatePicture(now, format);
    return dt === "time" ? now.toLocaleTimeString() : now.toLocaleDateString();
  });
}

/**
 * The `now` prop as a Date: a Date or an ISO-8601 string (JSON-friendly). A
 * missing or unparseable value is the current time.
 */
export function resolveNow(now: Date | string | undefined | null): Date {
  if (now instanceof Date) return Number.isFinite(now.getTime()) ? new Date(now.getTime()) : new Date();
  if (typeof now === "string") {
    const d = new Date(now);
    if (Number.isFinite(d.getTime())) return d;
  }
  return new Date();
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Longest first, so `dddd` wins over `d` and `am/pm` over `m`. Case-sensitive: M is month, m minute. */
const PICTURE = [
  "AM/PM",
  "am/pm",
  "dddd",
  "MMMM",
  "yyyy",
  "ddd",
  "MMM",
  "dd",
  "MM",
  "yy",
  "HH",
  "hh",
  "mm",
  "ss",
  "d",
  "M",
  "H",
  "h",
  "m",
  "s",
] as const;

const two = (n: number): string => String(n).padStart(2, "0");

/**
 * A Word date-time picture, formatted in LOCAL time: d dd ddd dddd, M MM MMM
 * MMMM, yy yyyy, h hh (12-hour), H HH (24-hour), m mm, s ss, am/pm, AM/PM.
 * Text in single quotes is literal (an unterminated quote runs to the end);
 * every other character is literal. Names are English, as Word writes them
 * for an English document. Pure string work: no third-party code, no eval.
 */
export function formatDatePicture(date: Date, picture: string): string {
  const h12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  const value = (token: (typeof PICTURE)[number]): string => {
    switch (token) {
      case "d":
        return String(date.getDate());
      case "dd":
        return two(date.getDate());
      case "ddd":
        return DAYS[date.getDay()]!.slice(0, 3);
      case "dddd":
        return DAYS[date.getDay()]!;
      case "M":
        return String(date.getMonth() + 1);
      case "MM":
        return two(date.getMonth() + 1);
      case "MMM":
        return MONTHS[date.getMonth()]!.slice(0, 3);
      case "MMMM":
        return MONTHS[date.getMonth()]!;
      case "yy":
        return two(date.getFullYear() % 100);
      case "yyyy":
        return String(date.getFullYear()).padStart(4, "0");
      case "h":
        return String(h12);
      case "hh":
        return two(h12);
      case "H":
        return String(date.getHours());
      case "HH":
        return two(date.getHours());
      case "m":
        return String(date.getMinutes());
      case "mm":
        return two(date.getMinutes());
      case "s":
        return String(date.getSeconds());
      case "ss":
        return two(date.getSeconds());
      case "am/pm":
        return date.getHours() < 12 ? "am" : "pm";
      case "AM/PM":
        return date.getHours() < 12 ? "AM" : "PM";
    }
  };

  let out = "";
  let i = 0;
  while (i < picture.length) {
    if (picture[i] === "'") {
      const end = picture.indexOf("'", i + 1);
      if (end < 0) {
        out += picture.slice(i + 1);
        break;
      }
      out += picture.slice(i + 1, end);
      i = end + 1;
      continue;
    }
    const token = PICTURE.find((t) => picture.startsWith(t, i));
    if (token) {
      out += value(token);
      i += token.length;
      continue;
    }
    out += picture[i];
    i++;
  }
  return out;
}
