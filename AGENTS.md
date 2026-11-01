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
footnotes.ts    numbering, keyed by Run identity
table-grid.ts   HTML-style spans -> grid columns, joinPrevious, header rows
style.ts        pt helpers, Word's writer defaults, CSS sanitising
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
  (`styles.test.ts` checks this).

## Types

`types.ts` declares the Doc locally as a structural SUPERSET of
`@particle-academy/last-word`'s. The JS package's `Page` lacks the bands, the
header/footer distances and footnotes. `tests/compat.test.tsx` assigns a real
last-word `Doc` to ours under `tsc`. It already caught an index signature on
`Page` that would have rejected every reader output. last-word is a
devDependency only.

## Traps

- jsdom has no layout: every height is 0, so jsdom tests cover structure,
  styling and handles, and the packer tests cover breaks. Real breaks need the
  browser (`npm run demo`).
- react-fancy's `Table` puts only `Table.Head`/`Table.Body` inside its
  `<table>`, so there is no `<colgroup>`. Column widths come from a zero-height
  sizer row (`data-lw-sizer`) plus `table-layout: fixed` in the viewer CSS.
