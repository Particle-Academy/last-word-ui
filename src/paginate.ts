/**
 * The page packer: measured heights in, page assignments out.
 *
 * Pure and deterministic -- no DOM, no React -- so every pagination rule is a
 * unit test rather than a screenshot. `measure.ts` turns rendered blocks into
 * these items; `DocViewer` renders the pages this returns. All lengths are in
 * one unit (the viewer uses CSS px); the packer never converts.
 *
 * What it splits, and where:
 * - a block with `breakpoints` (the bottoms of its text lines) at the deepest
 *   breakpoint that fits -- paragraphs, headings, lists, quotes and code;
 * - a table between rows, repeating its leading header rows on every
 *   continuation page, and never inside a row span (`joinPrevious`);
 * - anything else, only when it is taller than a whole page, by cutting it at
 *   the page height (`forced: true`). A forced cut can fall through a line of
 *   text or an image; it is the alternative to losing content, not a layout.
 * It never splits a table ROW: a row taller than a page is placed alone and
 * flagged `overflow`.
 */

/** A footnote mark inside a block: `at` is its offset from the block's top. */
export interface FootnoteMark {
  id: number;
  at: number;
  /** The rendered height of the note itself. */
  height: number;
}

export interface BlockItem {
  type: "block";
  id: string;
  height: number;
  /** Offsets from the block's top where a cut is allowed, ascending. */
  breakpoints?: number[];
  /** Keep on the same page as (the first piece of) the next item. */
  keepNext?: boolean;
  footnotes?: FootnoteMark[];
}

export interface TableRowItem {
  height: number;
  /** A row span from above reaches this row: no break before it. */
  joinPrevious?: boolean;
  footnotes?: Array<{ id: number; height: number }>;
}

export interface TableItem {
  type: "table";
  id: string;
  rows: TableRowItem[];
  /** How many leading rows are header rows (repeated on each page). */
  headerRows?: number;
}

export interface BreakItem {
  type: "break";
  /**
   * This break starts a run of pages of another shape, and these are its heights.
   * `firstPageHeight` is its first page when that page is odd and
   * `firstEvenPageHeight` when even: the pages before it decide which.
   */
  stretch?: Pick<PackOptions, "pageHeight" | "firstPageHeight" | "firstEvenPageHeight" | "evenPageHeight">;
}

export type PackItem = BlockItem | TableItem | BreakItem;

export interface PackOptions {
  /**
   * The body height available on a page no variant below covers: every page
   * when neither is given, else the odd pages after the first.
   */
  pageHeight: number;
  /**
   * The body height of page 1, when its header or footer differs from the
   * rest (a first-page letterhead). `pageHeight` when absent.
   */
  firstPageHeight?: number;
  /**
   * The body height of the even pages (2, 4, ...), when their bands differ.
   * `pageHeight` when absent. Page 1 is odd, so it never takes this.
   */
  evenPageHeight?: number;
  /**
   * The body height of a stretch's first page when that page is even. Page 1 is
   * odd, so the first stretch never takes it. `firstPageHeight` does not stand in:
   * absent, the page is an ordinary even page.
   */
  firstEvenPageHeight?: number;
  /**
   * Height of the separator rule above a page's footnotes, reserved once on
   * any page that holds at least one note. 0 when absent.
   */
  footnoteSeparator?: number;
}

export interface BlockFragment {
  type: "block";
  id: string;
  /** Index into the items array. */
  item: number;
  /** Offsets within the block: the window [start, end) shown on this page. */
  start: number;
  end: number;
  /** Cut at the page height because the block is taller than a page and had no breakpoint that fit. */
  forced?: boolean;
}

export interface TableFragment {
  type: "table";
  id: string;
  item: number;
  /** Row indices to draw, header rows first. */
  rows: number[];
  /** True on a continuation page, where the header rows are a repeat. */
  repeatedHeader: boolean;
  /** A row taller than the page was placed anyway. */
  overflow?: boolean;
}

export type Fragment = BlockFragment | TableFragment;

export interface PageLayout {
  /** 0-based. */
  index: number;
  fragments: Fragment[];
  /** Footnote ids whose marks are on this page, in order. */
  footnotes: number[];
  /** Body height used, footnotes and separator included. */
  used: number;
  /** The body height this page had to fill (`pageCapacity()` for its index). */
  capacity: number;
  /** Which stretch it is in, 0-based. Absent in the first. */
  stretch?: number;
}

const EPS = 1e-6;

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * The body height of the page at 0-based `index`, in a stretch whose first page is at
 * `start`: that first page takes `firstPageHeight` (`firstEvenPageHeight` on an even
 * page), even pages (odd indices) `evenPageHeight`, the rest `pageHeight`. A variant
 * that is absent, non-finite or not positive falls back. At least 1, so a page always
 * makes progress.
 */
export function pageCapacity(options: PackOptions, index: number, start = 0): number {
  const base = Math.max(1, positive(options.pageHeight) ? options.pageHeight : 1);
  const even = index % 2 === 1;
  if (index === start) {
    const first = even ? options.firstEvenPageHeight : options.firstPageHeight;
    if (positive(first)) return Math.max(1, first);
  }
  if (even) return positive(options.evenPageHeight) ? Math.max(1, options.evenPageHeight) : base;
  return base;
}

export function paginate(items: PackItem[], initial: PackOptions): PageLayout[] {
  // Every rule below works at the capacity of the page it is filling; `cap`
  // is re-read on each new page. A break with a stretch swaps the heights.
  let options = initial;
  let stretchStart = 0;
  let stretch = 0;
  let cap = pageCapacity(options, 0);
  const sep = Math.max(0, options.footnoteSeparator ?? 0);
  const pages: PageLayout[] = [];

  // Current page state.
  let page!: PageLayout;
  let content = 0; // body content height placed (no notes)
  let noteHeights = 0; // sum of note heights on the page

  const newPage = (): void => {
    cap = pageCapacity(options, pages.length, stretchStart);
    page = { index: pages.length, fragments: [], footnotes: [], used: 0, capacity: cap, ...(stretch > 0 ? { stretch } : {}) };
    pages.push(page);
    content = 0;
    noteHeights = 0;
  };
  const noteCost = (extraCount: number, extraHeight: number): number => {
    const count = page.footnotes.length + extraCount;
    return count > 0 ? noteHeights + extraHeight + sep : 0;
  };
  const fits = (h: number, notes: Array<{ height: number }>): boolean =>
    content + h + noteCost(notes.length, sum(notes)) <= cap + EPS;
  const commit = (h: number, notes: Array<{ id: number; height: number }>): void => {
    content += h;
    for (const n of notes) {
      page.footnotes.push(n.id);
      noteHeights += n.height;
    }
    page.used = content + noteCost(0, 0);
  };
  const empty = (): boolean => page.fragments.length === 0;

  newPage();

  items.forEach((item, index) => {
    if (item.type === "break") {
      if (item.stretch) {
        options = { footnoteSeparator: options.footnoteSeparator, ...item.stretch };
        stretchStart = pages.length;
        stretch++;
      }
      newPage();
      return;
    }
    if (item.type === "table") {
      placeTable(item, index);
      return;
    }
    placeBlock(item, index);
  });

  return pages;

  function notesIn(item: BlockItem, start: number, end: number, last: boolean): FootnoteMark[] {
    // Clamped into the block: a superscript mark on the first line measures a
    // little ABOVE the block's top, and a mark must never fall between
    // fragments -- every note lands on exactly one page.
    const h = Math.max(0, item.height);
    return (item.footnotes ?? []).filter((n) => {
      const at = Math.min(h, Math.max(0, n.at));
      return at >= start - EPS && (last ? at <= end + EPS : at < end - EPS);
    });
  }

  /** Height of an item's first unbreakable piece -- what a keep-with-next needs on the page. */
  function firstPiece(item: PackItem | undefined): number {
    if (!item || item.type === "break") return 0;
    if (item.type === "block") {
      const bp = (item.breakpoints ?? []).find((b) => b > EPS && b < item.height - EPS);
      return bp ?? item.height;
    }
    const header = item.rows.slice(0, headerCount(item)).reduce((a, r) => a + r.height, 0);
    const units = tableUnits(item);
    return header + (units[0] ? units[0].height : 0);
  }

  function keepChainHeight(from: number): number {
    // Every keepNext block in the chain whole, then the first piece of the item after it.
    let total = 0;
    let i = from;
    while (i < items.length) {
      const it = items[i]!;
      if (it.type === "block" && it.keepNext) {
        total += it.height;
        i++;
        continue;
      }
      total += firstPiece(it);
      break;
    }
    return total;
  }

  function placeBlock(item: BlockItem, index: number): void {
    const height = Math.max(0, item.height);

    if (item.keepNext && !empty()) {
      const chain = keepChainHeight(index);
      const next = items[index + 1];
      const meaningful = next !== undefined && next.type !== "break";
      // Move the chain only if the page it would move to can hold it.
      const nextCap = pageCapacity(options, page.index + 1, stretchStart);
      if (meaningful && chain <= nextCap + EPS && !fits(chain, notesIn(item, 0, height, true))) newPage();
    }

    let start = 0;
    for (let guard = 0; guard < 100000; guard++) {
      const restNotes = notesIn(item, start, height, true);
      if (fits(height - start, restNotes)) {
        page.fragments.push({ type: "block", id: item.id, item: index, start, end: height });
        commit(height - start, restNotes);
        return;
      }

      // The deepest breakpoint that fits, with the notes its fragment carries.
      const bps = (item.breakpoints ?? []).filter((b) => b > start + EPS && b < height - EPS).sort((a, b) => b - a);
      let cut: number | undefined;
      for (const bp of bps) {
        if (fits(bp - start, notesIn(item, start, bp, false))) {
          cut = bp;
          break;
        }
      }
      if (cut !== undefined) {
        page.fragments.push({ type: "block", id: item.id, item: index, start, end: cut });
        commit(cut - start, notesIn(item, start, cut, false));
        newPage();
        start = cut;
        continue;
      }

      if (!empty()) {
        newPage();
        continue;
      }

      // Alone on an empty page and still too tall: cut at what the page holds.
      let room = cap;
      let end = Math.min(height, start + room);
      let notes = notesIn(item, start, end, false);
      room = cap - noteCost(notes.length, sum(notes));
      if (room <= EPS) room = cap; // notes taller than a page: place them, the page overflows
      end = Math.min(height, start + room);
      notes = notesIn(item, start, end, end >= height - EPS);
      const forced = end < height - EPS;
      page.fragments.push({ type: "block", id: item.id, item: index, start, end, ...(forced ? { forced: true } : {}) });
      commit(end - start, notes);
      if (!forced) return;
      newPage();
      start = end;
    }
  }

  function headerCount(item: TableItem): number {
    return Math.max(0, Math.min(item.headerRows ?? 0, item.rows.length));
  }

  /** Body rows grouped so no group starts at a row a span reaches into. */
  function tableUnits(item: TableItem): Array<{ rows: number[]; height: number; notes: Array<{ id: number; height: number }> }> {
    const units: Array<{ rows: number[]; height: number; notes: Array<{ id: number; height: number }> }> = [];
    for (let r = headerCount(item); r < item.rows.length; r++) {
      const row = item.rows[r]!;
      const last = units[units.length - 1];
      if (row.joinPrevious && last) {
        last.rows.push(r);
        last.height += row.height;
        last.notes.push(...(row.footnotes ?? []));
      } else {
        units.push({ rows: [r], height: row.height, notes: [...(row.footnotes ?? [])] });
      }
    }
    return units;
  }

  function placeTable(item: TableItem, index: number): void {
    const h = headerCount(item);
    const headerIdx = Array.from({ length: h }, (_, i) => i);
    const headerHeight = item.rows.slice(0, h).reduce((a, r) => a + r.height, 0);
    const headerNotes = item.rows.slice(0, h).flatMap((r) => r.footnotes ?? []);
    const units = tableUnits(item);
    if (units.length === 0 && h === 0) return;
    if (units.length === 0) units.push({ rows: [], height: 0, notes: [] });

    let frag: TableFragment | null = null;
    let first = true;

    for (let u = 0; u < units.length; ) {
      const unit = units[u]!;
      if (frag === null) {
        // A fragment opens with the header rows: never a header alone at the foot.
        const notes = first ? [...headerNotes, ...unit.notes] : unit.notes;
        const need = headerHeight + unit.height;
        if (!fits(need, notes) && !empty()) {
          newPage();
          continue;
        }
        const overflow = !fits(need, notes);
        frag = {
          type: "table",
          id: item.id,
          item: index,
          rows: [...headerIdx, ...unit.rows],
          repeatedHeader: !first && h > 0,
          ...(overflow ? { overflow: true } : {}),
        };
        page.fragments.push(frag);
        commit(need, notes);
        first = false;
        u++;
        continue;
      }
      if (fits(unit.height, unit.notes)) {
        frag.rows.push(...unit.rows);
        commit(unit.height, unit.notes);
        u++;
        continue;
      }
      newPage();
      frag = null;
    }
  }
}

function sum(notes: Array<{ height: number }>): number {
  return notes.reduce((a, n) => a + n.height, 0);
}
