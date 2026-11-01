import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, type DocViewerLayout } from "../src";
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

const para = (t: string) => ({ type: "paragraph" as const, runs: [{ text: t }] });

describe("DocViewer", () => {
  it("draws a page with stable handles for the viewer, the page and each block", () => {
    const el = render(<DocViewer doc={{ blocks: [para("Hello"), para("World")] }} />);
    expect(el.querySelector("[data-lw-viewer]")).not.toBeNull();
    expect(pages(el).map((p) => p.dataset.page)).toEqual(["1"]);
    const blocks = Array.from(pages(el)[0]!.querySelectorAll<HTMLElement>("[data-block]")).map((b) => b.dataset.block);
    expect(blocks).toEqual(["b0", "b1"]);
    expect(text(pages(el)[0])).toContain("Hello");
  });

  it("starts a page at every explicit page break and numbers each page's footer live", () => {
    const doc: Doc = {
      blocks: [para("one"), { type: "pageBreak" }, para("two"), { type: "pageBreak" }, para("three")],
      page: { footer: { center: "Page {page} of {pages}" }, header: { left: "Memo", right: "{page}/{pages}" } },
    };
    const el = render(<DocViewer doc={doc} />);
    const ps = pages(el);
    expect(ps).toHaveLength(3);
    expect(ps.map((p) => text(p.querySelector('[data-lw-band="footer"]')))).toEqual([
      "Page 1 of 3",
      "Page 2 of 3",
      "Page 3 of 3",
    ]);
    expect(text(ps[1]!.querySelector('[data-lw-band="header"] [data-lw-slot="right"]'))).toBe("2/3");
    expect(text(ps[2])).toContain("three");
  });

  it("puts {page} fields in a blocks band (a letterhead) too, but leaves them literal in the body", () => {
    const doc: Doc = {
      blocks: [para("Body says {page}")],
      page: { header: { blocks: [para("Acme Ltd"), para("Page {page}")] } },
    };
    const el = render(<DocViewer doc={doc} />);
    expect(text(el.querySelector('[data-page="1"] [data-lw-band="header"]'))).toBe("Acme LtdPage 1");
    expect(text(el.querySelector('[data-page="1"] [data-lw-body]'))).toContain("Body says {page}");
  });

  it.each([
    ["letter", "portrait", "612pt", "792pt"],
    ["legal", "portrait", "612pt", "1008pt"],
    ["a4", "landscape", "841.9pt", "595.3pt"],
  ] as const)("lays a %s %s page out at its paper size", (size, orientation, w, h) => {
    const el = render(<DocViewer doc={{ blocks: [para("x")], page: { size, orientation } }} />);
    const sheet = el.querySelector<HTMLElement>('[data-page="1"] [data-lw-sheet]')!;
    expect([sheet.style.width, sheet.style.height]).toEqual([w, h]);
  });

  it("places the header and footer at their distances, defaulting to half an inch", () => {
    const el = render(
      <DocViewer doc={{ blocks: [para("x")], page: { header: { left: "H" }, footer: { left: "F" }, margins: { footer: 20 } } }} />,
    );
    expect(el.querySelector<HTMLElement>('[data-lw-band="header"]')!.style.top).toBe("36pt");
    expect(el.querySelector<HTMLElement>('[data-lw-band="footer"]')!.style.bottom).toBe("20pt");
  });

  it("numbers footnote marks in order and sets the notes at the foot of their page", () => {
    const doc: Doc = {
      blocks: [
        { type: "paragraph", runs: [{ text: "Revenue rose" }, { text: "", footnote: { blocks: [para("Audited.")] } }] },
        { type: "pageBreak" },
        { type: "paragraph", runs: [{ text: "Costs fell" }, { text: "", footnote: { blocks: [para("Unaudited.")] } }] },
      ],
    };
    const el = render(<DocViewer doc={doc} />);
    const [p1, p2] = pages(el);
    expect(Array.from(p1!.querySelectorAll("[data-lw-footnote-ref]")).map((m) => m.textContent)).toEqual(["1"]);
    expect(Array.from(p2!.querySelectorAll("[data-lw-footnote-ref]")).map((m) => m.textContent)).toEqual(["2"]);
    expect(text(p1!.querySelector('[data-lw-footnotes] [data-footnote="1"]'))).toBe("1Audited.");
    expect(text(p2!.querySelector('[data-lw-footnotes] [data-footnote="2"]'))).toBe("2Unaudited.");
    expect(p1!.querySelector('[data-footnote="2"]')).toBeNull();
  });

  it("draws a table with its header fill, cell shading, spans and column widths", () => {
    const doc: Doc = {
      blocks: [
        {
          type: "table",
          widths: [1, 3],
          rows: [
            { header: true, cells: [{ blocks: [para("Item")] }, { blocks: [para("Amount")], shading: "#1F3A5F" }] },
            { cells: [{ blocks: [para("A")], colSpan: 2, valign: "center" }] },
          ],
        },
      ],
    };
    const el = render(<DocViewer doc={doc} />);
    const table = el.querySelector('[data-page="1"] [data-block="b0"]')!;
    const sizer = Array.from(table.querySelectorAll<HTMLElement>("[data-lw-sizer] td")).map((td) => td.style.width);
    expect(sizer).toEqual(["25%", "75%"]);
    const h0 = table.querySelector<HTMLElement>('[data-lw-cell="0:0"]')!;
    const h1 = table.querySelector<HTMLElement>('[data-lw-cell="0:1"]')!;
    expect(h0.tagName).toBe("TH");
    expect(h0.style.backgroundColor).toBe("rgb(231, 231, 231)");
    expect(h1.style.backgroundColor).toBe("rgb(31, 58, 95)");
    expect(h0.querySelector("span")!.style.fontWeight).toBe("700");
    const merged = table.querySelector<HTMLElement>('[data-lw-cell="1:0"]')!;
    expect(merged.getAttribute("colspan")).toBe("2");
    expect(merged.style.verticalAlign).toBe("middle");
  });

  it("removes a table's default borders only where the document says none", () => {
    const none = { style: "none" as const };
    const doc: Doc = {
      blocks: [
        {
          type: "table",
          borders: { top: none, bottom: none, left: none, right: none, insideH: none, insideV: none },
          rows: [{ cells: [{ blocks: [para("a")] }] }],
        },
        { type: "table", rows: [{ cells: [{ blocks: [para("b")] }] }] },
      ],
    };
    const el = render(<DocViewer doc={doc} />);
    const cell = (b: string) => el.querySelector<HTMLElement>(`[data-page="1"] [data-block="${b}"] [data-lw-cell="0:0"]`)!;
    expect(cell("b0").style.borderTop).not.toContain("solid");
    expect(cell("b1").style.borderTop).toContain("solid");
  });

  it("styles runs and paragraphs as the reader returns them", () => {
    const doc: Doc = {
      blocks: [
        {
          type: "paragraph",
          align: "right",
          shading: "#FFF4CE",
          indentLeft: 18,
          borders: { left: { style: "single", width: 3, color: "#C00000" } },
          runs: [{ text: "Decision", bold: true, color: "#1F3A5F", size: 14, italic: true, underline: true }],
        },
      ],
    };
    const el = render(<DocViewer doc={doc} />);
    const p = el.querySelector<HTMLElement>('[data-page="1"] [data-block="b0"] p')!;
    expect(p.style.textAlign).toBe("right");
    expect(p.style.backgroundColor).toBe("rgb(255, 244, 206)");
    expect(p.style.marginLeft).toBe("18pt");
    expect(p.style.borderLeft).toBe("3pt solid rgb(192, 0, 0)");
    const span = p.querySelector("span")!;
    expect([span.style.fontWeight, span.style.fontStyle, span.style.fontSize, span.style.textDecoration]).toEqual([
      "700",
      "italic",
      "14pt",
      "underline",
    ]);
    expect(span.style.color).toBe("rgb(31, 58, 95)");
  });

  it("never puts a javascript: link in an href", () => {
    const doc: Doc = {
      blocks: [{ type: "paragraph", runs: [{ text: "bad", link: "javascript:alert(1)" }, { text: "good", link: "https://example.com/" }] }],
    };
    const el = render(<DocViewer doc={doc} />);
    const hrefs = Array.from(el.querySelectorAll('[data-page] a')).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://example.com/"]);
  });

  it("draws only embedded images: a remote src is never requested", () => {
    const doc: Doc = { blocks: [{ type: "image", src: "https://tracker.example/pixel.png", alt: "logo", widthPx: 10, heightPx: 10 }] };
    const el = render(<DocViewer doc={doc} />);
    expect(el.querySelectorAll("img")).toHaveLength(0);
    expect(text(el.querySelector('[data-page="1"] [data-lw-image-missing]'))).toBe("logo");
  });

  it("refuses a colour that is not #RRGGBB rather than passing it to CSS", () => {
    const doc: Doc = { blocks: [{ type: "paragraph", shading: "url(https://x.example/a)", runs: [{ text: "x", color: "red;" }] }] };
    const el = render(<DocViewer doc={doc} />);
    const p = el.querySelector<HTMLElement>('[data-page="1"] p')!;
    expect(p.style.backgroundColor).toBe("");
    expect(p.querySelector("span")!.style.color).toBe("");
  });

  it("reports its layout as JSON", () => {
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    render(<DocViewer doc={{ blocks: [para("a"), { type: "pageBreak" }, para("b")], page: { size: "a4" } }} onLayout={onLayout} scale={0.5} />);
    const last = onLayout.mock.calls[onLayout.mock.calls.length - 1]![0];
    expect(last).toEqual({ pages: 2, pageWidth: 595.3, pageHeight: 841.9, scale: 0.5 });
    expect(JSON.parse(JSON.stringify(last))).toEqual(last);
  });

  it("scales the whole page rather than reflowing it", () => {
    const el = render(<DocViewer doc={{ blocks: [para("a")] }} scale={0.5} />);
    const page = el.querySelector<HTMLElement>('[data-page="1"]')!;
    const sheet = page.querySelector<HTMLElement>("[data-lw-sheet]")!;
    expect(sheet.style.transform).toBe("scale(0.5)");
    expect(sheet.style.width).toBe("612pt");
    expect(page.style.width).toBe("408px");
  });
});
