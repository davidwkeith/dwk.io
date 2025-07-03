import dotenv from "dotenv"
dotenv.config()

import eleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";
// import pluginWebmentions from "@chrisburnell/eleventy-cache-webmentions"

export default function(eleventyConfig) {
  // Workaround for https://github.com/11ty/eleventy-plugin-webc/issues/86
  eleventyConfig.setFreezeReservedData(false);

  eleventyConfig.addBundle("css");
  eleventyConfig.addBundle("js");


  // eleventyConfig.addGlobalData("configWebmentions", {
  //   ...pluginWebmentions.defaults,
  //   domain: `dwk.io`,
  //   token: process.env.WEBMENTION_IO_TOKEN,
  //   feed: `https://webmention.io/api/mentions.jf2?domain=dwk.io&token=${process.env.WEBMENTION_IO_TOKEN}&per-page=9001`,
  //   key: "children",
  // });

  // Add WebC plugin
  eleventyConfig.addPlugin(eleventyWebcPlugin, {
    components: [
      "src/_components/**/*.webc",
      "npm:@11ty/eleventy-img/*.webc",
    ]
  });
  eleventyConfig.addPlugin(eleventyImagePlugin,{
		// Set global default options
		formats: ["webp", "jpeg"],

		outputDir: "./_site/img/",
    urlPath: "/img/",

		defaultAttributes: {
			loading: "lazy",
			decoding: "async",
	  	}
  });

  eleventyConfig.addJavaScriptFunction("getSchema", (schema) => {
    return JSON.stringify(schema);
  });

  eleventyConfig.setTemplateFormats([
    "webc",
    "md",
    "html"
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