import Ajv from "ajv";
import dotenv from "dotenv"
import eleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import schemaOrgContext from "./schemaorg-context.js";
import { eleventyImagePlugin } from "@11ty/eleventy-img";

dotenv.config()
const ajv = new Ajv({ strict: false });

export default function(eleventyConfig) {
  // Workaround for https://github.com/11ty/eleventy-plugin-webc/issues/86
  eleventyConfig.setFreezeReservedData(false);

  eleventyConfig.addBundle("css");
  eleventyConfig.addBundle("js");

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

  /**
   * Get schema.org JSON-LD data validates against the schema.org
   * context and returns it as a JSON string.
   */
  eleventyConfig.addJavaScriptFunction("getSchema", (schema) => {
    const valid = ajv.validate(schemaOrgContext, schema);
    if (!valid) {
      console.error(ajv.errors);
    }
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