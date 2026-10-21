// Micropub posts on the site itself. @dwk/micropub keeps each post's mf2 in
// D1; the Worker renders `/posts/` (an h-feed) and each `/posts/<slug>`
// permalink (an h-entry) into the static `/post-shell/` page, so a post is
// live as soon as the Micropub request returns, with no rebuild.
import { createMicropubStore, MAX_LIMIT, type GeneratePostUrl, type PostRecord } from "@dwk/micropub";
import { schema } from "../src/data/schema";
import { site } from "../src/data/site";
import type { Env } from "./env";
import { escapeHtml, httpUrl, rewriter, timeTag, type RewriterElement } from "./html";

export const POSTS_PATH = "/posts/";
export const SHELL_PATH = "/post-shell/";
/** How many posts the `/posts/` index and the feeds show. */
const LIST_LIMIT = 50;

/** The shell is not a page of its own, with or without its trailing slash. */
export function isShellPath(pathname: string) {
  return pathname === SHELL_PATH.slice(0, -1) || pathname.startsWith(SHELL_PATH);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/**
 * New posts live under `/posts/`, clear of the project pages at `/<slug>/`.
 * No trailing slash: on a collision @dwk/micropub appends `-xxxx` to the URL.
 */
export const generatePostUrl: GeneratePostUrl = (post, commands) => {
  const name = post.properties.name?.[0];
  const slug =
    slugify(commands.slug ?? "") ||
    (typeof name === "string" ? slugify(name) : "") ||
    // A note has no name: a base36 timestamp keeps its slug short and unique.
    Date.now().toString(36);
  return `${site.url}${POSTS_PATH}${slug}`;
};

// --- Reading mf2 properties ------------------------------------------------

type Props = PostRecord["properties"];

function strings(props: Props, key: string): string[] {
  return (props[key] ?? []).flatMap((v) => {
    if (typeof v === "string") return [v];
    // An embedded h-cite/h-card names its URL in `properties.url`, or `value`.
    const obj = v as { value?: unknown; properties?: { url?: unknown[] } };
    const url = obj.properties?.url?.[0] ?? obj.value;
    return typeof url === "string" ? [url] : [];
  });
}

function first(props: Props, key: string) {
  const value = props[key]?.[0];
  return typeof value === "string" ? value : undefined;
}

function textToHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function contentOf(props: Props): { html: string; text: string } {
  const content = props.content?.[0];
  if (typeof content === "string") return { html: textToHtml(content), text: content };
  const { html, value } = (content ?? {}) as { html?: unknown; value?: unknown };
  const text = typeof value === "string" ? value : "";
  // The owner's own HTML, from an IndieAuth-authorized Micropub client; the
  // CSP still keeps any script in it from running.
  return { html: typeof html === "string" ? html : textToHtml(text), text: text || (typeof html === "string" ? html.replace(/<[^>]*>/g, "") : "") };
}

function publishedOf(record: PostRecord) {
  const published = first(record.properties, "published");
  const date = published ? new Date(published) : new Date(NaN);
  return Number.isNaN(date.getTime()) ? new Date(record.createdAt * 1000) : date;
}

/** The post's title: its `name`, or the start of a note's text. */
export function titleOf(record: PostRecord) {
  const name = first(record.properties, "name");
  if (name) return name;
  const text = contentOf(record.properties).text.trim().replace(/\s+/g, " ");
  return text.length > 60 ? `${text.slice(0, 59)}…` : text || "Note";
}

/** Drafts and private posts are never served; unlisted ones only at their permalink. */
function isPublic(record: PostRecord) {
  return !record.deleted && first(record.properties, "post-status") !== "draft" && first(record.properties, "visibility") !== "private";
}

function isListed(record: PostRecord) {
  return isPublic(record) && first(record.properties, "visibility") !== "unlisted";
}

// --- Rendering --------------------------------------------------------------

/** The post's view, shared by its permalink and the feeds. */
export interface PostView {
  readonly url: string;
  readonly name?: string;
  readonly title: string;
  readonly summary: string;
  readonly contentHtml: string;
  readonly published: Date;
  readonly updated: Date;
  readonly categories: string[];
}

export function viewOf(record: PostRecord): PostView {
  const { html, text } = contentOf(record.properties);
  const summary = first(record.properties, "summary") ?? text.trim().replace(/\s+/g, " ").slice(0, 200);
  return {
    url: record.url,
    name: first(record.properties, "name"),
    title: titleOf(record),
    summary,
    contentHtml: html + photosHtml(record.properties),
    published: publishedOf(record),
    updated: new Date(record.updatedAt * 1000),
    categories: strings(record.properties, "category"),
  };
}

function photosHtml(props: Props) {
  return (props.photo ?? [])
    .map((p) => {
      const { value, alt } = (typeof p === "string" ? { value: p } : p) as { value?: unknown; alt?: unknown };
      const src = httpUrl(value);
      if (!src) return "";
      const altText = escapeHtml(typeof alt === "string" ? alt : "");
      // The CSP only loads images from this origin (e.g. `/media/` uploads); link the rest.
      return new URL(src).origin === site.url
        ? `<img class="u-photo" src="${escapeHtml(src)}" alt="${altText}">`
        : `<p><a class="u-photo" href="${escapeHtml(src)}">${altText || "Photo"}</a></p>`;
    })
    .join("");
}

/** "In reply to …" lines for the response properties a client sent. */
function contextHtml(props: Props) {
  const kinds = [
    ["in-reply-to", "u-in-reply-to", "In reply to"],
    ["like-of", "u-like-of", "Liked"],
    ["repost-of", "u-repost-of", "Reposted"],
    ["bookmark-of", "u-bookmark-of", "Bookmarked"],
  ] as const;
  return kinds
    .flatMap(([key, cls, label]) =>
      strings(props, key).flatMap((value) => {
        const url = httpUrl(value);
        return url ? [`<p>${label} <a class="${cls}" href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`] : [];
      }),
    )
    .join("");
}

function entryHtml(record: PostRecord) {
  const view = viewOf(record);
  const props = record.properties;
  const tags = view.categories.map((c) => `<li><span class="p-category">${escapeHtml(c)}</span></li>`).join("");
  const syndication = strings(props, "syndication")
    .flatMap((s) => {
      const url = httpUrl(s);
      return url ? [`<li><a class="u-syndication" rel="syndication" href="${escapeHtml(url)}">${escapeHtml(new URL(url).host)}</a></li>`] : [];
    })
    .join("");
  return (
    `<article class="h-entry">` +
    (view.name ? `<h2 class="p-name">${escapeHtml(view.name)}</h2>` : "") +
    contextHtml(props) +
    `<div class="e-content${view.name ? "" : " p-name"}">${view.contentHtml}</div>` +
    `<ul class="post-metadata"><li><a class="u-url u-uid" href="${escapeHtml(view.url)}">${timeTag(view.published)}</a></li>${tags}</ul>` +
    (syndication ? `<p>Also on:</p><ul class="post-metadata">${syndication}</ul>` : "") +
    `<span class="p-author h-card" hidden><a class="p-name u-url" href="${escapeHtml(schema.author.url)}">${escapeHtml(schema.author.name)}</a></span>` +
    `</article>`
  );
}

function indexHtml(records: readonly PostRecord[]) {
  const items = records
    .map((record) => {
      const view = viewOf(record);
      return `<li class="h-entry"><a class="u-url p-name" href="${escapeHtml(view.url)}">${escapeHtml(view.title)}</a> · ${timeTag(view.published)}</li>`;
    })
    .join("");
  return `<div class="h-feed"><h2 class="p-name">Posts</h2>${items ? `<ul>${items}</ul>` : "<p>Nothing posted yet.</p>"}</div>`;
}

/** Fill the shell's `<head>` and `[data-post]` for one rendered page. */
function fillShell(shell: Response, page: { url: string; title: string; description: string; body: string; jsonLd: object; isEntry: boolean }) {
  const fullTitle = `${page.title} — ${site.title}`;
  const set = (attribute: string, value: string) => ({ element: (el: RewriterElement) => void el.setAttribute(attribute, value) });
  const remove = { element: (el: RewriterElement) => void el.remove() };
  let r = rewriter()
    .on("title", { element: (el) => void el.setInnerContent(fullTitle) })
    .on('link[rel="canonical"]', set("href", page.url))
    .on('meta[property="og:url"]', set("content", page.url))
    .on('meta[property="og:type"]', set("content", page.isEntry ? "article" : "website"));
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) {
    r = r.on(selector, set("content", page.title));
  }
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
    r = r.on(selector, set("content", page.description));
  }
  r = r
    .on('script[type="application/ld+json"]', {
      element: (el) => void el.setInnerContent(JSON.stringify(page.jsonLd).replace(/</g, "\\u003c"), { html: true }),
    })
    .on("[data-post]", { element: (el) => void el.setInnerContent(page.body, { html: true }) });
  // Only a permalink takes webmentions; the shell's section names no target yet.
  r = page.isEntry
    ? r.on("[data-webmentions]", set("data-webmentions", page.url)).on('.webmentions input[name="target"]', set("value", page.url))
    : r.on(".webmentions", remove);
  return r.transform(shell);
}

export async function listPublicPosts(env: Env): Promise<PostRecord[]> {
  // Over-fetch so unlisted posts filtered out here don't shorten the list.
  const records = await createMicropubStore(env).listPosts({ limit: MAX_LIMIT, offset: 0 });
  return records.filter(isListed).slice(0, LIST_LIMIT);
}

/** Serve `/posts/` and `/posts/<slug>`; the shell itself is not a public page. */
export async function servePosts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const notFound = () => env.ASSETS.fetch(new Request(new URL("/404-not-found/", url), request));
  if (isShellPath(url.pathname)) return notFound();
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  }
  // The index has a trailing slash, like the static pages; permalinks don't.
  const canonicalPath = url.pathname === POSTS_PATH || url.pathname === POSTS_PATH.slice(0, -1) ? POSTS_PATH : url.pathname.replace(/\/+$/, "");
  if (canonicalPath !== url.pathname) {
    url.pathname = canonicalPath;
    return Response.redirect(url.toString(), 301);
  }
  const shell = await env.ASSETS.fetch(new Request(new URL(SHELL_PATH, url)));
  const pageUrl = `${site.url}${url.pathname}`;

  if (url.pathname === POSTS_PATH) {
    const records = await listPublicPosts(env);
    return fillShell(shell, {
      url: pageUrl,
      title: "Posts",
      description: `Posts by ${schema.author.name}.`,
      body: indexHtml(records),
      jsonLd: { "@context": "https://schema.org", "@type": "Blog", name: `${site.title}: Posts`, url: pageUrl, author: schema.author },
      isEntry: false,
    });
  }

  const record = await createMicropubStore(env).getPost(pageUrl);
  if (!record || !isPublic(record)) return notFound();
  const view = viewOf(record);
  return fillShell(shell, {
    url: pageUrl,
    title: view.title,
    description: view.summary,
    body: entryHtml(record),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: view.title,
      datePublished: view.published.toISOString(),
      dateModified: view.updated.toISOString(),
      author: schema.author,
      url: pageUrl,
      ...(view.categories.length ? { keywords: view.categories.join(", ") } : {}),
    },
    isEntry: true,
  });
}
