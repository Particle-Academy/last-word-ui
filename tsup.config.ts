import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/styles.css"],
  format: ["esm", "cjs"],
  dts: { entry: ["src/index.ts"] },
  // Peers stay external. Bundling react-fancy would ship a second component
  // registry; bundling React would ship a second React.
  external: ["react", "react-dom", "@particle-academy/react-fancy"],
  // The bundled Carlito is referenced, never copied: dist/styles.css keeps
  // url("../fonts/...") so the ONE unmodified copy in fonts/ (with its OFL and
  // NOTICE) is what a consumer's bundler emits.
  esbuildOptions(options) {
    options.external = [...(options.external ?? []), "../fonts/*"];
  },
  treeshake: true,
  clean: true,
  sourcemap: true,
});
