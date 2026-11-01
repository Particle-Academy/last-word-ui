import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fontFaceCss } from "../src/fonts";
import { VIEWER_CSS } from "../src/viewer-css";

const rules = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

describe("styles.css", () => {
  it("is the font faces plus the same rules the viewer injects, so the strict-CSP route renders identically", () => {
    const stylesheet = readFileSync("src/styles.css", "utf8");
    // Relative to the stylesheet: src/styles.css and dist/styles.css both sit
    // one level below fonts/, so a bundler resolves the same files from either.
    expect(rules(stylesheet)).toEqual(rules(fontFaceCss((file) => `../fonts/${file}`) + "\n" + VIEWER_CSS));
  });

  it("references fonts that exist where a bundler will look for them", () => {
    const stylesheet = readFileSync("src/styles.css", "utf8");
    const urls = Array.from(stylesheet.matchAll(/url\("([^"]+)"\)/g), (m) => m[1]!);
    expect(urls).toHaveLength(4);
    for (const u of urls) expect(() => readFileSync(resolve("src", u))).not.toThrow();
  });
});
