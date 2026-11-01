import { CARLITO_FAMILY, DEFAULT_FONT } from "./style";
import type { Block, Doc, Run } from "./types";

/**
 * The bundled Carlito: the font the viewer draws Calibri and unspecified text
 * in, so every machine paginates the same document identically.
 *
 * Carlito is metric-compatible with Calibri (every printable ASCII and Latin-1
 * advance equal in all four styles), so a line breaks where Calibri would.
 * It ships UNMODIFIED from googlefonts/carlito (`fonts/`, with its OFL and a
 * NOTICE) under a package-unique family name, so a page's own "Carlito" or
 * "Calibri" never shadows it and it never shadows theirs.
 */
export { CARLITO_FAMILY };

export interface CarlitoFace {
  file: string;
  weight: 400 | 700;
  style: "normal" | "italic";
  /** sha256 of the upstream file; a test pins the shipped bytes to it. */
  sha256: string;
}

export const CARLITO_FACES: readonly CarlitoFace[] = [
  { file: "Carlito-Regular.ttf", weight: 400, style: "normal", sha256: "f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595" },
  { file: "Carlito-Bold.ttf", weight: 700, style: "normal", sha256: "bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db" },
  { file: "Carlito-Italic.ttf", weight: 400, style: "italic", sha256: "0b019225e58d702bfedcbd35c21696769f8ee115cb6343f84c2f240312450d1c" },
  { file: "Carlito-BoldItalic.ttf", weight: 700, style: "italic", sha256: "b32928186c119599e03ca6a1ffc680fdcb7fac95772f4b95d989cf6cd3861517" },
];

/** The four `@font-face` rules, each face at the URL `url(file)` returns. */
export function fontFaceCss(url: (file: string) => string): string {
  return CARLITO_FACES.map(
    (f) =>
      `@font-face { font-family: "${CARLITO_FAMILY}"; font-weight: ${f.weight}; font-style: ${f.style}; font-display: swap; src: url("${url(f.file)}") format("truetype"); }`,
  ).join("\n");
}

const clean = (name: unknown): string => (typeof name === "string" ? name.replace(/[^A-Za-z0-9 _-]/g, "").trim() : "");

/** True when a font name resolves to the bundled Carlito (Calibri, or nothing). */
export function usesCarlito(name: unknown): boolean {
  const n = clean(name);
  return (n === "" ? DEFAULT_FONT : n).toLowerCase() === "calibri";
}

/**
 * The faces a document draws in the bundled Carlito, as `FontFaceSet.load()`
 * descriptors, in a fixed order. Only those are fetched: a plain memo never
 * downloads the italic faces.
 */
export function carlitoFaces(doc: Doc): string[] {
  const used = new Set<string>();
  const docCarlito = usesCarlito(doc?.defaultFont);

  const runs = (list: unknown, bold: boolean, italic: boolean): void => {
    if (!Array.isArray(list)) return;
    for (const r of list as Run[]) {
      if (!r || typeof r !== "object") continue;
      // A footnote's blocks render in the same family, upright and regular.
      if (r.footnote && typeof r.footnote === "object") blocks(r.footnote.blocks, false, false);
      const hasFont = typeof r.font === "string" && r.font !== "";
      if (r.code || !(hasFont ? usesCarlito(r.font) : docCarlito)) continue;
      used.add(`${bold || r.bold ? 700 : 400}:${italic || r.italic ? "italic" : "normal"}`);
    }
  };
  const blocks = (list: unknown, bold: boolean, italic: boolean): void => {
    if (!Array.isArray(list)) return;
    for (const b of list as Block[]) {
      if (!b || typeof b !== "object") continue;
      switch (b.type) {
        case "paragraph":
          runs(b.runs, bold, italic);
          break;
        case "heading":
          runs(b.runs, true, italic);
          break;
        case "list": {
          const items = (xs: unknown): void => {
            if (!Array.isArray(xs)) return;
            for (const it of xs as Array<{ runs?: unknown; children?: unknown }>) {
              runs(it?.runs, bold, italic);
              items(it?.children);
            }
          };
          items(b.items);
          break;
        }
        case "quote":
          blocks(b.blocks, bold, true);
          break;
        case "table":
          for (const row of Array.isArray(b.rows) ? b.rows : []) {
            for (const cell of Array.isArray(row?.cells) ? row.cells : []) blocks(cell?.blocks, bold || row.header === true, italic);
          }
          break;
        default:
          break;
      }
    }
  };

  blocks(doc?.blocks, false, false);
  const page = doc?.page && typeof doc.page === "object" ? (doc.page as Record<string, unknown>) : {};
  for (const key of ["header", "footer", "firstHeader", "firstFooter", "evenHeader", "evenFooter"]) {
    const band = page[key] as { blocks?: unknown; left?: unknown; center?: unknown; right?: unknown } | undefined;
    if (!band || typeof band !== "object") continue;
    if (Array.isArray(band.blocks)) blocks(band.blocks, false, false);
    else if (docCarlito && [band.left, band.center, band.right].some((s) => typeof s === "string" && s !== "")) used.add("400:normal");
  }

  return CARLITO_FACES.filter((f) => used.has(`${f.weight}:${f.style}`)).map(
    (f) => `${f.weight} ${f.style} 16px "${CARLITO_FAMILY}"`,
  );
}
