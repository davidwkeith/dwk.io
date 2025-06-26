import eleventyWebcPlugin from "@11ty/eleventy-plugin-webc";
import { eleventyImagePlugin } from "@11ty/eleventy-img";


export default function(eleventyConfig) {
  eleventyConfig.addBundle("css");
  eleventyConfig.addBundle("js");

  // Add WebC plugin
  eleventyConfig.addPlugin(eleventyWebcPlugin, {
    components: [
      "_components/**/*.webc",
      "npm:@11ty/eleventy-img/*.webc",
    ]
  });
  eleventyConfig.addPlugin(eleventyImagePlugin,{
		// Set global default options
		formats: ["webp", "jpeg"],

		// Notably `outputDir` is resolved automatically
		// to the project output directory

		defaultAttributes: {
			loading: "lazy",
			decoding: "async",
	  	}
  });

  // Set template formats to only webc, md, and html
  eleventyConfig.setTemplateFormats([
    "webc",
    "md",
    "html"
  ]);

  // Set input and output directories
  return {
    markdownTemplateEngine: "webc",
    htmlTemplateEngine: "webc",
  };
}