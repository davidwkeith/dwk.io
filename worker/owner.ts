// Owner-only test surfaces gated by the OWNER_TOKEN shared-secret bearer:
// `POST /admin/init` (one-time D1 schema init) and `POST /webmention/send`
// (drives @dwk/webmention's sender for webmention.rocks/sender). Both mirror
// the @dwk/workers conformance target's admin.ts / webmention-send.ts.
import { createIndieAuthStore } from "@dwk/indieauth";
import { createMicropubStore } from "@dwk/micropub";
import { createMicrosubStore } from "@dwk/microsub";
import { createVcStatusStore } from "@dwk/vc";
import { safeFetch, sendWebmention } from "@dwk/webmention";
import type { Env } from "./env";

// Compares SHA-256 digests, so the comparison takes the same time whatever
// the lengths of the inputs and leaks neither the token nor its length.
async function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const ba = new Uint8Array(da);
  const bb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i]! ^ bb[i]!;
  return diff === 0;
}

/**
 * Whether the request carries `Authorization: Bearer $OWNER_TOKEN`. Refuses
 * outright when the secret is unset, so a literal "Bearer undefined" header can
 * never authenticate.
 */
export async function isOwner(env: Env, request: Request) {
  const auth = request.headers.get("authorization");
  if (!env.OWNER_TOKEN || auth === null) return false;
  return timingSafeEqual(auth, `Bearer ${env.OWNER_TOKEN}`);
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function gate(env: Env, request: Request) {
  if (!(await isOwner(env, request))) return json(401, { error: "unauthorized" });
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  }
  return undefined;
}

/**
 * `POST /admin/init`: create the D1 tables for every package with a public
 * store-init API. Idempotent (`CREATE TABLE IF NOT EXISTS`); the packages
 * without one (webmention, websub, mastodon-api, solid-oidc) create their
 * schema lazily on first use.
 */
export async function adminInit(request: Request, env: Env) {
  const refused = await gate(env, request);
  if (refused) return refused;
  const initialized: Record<string, string> = {};
  await createIndieAuthStore(env).init();
  initialized["@dwk/indieauth"] = "initialized";
  await createMicropubStore(env).init();
  initialized["@dwk/micropub"] = "initialized";
  await createMicrosubStore(env).init();
  initialized["@dwk/microsub"] = "initialized";
  await createVcStatusStore({ VC_STATUS_DB: env.VC_STATUS_DB! }).init();
  initialized["@dwk/vc"] = "initialized";
  for (const name of ["@dwk/webmention", "@dwk/websub", "@dwk/mastodon-api"]) {
    initialized[name] = "lazy: schema is created on first use";
  }
  return json(200, { initialized });
}

/**
 * `POST /webmention/send` with `{"source": "...", "target": "..."}`: discover
 * the target's endpoint and send one Webmention, returning the sender's result.
 */
export async function webmentionSend(request: Request, env: Env) {
  const refused = await gate(env, request);
  if (refused) return refused;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const { source, target } = (body ?? {}) as Record<string, unknown>;
  if (typeof source !== "string" || !source || typeof target !== "string" || !target) {
    return json(400, { error: "invalid_request", message: "expected a JSON body with non-empty source and target" });
  }
  return json(200, await sendWebmention(source, target));
}

/**
 * `POST /admin/fetch` with `{"url": "...", "accept"?: "..."}`: perform one
 * outbound fetch exactly as `@dwk/activitypub`'s key resolver does (SSRF-guarded
 * `safeFetch`, https only, 10 s budget, `Accept: application/activity+json` by
 * default) and report what came back, from Cloudflare's own egress. For
 * diagnosing peers that answer the Worker differently from a terminal, such as
 * an anti-scraper layer in front of a Mastodon instance (davidwkeith/dwk.io#11).
 * Owner-only; the body preview is capped and nothing is stored.
 */
export async function adminFetch(request: Request, env: Env) {
  const refused = await gate(env, request);
  if (refused) return refused;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const { url, accept } = (body ?? {}) as Record<string, unknown>;
  if (typeof url !== "string" || !url) return json(400, { error: "invalid_request", message: "expected a JSON body with a url" });
  const started = Date.now();
  try {
    const { response, url: servedUrl } = await safeFetch(
      fetch,
      url,
      { headers: { accept: typeof accept === "string" && accept ? accept : "application/activity+json" } },
      { allowedSchemes: ["https:"], timeoutMs: 10_000 },
    );
    const preview = (await response.text()).slice(0, 400);
    const headers: Record<string, string> = {};
    for (const name of ["content-type", "location", "server", "cf-mitigated", "cf-ray", "retry-after", "www-authenticate"]) {
      const value = response.headers.get(name);
      if (value !== null) headers[name] = value;
    }
    return json(200, { ok: response.ok, status: response.status, servedUrl, elapsedMs: Date.now() - started, headers, preview });
  } catch (error) {
    const e = error as { name?: string; message?: string; reason?: string };
    return json(200, { ok: false, elapsedMs: Date.now() - started, error: e.name ?? "Error", reason: e.reason, message: e.message });
  }
}
