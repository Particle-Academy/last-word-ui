import type { ReactNode } from "react";
import { Text } from "@particle-academy/react-fancy";
import { pt, SINGLE_LINE } from "./style";
import type { SignFieldBlock } from "./types";

/**
 * fine-print's signing extension draws these node types (its `Signable`
 * writer). They are not part of last-word's shared schema, so last-word's
 * `layout()` does not count them; the viewer draws them so a document that
 * will be signed reads as it will print.
 */
export type SignFieldKind = "signature" | "initials" | "date_signed";

/** Box sizes in points, width x height: fine-print's `FieldFlow::SIZES`. */
export const SIGN_FIELD_SIZES: Record<SignFieldKind, [number, number]> = {
  signature: [216, 40],
  initials: [72, 28],
  date_signed: [144, 18],
};

const KIND_OF: Record<SignFieldBlock["type"], SignFieldKind> = {
  signatureField: "signature",
  initialsField: "initials",
  dateSignedField: "date_signed",
};

const DEFAULT_LABEL: Record<SignFieldKind, string> = {
  signature: "Signature",
  initials: "Initials",
  date_signed: "Date signed",
};

/** fine-print's `Schema::FIELD_ID`, for the field id and the signer id. */
const FIELD_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** fine-print's `Schema::FIELD_LABEL_MAX`. */
const LABEL_MAX = 200;
/** fine-print's field label: 8pt in `#6B7280`, 2pt under the rule. */
const LABEL_SIZE = 8;
const LABEL_COLOR = "#6B7280";
const LABEL_GAP = 2;
/** The rule under the box: 0.75pt, a dark grey. */
const RULE = `${pt(0.75)} solid #333333`;

/** What `renderField` is given: the node's facts, JSON-friendly. */
export interface DocSignField {
  id: string;
  kind: SignFieldKind;
  signer: string;
  required: boolean;
  /** The node's own label, or null when it has none (the box then shows the default). */
  label: string | null;
}

/**
 * Fill a signing field's box with the host's own control (a signing ceremony
 * passes its field control here). Return `undefined` to leave the bare box.
 * Called only for the drawn pages, never for the hidden measuring copy, so a
 * control and its handles appear once.
 */
export type RenderSignField = (field: DocSignField) => ReactNode | undefined;

export function isSignFieldType(type: unknown): type is SignFieldBlock["type"] {
  return typeof type === "string" && type in KIND_OF;
}

/** The node's facts, or null for a node fine-print would refuse. */
export function signField(block: SignFieldBlock): DocSignField | null {
  if (!isSignFieldType(block?.type)) return null;
  if (typeof block.id !== "string" || !FIELD_ID.test(block.id)) return null;
  if (typeof block.signer !== "string" || !FIELD_ID.test(block.signer)) return null;
  const label = typeof block.label === "string" ? block.label.slice(0, LABEL_MAX) : null;
  return { id: block.id, kind: KIND_OF[block.type], signer: block.signer, required: block.required !== false, label };
}

/**
 * The box, the rule under it and the label, at fine-print's sizes. The box is
 * the same size in the measuring copy and on the pages; only its content
 * differs, so a host control never moves a page break.
 */
export function SignFieldBox({ field, content }: { field: DocSignField; content?: ReactNode }) {
  const [w, h] = SIGN_FIELD_SIZES[field.kind];
  const label = field.label ?? DEFAULT_LABEL[field.kind];
  return (
    <div
      data-lw-kind="field"
      data-lw-field={field.id}
      data-lw-field-kind={field.kind}
      data-lw-field-signer={field.signer}
      data-lw-field-required={String(field.required)}
      style={{ display: "flow-root", paddingTop: pt(6), paddingBottom: pt(10) }}
    >
      <div
        data-lw-field-area=""
        style={{
          position: "relative",
          width: pt(w),
          maxWidth: "100%",
          height: pt(h),
          borderBottom: RULE,
          boxSizing: "content-box",
        }}
      >
        {content}
      </div>
      {label.trim() !== "" && (
        <Text
          as="p"
          data-lw-field-label=""
          style={{ margin: 0, marginTop: pt(LABEL_GAP), fontSize: pt(LABEL_SIZE), lineHeight: SINGLE_LINE, color: LABEL_COLOR }}
        >
          {label}
        </Text>
      )}
    </div>
  );
}
