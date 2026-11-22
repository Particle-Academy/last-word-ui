import type { Doc, Run } from "./types";

/**
 * A FAIL-SAFE for tracked changes, not support for them.
 *
 * last-word's model can carry a `revision` key: on a run (`insert`, `delete`,
 * `moveFrom`, `moveTo`, `format`, with `author`, `date`, `name`), on a paragraph or
 * heading block (its paragraph mark) and on a list item. This viewer cannot show
 * revisions. Drawing the document as if they were not there would present DELETED
 * text as live text, so a document carrying any revision draws with this notice, and
 * a deleted or moved-away run is not drawn at all.
 */
export const TRACKED_CHANGES_NOTICE =
  "This document has tracked changes, which this viewer can't show yet. Accept them first. Deleted text is hidden.";

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => typeof v === "object" && v !== null;

/** Revision kinds whose run text is part of the document if the change is accepted. */
const KEPT_KINDS = new Set(["insert", "moveTo", "format"]);
const KINDS = ["insert", "delete", "moveFrom", "moveTo", "format"];

/** The kind a revision names, read loosely: the authoring shape is new and arrives as JSON. */
function revisionKind(revision: unknown): string | null {
  if (typeof revision === "string") return revision;
  if (!isObject(revision)) return null;
  for (const key of ["type", "kind"]) {
    if (typeof revision[key] === "string") return revision[key] as string;
  }
  const named = KINDS.filter((k) => revision[k] !== undefined && revision[k] !== false);
  return named.length === 1 ? named[0]! : null;
}

/**
 * Whether a run's text must not be drawn: it was deleted, or moved away from here.
 * FAILS SAFE: a `revision` it cannot read counts as deleted, because hiding text
 * under a visible notice is recoverable and showing deleted text as live is not.
 */
export function isDeletedRun(run: Run): boolean {
  if (!isObject(run) || !("revision" in run) || run.revision === undefined) return false;
  const kind = revisionKind(run.revision);
  return kind === null || !KEPT_KINDS.has(kind);
}

const escape = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

/**
 * JSON Pointers to every `revision` key in the document: the body, quotes, table
 * cells, list items at any depth, footnotes and the page bands. A chart's `option` is
 * arbitrary chart data and is not read. Nothing here trusts the Doc's shape, and the
 * walk is iterative: the nesting is the file's.
 */
export function revisionPaths(doc: Doc): string[] {
  const found: string[] = [];
  if (!isObject(doc)) return found;
  const seen = new Set<object>();
  const stack: Array<{ value: unknown; at: string }> = [{ value: doc, at: "" }];
  while (stack.length > 0) {
    const { value, at } = stack.pop()!;
    if (!isObject(value) || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) stack.push({ value: value[i], at: `${at}/${i}` });
      continue;
    }
    if (value.revision !== undefined) found.push(`${at}/revision`);
    const keys = Object.keys(value).filter((k) => k !== "revision" && !(k === "option" && value.type === "chart"));
    for (let i = keys.length - 1; i >= 0; i--) stack.push({ value: value[keys[i]!], at: `${at}/${escape(keys[i]!)}` });
  }
  return found;
}

/** Whether the document carries any tracked change. A host can check this before showing it. */
export function hasRevisions(doc: Doc): boolean {
  return revisionPaths(doc).length > 0;
}
