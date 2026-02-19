import dotenv from "dotenv"
import eleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";
import faviconsPlugin from "eleventy-plugin-gen-favicons";
import sharedPlugin, { getCommitHash } from "@dwk/eleventy-shared";
import type UserConfig from "@11ty/eleventy/src/UserConfig";

/**
 * Load environment variables from .env file.
 */
dotenv.config()

/**
 * Eleventy configuration function.
 */
export default function (eleventyConfig: UserConfig) {

  // FIXME: Workaround for a known issue in eleventy-plugin-webc (https://github.com/11ty/eleventy-plugin-webc/issues/86).
  // When using `permalink` in front matter, especially with dynamic values or for non-HTML files,
  // `page.url` may not be correctly populated or available to other plugins/filters.
  // To avoid build errors and ensure consistent URL generation, explicitly duplicate the `permalink`
  // value in `page.url` within the front matter for affected templates.
  //
  // Example:
  // ```
  // permalink: /my-page/index.html
  // page:
  //    url: /my-page/
  // ```
  // This ensures that `page.url` is always available and correctly reflects the intended output URL.
  eleventyConfig.setFreezeReservedData(false);

  eleventyConfig.addPlugin(sharedPlugin, {
    url: "https://dwk.io",
    language: "en",
    securityContact: "mailto:security@dwk.io",
    sitemap: { permalink: "/sitemap.xml" },
    robots: { permalink: "/robots.txt" },
    humans: { commitHash: getCommitHash() },
    fourOhFour: { layout: "base.webc", title: "404 Not Found" },
    webfinger: { handle: "dwk", instance: "xn--4t8h.dwk.io" },
    nostr: { handle: "dwk", pubkey: "096a5ff28249cae96026c34167163991fb6e9729fe6257c688b40fa7e684698c" },
    didDocument: {
      services: [
        { id: "website", type: "LinkedDomains", endpoint: "https://dwk.io" },
        { id: "mastodon", type: "LinkedDomains", endpoint: "https://xn--4t8h.dwk.io/@dwk" },
        { id: "bluesky", type: "LinkedDomains", endpoint: "https://bsky.app/profile/dwk.io" },
      ],
    },
    atprotoDid: "did:plc:rxtknc5m5ixmscnq3xdamqxc",
    dntPolicy: true,
  });

  eleventyConfig.addPlugin(faviconsPlugin, {});
  eleventyConfig.addPlugin(eleventyWebcPlugin, {
    components: [
      "src/_includes/**/*.webc",
      "npm:@11ty/eleventy-img/*.webc",
    ]
  });

  /**
   * Configure the Eleventy Image plugin to process images in web components.
   */
  eleventyConfig.addPlugin(eleventyImagePlugin, {
    formats: ["webp", "jpeg"],
    outputDir: "./_site/img/",
    urlPath: "/img/",
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
    }
  });

  return {
    templateFormats: [ "11ty.js", "11ty.ts", "webc", "md", "html" ],
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts"
    },
    markdownTemplateEngine: "webc",
    htmlTemplateEngine: "webc",
  };
}
