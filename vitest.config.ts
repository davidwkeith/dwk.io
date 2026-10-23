// Tests run inside workerd with the Worker's own bindings from wrangler.jsonc
// (local D1, queues, Durable Objects, and ASSETS from `dist/`, so `npm test`
// builds first). https://developers.cloudflare.com/workers/testing/vitest-integration/
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Wrangler fills the test env from a local `.dev.vars` (or, without one, `.env`,
// which also holds the build's GPG key). Keep the suite hermetic: skip `.env`,
// and blank every key a `.dev.vars` defines (an empty secret reads as unset).
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = "false";
const localDevVars = existsSync(".dev.vars")
  ? Object.fromEntries(Object.keys(parseEnv(readFileSync(".dev.vars", "utf8"))).map((key) => [key, ""]))
  : {};

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // A test-only signing key, so the token-guarded mounts (IndieAuth,
      // Micropub, Microsub) serve instead of answering 503 not_configured.
      miniflare: {
        bindings: { ...localDevVars, TOKEN_SIGNING_KEY: "test-signing-key", INTROSPECTION_TOKEN: "test-introspection-token" },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    // n3 (via @dwk/solid-pod) pulls in CommonJS readable-stream, which the
    // module runner can't evaluate unbundled; wrangler's esbuild copes the same way.
    deps: { optimizer: { ssr: { enabled: true, include: ["n3"] } } },
  },
});
