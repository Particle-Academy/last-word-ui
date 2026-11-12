import { useEffect, useMemo, useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { ChartBlock } from "./types";

/** What `renderChart` is given for one chart block. */
export interface ChartRenderArgs {
  /** The block as it is in the Doc. */
  block: ChartBlock;
  /**
   * The block's ECharts option laid out for a page: a transparent background,
   * last-word's default palette, no animation and a grid that keeps axis labels
   * inside the box. Every key the block sets wins.
   */
  option: Record<string, unknown>;
  /** CSS px at 100% (before the page's scale), as the page lays the block out. */
  width: number;
  height: number;
  /** The chart's title, or its alt text, or "". */
  title: string;
}

/**
 * Draws a chart block instead of the built-in renderer. Return `undefined` to
 * leave that chart to the default (fancy-echarts when installed, else the
 * placeholder). Draw at exactly `width` x `height`: the page was laid out for it.
 */
export type RenderChart = (chart: ChartRenderArgs) => ReactNode | undefined;

/** last-word's default chart palette (Office's), so an unstyled chart is the colour it is in Word. */
export const OFFICE_PALETTE = ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47", "#264478", "#9E480E"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A block's option as a page draws it. Defaults only: the block's own keys win.
 * The sheet is white paper in every app colour scheme, so the background is
 * transparent (the paper shows through), and animation is off so a printed or
 * captured page is never caught mid-transition.
 */
export function pageChartOption(option: unknown): Record<string, unknown> {
  const o = isObj(option) ? option : {};
  const hasAxes = o.xAxis !== undefined || o.yAxis !== undefined;
  const legendShown = isObj(o.legend) && o.legend.show !== false;
  return {
    backgroundColor: "transparent",
    color: OFFICE_PALETTE,
    animation: false,
    ...o,
    ...(hasAxes
      ? {
          grid: o.grid ?? {
            top: o.title ? 36 : 16,
            right: 16,
            bottom: 8 + (legendShown ? 28 : 0),
            left: 8,
            outerBoundsMode: "same",
            outerBoundsContain: "all",
          },
        }
      : {}),
  };
}

export function chartTitle(block: ChartBlock): string {
  const title = isObj(block.option) ? block.option.title : undefined;
  if (typeof title === "string") return title;
  if (isObj(title) && typeof title.text === "string") return title.text;
  return typeof block.alt === "string" ? block.alt : "";
}

// ── The optional peer ──────────────────────────────────────────────────────

type EChartComponent = ComponentType<{
  option: Record<string, unknown>;
  theme?: string | object;
  renderer?: "canvas" | "svg";
  autoResize?: boolean;
  style?: CSSProperties;
}>;

type PeerState = { status: "pending" } | { status: "ready"; EChart: EChartComponent } | { status: "missing" };

const PENDING: PeerState = { status: "pending" };
const MISSING: PeerState = { status: "missing" };
let peer: PeerState = PENDING;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/**
 * fancy-echarts is an OPTIONAL peer: a document with no chart must not make an
 * app install a charting engine. A static import would fail an app's build
 * without it, so it is imported on first use, on the client only (a store
 * subscription never runs on the server), and a failed import means "absent".
 */
function loadPeer(): void {
  if (loading) return;
  loading = import("@particle-academy/fancy-echarts")
    .then((ns) => {
      const mod = ns as unknown as Record<string, unknown>;
      const EChart = mod.EChart as EChartComponent | undefined;
      if (typeof EChart !== "function" && typeof EChart !== "object") return MISSING;
      (mod.registerAll as (() => void) | undefined)?.();
      return { status: "ready", EChart } as PeerState;
    })
    .catch(() => MISSING)
    .then((state) => {
      peer = state;
      listeners.forEach((l) => l());
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  loadPeer();
  return () => listeners.delete(listener);
}

const getSnapshot = () => peer;
// The server, and the hydrating client, draw the empty sized box: the markup
// cannot depend on whether a module has loaded.
const getServerSnapshot = () => PENDING;

let warned = false;

function warnMissing(): void {
  if (warned) return;
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (env?.NODE_ENV === "production") return;
  warned = true;
  console.warn(
    "[last-word-ui] This document has charts, but @particle-academy/fancy-echarts is not installed, so they " +
      "draw as placeholders. Install it (npm i @particle-academy/fancy-echarts echarts) to draw them, or pass " +
      "DocViewer a renderChart prop.",
  );
}

/**
 * An explicit light theme. Left undefined, fancy-echarts picks "dark" when the OS
 * prefers dark, and draws light text on the white sheet. Stable identity: a new
 * object each render would re-create the chart.
 */
const PAPER_THEME = {};

// ── The drawn chart ────────────────────────────────────────────────────────

interface ChartBoxProps {
  block: ChartBlock;
  width: number;
  height: number;
  /** The measuring copy: only the box, never a chart. */
  measuring?: boolean;
  renderChart?: RenderChart;
}

/** The chart's box, at its size, whatever is drawn in it: the measuring copy and the page lay out the same. */
export function ChartBox({ block, width, height, measuring, renderChart }: ChartBoxProps) {
  const title = chartTitle(block);
  return (
    <div
      data-lw-chart=""
      role={measuring ? undefined : "img"}
      aria-label={measuring || !title ? undefined : title}
      style={{ width, height, overflow: "hidden" }}
    >
      {measuring ? null : <ChartContent block={block} width={width} height={height} title={title} renderChart={renderChart} />}
    </div>
  );
}

function ChartContent({ block, width, height, title, renderChart }: Omit<ChartBoxProps, "measuring"> & { title: string }) {
  const option = useMemo(() => pageChartOption(block.option), [block.option]);
  if (renderChart) {
    const custom = renderChart({ block, option, width, height, title });
    if (custom !== undefined) return <>{custom}</>;
  }
  return <DefaultChart option={option} width={width} height={height} title={title} />;
}

/** Subscribes to the peer only when it draws: a renderChart that draws every chart never loads it. */
function DefaultChart({ option, width, height, title }: { option: Record<string, unknown>; width: number; height: number; title: string }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (state.status === "ready") {
    const { EChart } = state;
    return <EChart option={option} theme={PAPER_THEME} renderer="svg" autoResize={false} style={{ width, height }} />;
  }
  if (state.status === "missing") return <Placeholder width={width} height={height} title={title} />;
  return null;
}

function Placeholder({ width, height, title }: { width: number; height: number; title: string }) {
  // Only when a placeholder is actually drawn: an app whose renderChart draws
  // every chart has nothing to be warned about.
  useEffect(warnMissing, []);
  return (
    <div
      data-lw-chart-placeholder=""
      style={{
        width,
        height,
        border: "0.75pt dashed #9CA3AF",
        color: "#6B7280",
        fontSize: "9pt",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      {title ? `Chart: ${title}` : "Chart"}
    </div>
  );
}
