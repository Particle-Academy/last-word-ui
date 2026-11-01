import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/styles.css"],
  format: ["esm", "cjs"],
  dts: { entry: ["src/index.ts"] },
  // Peers stay external. Bundling react-fancy would ship a second component
  // registry; bundling React would ship a second React.
  external: ["react", "react-dom", "@particle-academy/react-fancy"],
  treeshake: true,
  clean: true,
  sourcemap: true,
});
