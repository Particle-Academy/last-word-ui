/**
 * The viewer draws last-word 0.16.0's band variants and field tokens: each page
 * its own header and footer, tokens only in bands, as plain text.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocViewer } from "../src";
import type { Doc } from "../src/types";

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

function render(el: React.ReactElement): HTMLElement {
  act(() => root.render(el));
  return host;
}
const pages = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>("[data-page]"));
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/​/g, "");
const band = (p: HTMLElement, kind: "header" | "footer") => p.querySelector(`[data-lw-band="${kind}"]`);
const para = (t: string) => ({ type: "paragraph" as const, runs: [{ text: t }] });
const fourPages = [para("one"), { type: "pageBreak" as const }, para("two"), { type: "pageBreak" as const }, para("three"), { type: "pageBreak" as const }, para("four")];

describe("DocViewer: band variants per page", () => {
  it("draws the first, even and default bands on the right pages", () => {
    const doc: Doc = {
      blocks: fourPages,
      page: {
        header: { left: "odd header" },
        firstHeader: { blocks: [para("Acme letterhead")] },
        evenHeader: { left: "even header" },
        footer: { center: "odd {page}" },
        firstFooter: { center: "first {page}" },
        evenFooter: { center: "even {page}" },
      },
    };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(ps.map((p) => text(band(p, "header")))).toEqual(["Acme letterhead", "even header", "odd header", "even header"]);
    expect(ps.map((p) => text(band(p, "footer")))).toEqual(["first 1", "even 2", "odd 3", "even 4"]);
  });

  it("names the variant each page drew", () => {
    const doc: Doc = { blocks: fourPages, page: { header: { left: "h" }, firstHeader: { left: "f" }, evenHeader: { left: "e" } } };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(ps.map((p) => band(p, "header")!.getAttribute("data-lw-band-variant"))).toEqual(["first", "even", "default", "even"]);
  });

  it("blanks page 1's header when firstHeader is {blocks: []}", () => {
    const doc: Doc = { blocks: fourPages.slice(0, 3), page: { header: { left: "running" }, firstHeader: { blocks: [] } } };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(band(ps[0]!, "header")).toBeNull();
    expect(text(band(ps[1]!, "header"))).toBe("running");
  });

  it("draws a first-only letterhead on page 1 and no header after", () => {
    const doc: Doc = { blocks: fourPages.slice(0, 3), page: { firstHeader: { left: "letterhead" } } };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(text(band(ps[0]!, "header"))).toBe("letterhead");
    expect(band(ps[1]!, "header")).toBeNull();
  });

  it("gives a single-page document its first-page band", () => {
    const doc: Doc = { blocks: [para("only")], page: { header: { left: "running" }, firstHeader: { left: "first" } } };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(ps).toHaveLength(1);
    expect(text(band(ps[0]!, "header"))).toBe("first");
  });
});

describe("DocViewer: field tokens", () => {
  const now = "2026-11-01T14:05:09";

  it("fills every token in a band from the doc and the props", () => {
    const doc: Doc = {
      title: "Q3 Board Memo",
      meta: { author: "A. Writer" },
      blocks: [para("x"), { type: "pageBreak" }, para("y")],
      page: {
        header: { left: "{title} by {author}", center: "{filename}", right: "{section}/{sectionpages}" },
        footer: { left: "{date:d MMMM yyyy}", center: "{time:HH:mm}", right: "{page} of {pages}" },
      },
    };
    const ps = pages(render(<DocViewer doc={doc} filename="memo.docx" now={now} />));
    const slots = (p: HTMLElement, kind: "header" | "footer") =>
      Array.from(band(p, kind)!.querySelectorAll("[data-lw-slot]")).map((s) => text(s));
    expect(slots(ps[1]!, "header")).toEqual(["Q3 Board Memo by A. Writer", "memo.docx", "1/2"]);
    expect(slots(ps[1]!, "footer")).toEqual(["1 November 2026", "14:05", "2 of 2"]);
  });

  it("takes `now` as a Date too", () => {
    const doc: Doc = { blocks: [para("x")], page: { footer: { center: "{date:yyyy-MM-dd} {time:H:mm}" } } };
    const ps = pages(render(<DocViewer doc={doc} now={new Date(2026, 0, 2, 9, 30)} />));
    expect(text(band(ps[0]!, "footer"))).toBe("2026-01-02 9:30");
  });

  it("fills tokens in a blocks band", () => {
    const doc: Doc = { title: "T", blocks: [para("x")], page: { firstHeader: { blocks: [para("{title} {date:yyyy}")] } } };
    const ps = pages(render(<DocViewer doc={doc} now={now} />));
    expect(text(band(ps[0]!, "header"))).toBe("T 2026");
  });

  it("reads {title} from doc.title, not meta", () => {
    const doc = { title: "Top title", meta: { title: "Meta title", author: "A" }, blocks: [para("x")], page: { header: { left: "{title}" } } } as Doc;
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(text(band(ps[0]!, "header"))).toBe("Top title");
  });

  it("leaves {author}, {title} and {filename} empty when unknown", () => {
    const doc: Doc = { blocks: [para("x")], page: { header: { left: "[{author}|{title}|{filename}]" } } };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(text(band(ps[0]!, "header"))).toBe("[||]");
  });

  it("ignores an author or title that is not a string", () => {
    const doc = { title: 42, meta: { author: { x: 1 } }, blocks: [para("x")], page: { header: { left: "[{author}|{title}]" } } } as unknown as Doc;
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(text(band(ps[0]!, "header"))).toBe("[|]");
  });

  it("leaves unknown tokens literal in a band", () => {
    const doc: Doc = { blocks: [para("x")], page: { header: { left: "{Title} {unknown} {date:}" } } };
    const ps = pages(render(<DocViewer doc={doc} />));
    expect(text(band(ps[0]!, "header"))).toBe("{Title} {unknown} {date:}");
  });

  it("leaves every token literal in the body", () => {
    const body = "{page} {pages} {section} {sectionpages} {author} {title} {filename} {date} {time:HH:mm}";
    const doc: Doc = { title: "T", meta: { author: "A" }, blocks: [para(body)], page: { header: { left: "{title}" } } };
    const ps = pages(render(<DocViewer doc={doc} filename="f.docx" now={now} />));
    expect(text(ps[0]!.querySelector("[data-lw-body]"))).toContain(body);
  });

  it("renders an author full of markup as plain text, never HTML", () => {
    const doc: Doc = { meta: { author: "<img src=x onerror=alert(1)>" }, blocks: [para("x")], page: { header: { left: "{author}" } } };
    const el = render(<DocViewer doc={doc} filename="<b>f</b>" />);
    const h = band(pages(el)[0]!, "header")!;
    expect(text(h)).toBe("<img src=x onerror=alert(1)>");
    expect(el.querySelector("[data-page] img")).toBeNull();
  });
});
