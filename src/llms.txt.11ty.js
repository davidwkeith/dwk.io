/**
 * LLM-readable site summary.
 *
 * @see https://llmstxt.org/
 */
export default class LlmsTxt {

  data() {
    return {
      permalink: "/llms.txt",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const projects = [...data.collections.project]
      .reverse()
      .map(p => {
        const desc = p.data.schema?.abstract || p.data.summary || p.data.title;
        return `- [${p.data.title}](https://dwk.io${p.page.url}): ${desc}`;
      })
      .join("\n");

    return `# ${data.site.title}

> ${data.site.description} A portfolio and project showcase for David W. Keith (DWK).

This site is built with Eleventy and hosted on Cloudflare Pages. It uses a 1990s retro aesthetic with monospace typography and supports both dark and light modes.

## Projects

${projects}

## Optional

- [JSON Feed](https://dwk.io/feed.json): RSS-like feed of project updates
- [Sitemap](https://dwk.io/sitemap.xml): XML sitemap`;
  }
}
