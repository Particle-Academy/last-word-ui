# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Pre-1.0:** breaking changes land in MINOR releases. Until 1.0 the minor
> number is not a compatibility promise. Read the entry, not the version.

## [Unreleased]

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
