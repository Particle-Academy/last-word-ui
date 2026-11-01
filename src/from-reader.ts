import type { Doc } from "./types";

/**
 * A Doc from what a last-word reader returned -- `new DocxReader().read(bytes)`
 * in `@particle-academy/last-word`, or the same JSON from PHP or Python over
 * the wire (a string is parsed).
 *
 * This package does not depend on last-word at runtime, so it does not read
 * bytes itself: read on the server or with last-word-js, then hand the result
 * here. It returns the SAME object (footnote numbering is keyed by run
 * identity, so the viewer must render the object it was given), and throws a
 * TypeError naming the problem rather than rendering a blank page.
 */
export function docFromReader(output: unknown): Doc {
  let value = output;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new TypeError("last-word-ui: reader output is a string but not JSON");
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("last-word-ui: reader output must be a Doc object");
  }
  if (!Array.isArray((value as Doc).blocks)) {
    throw new TypeError("last-word-ui: reader output has no `blocks` array");
  }
  return value as Doc;
}
