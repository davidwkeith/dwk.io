import type { EleventyData } from '../types.ts';

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

  render(data: EleventyData): string {
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
