import dotenv from "dotenv"
import eleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";
import faviconsPlugin from "eleventy-plugin-gen-favicons";
import htmlmin from "html-minifier-terser";

dotenv.config()

export default function (eleventyConfig) {

  // FIXME: Workaround for https://github.com/11ty/eleventy-plugin-webc/issues/86
  // In the front matter of a file with a permalink like `/404.html`, simply
  // duplicate the permalink value in `page.url` to avoid build errors.
  // ```
  // permalink: /404.html
  // page:
  //    url: /404.html
  // ```
  eleventyConfig.setFreezeReservedData(false);

  eleventyConfig.addBundle("css");
  eleventyConfig.addBundle("js");

  eleventyConfig.addPlugin(faviconsPlugin, {});
  eleventyConfig.addPlugin(eleventyWebcPlugin, {
    components: [
      "src/_components/**/*.webc",
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
   * Get schema.org JSON-LD data validates against the schema.org
   * context and returns it as a JSON string.
   */
  eleventyConfig.addJavaScriptFunction("getSchema", (schema) => {
    // TODO: Validate schema against schema.org context
    return JSON.stringify(schema);
  });

  eleventyConfig.addTransform("htmlmin", function (content) {
    if ((this.page.outputPath || "").endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });

      return minified;
    }

    // If not an HTML output, return content as-is
    return content;
  });

  /**
   * Standard template formats only.
   */
  eleventyConfig.setTemplateFormats([
    "11ty.js",
    "html",
    "md",
    "webc",
  ]);

  eleventyConfig.addPassthroughCopy(`src/projects/**/*.{svg,webp,png,jpg,jpeg,gif,zip}`)

  // Set input and output directories
  return {
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