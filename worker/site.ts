// Everything outside the package mounts: the static site from `dist/`, plus
// the Micropub posts and received webmentions the Worker renders into it.
// `worker/publish.ts` hashes the WebSub topics through here too, so a new post
// in the feeds triggers a publish ping like a deploy does.
import * as config from "./config";
import type { Env } from "./env";
import { escapeHtml } from "./html";
import { listPublicPosts, POSTS_PATH, servePosts, viewOf, type PostView } from "./posts";
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
  let body: string;
  if (kind === "json") {
    const json = (await feed.json()) as { items: { date_published: string }[] };
    json.items = [...posts.map(jsonItem), ...json.items].sort((a, b) => b.date_published.localeCompare(a.date_published));
    body = JSON.stringify(json);
  } else {
    const xml = await feed.text();
    const newest = posts.reduce((max, p) => (p.updated > max ? p.updated : max), new Date(0));
    const entries = posts.map(atomEntry).join("");
    body = xml
      // The first <updated> is the feed's own; move it forward to the newest post.
      .replace(/<updated>([^<]*)<\/updated>/, (match, current: string) => (new Date(current) < newest ? `<updated>${newest.toISOString()}</updated>` : match))
      .replace(/<entry>|<\/feed>/, (match) => entries + match);
  }
  return new Response(body, { status: feed.status, headers });
}

export async function serveSite(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === POSTS_PATH.slice(0, -1) || pathname.startsWith(POSTS_PATH) || pathname.startsWith("/post-shell")) {
    return withMentions(await servePosts(request, env), env);
  }
  const response = await env.ASSETS.fetch(request);
  if (pathname === "/feed.xml") return withPosts(response, "atom", env);
  if (pathname === "/feed.json") return withPosts(response, "json", env);
  return withMentions(response, env);
}
