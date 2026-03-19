import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { schema } from '../data/schema';

export const GET: APIRoute = async () => {
  const projects = await getCollection('projects');
  const author = schema.author;

  const feed = {
    version: "https://jsonfeed.org/version/1",
    title: site.title,
    home_page_url: site.url,
    feed_url: `${site.url}/feed.json`,
    description: site.description,
    icon: `${site.url}/icon-512.png`,
    author: { name: author.name, url: author.url, avatar: author.image },
    items: projects.map(project => ({
      id: `${site.url}/${project.id}/`,
      title: project.data.title,
      url: `${site.url}/${project.id}/`,
      summary: project.data.description,
      date_published: project.data.date.toISOString(),
      date_modified: project.data.date.toISOString(),
      author: { name: author.name, url: author.url, avatar: author.image },
      tags: project.data.tags,
    })),
  };

  return new Response(JSON.stringify(feed));
};
