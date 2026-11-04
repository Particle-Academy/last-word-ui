# AGENTS.md -- last-word-ui

A read-only, paged React viewer for a last-word `Doc`. `CLAUDE.md` is a
symlink to this file. It describes this repo's code only; process rules live
in the envelope.

## Shape

```
DocViewer.tsx   renders a hidden measuring copy, measures it, paginates, draws pages
measure.ts      DOM rects -> PackItem[]       (the ONLY browser-dependent step)
paginate.ts     PackItem[] -> PageLayout[]    (pure; every pagination rule is a unit test)
render.tsx      block / run / table / band / footnote renderers (react-fancy primitives)
geometry.ts     paper sizes, pageMargins() (THE place defaults live), bodyBox()
bands.ts        which header/footer each page draws (default / first / even), body box per page class
layout-notice.ts page layout the doc asks for and the viewer ignores (pageBreak.page, near-miss keys, sections), and the notice's words
fields.ts       band field tokens and the Word date-time picture formatter (pure)
footnotes.ts    numbering, keyed by Run identity
table-grid.ts   HTML-style spans -> grid columns, joinPrevious, header rows
style.ts        pt helpers, Word's writer defaults, CSS sanitising, typography()
fonts.ts        the bundled Carlito: faces, their sha256, @font-face CSS, carlitoFaces(doc)
font-urls.ts    new URL("../fonts/...", import.meta.url) for the injected @font-face
fonts/          (package root) Carlito 1.104 TTFs, UNMODIFIED, with OFL.txt and NOTICE
demo/agreement  the harness that records the viewer goldens for last-word's layout()
```

## Invariants

- **Measurement and pages must render identically.** Both sit under the same
  typography and the same `RenderCtx`. A style applied in one place and not the
  other moves every break. The measuring copy is offscreen at the text width,
  not scaled; the scale is a CSS transform on the drawn sheet only.
- **Pagination decisions belong in `paginate()`, never in the DOM layer.** If a
  rule needs a new input, add a field to `PackItem` and a test.
- **A split block is drawn whole and windowed** (`marginTop: -start`, fixed
  height, `overflow: hidden`). Breakpoints are line bottoms where no text
  crosses, so a window edge never cuts a line. The browser check for this
  counts text rects that straddle a window edge, and it must be zero.
- **Footnote marks are clamped into their block.** A superscript on line one
  measures above the block's top. Unclamped, it fell between fragments and the
  note vanished from every page (found in the browser, pinned in
  `paginate.test.ts`).
- **Body height is per page CLASS, not per document.** Page 1, even pages and
  the other odd pages can draw different bands (last-word 0.16.0), so
  `pageBodyBoxes()` derives one body box per class from the bands that class
  draws, and `paginate()` takes `firstPageHeight` / `evenPageHeight` beside
  `pageHeight` (`pageCapacity()`). Every packer rule works at the capacity of
  the page it is filling; a keep-with-next chain moves only if the NEXT
  page's capacity holds it. Band selection lives in `bands.ts` alone: the
  measuring copy measures every slot, the pages draw `pageBand()`.
- **Field tokens are band-only and text-only.** `substituteFields` returns a
  string that renders as a React text node. Band fields come from one
  `docFields` object shared by the measuring copy and the pages.
- **Footnote numbering is keyed by Run identity.** Do not clone the Doc inside
  the viewer.
- **Doc content is untrusted.** Links go through `safeHref`, images render only
  from `data:image/...`, colours only as `#RRGGBB` (`hex()`), and font names go
  through `fontStack()`. Keep it that way for any new field.
- **Defaults mirror the writer**, so the preview matches Word's rendering of
  the same file: 8pt after a paragraph, Calibri 11, heading sizes
  20/16/14/13/12/11, a header-row fill of `#E7E7E7`, cell padding of 3/5.4pt,
  0.5pt single borders, and a band at 9pt in `#6B7280`. They live in `style.ts`
  and `render.tsx`.
- `src/styles.css` and `src/viewer-css.ts` hold the same rules
  (`styles.test.ts` checks this), plus the `@font-face` rules in `styles.css`.
- **Calibri and default text is the bundled Carlito, and only that is
  deterministic.** `fontStack()` puts `"LW Carlito"` first for Calibri or no
  font; kerning and ligatures are off (`typography()`), so a line is the sum of
  its advances. The fonts ship byte-for-byte as upstream (`fonts.test.ts` pins
  each sha256): never subset, convert or re-hint them. `fonts/` sits at the
  package root so `../fonts/` is right from `src/` and `dist/`; tsup marks it
  external so `dist/` never carries a second, renamed copy.
- **Nothing is measured before the font loads.** `DocViewer` waits on
  `document.fonts.load()` for the faces `carlitoFaces(doc)` lists (timeout
  `FONT_LOAD_TIMEOUT_MS`) and reports `font` in `onLayout`. A layout in the
  fallback must never be reported as if it were the real one.
- **last-word's PHP `Agent::layout()` mirrors this package** (its
  `src/Layout/`: `BlockMeasurer` = render.tsx + measure.ts, `Packer` =
  paginate.ts). A change to a renderer's box model, a default, a measuring rule
  or the packer moves page counts there too. After any such change, re-run the
  harness (`demo/agreement.html`, `window.lwRender(doc)`), regenerate
  `tests/fixtures/viewer-agreement.json`, copy the same bytes to last-word and
  update both hashes; a disagreement is then a bug on one side, never a
  fixture to edit by hand.

## Types

`types.ts` declares the Doc locally as a structural SUPERSET of
`@particle-academy/last-word`'s. The JS package's `Page` lacks the bands, the
header/footer distances and footnotes. `tests/compat.test.tsx` assigns a real
last-word `Doc` to ours under `tsc`. It already caught an index signature on
`Page` that would have rejected every reader output. last-word is a
devDependency only.

## Traps

- On a machine with Calibri installed, removing the bundled font changes
  nothing measurable: Calibri 6.27 and Carlito 1.104 have the same advances
  and kerning is off. A check that "the font matters" has to simulate a
  machine WITHOUT Calibri (Segoe UI or Arial first), or it passes vacuously.
- A line box is NOT size x line-height rounded one way: measured in Chromium,
  9pt at the default spacing is a floor (969/64 px for 969.70) and 8pt a
  ceiling (862 for 861.95). No rounding rule tried reproduced all 245 measured
  cases, so last-word carries them as a measured table; re-measure if Blink's
  line layout changes.
- jsdom has no layout: every height is 0, so jsdom tests cover structure,
  styling and handles, and the packer tests cover breaks. Real breaks need the
  browser (`npm run demo`).
- react-fancy's `Table` puts only `Table.Head`/`Table.Body` inside its
  `<table>`, so there is no `<colgroup>`. Column widths come from a zero-height
  sizer row (`data-lw-sizer`) plus `table-layout: fixed` in the viewer CSS.
