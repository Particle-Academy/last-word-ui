/**
 * Signing field nodes (fine-print's signing extension: `signatureField`,
 * `initialsField`, `dateSignedField`) are drawn as boxes at fine-print's sizes,
 * and a host can fill each box with its own control through `renderField`.
 * That is how a signing ceremony puts the signer's fields ON the page.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, SIGN_FIELD_SIZES, type DocSignField } from "../src";
import type { Doc } from "../src/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(el: React.ReactElement): HTMLElement {
  act(() => root.render(el));
  return host;
}
const pagesOf = (el: HTMLElement) => el.querySelector<HTMLElement>("[data-lw-viewer]")!;
/** Only what is on the pages, never the hidden measuring copy. */
const onPages = (el: HTMLElement, selector: string) =>
  Array.from(el.querySelectorAll<HTMLElement>(`[data-page] ${selector}`));
const para = (t: string) => ({ type: "paragraph" as const, runs: [{ text: t }] });

const signature = { type: "signatureField", id: "sig_client", signer: "client", required: true } as const;
const date = { type: "dateSignedField", id: "date_client", signer: "client", label: "Date signed" } as const;
const initials = { type: "initialsField", id: "ini_client", signer: "client", required: false, label: "" } as const;

describe("DocViewer: signing field nodes", () => {
  it("draws each field as a box at fine-print's size, with a stable handle", () => {
    const doc = { blocks: [para("Accepted:"), signature, date, initials] } as unknown as Doc;
    const el = render(<DocViewer doc={doc} fit="none" />);
    expect(pagesOf(el)).toBeTruthy();

    const boxes = onPages(el, "[data-lw-field]");
    expect(boxes.map((b) => b.dataset.lwField)).toEqual(["sig_client", "date_client", "ini_client"]);
    expect(boxes.map((b) => b.dataset.lwFieldKind)).toEqual(["signature", "date_signed", "initials"]);
    expect(boxes[0]!.dataset.lwFieldSigner).toBe("client");
    expect(boxes[0]!.dataset.lwFieldRequired).toBe("true");
    expect(boxes[2]!.dataset.lwFieldRequired).toBe("false");

    // fine-print's FieldFlow::SIZES, in points.
    expect(SIGN_FIELD_SIZES).toEqual({ signature: [216, 40], initials: [72, 28], date_signed: [144, 18] });
    const area = (b: HTMLElement) => b.querySelector<HTMLElement>("[data-lw-field-area]")!;
    expect(area(boxes[0]!).style.width).toBe("216pt");
    expect(area(boxes[0]!).style.height).toBe("40pt");
    expect(area(boxes[1]!).style.height).toBe("18pt");
    // Never wider than the column it sits in.
    expect(area(boxes[0]!).style.maxWidth).toBe("100%");
  });

  it("draws the label under the box: the default per kind, the given one, none for an empty one", () => {
    const doc = { blocks: [signature, date, initials] } as unknown as Doc;
    const el = render(<DocViewer doc={doc} fit="none" />);
    const labels = onPages(el, "[data-lw-field]").map((b) => b.querySelector("[data-lw-field-label]")?.textContent ?? null);
    expect(labels).toEqual(["Signature", "Date signed", null]);
  });

  it("fills each box with the host's control, on the pages only, never in the measuring copy", () => {
    const seen: DocSignField[] = [];
    const renderField = vi.fn((field: DocSignField) => {
      seen.push(field);
      return <button data-host-control={field.id}>Sign {field.kind}</button>;
    });
    const doc = { blocks: [signature, date] } as unknown as Doc;
    const el = render(<DocViewer doc={doc} fit="none" renderField={renderField} />);

    // Exactly one host control per field in the whole viewer: the hidden
    // measuring copy draws the bare box, so a handle is never duplicated.
    expect(el.querySelectorAll('[data-host-control="sig_client"]')).toHaveLength(1);
    expect(el.querySelectorAll('[data-host-control="date_client"]')).toHaveLength(1);
    expect(onPages(el, '[data-lw-field="sig_client"] [data-host-control="sig_client"]')).toHaveLength(1);
    expect(seen.find((f) => f.id === "sig_client")).toEqual({
      id: "sig_client",
      kind: "signature",
      signer: "client",
      required: true,
      label: null,
    });
    expect(seen.find((f) => f.id === "date_client")).toMatchObject({ kind: "date_signed", required: true, label: "Date signed" });
  });

  it("falls back to the bare box when the host returns undefined for a field", () => {
    const doc = { blocks: [signature, date] } as unknown as Doc;
    const el = render(
      <DocViewer doc={doc} fit="none" renderField={(f) => (f.id === "date_client" ? <i data-host-control="" /> : undefined)} />,
    );
    const [sig, dt] = onPages(el, "[data-lw-field]");
    expect(sig!.querySelector("[data-host-control]")).toBeNull();
    expect(sig!.querySelector("[data-lw-field-area]")).toBeTruthy();
    expect(dt!.querySelector("[data-host-control]")).toBeTruthy();
  });

  it("draws a field inside a table cell, where a signature block usually sits", () => {
    const doc = {
      blocks: [
        {
          type: "table",
          rows: [{ cells: [{ blocks: [signature] }, { blocks: [para("Seller")] }] }],
        },
      ],
    } as unknown as Doc;
    const el = render(<DocViewer doc={doc} fit="none" renderField={(f) => <b data-host-control={f.id} />} />);
    expect(onPages(el, '[data-lw-field="sig_client"] [data-host-control="sig_client"]')).toHaveLength(1);
  });

  it("draws nothing for a malformed field node, as fine-print refuses one", () => {
    const doc = {
      blocks: [
        { type: "signatureField", id: "has space", signer: "client" },
        { type: "signatureField", id: "ok", signer: "" },
        { type: "signatureField", signer: "client" },
        para("after"),
      ],
    } as unknown as Doc;
    const renderField = vi.fn(() => <b />);
    const el = render(<DocViewer doc={doc} fit="none" renderField={renderField} />);
    expect(onPages(el, "[data-lw-field]")).toHaveLength(0);
    expect(renderField).not.toHaveBeenCalled();
  });

  it("does not draw a field in a header or footer: fields are body content, as in fine-print", () => {
    const doc = {
      blocks: [para("body")],
      page: { header: { blocks: [para("LETTERHEAD"), signature] } },
    } as unknown as Doc;
    const renderField = vi.fn(() => <b data-host-control="" />);
    const el = render(<DocViewer doc={doc} fit="none" renderField={renderField} />);
    // The header IS drawn, so the field's absence is the rule and not a missing band.
    expect(el.querySelector('[data-page] [data-lw-band="header"]')?.textContent).toContain("LETTERHEAD");
    expect(el.querySelectorAll("[data-lw-field]")).toHaveLength(0);
    expect(renderField).not.toHaveBeenCalled();
  });
});
