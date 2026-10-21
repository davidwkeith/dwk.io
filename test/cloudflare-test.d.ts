// Minimal shape of the `cloudflare:test` module from @cloudflare/vitest-plugin.
// Its own types need @cloudflare/workers-types, which this (Astro, DOM-lib)
// TypeScript project doesn't load: the @dwk packages' binding types stop
// agreeing with each other once it's present (see worker/env.ts).
declare module "cloudflare:test" {
  /** The Worker's bindings, as wrangler.jsonc declares them. */
  export const env: import("../worker/env").Env;
  /** The Worker's default export, for integration tests. */
  export const SELF: { fetch(input: string | Request, init?: RequestInit): Promise<Response> };
}
