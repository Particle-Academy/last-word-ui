// fancy-echarts is an optional peer, imported dynamically in chart.tsx and not
// installed here (it would bring echarts with it). Typed as the members read.
declare module "@particle-academy/fancy-echarts" {
  export const EChart: unknown;
  export const registerAll: (() => void) | undefined;
}
