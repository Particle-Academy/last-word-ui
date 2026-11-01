import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { carlitoFaces } from "../src/fonts";
import { paginate, type PackItem, type PackOptions } from "../src/paginate";
import type { Doc } from "../src/types";

/**
 * The agreement fixtures: documents this viewer laid out in Chromium in the
 * bundled Carlito (demo/agreement.html), with the page count, the block each
 * page starts with and the exact input the packer was given. last-word's PHP
 * `layout()` is held to the same file (tests/fixtures/layout/viewer-agreement.json
 * there, the same bytes); both pin the hash.
 *
 * Here they pin the packer: given the inputs the browser measured, it must
 * still produce the pages it produced. A packer change that moves a break
 * fails here, and is then a change both sides must make together.
 */
const SHA256 = "c262515fc734b352f4d074e0f8238951f6a3a7b32fb7eed1b2dcd5256ca18131";

interface Case {
  id: string;
  doc: Doc;
  viewerDoc?: Doc;
  viewer: { pages: number; pageStarts: Array<number | null>; packer: { items: PackItem[]; options: PackOptions } };
}

const raw = readFileSync("tests/fixtures/viewer-agreement.json", "utf8").replace(/\r\n/g, "\n");
const fixture = JSON.parse(raw) as { cases: Case[] };

describe("viewer agreement fixtures", () => {
  it("are the bytes last-word pins", () => {
    expect(createHash("sha256").update(raw).digest("hex")).toBe(SHA256);
    expect(fixture.cases.length).toBeGreaterThanOrEqual(9);
  });

  it.each(fixture.cases.map((c) => [c.id, c] as const))("%s: the packer still draws the recorded pages", (_id, c) => {
    const pages = paginate(c.viewer.packer.items, c.viewer.packer.options);
    expect(pages.length).toBe(c.viewer.pages);
    expect(pages.map((p) => (p.fragments[0] ? p.fragments[0].item : null))).toEqual(c.viewer.pageStarts);
  });

  it.each(fixture.cases.map((c) => [c.id, c] as const))("%s: is Calibri text, so the count is the bundled font's", (_id, c) => {
    expect(carlitoFaces(c.viewerDoc ?? c.doc)).toContain('400 normal 16px "LW Carlito"');
  });
});
