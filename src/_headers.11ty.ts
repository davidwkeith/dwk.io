import type { EleventyData } from './types.ts';

interface HeaderConfig {
  source: string;
  headers: Record<string, string>;
}

/**
 * Represents the Headers configuration for Cloudflare Pages.
 *
 * @see https://developers.cloudflare.com/pages/configuration/headers/
 */
export default class Headers {

  headers: HeaderConfig[] = [
    { source: "/*",
      headers: {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer-when-downgrade"
      }
    },
    { source: "/.well-known/webfinger",
      headers: {
        "Content-Type": "application/jrd+json",
        "Access-Control-Allow-Origin": "*"
      }
    },
    { source: "/.well-known/host-meta",
      headers: {
        "Content-Type": "application/xrd+xml"
      }
    },
    { source: "/.well-known/nostr.json",
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    },
    { source: "/.well-known/atproto-did",
      headers: {
        "Content-Type": "text/plain"
      }
    },
    { source: "/.well-known/did.json",
      headers: {
        "Content-Type": "application/did+ld+json"
      }
    },
  ]

  data() {
    return {
      permalink: "/_headers",
      eleventyExcludeFromCollections: true,
    }
  }

  async render(_data: EleventyData): Promise<string> {
    const output: string[] = [];

    this.headers.forEach(headerConfig => {
      if (headerConfig.headers) {
        output.push(headerConfig.source);
        for (const [key, value] of Object.entries(headerConfig.headers)) {
          output.push(`  ${key}: ${value}`);
        }
      }
    });

    return output.join("\n");
  }
}
