# Using @particle-academy/last-word-ui — guide for agents

How an agent installs and uses this package in a consumer app. What the package
is, is in [README.md](./README.md). Notes for working ON this repo's code are in
[CONTRIBUTING.md](./CONTRIBUTING.md).

## Install

```bash
npm install @particle-academy/last-word-ui @particle-academy/react-fancy react react-dom
```

- **Peers:** `@particle-academy/react-fancy` `>=5.0.0`, `react ^19`,
  `react-dom ^19`. **Node:** `>=22`.
- **Charts are optional:** install `@particle-academy/fancy-echarts echarts` to
  draw chart blocks; without them each chart is a sized, labelled placeholder.
- **The viewer does not read `.docx` bytes.** Read on the server (PHP
  `particle-academy/last-word`, Python `fancy-last-word`) and send the JSON, or
  read in the browser with `@particle-academy/last-word`.

## Find it on the Fancy MCP server

The catalog server is `https://ui.particle.academy/mcp` (streamable HTTP, no API
key; MCP id `fancy-ui`). This package's registry entry is
`last-word-ui-doc-viewer`. Find it with `search-components` ("document
viewer", "docx"), use `install-instructions` for the exact commands and
`get-component` for the source bundle. Vendored source:
`npx fancy-cli@latest add last-word-ui-doc-viewer`. The readers and writers are
found with `search-backend-packages`.

## API essentials

- `import { DocViewer, docFromReader } from "@particle-academy/last-word-ui"`;
  `<DocViewer doc={doc} />`. `docFromReader()` takes a reader result or a JSON
  string.
- **Props:** `doc`, `fit` (`"width" | "none"`), `scale`, `maxScale`, `gap`,
  `filename`, `now`, `onLayout`, `injectStyles`, `renderChart`, `id`,
  `className`, `style`. The full table is in the [README](./README.md).
- **`onLayout`** reports `{ pages, pageWidth, pageHeight, scale, font }` as
  JSON; `font` is `"carlito"` (deterministic), `"fallback"` or `"unused"`.
- **Stable handles:** `data-lw-viewer` on the root, `data-page` (1-based) per
  page, `data-block` (`b0`, `b1`, ...) per block or fragment, `data-footnote`,
  `data-lw-band` / `data-lw-band-variant`, `data-lw-rows`,
  `data-lw-repeated-header`, `data-lw-chart`, `data-lw-chart-placeholder`,
  `data-lw-font`, `data-lw-tracked-changes` / `data-lw-tracked-changes-notice`.
- **Lower level:** `paginate()`, `pageGeometry()`, `pageMargins()`,
  `bodyBox()`, `numberFootnotes()`, `substituteFields()` lay pages out without
  the DOM.

## Traps

- **Render the object you were given.** Footnote numbering is keyed by run
  identity, so deep-cloning the Doc between numbering and render loses the
  marks.
- **Under a CSP without `'unsafe-inline'` styles**, pass
  `injectStyles={false}` and `import "@particle-academy/last-word-ui/styles.css"`.
  Allow the bundled font files in `font-src`.
- **The CommonJS build cannot resolve the bundled font** (no `import.meta`), so
  it reports `font: "fallback"`; import `styles.css` there.
- **Only Calibri and default text paginate deterministically** (the bundled
  Carlito). Other fonts draw as installed on the machine.
- **Nothing is drawn until the font loads**, up to `FONT_LOAD_TIMEOUT_MS`
  (3 s).
- **Tracked changes are not shown, and that is a fail-safe.** A `doc` carrying any
  `revision` key draws with a notice (`data-lw-tracked-changes-notice`), deleted and
  moved-away runs (`delete`, `moveFrom`, or a revision it cannot read) are hidden,
  and inserted text draws as normal text. Check `hasRevisions(doc)` (or `onLayout`'s
  `revisions`) before showing a document, and have the person accept or reject the
  changes first. The viewer never edits the model, so the revisions survive for
  whatever writes the file back.
- **Not yet handled:** a table row taller than a page (`data-lw-overflow`), an
  unbreakable block taller than a page (`data-lw-forced`), a footnote that does
  not fit, page backgrounds and border frames.
- **A Doc is untrusted input:** links render only for `http(s)`, `mailto`,
  `tel` and `#anchor`; images only from `data:image/...`; colours only as
  `#RRGGBB`.
