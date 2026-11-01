import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DocViewer, type Doc, type DocViewerLayout } from "../src";

/** A small letterhead logo, drawn at runtime so the demo carries no binary. */
function logo(): string {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 48;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1F3A5F";
  g.fillRect(0, 0, 48, 48);
  g.fillStyle = "#FFFFFF";
  g.font = "bold 28px sans-serif";
  g.fillText("A", 14, 34);
  g.fillStyle = "#1F3A5F";
  g.font = "bold 22px sans-serif";
  g.fillText("Acme Ltd", 58, 32);
  return c.toDataURL("image/png");
}

const lorem =
  "Operating performance held up through the quarter despite a softer September. The board is asked to note the movements below and to approve the revised capital plan, which re-phases two projects into the first half of next year without changing their total cost.";

function memo(): Doc {
  const rows = Array.from({ length: 22 }, (_, i) => ({
    cells: [
      { blocks: [{ type: "paragraph" as const, spaceAfter: 0, runs: [{ text: `Cost centre ${101 + i}` }] }] },
      { blocks: [{ type: "paragraph" as const, spaceAfter: 0, runs: [{ text: i % 3 === 0 ? "Operations" : i % 3 === 1 ? "Sales" : "Research" }] }] },
      {
        blocks: [{ type: "paragraph" as const, spaceAfter: 0, align: "right" as const, runs: [{ text: (1200 + i * 137).toLocaleString("en-US") }] }],
        ...(i % 5 === 4 ? { shading: "#FFF4CE" } : {}),
      },
    ],
  }));
  return {
    title: "Q3 Board Memo",
    page: {
      size: "letter",
      margins: { header: 28 },
      header: {
        blocks: [
          { type: "image", src: logo(), widthPx: 120, heightPx: 36 },
          { type: "paragraph", align: "right", spaceAfter: 0, runs: [{ text: "Acme Ltd, 1 Example Street, Springfield", size: 8, color: "#6B7280" }] },
        ],
      },
      footer: { left: "Q3 2026 Board Memo", center: "Confidential", right: "Page {page} of {pages}" },
    },
    blocks: [
      { type: "heading", level: 1, runs: [{ text: "Q3 2026 results", color: "#1F3A5F" }] },
      {
        type: "paragraph",
        runs: [
          { text: "Revenue rose " },
          { text: "8.4%", bold: true },
          { text: " against plan" },
          { text: "", footnote: { blocks: [{ type: "paragraph", runs: [{ text: "Audited figures, FY2026; unaudited for September." }] }] } },
          { text: ". " + lorem },
        ],
      },
      {
        type: "paragraph",
        shading: "#EAF1FB",
        indentLeft: 12,
        borders: { left: { style: "single", width: 3, color: "#1F3A5F" } },
        runs: [{ text: "Decision requested: ", bold: true }, { text: "approve the revised capital plan (Appendix A)." }],
      },
      { type: "heading", level: 2, runs: [{ text: "Highlights" }] },
      {
        type: "list",
        items: [
          { runs: [{ text: "Gross margin up 1.2 points on mix." }] },
          { runs: [{ text: "Two projects re-phased; " }, { text: "no change to total cost", italic: true }] , children: [{ runs: [{ text: "Plant upgrade moves to Q1." }] }] },
          { runs: [{ text: "Headcount flat at 412." }] },
        ],
      },
      { type: "quote", blocks: [{ type: "paragraph", runs: [{ text: "We grew where we chose to, and held costs everywhere else." }] }] },
      { type: "heading", level: 2, runs: [{ text: "Cost centre detail" }] },
      {
        type: "table",
        widths: [3, 2, 2],
        rows: [
          {
            header: true,
            cells: ["Cost centre", "Function", "USD"].map((t, i) => ({
              shading: "#1F3A5F",
              blocks: [{ type: "paragraph" as const, spaceAfter: 0, ...(i === 2 ? { align: "right" as const } : {}), runs: [{ text: t, color: "#FFFFFF" }] }],
            })),
          },
          ...rows,
        ],
      },
      { type: "paragraph", runs: [{ text: lorem }] },
      { type: "hr" },
      { type: "heading", level: 2, runs: [{ text: "Appendix A" }] },
      {
        type: "paragraph",
        runs: [
          { text: "The plan re-phases spend as follows" },
          { text: "", footnote: { blocks: [{ type: "paragraph", runs: [{ text: "Figures in USD thousands." }] }] } },
          { text: ". " + lorem + " " + lorem },
        ],
      },
      { type: "code", text: "capex.q4 = 1_250\ncapex.q1 = 2_100" },
      { type: "paragraph", runs: [{ text: lorem + " " + lorem + " " + lorem }] },
      { type: "paragraph", runs: [{ text: Array.from({ length: 9 }, () => lorem).join(" ") }] },
    ],
  };
}

const doc = memo();

function App() {
  const [layout, setLayout] = useState<DocViewerLayout | null>(null);
  return (
    <>
      <div className="bar" data-demo-status="">
        {layout ? `${layout.pages} pages, ${layout.pageWidth} x ${layout.pageHeight} pt` : "laying out..."}
      </div>
      <div className="layout">
        <div className="panel wide">
          <DocViewer doc={doc} onLayout={setLayout} />
        </div>
        <div className="panel narrow">
          <DocViewer doc={doc} />
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
