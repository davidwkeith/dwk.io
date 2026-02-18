import type { EleventyData } from '../types.ts';

/**
 * WebFinger endpoint for Fediverse / Mastodon account discovery.
 * Allows searching @handle@dwk.io to find the actual Mastodon account.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7033
 * @see https://docs.joinmastodon.org/spec/webfinger/
 */
export default class WebFinger {

  data() {
    return {
      permalink: "/.well-known/webfinger",
      eleventyExcludeFromCollections: true,
      eleventyAllowMissingExtension: true,
    };
  }

  render(data: EleventyData): string {
    const { handle, instance } = data.site.mastodon;

    const webfinger = {
      subject: `acct:${handle}@${new URL(data.site.url).hostname}`,
      aliases: [
        `https://${instance}/@${handle}`,
        `https://${instance}/users/${handle}`,
      ],
      links: [
        {
          rel: "http://webfinger.net/rel/profile-page",
          type: "text/html",
          href: `https://${instance}/@${handle}`,
        },
        {
          rel: "self",
          type: "application/activity+json",
          href: `https://${instance}/users/${handle}`,
        },
        {
          rel: "http://ostatus.org/schema/1.0/subscribe",
          template: `https://${instance}/authorize_interaction?uri={uri}`,
        },
      ],
    };

    return JSON.stringify(webfinger, null, 2);
  }
}
