/** The live values a header or footer's `{page}` / `{pages}` fields take on one page. */
export interface PageFields {
  /** 1-based. */
  page: number;
  pages: number;
}

const FIELD = /\{page\}|\{pages\}/g;

/**
 * Text with `{page}` and `{pages}` replaced by this page's numbers -- the PAGE
 * and NUMPAGES fields last-word writes into a band. Only in bands: in the body
 * the same characters are literal text, as they are in the written file.
 */
export function substituteFields(text: string, fields: PageFields): string {
  return text.replace(FIELD, (m) => String(m === "{page}" ? fields.page : fields.pages));
}
