import { defineConfig, type Plugin } from "vitest/config";

/**
 * fancy-echarts is an optional peer and is NOT installed here. An app's Vite
 * replaces a missing optional peer with a stub module that throws when loaded;
 * this does the same for the suite, so the viewer's dynamic import fails the way
 * it does in an app without the peer. `vi.mock` of the peer still overrides it.
 */
const OPTIONAL_PEERS = ["@particle-academy/fancy-echarts"];
const STUB = "\0optional-peer-absent:";

function optionalPeersAbsent(): Plugin {
  return {
    name: "optional-peers-absent",
    enforce: "pre",
    resolveId(id) {
      return OPTIONAL_PEERS.includes(id) ? STUB + id : null;
    },
    load(id) {
      if (!id.startsWith(STUB)) return null;
      const name = id.slice(STUB.length);
      return `throw new Error(${JSON.stringify(`Could not resolve "${name}". Is it installed?`)});`;
    },
  };
}

export default defineConfig({
  plugins: [optionalPeersAbsent()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    restoreMocks: true,
  },
  esbuild: {
    jsx: "automatic",
  },
});
