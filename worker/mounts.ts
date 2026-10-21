// The mount table: request path → package handler, first match wins. Paths
// here and the endpoint URLs the packages advertise come from the same
// `worker/config.ts` constants, so they cannot drift apart. Everything that
// matches nothing falls through to the static site (`worker.ts`).
//
// Handlers are built lazily, once per isolate, on first match: a package whose
// secret is unset (`NotConfiguredError`) answers 503 on its own paths while the
// rest of the site keeps serving.
import { createActivityPub, createActivitypubMastodonApi, resolveConfig } from "@dwk/activitypub";
import { createAtprotoPds } from "@dwk/atproto-pds";
import { createHostMeta } from "@dwk/host-meta";
import { createIndieAuth } from "@dwk/indieauth";
import { createMicropub } from "@dwk/micropub";
import { createMicrosub } from "@dwk/microsub";
import { createRemoteStorage } from "@dwk/remotestorage";
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
import { adminInit, webmentionSend } from "./owner";

export type Handler = (request: Request, env: Env, ctx: Ctx) => Promise<Response>;

export interface Mount {
  /** Package name, for diagnostics. */
  readonly name: string;
  /** Whether this mount owns the request. */
  readonly matches: (url: URL) => boolean;
  /** Build the handler; may throw `NotConfiguredError`. */
  readonly create: (env: Env) => Handler;
}

const exact = (...paths: readonly string[]) => (url: URL) => paths.includes(url.pathname);
const prefix = (...roots: readonly string[]) => (url: URL) =>
  roots.some((root) => url.pathname === root || url.pathname.startsWith(`${root}/`));

const { USERNAME, auth } = config;
const authPath = (href: string) => new URL(href).pathname;

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
    foaf:homepage <${config.me}> .
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
    matches: exact("/.well-known/oauth-authorization-server", authPath(auth.authorize), authPath(auth.token), authPath(auth.revocation)),
    create: (env) => createIndieAuth(config.indieauth(env)),
  },
  {
    // Owner sign-in for both OAuth flows, behind Cloudflare Access.
    name: "login",
    matches: exact(authPath(auth.login)),
    create: () => (request, env) =>
      handleLogin(request, env, config.owner, { indieauth: auth.authorize, mastodon: auth.mastodonAuthorize }),
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
    create: (env) => createMicropub(config.micropub(env)),
  },
  { name: "@dwk/microsub", matches: exact("/microsub"), create: () => createMicrosub(config.microsub) },
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
  },
  { name: "@dwk/remotestorage", matches: prefix("/storage"), create: (env) => createRemoteStorage(config.remotestorage(env)) },
  { name: "@dwk/solid-pod", matches: prefix("/pod"), create: (env) => createSolidPod(config.solidPod(env)) },
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

/** Dispatch to a mount, building its handler on first use. */
export async function dispatch(mount: Mount, request: Request, env: Env, ctx: Ctx) {
  let handler = handlers.get(mount.name);
  if (!handler) {
    try {
      handler = mount.create(env);
    } catch (error) {
      if (error instanceof config.NotConfiguredError) {
        config.logger.warn("mount.not_configured", { mount: mount.name, binding: error.binding });
        return new Response(JSON.stringify({ error: "not_configured", mount: mount.name, binding: error.binding }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      }
      throw error;
    }
    handlers.set(mount.name, handler);
  }
  return handler(request, env, ctx);
}
