/**
 * Where the bundled Carlito files are, for the stylesheet the viewer injects.
 *
 * Each URL is a literal `new URL("../fonts/<file>", import.meta.url)`, the
 * pattern Vite, webpack 5, Rollup and Parcel all resolve to an emitted asset.
 * `fonts/` sits at the package root, one level above both `src/` and `dist/`,
 * so the same path is right from source and from the build.
 *
 * Returns null where it cannot work: the CommonJS build (no `import.meta`) or
 * a runtime that rejects the URL. The viewer then lays out with the fallback
 * stack and reports `font: "fallback"`; `styles.css` is the route that does
 * not depend on any of this.
 */
export function carlitoUrls(): Record<string, string> | null {
  try {
    return {
      "Carlito-Regular.ttf": new URL("../fonts/Carlito-Regular.ttf", import.meta.url).href,
      "Carlito-Bold.ttf": new URL("../fonts/Carlito-Bold.ttf", import.meta.url).href,
      "Carlito-Italic.ttf": new URL("../fonts/Carlito-Italic.ttf", import.meta.url).href,
      "Carlito-BoldItalic.ttf": new URL("../fonts/Carlito-BoldItalic.ttf", import.meta.url).href,
    };
  } catch {
    return null;
  }
}
