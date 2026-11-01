import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VIEWER_CSS } from "../src/viewer-css";

const rules = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

describe("styles.css", () => {
  it("is the same rules the viewer injects, so the strict-CSP route renders identically", () => {
    const stylesheet = readFileSync("src/styles.css", "utf8");
    expect(rules(stylesheet)).toEqual(rules(VIEWER_CSS));
  });
});
