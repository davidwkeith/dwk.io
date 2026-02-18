import type { EleventyData } from './types.ts';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default class AtomFeed {

  data() {
    return {
      permalink: "/feed.xml",
      eleventyExcludeFromCollections: true,
    }
  }

  async render(data: EleventyData): Promise<string> {
    const siteUrl = data.site.url.toString();
    const feedUrl = new URL('/feed.xml', siteUrl).toString();
    const author = data.schema.author;

    const items = data.collections['project'] ?? [];
    const mostRecent = items.length > 0
      ? new Date(Math.max(...items.map(i => i.date.getTime())))
      : new Date();

    let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(data.site.title)}</title>
  <subtitle>${escapeXml(data.site.description)}</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(siteUrl)}" rel="alternate" type="text/html"/>
  <id>${escapeXml(siteUrl)}</id>
  <updated>${mostRecent.toISOString()}</updated>
  <author>
    <name>${escapeXml(author?.name ?? '')}</name>
    <email>${escapeXml((author?.email ?? '').replace('mailto:', ''))}</email>
    <uri>${escapeXml(author?.url ?? '')}</uri>
  </author>
  <icon>${escapeXml(new URL('/icon-512.png', siteUrl).toString())}</icon>
  <rights>${escapeXml(data.site.copyright)}</rights>
  <generator>Eleventy</generator>
`;

    for (const item of items) {
      const url = new URL(item.url, siteUrl).toString();
      const title = item.data.title ?? 'Untitled';
      const content = item.templateContent ?? item.data.content ?? '';
      const summary = item.data.summary ?? item.data.description;

      xml += `  <entry>
    <title>${escapeXml(title)}</title>
    <link href="${escapeXml(url)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(url)}</id>
    <published>${item.date.toISOString()}</published>
    <updated>${item.date.toISOString()}</updated>
${summary ? `    <summary>${escapeXml(summary)}</summary>\n` : ''}    <content type="html">${escapeXml(content)}</content>
    <author>
      <name>${escapeXml(author?.name ?? '')}</name>
      <uri>${escapeXml(author?.url ?? '')}</uri>
    </author>
  </entry>
`;
    }

    xml += `</feed>
`;
    return xml;
  }
}
