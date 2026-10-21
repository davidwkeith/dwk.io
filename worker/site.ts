// Everything outside the package mounts: the static site from `dist/`, plus
// the Micropub posts and received webmentions the Worker renders into it.
// `worker/publish.ts` hashes the WebSub topics through here too, so a new post
// in the feeds triggers a publish ping like a deploy does.
import * as config from "./config";
import type { Env } from "./env";
import { escapeHtml } from "./html";
import { site } from "../src/data/site";
import { allListedPosts, isShellPath, listPublicPosts, POSTS_PATH, servePosts, viewOf, type PostView } from "./posts";
import { withMentions } from "./webmentions";

function atomEntry(post: PostView) {
  const url = escapeHtml(post.url);
  return (
    `<entry><title>${escapeHtml(post.title)}</title><link href="${url}" rel="alternate" type="text/html"/><id>${url}</id>` +
    `<published>${post.published.toISOString()}</published><updated>${post.updated.toISOString()}</updated>` +
    `<summary>${escapeHtml(post.summary)}</summary><content type="html">${escapeHtml(post.contentHtml)}</content>` +
    post.categories.map((c) => `<category term="${escapeHtml(c)}"/>`).join("") +
    `</entry>\n  `
  );
}

function jsonItem(post: PostView) {
  return {
    id: post.url,
    url: post.url,
    ...(post.name ? { title: post.name } : {}),
    summary: post.summary,
    content_html: post.contentHtml,
    date_published: post.published.toISOString(),
    date_modified: post.updated.toISOString(),
    ...(post.categories.length ? { tags: post.categories } : {}),
  };
}

/** Add the Micropub posts to a static feed (the projects); unchanged when there are none. */
async function withPosts(feed: Response, kind: "atom" | "json", env: Env): Promise<Response> {
  let posts: PostView[];
  try {
    posts = (await listPublicPosts(env)).map(viewOf);
  } catch (error) {
    // Fall back to the static feed rather than failing it.
    config.logger.error("posts.feed_failed", { error: error instanceof Error ? error.name : "unknown" });
    return feed;
  }
  if (!posts.length || !feed.ok) return feed;
  const headers = new Headers(feed.headers);
  headers.delete("content-length");
  headers.delete("etag");
  const text = await feed.text();
  let body: string;
  if (kind === "json") {
    try {
      const json = JSON.parse(text) as { items: { date_published: string }[] };
      json.items = [...posts.map(jsonItem), ...json.items].sort((a, b) => b.date_published.localeCompare(a.date_published));
      body = JSON.stringify(json);
    } catch (error) {
      config.logger.error("posts.feed_failed", { error: error instanceof Error ? error.name : "unknown" });
      body = text;
    }
  } else {
    const newest = posts.reduce((max, p) => (p.updated > max ? p.updated : max), new Date(0));
    const entries = posts.map(atomEntry).join("");
    body = text
      // The first <updated> is the feed's own; move it forward to the newest post.
      .replace(/<updated>([^<]*)<\/updated>/, (match, current: string) => (new Date(current) < newest ? `<updated>${newest.toISOString()}</updated>` : match))
      .replace(/<entry>|<\/feed>/, (match) => entries + match);
  }
  return new Response(body, { status: feed.status, headers });
}

/** Listed alongside the build's own sitemap in `sitemap-index.xml` (astro.config.ts `customSitemaps`). */
export const POSTS_SITEMAP_PATH = "/sitemap-posts.xml";

/** The posts' sitemap: the `/posts/` index and every listed post. */
async function postsSitemap(env: Env): Promise<Response> {
  let posts: PostView[] = [];
  try {
    posts = (await allListedPosts(env)).map(viewOf);
  } catch (error) {
    // Still a valid sitemap, of the index alone.
    config.logger.error("posts.sitemap_failed", { error: error instanceof Error ? error.name : "unknown" });
  }
  const url = (loc: string, lastmod?: Date) => `<url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ""}</url>`;
  const body =
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    url(`${site.url}${POSTS_PATH}`, posts[0]?.updated) +
    posts.map((p) => url(p.url, p.updated)).join("") +
    `</urlset>`;
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "x-content-type-options": "nosniff" } });
}

/** Add a "Posts" section to the static `llms.txt` (the projects), ahead of its "Optional" one. */
async function withPostsInLlms(llms: Response, env: Env): Promise<Response> {
  let posts: PostView[];
  try {
    posts = (await listPublicPosts(env)).map(viewOf);
  } catch (error) {
    config.logger.error("posts.llms_failed", { error: error instanceof Error ? error.name : "unknown" });
    return llms;
  }
  if (!posts.length || !llms.ok) return llms;
  // Markdown link text; brackets would end it early.
  const list = posts.map((p) => `- [${p.title.replace(/[[\]]/g, "")}](${p.url}): ${p.summary.replace(/\s+/g, " ")}`).join("\n");
  const section = `## Posts\n\n${list}\n\nAll posts: ${site.url}${POSTS_PATH}\n\n`;
  const text = await llms.text();
  const at = text.indexOf("## Optional");
  const body = at === -1 ? `${text.trimEnd()}\n\n${section.trimEnd()}\n` : text.slice(0, at) + section + text.slice(at);
  const headers = new Headers(llms.headers);
  headers.delete("content-length");
  headers.delete("etag");
  return new Response(body, { status: llms.status, headers });
}

export async function serveSite(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === POSTS_PATH.slice(0, -1) || pathname.startsWith(POSTS_PATH) || isShellPath(pathname)) {
    return withMentions(await servePosts(request, env), env);
  }
  if (pathname === POSTS_SITEMAP_PATH) return postsSitemap(env);
  const response = await env.ASSETS.fetch(request);
  if (pathname === "/llms.txt") return withPostsInLlms(response, env);
  if (pathname === "/feed.xml") return withPosts(response, "atom", env);
  if (pathname === "/feed.json") return withPosts(response, "json", env);
  return withMentions(response, env);
}
