// The mount table: request path → package handler, first match wins. Paths
// here and the endpoint URLs the packages advertise come from the same
// `worker/config.ts` constants, so they cannot drift apart. Everything that
// matches nothing falls through to the static site (`worker.ts`).
//
// Handlers are built lazily, once per isolate, on first match: a package whose
// secret is unset (`NotConfiguredError`, or a listed `requires` secret the
// package itself reads from `env`) answers 503 on its own paths while the rest
// of the site keeps serving.
import { createActivityPub, createActivitypubMastodonApi, resolveConfig } from "@dwk/activitypub";
import { createAtprotoPds } from "@dwk/atproto-pds";
import { createHostMeta } from "@dwk/host-meta";
import { createIndieAuth } from "@dwk/indieauth";
import { createMicropub } from "@dwk/micropub";
import { createMicrosub } from "@dwk/microsub";
import { createRemoteStorage } from "@dwk/remotestorage";
import { createSolidOidc } from "@dwk/solid-oidc";
import { createSolidPod, createSolidPodWebdav, createSolidPodWebdavCredentials } from "@dwk/solid-pod";
import { createVc } from "@dwk/vc";
import { createWebAuthn } from "@dwk/webauthn";
import { createWebfinger } from "@dwk/webfinger";
import { createWebmention } from "@dwk/webmention";
import { createWebSub } from "@dwk/websub";
import { site } from "../src/data/site";
import * as config from "./config";
import type { Ctx, Env } from "./env";
import { handleLogin } from "./login";
import { adminInit, isOwner, webmentionSend } from "./owner";
import { serveSite } from "./site";

export type Handler = (request: Request, env: Env, ctx: Ctx) => Promise<Response>;

export interface Mount {
  /** Package name, for diagnostics. */
  readonly name: string;
  /** Whether this mount owns the request. */
  readonly matches: (url: URL) => boolean;
  /** Build the handler; may throw `NotConfiguredError`. */
  readonly create: (env: Env) => Handler;
  /** Secrets the package reads from `env` at request time; unset → 503. */
  readonly requires?: readonly (keyof Env & string)[];
}

const SIGNING = ["TOKEN_SIGNING_KEY"] as const;

const exact = (...paths: readonly string[]) => (url: URL) => paths.includes(url.pathname);
const prefix = (...roots: readonly string[]) => (url: URL) =>
  roots.some((root) => url.pathname === root || url.pathname.startsWith(`${root}/`));

const { USERNAME, auth, oidc } = config;
const authPath = (href: string) => new URL(href).pathname;

// Browser Solid apps call the provider's discovery, JWKS, and token endpoints
// cross-origin. Their responses carry no cookies or ambient credentials, so any
// origin may read them. The authorize endpoint is a top-level navigation.
const OIDC_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, DPoP",
  "Access-Control-Max-Age": "86400",
};

function withCors(handler: Handler): Handler {
  return async (request, env, ctx) => {
    if (new URL(request.url).pathname === authPath(oidc.authorize)) return handler(request, env, ctx);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: OIDC_CORS });
    const original = await handler(request, env, ctx);
    const response = new Response(original.body, original);
    for (const [name, value] of Object.entries(OIDC_CORS)) response.headers.set(name, value);
    return response;
  };
}

/** The WebID profile document for the owner of the Solid pods. */
function profileCard() {
  return `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .

<${site.url}/profile/card>
    a foaf:PersonalProfileDocument ;
    foaf:primaryTopic <${config.ownerWebId}> .

<${config.ownerWebId}>
    a foaf:Person ;
    foaf:name "${site.title}" ;
    foaf:homepage <${config.me}> ;
    solid:oidcIssuer <${config.oidc.issuer}> .
`;
}

// webmention.rocks/sender numbers its targets test/1..22, test/23/page (the
// redirect case's real entry point), update/1-2, and delete/1. It rejects a
// source that has no literal <a href> to the target, so link them all.
const WEBMENTION_ROCKS_TARGETS = [
  ...Array.from({ length: 22 }, (_, i) => `test/${i + 1}`),
  "test/23/page",
  "update/1",
  "update/2",
  "delete/1",
];

function webmentionQaSource() {
  const links = WEBMENTION_ROCKS_TARGETS.map((p) => `<li><a href="https://webmention.rocks/${p}">${p}</a></li>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>webmention.rocks/sender source</title></head>
<body><article class="h-entry"><h1 class="p-name">webmention.rocks/sender source</h1>
<p class="p-summary">The <code>source</code> page for driving <code>POST /webmention/send</code> through the
webmention.rocks/sender suite: one link per target.</p><ul>
${links}
</ul></article></body></html>
`;
}

export const mounts: readonly Mount[] = [
  {
    name: "@dwk/webfinger",
    matches: exact("/.well-known/webfinger"),
    create: () => createWebfinger(config.webfinger),
  },
  {
    name: "@dwk/host-meta",
    matches: exact("/.well-known/host-meta", "/.well-known/host-meta.json"),
    create: () => createHostMeta(config.hostMeta),
  },
  {
    name: "@dwk/indieauth",
    matches: exact("/.well-known/oauth-authorization-server", authPath(auth.authorize), authPath(auth.token), authPath(auth.revocation), authPath(auth.introspection)),
    create: (env) => createIndieAuth(config.indieauth(env)),
    requires: SIGNING,
  },
  {
    // Owner sign-in for both OAuth flows, behind Cloudflare Access.
    name: "login",
    matches: exact(authPath(auth.login)),
    create: () => (request, env) =>
      handleLogin(request, env, config.owner, { indieauth: auth.authorize, mastodon: auth.mastodonAuthorize, "solid-oidc": oidc.authorize }),
    requires: SIGNING,
  },
  {
    name: "@dwk/solid-oidc",
    matches: exact(...[oidc.discovery, oidc.jwks, oidc.authorize, oidc.token].map(authPath)),
    create: (env) => withCors(createSolidOidc(config.solidOidc(env))),
    // The owner sign-in signs its consent tokens with this.
    requires: SIGNING,
  },
  { name: "admin", matches: exact("/admin/init"), create: () => adminInit },
  { name: "@dwk/webmention (send trigger)", matches: exact("/webmention/send"), create: () => webmentionSend },
  {
    name: "@dwk/webmention",
    matches: exact("/webmention"),
    create: () => createWebmention(config.webmention),
  },
  {
    name: "@dwk/micropub",
    matches: (url) => url.pathname === "/micropub" || prefix("/media")(url),
    create: (env) => createMicropub(config.micropub(env, siteFetch(env))),
    requires: SIGNING,
  },
  { name: "@dwk/microsub", matches: exact("/microsub"), create: () => createMicrosub(config.microsub), requires: SIGNING },
  { name: "@dwk/websub", matches: exact("/websub"), create: () => createWebSub(config.websub) },
  {
    name: "@dwk/activitypub",
    matches: (url) => prefix(`/users/${USERNAME}`)(url) || exact("/inbox", "/.well-known/nodeinfo")(url) || prefix("/nodeinfo")(url),
    create: (env) => createActivityPub(config.activitypub(env)),
  },
  {
    // Mastodon-compatible client API over the same actor Durable Object.
    name: "@dwk/mastodon-api",
    matches: (url) => prefix("/api/v1", "/api/v2")(url) || exact("/oauth/authorize", "/oauth/token", "/oauth/revoke")(url),
    create: (env) =>
      createActivitypubMastodonApi({
        config: resolveConfig(config.activitypub(env)),
        actor: env.ACTOR,
        mastodonConfig: config.mastodonApi(env),
      }),
    requires: SIGNING,
  },
  { name: "@dwk/remotestorage", matches: prefix("/storage"), create: (env) => createRemoteStorage(config.remotestorage(env)) },
  {
    // One pod, two verifiers: the OWNER_TOKEN bearer, or a Solid-OIDC token
    // from /oidc. A package `authenticate` hook replaces the built-in token
    // verifier outright, so each gets its own handler over the same pod.
    name: "@dwk/solid-pod",
    matches: prefix("/pod"),
    create: (env) => {
      const ownerPod = createSolidPod(config.solidPod(env));
      const oidcPod = createSolidPod(config.solidPodOidc(siteFetch(env)));
      return async (request, env, ctx) => ((await isOwner(env, request)) ? ownerPod : oidcPod)(request, env, ctx);
    },
  },
  { name: "@dwk/webdav (pod door)", matches: prefix("/dav"), create: (env) => createSolidPodWebdav(config.davPod(env)) },
  {
    name: "@dwk/webdav (credentials)",
    matches: exact("/dav-credentials"),
    create: (env) => createSolidPodWebdavCredentials(config.davPod(env)),
  },
  { name: "@dwk/webauthn", matches: prefix("/webauthn"), create: (env) => createWebAuthn(config.webauthn(env)) },
  { name: "@dwk/vc", matches: prefix("/credentials"), create: (env) => createVc(config.vc(env)) },
  // /.well-known/atproto-did and /.well-known/did.json stay static (the real
  // Bluesky identity), so only the XRPC surface is mounted.
  { name: "@dwk/atproto-pds", matches: prefix("/xrpc"), create: (env) => createAtprotoPds(config.atproto(env)) },
  {
    name: "identity documents",
    matches: exact("/profile/card", "/webmention-qa-source"),
    create: () => async (request) =>
      new URL(request.url).pathname === "/profile/card"
        ? new Response(profileCard(), { headers: { "content-type": "text/turtle; charset=utf-8" } })
        : new Response(webmentionQaSource(), { headers: { "content-type": "text/html; charset=utf-8" } }),
  },
];

const handlers = new Map<string, Handler>();

/** The mount owning `url`, or `undefined` for the static site. */
export function findMount(url: URL) {
  return mounts.find((mount) => mount.matches(url));
}

function notConfigured(mount: Mount, binding: string) {
  config.logger.warn("mount.not_configured", { mount: mount.name, binding });
  return new Response(JSON.stringify({ error: "not_configured", mount: mount.name, binding }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

/**
 * `fetch` for the Worker's requests to its own site: Micropub syndicating
 * through the actor's publish endpoint, the WebSub hub fetching the feeds it
 * distributes. On its Custom Domain the Worker can't reach its own hostname
 * over the network (Cloudflare answers 522), so a request for this site goes
 * to its mount, or the static site, in-process; anything else is an ordinary
 * `fetch`. The callee gets no execution context of its own: only mounts that
 * don't need `waitUntil` (the ActivityPub actor) are called so.
 */
export function siteFetch(env: Env): typeof fetch {
  const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as Ctx;
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== site.url) return fetch(request);
    const mount = findMount(url);
    return mount ? dispatch(mount, request, env, ctx) : serveSite(request, env);
  };
}

/** Dispatch to a mount, building its handler on first use. */
export async function dispatch(mount: Mount, request: Request, env: Env, ctx: Ctx) {
  const missing = mount.requires?.find((name) => !env[name]);
  if (missing) return notConfigured(mount, missing);
  let handler = handlers.get(mount.name);
  if (!handler) {
    try {
      handler = mount.create(env);
    } catch (error) {
      if (error instanceof config.NotConfiguredError) return notConfigured(mount, error.binding);
      throw error;
    }
    handlers.set(mount.name, handler);
  }
  return handler(request, env, ctx);
}
