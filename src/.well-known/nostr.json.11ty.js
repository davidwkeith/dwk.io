/**
 * Nostr NIP-05 identity verification.
 * Maps handle@dwk.io to a Nostr public key.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/05.md
 */
export default class NostrJSON {

  data() {
    return {
      permalink: "/.well-known/nostr.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const hostname = new URL(data.site.url).hostname;
    const handle = data.site.mastodon.handle;

    return JSON.stringify({
      names: {
        [handle]: data.site.nostrPubkey,
        ["_"]: data.site.nostrPubkey,
      },
      relays: {},
    }, null, 2);
  }
}
