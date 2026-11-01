/**
 * The few rules inline styles cannot reach: react-fancy's Table renders its own
 * <table>, and Separator renders an <hr> with no style prop. Kept identical to
 * styles.css (tests/styles.test.ts checks), which is the CSP-strict route.
 * Every rule is scoped to the viewer and low-specificity.
 */
export const VIEWER_CSS = `
:where([data-lw-viewer]) [data-lw-table] > table { width: 100%; border-collapse: collapse; table-layout: fixed; }
:where([data-lw-viewer]) [data-lw-table] { border: 0; border-radius: 0; overflow: visible; }
:where([data-lw-viewer]) [data-lw-sizer] > td { height: 0; padding: 0; border: none; }
:where([data-lw-viewer]) hr[data-react-fancy-separator] { margin: 0; width: 100%; border: 0; border-top: 0.75pt solid #000000; }
:where([data-lw-viewer]) [data-lw-sheet] p, :where([data-lw-viewer]) [data-lw-measure] p { margin-top: 0; margin-bottom: 0; }
`.trim();
