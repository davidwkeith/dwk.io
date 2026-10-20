import { createHostMeta } from "@dwk/host-meta";
import { consoleLogger } from "@dwk/log";
import { createWebfinger } from "@dwk/webfinger";
import { site } from "./src/data/site";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
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
    [site.url]: account,
    [`${site.url}/`]: account,
  },
  logger,
});

const hostMeta = createHostMeta({
  webfingerUrl: `${site.url}/.well-known/webfinger`,
  logger,
});

// Redirect www.dwk.io/* to dwk.io/* (a cross-host redirect, which the
// Workers Static Assets `_redirects` file does not support), route the
// discovery endpoints to the @dwk packages, then serve everything else from
// the static assets.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    switch (url.pathname) {
      case "/.well-known/webfinger":
        return webfinger(request, {}, ctx);
      case "/.well-known/host-meta":
      case "/.well-known/host-meta.json":
        return hostMeta(request, {}, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
