/**
 * Represents the Headers configuration for Cloudflare Pages.
 *
 * @see https://developers.cloudflare.com/pages/configuration/headers/
 */
export default class Headers {

  /**
   * Defines the headers to be output to the `_headers` file.
   * Each object in the array can represent either a redirect or a set of HTTP response headers.
   * 
   * For HTTP response headers:
   * @property {string} source - The URL path to apply the headers to (e.g., "/*").
   * @property {object} headers - An object where keys are header names and values are header values.
   *
   * @type {Array<Object>}
   */
  headers = [
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


  /**
   * Eleventy data method to define permalink and exclude from collections.
   * @returns {object}
   */
  data() {
    return {
      permalink: "/_headers",
      eleventyExcludeFromCollections: true,
    }
  }

  /**
   * Renders the headers configuration into a string format for the `_headers` file.
   * @param {object} data - Eleventy's data cascade.
   * @returns {Promise<string>} The formatted headers string.
   */
  async render(data) {
    let output = [];

    this.headers.forEach(headerConfig => {
      if (headerConfig.headers) {
        // This is a set of HTTP response headers
        output.push(headerConfig.source);
        for (const [key, value] of Object.entries(headerConfig.headers)) {
          output.push(`  ${key}: ${value}`);
        }
      }
    });

    return output.join("\n");
  }
}