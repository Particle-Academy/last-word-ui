import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, type DocViewerLayout } from "../src";
import { FONT_LOAD_TIMEOUT_MS } from "../src/DocViewer";
import { typography } from "../src/style";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/** A stand-in FontFaceSet: `load()` returns a promise the test settles. */
function fakeFonts() {
  let settle!: { resolve: (v: unknown[]) => void; reject: (e: unknown) => void };
  const pending = new Promise<unknown[]>((resolve, reject) => {
    settle = { resolve, reject };
  });
  const fonts = { load: vi.fn(() => pending), ready: Promise.resolve(), check: vi.fn(() => true) };
  Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
  return { fonts, settle };
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (document as { fonts?: unknown }).fonts;
  vi.useRealTimers();
});

const doc = { blocks: [{ type: "paragraph" as const, runs: [{ text: "Hello" }] }] };
const pages = () => host.querySelectorAll("[data-page]").length;

describe("DocViewer and the bundled font", () => {
  it("does not paginate, draw or report until the Carlito faces it needs have loaded", async () => {
    const { fonts, settle } = fakeFonts();
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    act(() => root.render(<DocViewer doc={doc} onLayout={onLayout} />));

    expect(fonts.load).toHaveBeenCalledWith('400 normal 16px "LW Carlito"');
    expect(pages()).toBe(0);
    expect(onLayout).not.toHaveBeenCalled();

    await act(async () => {
      settle.resolve([{}]);
      await Promise.resolve();
    });
    expect(pages()).toBe(1);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(onLayout.mock.calls[0]![0].font).toBe("carlito");
    expect(host.querySelector("[data-lw-viewer]")!.getAttribute("data-lw-font")).toBe("carlito");
  });

  it("lays out with the fallback, and SAYS so, when the font cannot load", async () => {
    const { settle } = fakeFonts();
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    act(() => root.render(<DocViewer doc={doc} onLayout={onLayout} />));
    await act(async () => {
      settle.reject(new Error("404"));
      await Promise.resolve();
    });
    expect(pages()).toBe(1);
    expect(onLayout.mock.calls.at(-1)![0].font).toBe("fallback");
  });

  it("stops waiting after a timeout, so a blocked font never leaves the viewer empty", async () => {
    vi.useFakeTimers();
    fakeFonts();
    const onLayout = vi.fn<(l: DocViewerLayout) => void>();
    act(() => root.render(<DocViewer doc={doc} onLayout={onLayout} />));
    expect(pages()).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(FONT_LOAD_TIMEOUT_MS + 1);
      await Promise.resolve();
    });
    expect(pages()).toBe(1);
    expect(onLayout.mock.calls.at(-1)![0].font).toBe("fallback");
  });

  it("does not wait at all for a document with no Calibri text", () => {
    const { fonts } = fakeFonts();
    act(() => root.render(<DocViewer doc={{ ...doc, defaultFont: "Arial" }} />));
    expect(fonts.load).not.toHaveBeenCalled();
    expect(pages()).toBe(1);
  });
});

describe("typography", () => {
  it("turns off kerning and ligatures, as Word does by default, so a line is the sum of its advances", () => {
    const t = typography(undefined, 11);
    expect(t.fontKerning).toBe("none");
    expect(t.fontVariantLigatures).toBe("none");
    expect(t.fontFamily).toMatch(/^"LW Carlito", /);
    expect(t.fontSize).toBe("11pt");
  });
});
