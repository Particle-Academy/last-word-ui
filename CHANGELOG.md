# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0:** breaking changes land in MINOR releases. Until 1.0 the minor
> number is not a compatibility promise. Read the entry, not the version.

## [Unreleased]

### Added

- **Signing fields on the page.** `DocViewer` draws fine-print's signing
  extension nodes, `signatureField`, `initialsField` and `dateSignedField`, as
  boxes at fine-print's sizes (`SIGN_FIELD_SIZES`: 216 x 40, 72 x 28 and
  144 x 18 points, never wider than their column), with the rule under the box
  and the label below it (the default per kind, the node's own, or none for
  `""`). New prop `renderField(field)` fills a box with the host's own control,
  which is how a signing ceremony (fancy-sign-ui's data mode, `ctx.renderField`)
  puts the signer's fields where they print. It is called for the drawn pages
  only, never the hidden measuring copy, so a control appears once, and the box
  is the same size either way, so a control moves no page break. Handles:
  `data-lw-field` (the id), `data-lw-field-kind`, `data-lw-field-signer`,
  `data-lw-field-required`, `data-lw-field-area`, `data-lw-field-label`. As in
  fine-print, a malformed node (an id or signer outside `^[A-Za-z0-9_-]{1,64}$`)
  and a field in a header or footer draw nothing. Types: `SignFieldBlock` joins
  `Block`; `DocSignField`, `RenderSignField`, `SignFieldKind`.
  **Nothing to do** for a document without these nodes: they are not in
  last-word's shared schema, so no existing Doc carries one, and last-word's
  `layout()` agreement fixtures are unchanged.

## [0.7.0] - 2026-11-22

### Added

- **Fail-safe: a document with tracked changes no longer draws deleted text as live
  text.** last-word's model is gaining tracked-changes authoring: a `revision` key on
  runs (`insert`, `delete`, `moveFrom`, `moveTo`, `format`), on paragraph and heading
  blocks and on list items. This viewer cannot show revisions, and before this it drew
  them as if they were not there, so deleted text read as part of the document. Now,
  when a `doc` carries any `revision`: a run that was deleted or moved away
  (`delete`, `moveFrom`) is not drawn, on the pages or in the measuring copy, and its
  footnote is not numbered; inserted, moved-here and reformatted text draws as
  before; a block-level mark keeps its text. A notice above the pages says so
  (`TRACKED_CHANGES_NOTICE`, handle `data-lw-tracked-changes-notice` with
  `data-lw-revisions`, the count), and the root gains `data-lw-tracked-changes`. A
  `revision` this viewer cannot read counts as deleted: hiding text under a notice is
  recoverable, showing deleted text as live is not. The viewer never changes the
  model: the revisions are still there for the host to write back. This is a guard,
  not support; there is no review UI. New exports: `hasRevisions(doc)`,
  `revisionPaths(doc)` (JSON Pointers) and `isDeletedRun(run)`; `onLayout` gains
  `revisions` (the same pointers), absent when there are none. A document without
  revisions draws exactly as before; nothing to do.

### Changed

- **CI: the lab-certificate gate verifies against the lab's rotated key list.**
  The lab's first signing key is retired: certificates it already issued still
  verify, and nothing new it signs ever can. Consumers do nothing.

- **Docs:** `AGENTS.md` is now the guide to using this package (install, its entries on the Fancy MCP catalog server, API essentials, traps), and it ships in the package. The contributor notes it held moved to `CONTRIBUTING.md`, and `CLAUDE.md` is now a symlink to it. The README points to the MCP server and to `AGENTS.md`. No code changed; nothing to do.
- CI: re-pin org third-party allowlist to 2614224

## [0.6.0] - 2026-11-15

**What you must do:** to see charts drawn, install the optional peer:
`npm install @particle-academy/fancy-echarts echarts`. Without it nothing
breaks and nothing moves: charts stay sized placeholders, as in 0.5.0, now with
a development warning. Page breaks do not move either way: a chart's box is the
same size as before.

### Fixed

- **Charts draw as charts** (last-word-ui#1). Every chart block from
  last-word's native charts drew as a dashed "Chart: <title>" placeholder,
  although the `.docx` was correct. The block's ECharts `option` is now drawn
  by fancy-echarts' `EChart` at the block's size, inside the page: column, bar,
  line and pie. The sheet is white paper in every colour scheme, so the chart
  gets an explicit light theme (left unset, fancy-echarts picks its dark theme
  from the OS and draws light text on the white page), a transparent
  background, the SVG renderer (sharp under the page scale and in print) and no
  animation. The block's own keys win over each default.
- **The viewer has a box while it lays out.** Until the font loaded and the
  first layout ran (up to `FONT_LOAD_TIMEOUT_MS`, 3 s), `DocViewer`'s root held
  only the offscreen measuring copy, so it was 0 px high: the page jumped when
  the sheets arrived, and a kit-site inspector measuring early saw a viewer
  with no box at all. It now draws one blank sheet (`data-lw-pending`) at the
  first page's scaled size and marks the root `aria-busy="true"` until the
  pages replace it. Measuring, page breaks and `onLayout` are unchanged.
  Nothing to do; if you style the viewer, `[data-lw-pending]` is the new handle.

### Added

- `@particle-academy/fancy-echarts` (`>=6.1.0 <7.0.0`) as an **optional** peer.
  It is imported dynamically on first use, in the browser only, so a document
  with no charts loads no charting engine and server rendering draws the empty,
  sized box with no hydration mismatch.
- `renderChart` prop on `DocViewer`: draw a chart yourself, given
  `{ block, option, width, height, title }`. Return `undefined` to leave a
  chart to the default.
- `pageChartOption()`, `OFFICE_PALETTE`, and the `ChartRenderArgs` and
  `RenderChart` types.
- Chart blocks carry `data-lw-chart`. Without fancy-echarts, a placeholder
  still carries `data-lw-chart-placeholder`, and a development warning (once)
  names the package to install and the `renderChart` alternative.

### Changed

- The hidden measuring copy draws a chart's box only, never the chart, so a
  chart is never initialised twice. The box is the size it was, so page breaks
  do not move.
- **Releases need a lab-run certificate.** `publish.yml` gains a read-only
  `lab-certificate` job that every publishing job needs: a tag is published only
  when the fancy-labs lab has certified that exact version and commit. Consumers
  do nothing; this changes how releases are cut, not what the package does.

## [0.5.0] - 2026-11-04

### Added

- **Mixed page orientation.** A `pageBreak` carrying `page` changes the page from there on: each page is drawn at its own size and margins, with its own bands, and its text measured at its own width. `margins` merge side by side, every other key is replaced whole, `firstHeader` / `firstFooter` are never inherited and on a break mean the first page after it, and even bands follow the page number. `{section}` counts the stretches and `{sectionpages}` is the page count of the current one, as Word's `SECTION` and `SECTIONPAGES`. One scale serves every page, from the widest.
- `docStretches()`, `blockStretches()`, `packInput()`, `pageClassIn()`. `paginate()` takes a `stretch` on a break item and `firstEvenPageHeight`; `pageCapacity()` a stretch's first page index.
- `onLayout` reports `pageSizes` when the document's page changes partway. `pageWidth` and `pageHeight` stay the first page's.

### Changed

- The notice no longer fires for a `page` on a top-level break, because that is drawn now. It still fires for what the writers refuse (a nested `page`, a background on a break, page keys straight on a break, a top-level `sections`), in new words. **Consumer action:** none, unless you compared `LAYOUT_NOTICE`'s text.
- `tests/fixtures/viewer-agreement.json` has a tenth case, recorded in headless Chromium; the first nine did not move.

## [0.4.1] - 2026-11-03

**What you must do: nothing.** A document with a `colSpan` of 1000 or less draws
exactly as it did.

### Security

- A table cell's column span had no upper limit here either, so a very small
  document could cost a browser tab far more than its size. `tableGrid()` clamps a
  `colSpan` to 1000 (`MAX_COL_SPAN`, last-word's limit) and no longer spends memory
  on each slot a span covers. The viewer still never refuses a document.
  **Consumer action:** upgrade. If you vendored `doc-viewer` with `fancy-cli`,
  add it again to take the fix: a vendored copy does not update itself.

## [0.4.0] - 2026-11-03

**What you must do: nothing.** A document with one page setup draws exactly as
before, with no new element and no new `onLayout` key. Under Tailwind, your build
needs react-fancy's classes as it already does.

### Added

- **A visible notice when a document asks for mixed page layout** (mixed page
  orientation, stage 1). `pageBreak.page`, page keys written straight on a break
  (`pageBreak.orientation`, `.margins`, ...) and a top-level `sections` were silently
  ignored, so a landscape section drew as portrait with nothing said. The document
  still draws, one page setup as before, under a react-fancy `Callout`
  (`data-lw-layout-notice`) in light and dark. `onLayout` gains `notShown`, JSON
  Pointers to what it ignored, present only when there is something to report. New
  exports: `LAYOUT_NOTICE`, `unshownLayout(doc)`. Per-page geometry comes in a later
  release; **consumer action:** none. Those near-miss keys and `sections` do not
  exist: `pageBreak.page` is the form, and `last-word` refuses all of them on write
  until it can honour the first.

## [0.3.0] - 2026-11-01

**What you must do: probably nothing, but expect page breaks to move.** Calibri
and default text now draws in a bundled font with kerning off, so a document
can break differently from 0.2.0, on every machine, including ones that had
real Calibri or only Arial. That is the point: the count is now the same
everywhere and matches last-word's `Agent::layout()`. Under a strict CSP you
already import `styles.css`; allow its font files in `font-src`. On the
CommonJS build, import `styles.css` too, or the viewer reports
`font: "fallback"`.

### Added

- **A bundled Carlito** (1.104, from googlefonts/carlito, unmodified, SIL OFL
  1.1 with a NOTICE in `fonts/`), declared as `"LW Carlito"` in regular, bold,
  italic and bold italic. Metric-compatible with Calibri: every printable
  ASCII and Latin-1 advance is equal in all four styles. The package now
  publishes `fonts/` (about 2.7 MB of TTF; Carlito is not published as woff2
  upstream, and these are the files as published). A browser fetches only the
  faces a document uses.
- `styles.css` declares the same `@font-face` rules, with URLs relative to the
  stylesheet, for the strict-CSP route.
- `DocViewerLayout.font`: `"carlito"`, `"fallback"` or `"unused"`, and
  `data-lw-font` on the root, so a caller can tell a deterministic page count
  from one that depends on the machine.
- `FONT_LOAD_TIMEOUT_MS` (3000) and the `ViewerFont` type.
- `demo/agreement.html`: the harness that renders documents in the viewer and
  records the page layout last-word's `layout()` is held to. The fixtures it
  produced are in `tests/fixtures/viewer-agreement.json` (the same bytes as in
  last-word; both pin the sha256).

### Changed

- **Calibri and unspecified text draws in the bundled Carlito, first in the
  stack**, ahead of `Calibri`, `Carlito`, `Segoe UI` and `Arial`. Pages may
  break differently from 0.2.0 on any machine: where real Calibri was
  installed, because kerning is now off; where it was not, because the text is
  no longer in Segoe UI or Arial. Every other explicit font keeps its stack,
  and its breaks still depend on the machine.
- **Kerning and ligatures are off** (`font-kerning: none`,
  `font-variant-ligatures: none`), as in Word by default, and
  `text-rendering: geometricPrecision`.
- **The viewer waits for the font before it measures.** No pages and no
  `onLayout` until the faces the document draws have loaded (or 3 s pass).
  0.2.0 drew pages in the fallback first and re-laid them out when web fonts
  arrived, so `onLayout` could report a count that changed a moment later.

## [0.2.0] - 2026-11-01

Renders last-word 0.16.0's band variants and field tokens. **Consumer action:
none.** Both new props are optional, and a document without the new page keys
or tokens renders exactly as it did on 0.1.1. Pass `filename` and `now` only
if your bands use `{filename}`, `{date}` or `{time}`.

### Added

- **First-page and even-page bands:** `page.firstHeader`, `page.firstFooter`,
  `page.evenHeader` and `page.evenFooter`, in the same forms as `page.header`
  (a one-line band or `{blocks}`). Page 1 draws the first variant when
  present, even pages (2, 4, ...) the even variant, every other page the
  default. `{"blocks": []}` as a variant blanks that page's band. Each band
  carries `data-lw-band-variant` (`default`, `first` or `even`).
- **Per-page body heights.** Each page's body is sized by the bands it
  actually draws, so a tall first-page letterhead moves only page 1's body
  down. `paginate()` takes optional `firstPageHeight` and `evenPageHeight`
  beside `pageHeight`, and each `PageLayout` reports its `capacity`. Without
  the new options, pagination is unchanged.
- **Field tokens in band text:** `{section}` and `{sectionpages}` (a Doc is one
  section: `1` and the page total), `{author}` (`doc.meta.author`), `{title}`
  (the top-level `doc.title`; there is no `meta.title`), `{filename}`, and
  `{date}` / `{time}` in the browser locale, or `{date:FORMAT}` /
  `{time:FORMAT}` with a Word date-time picture (d to dddd, M to MMMM, yy,
  yyyy, h, hh, H, HH, m, mm, s, ss, am/pm, AM/PM, single-quoted literals,
  English names). Tokens follow last-word's grammar exactly; anything else in
  braces stays literal. In the body every token stays literal text. Values
  render as plain text only.
- **Props:** `filename` (what `{filename}` shows; empty when absent) and `now`
  (a Date or an ISO string; the moment `{date}` / `{time}` show, for
  deterministic output).
- **Exports:** `pageCapacity`, `pageBand`, `pageClass`, `bandSlot`,
  `pageBodyBoxes`, `formatDatePicture`, `resolveNow`, and the `BandKind`,
  `BandSlot`, `PageClass`, `BandHeights` and `DocMeta` types. `PageFields`
  gains optional `section`, `sectionPages`, `author`, `title`, `filename` and
  `now`; `substituteFields(text, { page, pages })` still works as before.

## [0.1.1] - 2026-11-01

### Changed
- Test environment: `jsdom` moved from 26 to 30 (devDependency only). jsdom 26
  pulled in `whatwg-encoding`, which is deprecated upstream and printed a
  deprecation warning on every `npm ci`. Nothing in the published package
  changes. **Consumer action: none.**

## [0.1.0] - 2026-11-01

First release. **What you must do:** install it beside `react` 19 and
`@particle-academy/react-fancy` 5, then render `<DocViewer doc={doc} />` with the
JSON a last-word reader returns. last-word itself is NOT a dependency: read the
file on the server, or with `@particle-academy/last-word`, and pass the result in.

### Added

- **`<DocViewer doc />`**, a read-only, paged view of a last-word `Doc`:
  - every page at its paper size and orientation (letter, legal, a4);
  - pages broken by CONTENT HEIGHT, as well as at explicit `pageBreak`s.
    Paragraphs, headings, lists, quotes and code split between lines, with
    Word's widow/orphan rule on paragraphs. Tables split between rows, repeat
    their header rows on each continuation page, and never break inside a row
    span. Headings keep with the next block;
  - header and footer at their distances (`page.margins.header` / `.footer`,
    36pt when absent), as a one-line left/centre/right band or as blocks (a
    letterhead logo, address lines). The body moves down when a header is
    taller than the top margin, as Word does;
  - `{page}` / `{pages}` as live numbers on every page, in bands only;
  - footnotes (the last-word 0.15.0 model: a run `{"text": "", "footnote":
    {"blocks": [...]}}`), numbered 1, 2, 3 in document order and set at the
    foot of the page holding the mark, under a separator rule. Their height
    comes off that page's body;
  - tables (widths, header rows and their default fill, cell shading, borders,
    padding, vertical alignment, column and row spans), paragraph alignment,
    shading, borders, indents and spacing, run styling, headings, lists,
    quotes, code, images and rules, all as the reader returns them;
  - scales whole pages to fit the panel (`fit`, `scale`, `maxScale`) and never
    reflows;
  - stable handles: `data-page`, `data-block` (`b0`, `b1`, ...),
    `data-footnote`, `data-lw-band`; `onLayout` reports `{pages, pageWidth,
    pageHeight, scale}` as JSON.
- **`paginate(items, options)`**, the pure page packer behind the viewer:
  heights in, page assignments out, no DOM.
- **`pageGeometry(doc)`, `pageMargins(doc)`, `bodyBox()`**: the page model,
  with the ONE place margin defaults are applied (72pt a side, 36pt to each
  band), mirroring PHP last-word's `Schema::pageMargins()`.
- **`docFromReader(output)`**: accepts a reader's Doc, or its JSON string.
- `numberFootnotes(doc)` and `substituteFields(text, fields)`.

### Security

- A Doc is untrusted input. Links render only for `http(s)`, `mailto`, `tel`
  and `#anchor` URLs, so a `javascript:` link never reaches an `href`. Images
  render only from embedded `data:image/...` URLs, so a document cannot make
  the reader's browser fetch a remote URL (a tracking pixel). Colours reach CSS
  only as `#RRGGBB`, and font names are reduced to safe characters.

### Not yet

- Charts draw as a sized, labelled placeholder (pagination stays right).
- A table ROW taller than a page is not split; it is placed alone and flagged
  `data-lw-overflow`. A footnote taller than the space left does not continue
  onto the next page. Page `background` and `border` are not drawn yet.
