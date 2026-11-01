# @particle-academy/last-word-ui

A read-only, **paged** React viewer for a [last-word](https://github.com/Particle-Academy/last-word-js)
`Doc`, drawn as the pages it prints on. Each page sits at its paper size, breaks
fall where the content runs out, the header and footer sit at Word's distances
with live page numbers, and footnotes sit at the foot of the page that holds
their mark. In a narrow preview panel it scales the whole page down and never
reflows the text.

> **Pre-1.0:** breaking changes land in MINOR releases. Read the
> [CHANGELOG](./CHANGELOG.md) entry before taking one.

## Install

```bash
npm install @particle-academy/last-word-ui @particle-academy/react-fancy react react-dom
```

## Use

```tsx
import { DocViewer } from "@particle-academy/last-word-ui";

<DocViewer doc={doc} />;
```

`doc` is last-word JSON: what `new DocxReader().read(bytes)` returns in
`@particle-academy/last-word`, or the same JSON from the PHP or Python
packages, sent over the wire. This package does not read `.docx` bytes itself,
so last-word is not a dependency. Read on the server, or with last-word-js:

```tsx
import { DocxReader } from "@particle-academy/last-word";
import { DocViewer, docFromReader } from "@particle-academy/last-word-ui";

const doc = docFromReader(new DocxReader().read(bytes)); // or a JSON string
<DocViewer doc={doc} onLayout={({ pages }) => setPageCount(pages)} />;
```

Render the object you were given. Footnote numbering is keyed by run identity,
so a deep clone between numbering and render would lose the marks.

### Props

| prop | type | default | |
|---|---|---|---|
| `doc` | `Doc` | (required) | last-word JSON |
| `fit` | `"width" \| "none"` | `"width"` | scale pages down to the viewer's width |
| `scale` | `number` | | a fixed scale; overrides `fit` |
| `maxScale` | `number` | `1` | the most `fit` will enlarge a page |
| `gap` | `number` | `16` | px between pages |
| `filename` | `string` | `""` | what a `{filename}` band field shows |
| `now` | `Date \| string` | first render | the moment `{date}` / `{time}` show; an ISO string is fine |
| `onLayout` | `(l) => void` | | `{ pages, pageWidth, pageHeight, scale }`, JSON |
| `injectStyles` | `boolean` | `true` | see *Styles* |
| `id`, `className`, `style` | | | on the root |

### Stable handles

The root carries `data-lw-viewer`. Each page carries `data-page` (1-based), each
block or fragment of a block carries `data-block` (`b0`, `b1`, ... in document
order), each footnote carries `data-footnote`, and the bands carry
`data-lw-band="header" | "footer"`, with `data-lw-band-variant="default" |
"first" | "even"` naming the band drawn. Table fragments carry `data-lw-rows`, plus
`data-lw-repeated-header` on continuation pages.

### Styles

The viewer renders its few CSS rules (react-fancy's `<table>` and `<hr>` take no
style prop) as a React 19 hoisted `<style>`. Under a CSP without
`'unsafe-inline'` styles, pass `injectStyles={false}` and import the same
rules instead:

```ts
import "@particle-academy/last-word-ui/styles.css";
```

## What it renders

- **Pages:** letter, legal and a4, portrait or landscape, with margins as the
  reader returns them. A missing side is the default of 72pt (the reader drops
  1-inch sides).
- **Breaks:** by content height, and at every `pageBreak`. Paragraphs,
  headings, lists, quotes and code split between lines, and paragraphs follow
  Word's widow and orphan rule. Tables split between rows, repeat their header
  rows on each continuation page, and never split inside a row span. Headings
  keep with the next block.
- **Header and footer:** at `page.margins.header` / `.footer` from the page
  edge (36pt when absent). They are either a left / centre / right band or
  blocks (a letterhead logo, address lines). A tall header pushes the body down,
  as in Word.
- **First-page and even-page bands** (last-word 0.16.0): page 1 draws
  `page.firstHeader` / `page.firstFooter` when present, even pages (2, 4, ...)
  `page.evenHeader` / `page.evenFooter`, and every other page the default.
  `{"blocks": []}` as a variant blanks that page's band. Each page's body is
  sized by the bands it actually draws, so a tall first-page letterhead moves
  only page 1's body down.
- **Fields in bands:** `{page}`, `{pages}`; `{section}` and `{sectionpages}`
  (a Doc is one section, so `1` and the page total); `{author}`
  (`doc.meta.author`); `{title}` (the top-level `doc.title`; there is no
  `meta.title`); `{filename}` (the `filename` prop); `{date}` and `{time}` in
  the browser's locale, or `{date:FORMAT}` / `{time:FORMAT}` with a Word
  picture (`d dd ddd dddd M MM MMM MMMM yy yyyy h hh H HH m mm s ss am/pm
  AM/PM`, text in single quotes literal, English names). Unknown values are
  empty. Names are lower-case and exact; anything else in braces stays
  literal. All of it is drawn as plain text. In the body every token stays
  literal text, as in the file.
- **Footnotes:** numbered 1, 2, 3 in document order and set at the foot of the
  mark's page, under a short rule. Their height comes off that page's body.
- **Content:** tables (widths, header rows, cell shading, borders, padding,
  vertical alignment, spans), paragraph alignment, shading, borders, indents
  and spacing, run styling (bold, italic, underline, strike, colour, highlight,
  size, font, small caps, letter spacing, inline code, links), headings,
  lists, quotes, code, images and rules.

### Not yet (v0)

- Charts draw as a sized, labelled placeholder, so pagination stays right.
- A table **row** taller than a page is not split. It is placed alone and
  flagged with `data-lw-overflow`.
- A block with no line breaks that is taller than a page (a huge image) is cut
  at the page height, with `data-lw-forced`.
- A footnote taller than the room left does not continue onto the next page.
- Page `background` and the page `border` frame are not drawn.

## Security

A Doc is untrusted input, and this viewer renders it in your origin:

- Links render only for `http(s)`, `mailto`, `tel` and `#anchor` URLs.
- Images render only from embedded `data:image/...` URLs. A remote `src` is
  never requested.
- Colours reach CSS only as `#RRGGBB`.

## Lower-level API

`paginate(items, { pageHeight, footnoteSeparator })` is the pure page packer.
It takes heights in and returns page assignments, with no DOM. Use it with
`pageGeometry(doc)`, `pageMargins(doc)` (the one place margin defaults are
applied), `bodyBox()`, `numberFootnotes(doc)` and `substituteFields()` to lay
pages out elsewhere.

## Develop

```bash
npm test        # vitest + jsdom
npm run lint    # tsc + eslint
npm run demo    # vite demo: a multi-page memo, wide and narrow
```

## License

MIT
