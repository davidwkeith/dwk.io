import { createIndieAuth, type IndieAuthEnv, type IndieAuthHandler } from "@dwk/indieauth";
import { consoleLogger } from "@dwk/log";
import { schema } from "./src/data/schema";
import { site } from "./src/data/site";
import { handleLogin, signLoginRequest, verifyConsent, type LoginEnv } from "./worker/login";

interface Env extends IndieAuthEnv, LoginEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
type Ctx = Parameters<IndieAuthHandler>[2];

// Worker-generated responses skip `public/_headers`, so the IndieAuth
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

// Fediverse discovery paths delegated to the Mastodon instance. Handles are
// `@dwk@dwk.io` (Mastodon's LOCAL_DOMAIN) while the server lives on the
// instance host (WEB_DOMAIN), so the apex forwards discovery there and
// Mastodon stays the single source of truth for the JRD and actor links.
const DISCOVERY_PATHS = new Set([
  "/.well-known/webfinger",
  "/.well-known/host-meta",
  "/.well-known/host-meta.json",
  "/.well-known/nodeinfo",
]);
const { instance } = site.identity.webfinger;

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

// Redirect www.dwk.io/* to dwk.io/* and the discovery paths to the Mastodon
// instance (cross-host redirects, which the Workers Static Assets
// `_redirects` file does not support), route the IndieAuth endpoints to
// @dwk/indieauth, then serve everything else from the static assets.
export default {
  async fetch(request: Request, env: Env, ctx: Ctx) {
    const url = new URL(request.url);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (DISCOVERY_PATHS.has(url.pathname)) {
      return Response.redirect(`https://${instance}${url.pathname}${url.search}`, 302);
    }
    switch (url.pathname) {
      case "/.well-known/oauth-authorization-server":
      case new URL(auth.authorize).pathname:
      case new URL(auth.token).pathname:
      case new URL(auth.revocation).pathname:
        return secure(getIndieAuth(env)(request, env, ctx));
      case new URL(auth.login).pathname:
        return handleLogin(request, env, owner, auth.authorize);
    }
    return env.ASSETS.fetch(request);
  },
};
