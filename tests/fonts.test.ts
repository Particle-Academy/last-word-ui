import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARLITO_FACES, CARLITO_FAMILY, carlitoFaces, fontFaceCss } from "../src/fonts";
import { fontStack } from "../src/style";
import type { Doc, Run } from "../src/types";

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("the bundled Carlito", () => {
  it("ships the four faces UNMODIFIED: Carlito 1.104 from googlefonts/carlito, byte for byte", () => {
    // The digests of the upstream files at googlefonts/carlito@3a810cab78
    // (identical blobs in google/fonts ofl/carlito). A re-encoded, subset or
    // re-hinted file changes these and fails here.
    expect(CARLITO_FACES.map((f) => [f.file, sha256(`fonts/${f.file}`)])).toEqual([
      ["Carlito-Regular.ttf", "f6418f708baede9789daef5d458c0f53d2a888af9820e8062934e504fedc6595"],
      ["Carlito-Bold.ttf", "bb5d20f79b82599ec72983597437373a80f2d2085fa91fc144fd74e876a594db"],
      ["Carlito-Italic.ttf", "0b019225e58d702bfedcbd35c21696769f8ee115cb6343f84c2f240312450d1c"],
      ["Carlito-BoldItalic.ttf", "b32928186c119599e03ca6a1ffc680fdcb7fac95772f4b95d989cf6cd3861517"],
    ]);
    expect(CARLITO_FACES.map((f) => f.sha256)).toEqual(CARLITO_FACES.map((f) => sha256(`fonts/${f.file}`)));
  });

  it("ships the OFL and a NOTICE beside the fonts, and publishes the folder", () => {
    expect(sha256("fonts/OFL.txt")).toBe("58402f82a7c332a700294988fe7554fbb0a63a8d27ccc1ee3bbc640311990a00");
    const notice = readFileSync("fonts/NOTICE", "utf8");
    expect(notice).toContain("Carlito");
    expect(notice).toContain("SIL Open Font License");
    expect(notice).toContain("3a810cab78ebd6e2e4eed42af9e8453c4f9b850a");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { files: string[]; exports: Record<string, unknown> };
    expect(pkg.files).toContain("fonts");
    expect(existsSync("fonts/Carlito-Regular.ttf")).toBe(true);
  });

  it("declares each face under the package-unique family, with the URL it is given", () => {
    const css = fontFaceCss((file) => `./x/${file}`);
    expect(CARLITO_FAMILY).toBe("LW Carlito");
    for (const f of CARLITO_FACES) {
      expect(css).toContain(`src: url("./x/${f.file}") format("truetype")`);
    }
    expect(css.match(/@font-face/g)).toHaveLength(4);
    expect(css).toContain('font-family: "LW Carlito"; font-weight: 700; font-style: italic;');
  });
});

describe("fontStack", () => {
  it("puts the bundled Carlito FIRST for Calibri and for an unspecified font", () => {
    expect(fontStack(undefined).startsWith('"LW Carlito", ')).toBe(true);
    expect(fontStack("").startsWith('"LW Carlito", ')).toBe(true);
    expect(fontStack("Calibri").startsWith('"LW Carlito", ')).toBe(true);
    expect(fontStack("calibri").startsWith('"LW Carlito", ')).toBe(true);
    // The old stack stays behind it, for a page the font never reaches.
    expect(fontStack("Calibri")).toContain('"Calibri", Carlito, "Segoe UI", Arial, sans-serif');
  });

  it("leaves every other explicit font as it was", () => {
    expect(fontStack("Arial")).toBe('"Arial", "Liberation Sans", Arimo, Helvetica, sans-serif');
    expect(fontStack("Georgia")).toBe('"Georgia", Carlito, "Segoe UI", Arial, sans-serif');
    expect(fontStack("Arial")).not.toContain("LW Carlito");
  });
});

describe("carlitoFaces", () => {
  const p = (runs: Run[]) => ({ type: "paragraph" as const, runs });

  it("asks for the regular face of a plain document, and nothing it does not draw", () => {
    expect(carlitoFaces({ blocks: [p([{ text: "Hi" }])] })).toEqual(['400 normal 16px "LW Carlito"']);
  });

  it("asks for bold for a heading, a bold run or a header row; italic for a quote; both when combined", () => {
    const doc: Doc = {
      blocks: [
        p([{ text: "plain" }]),
        { type: "heading", level: 1, runs: [{ text: "H" }] },
        { type: "quote", blocks: [p([{ text: "q" }]), p([{ text: "q", bold: true }])] },
      ],
    };
    expect(carlitoFaces(doc)).toEqual([
      '400 normal 16px "LW Carlito"',
      '700 normal 16px "LW Carlito"',
      '400 italic 16px "LW Carlito"',
      '700 italic 16px "LW Carlito"',
    ]);
    const table: Doc = { blocks: [{ type: "table", rows: [{ header: true, cells: [{ blocks: [p([{ text: "a" }])] }] }] }] };
    expect(carlitoFaces(table)).toContain('700 normal 16px "LW Carlito"');
  });

  it("asks for nothing when no text resolves to Calibri", () => {
    expect(carlitoFaces({ defaultFont: "Arial", blocks: [p([{ text: "x" }])] })).toEqual([]);
    expect(carlitoFaces({ defaultFont: "Arial", blocks: [p([{ text: "x", font: "Calibri" }])] })).toEqual(['400 normal 16px "LW Carlito"']);
  });

  it("looks into bands, footnotes, lists and table cells", () => {
    const doc: Doc = {
      defaultFont: "Arial",
      page: { firstHeader: { blocks: [p([{ text: "x", font: "Calibri", italic: true }])] } },
      blocks: [],
    };
    expect(carlitoFaces(doc)).toEqual(['400 italic 16px "LW Carlito"']);
  });
});
