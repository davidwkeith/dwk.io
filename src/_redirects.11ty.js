/**
 * Represents the Redirects configuration for Cloudflare Pages.
 *
 * @see https://developers.cloudflare.com/pages/configuration/redirects/
 */
export default class Redirects {

  /**
   * Defines the redirects to be output to the `_redirects` file.
   * Each object in the array represents a redirect rule.
   *
   * @property {string} source - The path to redirect from (e.g., "/old-path").
   * @property {string} destination - The path to redirect to (e.g., "/new-path").
   * @property {number} code - The HTTP status code for the redirect (e.g., 301, 302).
   * @type {Array<Object>}
   */
  redirects = [
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

  /**
   * Eleventy data method to define permalink and exclude from collections.
   * @returns {object}
   */
  data() {
    return {
      permalink: "/_redirects",
      eleventyExcludeFromCollections: true,
    };
  }

  /**
   * Renders the redirects configuration into a string format for the `_redirects` file.
   * @param {object} data - Eleventy's data cascade.
   * @returns {Promise<string>} The formatted redirects string.
   */
  async render(data) {
    let output = [];

    this.redirects.forEach(redirectConfig => {
      output.push(`${redirectConfig.source} ${redirectConfig.destination} ${redirectConfig.code}`);
    });

    return output.join("\n");
  }
}