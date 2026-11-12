import { act, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer, PX_PER_PT, type ChartRenderArgs } from "../src";
import type { ChartBlock, Doc } from "../src/types";

/**
 * last-word-ui#1: every chart block from last-word's native charts drew as a
 * dashed "Chart: <title>" placeholder. With fancy-echarts installed, the block's
 * option is drawn by its EChart, at the block's size, inside the page.
 *
 * fancy-echarts is an optional peer and is not installed in this repo, so the
 * module is mocked; the spy records exactly what the viewer hands EChart.
 */
interface EChartCall {
  option: Record<string, unknown>;
  theme?: unknown;
  renderer?: string;
  style?: CSSProperties;
}
const calls: EChartCall[] = [];

vi.mock("@particle-academy/fancy-echarts", () => ({
  registerAll: () => {},
  EChart: (props: EChartCall) => {
    calls.push(props);
    return <div data-test-echart="" />;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  calls.length = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

/** Render, then let the optional peer's dynamic import settle. */
async function render(el: React.ReactElement): Promise<HTMLElement> {
  act(() => root.render(el));
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return host;
}

const column: ChartBlock = {
  type: "chart",
  widthPx: 400,
  heightPx: 240,
  option: {
    title: { text: "Revenue" },
    xAxis: { type: "category", data: ["Q1", "Q2", "Q3"] },
    yAxis: { type: "value" },
    series: [{ type: "bar", name: "2026", data: [3, 5, 4] }],
  },
};
const bar: ChartBlock = {
  type: "chart",
  widthPx: 360,
  heightPx: 200,
  option: {
    title: { text: "Headcount" },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: ["North", "South"] },
    series: [{ type: "bar", data: [12, 9] }],
  },
};
const line: ChartBlock = {
  type: "chart",
  widthPx: 420,
  heightPx: 220,
  option: {
    title: { text: "Trend" },
    xAxis: { type: "category", data: ["Jan", "Feb", "Mar"] },
    yAxis: { type: "value" },
    series: [{ type: "line", data: [1, 4, 2] }],
  },
};
const pie: ChartBlock = {
  type: "chart",
  widthPx: 300,
  heightPx: 300,
  option: {
    title: { text: "Share" },
    legend: { show: true },
    series: [{ type: "pie", data: [{ name: "A", value: 60 }, { name: "B", value: 40 }] }],
  },
};

describe("chart blocks draw with fancy-echarts", () => {
  it.each([
    ["column", column],
    ["bar", bar],
    ["line", line],
    ["pie", pie],
  ] as const)("draws a %s chart through EChart with the block's option and size, inside the page", async (_kind, block) => {
    const el = await render(<DocViewer doc={{ blocks: [block] }} />);
    const page = el.querySelector('[data-page="1"]');
    expect(page).not.toBeNull();

    // On the page, not a placeholder, and not a second chart in the measuring copy.
    expect(page!.querySelector("[data-lw-chart-placeholder]")).toBeNull();
    expect(page!.querySelector('[data-block="b0"] [data-test-echart]')).not.toBeNull();
    expect(el.querySelector("[data-lw-measure] [data-test-echart]")).toBeNull();
    expect(calls.length).toBeGreaterThan(0);

    const call = calls[calls.length - 1]!;
    expect(call.option).toMatchObject(block.option);
    expect(call.style).toMatchObject({ width: block.widthPx, height: block.heightPx });
  });

  it("sizes a chart with no pixel size to the text column, 0.6 of its width tall", async () => {
    const block: ChartBlock = { type: "chart", option: line.option };
    await render(<DocViewer doc={{ blocks: [block] }} />);
    const width = 468 * PX_PER_PT; // Letter at 1in margins
    expect(calls[calls.length - 1]!.style).toMatchObject({ width, height: width * 0.6 });
  });

  it("draws on paper whatever the app's colour scheme, and crisp in print", async () => {
    await render(<DocViewer doc={{ blocks: [column] }} />);
    const call = calls[calls.length - 1]!;
    // An explicit theme: left undefined, fancy-echarts picks "dark" from the OS
    // and draws light text on the white sheet.
    expect(call.theme).toBeDefined();
    expect(call.theme).not.toBe("dark");
    // Vector output stays sharp under the sheet's scale transform and on paper.
    expect(call.renderer).toBe("svg");
    // The page shows through; a printed chart is never caught mid-animation.
    expect(call.option.backgroundColor).toBe("transparent");
    expect(call.option.animation).toBe(false);
  });

  it("keeps an option's own colours, background and animation", async () => {
    const block: ChartBlock = { ...column, option: { ...column.option, color: ["#112233"], backgroundColor: "#FFFFFF", animation: true } };
    await render(<DocViewer doc={{ blocks: [block] }} />);
    const option = calls[calls.length - 1]!.option;
    expect(option.color).toEqual(["#112233"]);
    expect(option.backgroundColor).toBe("#FFFFFF");
    expect(option.animation).toBe(true);
  });

  it("lets renderChart draw a chart instead, given the block, the option and its size", async () => {
    const seen: ChartRenderArgs[] = [];
    const el = await render(
      <DocViewer
        doc={{ blocks: [column] }}
        renderChart={(args) => {
          seen.push(args);
          return <svg data-test-custom="" />;
        }}
      />,
    );
    expect(el.querySelector('[data-page="1"] [data-test-custom]')).not.toBeNull();
    expect(el.querySelector("[data-test-echart]")).toBeNull();
    const args = seen[seen.length - 1]!;
    expect(args.block).toBe(column);
    expect(args.width).toBe(400);
    expect(args.height).toBe(240);
    expect(args.title).toBe("Revenue");
    expect(args.option).toMatchObject(column.option);
  });

  it("falls back to EChart when renderChart returns undefined", async () => {
    const el = await render(<DocViewer doc={{ blocks: [column] }} renderChart={() => undefined} />);
    expect(el.querySelector('[data-page="1"] [data-test-echart]')).not.toBeNull();
  });

  it("does not draw a chart in a header or footer", async () => {
    const doc: Doc = { blocks: [{ type: "paragraph", runs: [{ text: "x" }] }], page: { header: { blocks: [column] } } };
    const el = await render(<DocViewer doc={doc} />);
    expect(el.querySelector('[data-lw-band] [data-test-echart]')).toBeNull();
  });
});
