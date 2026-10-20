import { site } from "./src/data/site";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

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

// Redirect www.dwk.io/* to dwk.io/* and the discovery paths to the Mastodon
// instance (cross-host redirects, which the Workers Static Assets
// `_redirects` file does not support), then serve everything else from the
// static assets.
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    if (DISCOVERY_PATHS.has(url.pathname)) {
      return Response.redirect(`https://${instance}${url.pathname}${url.search}`, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
