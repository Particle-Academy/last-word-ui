import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocViewer } from "../src";
import type { ChartBlock } from "../src/types";

/**
 * Without fancy-echarts, a chart block keeps its sized placeholder (so the page
 * breaks where it would with the chart) and the developer is told why. NOT
 * mocked: fancy-echarts is absent from this repo, and vitest.config.ts stands in
 * for an app's Vite, which turns a missing optional peer into a module that
 * throws when loaded. So the viewer's dynamic import really fails here.
 */
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

async function render(el: React.ReactElement): Promise<HTMLElement> {
  act(() => root.render(el));
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
  return host;
}

const chart: ChartBlock = {
  type: "chart",
  widthPx: 400,
  heightPx: 240,
  option: { title: { text: "Revenue" }, series: [{ type: "pie", data: [{ name: "A", value: 1 }] }] },
};

describe("chart blocks without fancy-echarts", () => {
  it("draws the sized placeholder on the page and warns once, naming the package to install", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = await render(<DocViewer doc={{ blocks: [chart, { ...chart, option: { ...chart.option, title: "Costs" } }] }} />);
    const placeholders = Array.from(el.querySelectorAll<HTMLElement>('[data-page="1"] [data-lw-chart-placeholder]'));
    expect(placeholders.map((p) => p.textContent)).toEqual(["Chart: Revenue", "Chart: Costs"]);
    expect(placeholders[0]!.style.width).toBe("400px");
    expect(placeholders[0]!.style.height).toBe("240px");

    const peerWarnings = warn.mock.calls.filter((c) => String(c[0]).includes("@particle-academy/fancy-echarts"));
    expect(peerWarnings).toHaveLength(1);
    expect(String(peerWarnings[0]![0])).toContain("renderChart");
  });

  it("still lets renderChart draw the chart", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const el = await render(<DocViewer doc={{ blocks: [chart] }} renderChart={() => <svg data-test-custom="" />} />);
    expect(el.querySelector('[data-page="1"] [data-test-custom]')).not.toBeNull();
    expect(el.querySelector('[data-page="1"] [data-lw-chart-placeholder]')).toBeNull();
  });

  it("renders on the server without loading the peer or touching the DOM", () => {
    const html = renderToString(<DocViewer doc={{ blocks: [chart] }} />);
    expect(html).toContain('data-lw-kind="chart"');
    expect(html).toContain("width:400px");
  });
});
