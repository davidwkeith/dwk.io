import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { schema } from '../data/schema';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const projects = await getCollection('projects');
  const author = schema.author;
  const feedUrl = `${site.url}/feed.xml`;

  const mostRecent = projects.length > 0
    ? new Date(Math.max(...projects.map(p => p.data.date.getTime())))
    : new Date();

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(site.title)}</title>
  <subtitle>${escapeXml(site.description)}</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(site.url)}" rel="alternate" type="text/html"/>
  <id>${escapeXml(site.url)}</id>
  <updated>${mostRecent.toISOString()}</updated>
  <author>
    <name>${escapeXml(author.name)}</name>
    <email>${escapeXml(author.email.replace('mailto:', ''))}</email>
    <uri>${escapeXml(author.url)}</uri>
  </author>
  <icon>${escapeXml(`${site.url}/icon-512.png`)}</icon>
  <rights>${escapeXml(site.copyright)}</rights>
  <generator>Astro</generator>
`;

  for (const project of projects) {
    const url = `${site.url}/${project.id}/`;
    const summary = project.data.description;

    xml += `  <entry>
    <title>${escapeXml(project.data.title)}</title>
    <link href="${escapeXml(url)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(url)}</id>
    <published>${project.data.date.toISOString()}</published>
    <updated>${project.data.date.toISOString()}</updated>
${summary ? `    <summary>${escapeXml(summary)}</summary>\n` : ''}    <author>
      <name>${escapeXml(author.name)}</name>
      <uri>${escapeXml(author.url)}</uri>
    </author>
  </entry>
`;
  }

  xml += `</feed>\n`;
  return new Response(xml);
};
