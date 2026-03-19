import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';

export const GET: APIRoute = async () => {
  const projects = (await getCollection('projects'))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const projectList = projects
    .map(p => {
      const desc = p.data.schema?.abstract || p.data.description || p.data.title;
      return `- [${p.data.title}](${site.url}/${p.id}/): ${desc}`;
    })
    .join('\n');

  return new Response(`# ${site.title}

> ${site.description} A portfolio and project showcase for David W. Keith (DWK).

This site is built with Astro and hosted on Cloudflare Pages. It uses a 1990s retro aesthetic with monospace typography and supports both dark and light modes.

## Projects

${projectList}

## Optional

- [JSON Feed](${site.url}/feed.json): RSS-like feed of project updates
- [Sitemap](${site.url}/sitemap-index.xml): XML sitemap`);
};
