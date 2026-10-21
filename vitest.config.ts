// Tests run inside workerd with the Worker's own bindings from wrangler.jsonc
// (local D1, queues, Durable Objects, and ASSETS from `dist/`, so `npm test`
// builds first). https://developers.cloudflare.com/workers/testing/vitest-integration/
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["test/**/*.test.ts"],
    // n3 (via @dwk/solid-pod) pulls in CommonJS readable-stream, which the
    // module runner can't evaluate unbundled; wrangler's esbuild copes the same way.
    deps: { optimizer: { ssr: { enabled: true, include: ["n3"] } } },
  },
});
