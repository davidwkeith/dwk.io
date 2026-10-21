import { createHostMeta } from "@dwk/host-meta";
import { createIndieAuth, type IndieAuthEnv, type IndieAuthHandler } from "@dwk/indieauth";
import { consoleLogger } from "@dwk/log";
import { createWebfinger } from "@dwk/webfinger";
import { createWebmention, createWebmentionQueueConsumer, type WebmentionEnv } from "@dwk/webmention";
import { schema } from "./src/data/schema";
import { site } from "./src/data/site";
import { handleLogin, signLoginRequest, verifyConsent, type LoginEnv } from "./worker/login";

// Minimal shape of the native Workers Rate Limiting binding; no published
// package exports this type, and @cloudflare/workers-types isn't a dependency.
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env extends IndieAuthEnv, LoginEnv, WebmentionEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  WEBMENTION_RATE_LIMITER: RateLimiter;
}
type Ctx = Parameters<ReturnType<typeof createWebfinger>>[2];

// Worker-generated responses skip `public/_headers`, so the discovery
// endpoints get the relevant security headers here.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
};

async function secure(pending: Promise<Response>) {
  const original = await pending;
  const res = new Response(original.body, original);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(name, value);
  return res;
}

const logger = consoleLogger({ minLevel: "info" });
const { handle, instance } = site.identity.webfinger;
const profile = `https://${instance}/@${handle}`;
const actor = `https://${instance}/users/${handle}`;

// WebFinger resources dwk.io controls. They all point at the Mastodon account
// on the instance, so `@dwk@dwk.io` resolves to it from anywhere on the fediverse.
const account = {
  aliases: [profile, actor],
  links: [
    { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: profile },
    { rel: "self", type: "application/activity+json", href: actor },
    { rel: "http://ostatus.org/schema/1.0/subscribe", template: `https://${instance}/authorize_interaction?uri={uri}` },
  ],
};
const host = new URL(site.url).host;

const webfinger = createWebfinger({
  resources: {
    [`acct:${handle}@${host}`]: account,
    [`acct:${handle}@${instance}`]: account,
    [site.url]: account,
    [`${site.url}/`]: account,
  },
  logger,
});

const hostMeta = createHostMeta({
  webfingerUrl: `${site.url}/.well-known/webfinger`,
  logger,
});

// Webmention receiver: validates synchronously, enqueues async link
// verification on WEBMENTION_QUEUE, and persists verified mentions to the
// WEBMENTION_INBOX D1 database (schema created lazily, like AUTH_DB).
const webmentionPath = "/webmention";
const webmention = createWebmention({ baseUrl: site.url, logger });
const webmentionQueueConsumer = createWebmentionQueueConsumer({ baseUrl: site.url, logger });
type WebmentionBatch = Parameters<typeof webmentionQueueConsumer>[0];

// IndieAuth server for https://dwk.io/. The owner signs in at /auth/login,
// which sits behind Cloudflare Access (see worker/login.ts).
const me = `${site.url}/`;
const owner = { email: site.social.email.replace(/^mailto:/, ""), me, issuer: site.url };
const auth = {
  authorize: `${site.url}/auth/authorize`,
  token: `${site.url}/auth/token`,
  revocation: `${site.url}/auth/revocation`,
  login: `${site.url}/auth/login`,
};

// `approveAuthorization` gets no `env`, so the handler is built on first use
// with the bindings in scope; they don't change for the life of an isolate.
let indieauth: IndieAuthHandler | undefined;
function getIndieAuth(env: Env) {
  return (indieauth ??= createIndieAuth({
    baseUrl: site.url,
    authorizationEndpoint: auth.authorize,
    tokenEndpoint: auth.token,
    revocationEndpoint: auth.revocation,
    scopesSupported: ["profile", "email", "create", "update", "delete", "media"],
    // Only issue tokens for resource servers on this site.
    resourceIndicatorPolicy: (resource) => new URL(resource).origin === site.url,
    async approveAuthorization(req, httpRequest) {
      const url = new URL(httpRequest.url);
      const consent = url.searchParams.get("consent");
      if (consent && (await verifyConsent(env, consent, req))) {
        return {
          me,
          scopes: req.scopes,
          profile: {
            name: schema.author.name,
            url: me,
            photo: schema.author.image,
            ...(req.scopes.includes("email") ? { email: owner.email } : {}),
          },
        };
      }
      url.searchParams.delete("consent");
      url.searchParams.set("login", await signLoginRequest(env, req));
      return Response.redirect(`${auth.login}${url.search}`, 302);
    },
    logger,
  }));
}

// Redirect www.dwk.io/* to dwk.io/* (a cross-host redirect, which the
// Workers Static Assets `_redirects` file does not support), route the
// discovery and IndieAuth endpoints to the @dwk packages, then serve everything else from
// the static assets.
export default {
  async fetch(request: Request, env: Env, ctx: Ctx) {
    const url = new URL(request.url);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    switch (url.pathname) {
      case "/.well-known/webfinger":
        return secure(webfinger(request, {}, ctx));
      case "/.well-known/host-meta":
      case "/.well-known/host-meta.json":
        return secure(hostMeta(request, {}, ctx));
      case "/.well-known/oauth-authorization-server":
      case new URL(auth.authorize).pathname:
      case new URL(auth.token).pathname:
      case new URL(auth.revocation).pathname:
        return secure(getIndieAuth(env)(request, env, ctx));
      case new URL(auth.login).pathname:
        return handleLogin(request, env, owner, auth.authorize);
      case webmentionPath: {
        // Each accepted request makes the queue consumer fetch an arbitrary
        // source URL, so cap abuse of this public endpoint per sender IP.
        const key = request.headers.get("cf-connecting-ip") ?? "unknown";
        const { success } = await env.WEBMENTION_RATE_LIMITER.limit({ key });
        if (!success) {
          return secure(Promise.resolve(new Response("Too Many Requests", { status: 429 })));
        }
        return secure(webmention(request, env, ctx));
      }
    }
    return env.ASSETS.fetch(request);
  },
  async queue(batch: WebmentionBatch, env: Env, ctx: Ctx) {
    await webmentionQueueConsumer(batch, env, ctx);
  },
};
