/**
 * The real last-word-js, end to end: a Doc written to .docx bytes, read back by
 * its DocxReader, and drawn by the viewer. last-word is a DEV dependency only;
 * this is what proves the viewer's own types and rendering agree with what the
 * reader actually returns.
 */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { DocxReader, DocxWriter, type Doc as LastWordDoc } from "@particle-academy/last-word";
import { DocViewer, docFromReader, type Doc } from "../src";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("last-word-js reader output", () => {
  it("is assignable to this package's Doc without a cast", () => {
    const read: LastWordDoc = { blocks: [{ type: "paragraph", runs: [{ text: "x" }] }], page: { size: "a4" } };
    // Compile-time: the line below is the assertion (tsc runs over tests/).
    const viewerDoc: Doc = read;
    expect(viewerDoc).toBe(read);
  });

  it("round-trips a memo through .docx bytes and renders its bands, table and styling", () => {
    const source = {
      title: "Board memo",
      page: {
        size: "legal",
        margins: { left: 54 },
        footer: { left: "Q3 2026 Board Memo", right: "Page {page} of {pages}" },
      },
      blocks: [
        { type: "heading", level: 1, runs: [{ text: "Q3 results", color: "#1F3A5F" }] },
        {
          type: "table",
          widths: [2, 1],
          rows: [
            {
              header: true,
              cells: [
                { blocks: [{ type: "paragraph", runs: [{ text: "Line", color: "#FFFFFF" }] }], shading: "#1F3A5F" },
                { blocks: [{ type: "paragraph", runs: [{ text: "USD", color: "#FFFFFF" }] }], shading: "#1F3A5F" },
              ],
            },
            {
              cells: [
                { blocks: [{ type: "paragraph", runs: [{ text: "Revenue" }] }] },
                { blocks: [{ type: "paragraph", align: "right", runs: [{ text: "1,200" }] }] },
              ],
            },
          ],
        },
      ],
    };
    const bytes = new DocxWriter().toBytes(source as never);
    const doc = docFromReader(new DocxReader().read(bytes));

    expect(doc.page?.size).toBe("legal");
    expect(doc.page?.margins).toEqual({ left: 54 }); // 1in sides omitted by the reader

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<DocViewer doc={doc} />));

    const page = host.querySelector<HTMLElement>('[data-page="1"]')!;
    expect(page.querySelector<HTMLElement>("[data-lw-sheet]")!.style.height).toBe("1008pt");
    expect(page.querySelector<HTMLElement>("[data-lw-body]")!.style.left).toBe("54pt");
    expect(page.querySelector('[data-lw-band="footer"]')!.textContent).toContain("Page 1 of 1");
    const header = page.querySelector<HTMLElement>('[data-lw-cell="0:0"]')!;
    expect(header.style.backgroundColor).toBe("rgb(31, 58, 95)");
    expect(header.querySelector("span")!.style.color).toBe("rgb(255, 255, 255)");
    expect(page.querySelector<HTMLElement>('[data-lw-cell="1:1"] p')!.style.textAlign).toBe("right");
    expect(page.querySelector("h1")!.textContent).toBe("Q3 results");

    act(() => root.unmount());
    host.remove();
  });

  it("docFromReader parses JSON over the wire and refuses what is not a Doc", () => {
    expect(docFromReader('{"blocks":[]}')).toEqual({ blocks: [] });
    expect(() => docFromReader("nope")).toThrow(TypeError);
    expect(() => docFromReader({})).toThrow(/blocks/);
    expect(() => docFromReader([])).toThrow(TypeError);
  });
});
