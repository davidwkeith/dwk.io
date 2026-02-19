import dotenv from "dotenv"
import eleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";
import Image from "@11ty/eleventy-img";
import faviconsPlugin from "eleventy-plugin-gen-favicons";
import markdownIt from "markdown-it";
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

  /**
   * Generates an optimized Open Graph image URL using Eleventy Image.
   */
  eleventyConfig.addShortcode("ogImage", async (src: string) => {
    if (!src) {
      return "";
    }
    const metadata = await Image(src, {
      widths: [1200],
      formats: ["jpeg"],
      outputDir: "./_site/img/og/",
      urlPath: "/img/og/",
      filenameFormat: function (_id: string, _src: string, width: number, format: string) {
        return `${_id}-${width}.${format}`;
      }
    });
    return metadata.jpeg[0].url;
  });

  /**
   * Generates a responsive <picture> element with optimized images.
   */
  eleventyConfig.addShortcode("image", async (src: string, alt: string, classes?: string) => {
    if (!src) {
      throw new Error("Image shortcode requires a 'src' attribute.");
    }
    if (!alt) {
      console.warn(`Image "${src}" is missing alt text.`);
    }

    const metadata = await Image(src, {
      widths: [400, 800, 1200, 1600],
      formats: ["webp", "jpeg"],
      outputDir: "./_site/img/",
      urlPath: "/img/",
      defaultAttributes: {
        loading: "lazy",
        decoding: "async",
      }
    });

    const imageAttributes: Record<string, string> = {
      alt,
      sizes: "(min-width: 1024px) 100vw, 50vw",
      loading: "lazy",
      decoding: "async",
    };

    if (classes) {
      imageAttributes.class = classes;
    }

    return Image.generateHTML(metadata, imageAttributes);
  });

  eleventyConfig.setLibrary("md", markdownIt({
    html: true,
    breaks: true,
    linkify: true
  }).use(function(md: markdownIt) {
    // Override the default image renderer to use our `image` shortcode
    md.renderer.rules.image = (tokens, idx) => {
      const token = tokens[idx];
      const src = token.attrGet('src');
      const alt = token.attrGet('alt');
      const classes = token.attrGet('class');

      // Get the image shortcode function
      const imageShortcode = eleventyConfig.getFilter("image") as (...args: (string | null | undefined)[]) => string;

      // Call the image shortcode and return its output
      // Note: This is an async function, but markdown-it expects sync output.
      // Eleventy handles async shortcodes in markdown, so this should be fine.
      return imageShortcode(src, alt, classes);
    };
  }));

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
