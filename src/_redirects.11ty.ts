import type { EleventyData } from './types.ts';

interface RedirectConfig {
  source: string;
  destination: string;
  code: number;
}

/**
 * Represents the Redirects configuration for Cloudflare Pages.
 *
 * @see https://developers.cloudflare.com/pages/configuration/redirects/
 */
export default class Redirects {

  redirects: RedirectConfig[] = [
    {
      source: "/security.txt",
      destination: "/.well-known/security.txt",
      code: 301
    },
    {
      source: "/.well-known/avatar",
      destination: "/icon-512.png",
      code: 302
    },
  ];

  data() {
    return {
      permalink: "/_redirects",
      eleventyExcludeFromCollections: true,
    };
  }

  async render(_data: EleventyData): Promise<string> {
    const output: string[] = [];

    this.redirects.forEach(redirectConfig => {
      output.push(`${redirectConfig.source} ${redirectConfig.destination} ${redirectConfig.code}`);
    });

    return output.join("\n");
  }
}
