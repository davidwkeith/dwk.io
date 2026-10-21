// Identify this Worker's outbound requests. Workers send no `User-Agent` by
// default, and some peers' anti-scraper layers (the masto.host-hosted Mastodon
// instance this site federates with among them) challenge-loop an unidentified
// client. For the actor that surfaced as every inbound Follow failing
// verification with `key_unresolved`, because the key-resolution fetch never
// got the signer's actor document (davidwkeith/dwk.io#11).
//
// @dwk/activitypub fixes this upstream after 1.0.0-beta.6 by sending a
// descriptive agent itself, but its Durable Object delivers through the global
// `fetch`, which a config-level override cannot reach. So the global is wrapped
// once, here, before any package resolves it; a request that already carries a
// `User-Agent` is left alone. Remove this once the released package sends its
// own agent on key resolution, delivery, and discovery.
import { site } from "../src/data/site";

export const USER_AGENT = `dwk.io (+${site.url}/; ActivityPub, Webmention, WebSub)`;

/** `base` with `User-Agent: USER_AGENT` added to any request that has none. */
export function withUserAgent(base: typeof fetch): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (headers.has("user-agent")) return base(input, init);
    headers.set("user-agent", USER_AGENT);
    return base(input, { ...init, headers });
  };
}

globalThis.fetch = withUserAgent(globalThis.fetch);
