// Received webmentions, rendered into the page they target. Pages opt in with
// the `Webmentions.astro` component; its `[data-webmentions]` element names
// the target URL and gets the verified mentions from the @dwk/webmention inbox
// as mf2 `h-cite` comments, likes, reposts, bookmarks, and mentions
// (https://indieweb.org/comments-presentation). Authors' avatars go through
// `/webmention-avatar`, since the CSP only loads images from this origin; the
// component's form posts to `/webmention` and comes back with a notice.
import { createD1Inbox, safeFetch, type VerifiedMention } from "@dwk/webmention";
import { site } from "../src/data/site";
import * as config from "./config";
import type { Env } from "./env";
import { escapeHtml, httpUrl, isHtml, rewriter, timeTag } from "./html";

/** mf2 property and heading for each interaction type, in display order. */
const GROUPS = [
  { type: "reply", property: "p-comment", heading: "Replies" },
  { type: "like", property: "p-like", heading: "Likes" },
  { type: "repost", property: "p-repost", heading: "Reposts" },
  { type: "bookmark", property: "p-bookmark", heading: "Bookmarks" },
  { type: "mention", property: "p-mention", heading: "Mentions" },
] as const;

async function mentionsFor(env: Env, target: string) {
  const inbox = createD1Inbox(env.WEBMENTION_INBOX!);
  // Senders link to the page with or without its trailing slash.
  const variants = [target, target.endsWith("/") ? target.slice(0, -1) : `${target}/`];
  const lists = await Promise.all(variants.map((t) => inbox.list(t)));
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((m) => !seen.has(m.source) && seen.add(m.source))
    .sort((a, b) => (a.publishedAt ?? a.verifiedAt) - (b.publishedAt ?? b.verifiedAt));
}

export const AVATAR_PATH = "/webmention-avatar";

function avatarUrl(mention: VerifiedMention) {
  const params = new URLSearchParams({ target: mention.target, source: mention.source });
  return `${AVATAR_PATH}?${params}`;
}

function authorCard(mention: VerifiedMention) {
  const url = httpUrl(mention.author?.url);
  const name = escapeHtml(mention.author?.name || (url ? new URL(url).host : new URL(mention.source).host));
  const photo = httpUrl(mention.author?.photo)
    ? `<img class="u-photo" src="${escapeHtml(avatarUrl(mention))}" alt="" width="32" height="32" loading="lazy"> `
    : "";
  return url
    ? `<a class="p-author h-card" href="${escapeHtml(url)}">${photo}${name}</a>`
    : `<span class="p-author h-card">${photo}${name}</span>`;
}

function renderMention(mention: VerifiedMention, property: string) {
  const source = escapeHtml(mention.source);
  const date = new Date(mention.publishedAt ?? mention.verifiedAt);
  // `content` is already sanitized by @dwk/webmention (formatting allowlist,
  // `rel="ugc nofollow"` links), so it is inserted as HTML.
  const content = mention.interactionType === "reply" && mention.content ? `<div class="e-content p-name">${mention.content}</div>` : "";
  return (
    `<li class="${property} h-cite">${authorCard(mention)} · ` +
    `<a class="u-url" href="${source}" rel="ugc nofollow">${timeTag(date)}</a>${content}</li>`
  );
}

export function renderMentions(mentions: readonly VerifiedMention[]) {
  if (!mentions.length) return "<p>No responses yet.</p>";
  return GROUPS.map(({ type, property, heading }) => {
    const group = mentions.filter((m) => (m.interactionType ?? "mention") === type);
    if (!group.length) return "";
    return `<h4>${heading} (${group.length})</h4><ul class="webmention-list">${group.map((m) => renderMention(m, property)).join("")}</ul>`;
  }).join("");
}

/** What the page says after its form posted (`?webmention=`, set by {@link formResult}). */
function noticeFor(outcome: string) {
  const messages: Record<string, string> = {
    received: "Thanks! Your Webmention was received; it appears here once its source is verified to link to this page.",
    rate_limited: "Too many Webmentions from your address just now; please try again in a minute.",
    invalid_source: "That source isn't a valid http(s) URL.",
    missing_source: "Enter the URL of your response.",
    source_equals_target: "The source has to be a different page from this one.",
    invalid_target: "That page can't receive Webmentions.",
    target_not_supported: "That page can't receive Webmentions.",
  };
  const message = messages[outcome] ?? `That Webmention wasn't accepted (${outcome}).`;
  const kind = outcome === "received" ? "received" : "error";
  return `<p class="webmention-notice webmention-notice-${kind}" role="status">${escapeHtml(message)}</p>`;
}

/**
 * Fill each `[data-webmentions]` element in an HTML response with its target's
 * mentions, and show the outcome of a form submission (`?webmention=`).
 */
export function withMentions(response: Response, env: Env, requestUrl?: string): Response {
  if (!isHtml(response)) return response;
  const outcome = requestUrl ? new URL(requestUrl).searchParams.get("webmention") : null;
  return rewriter()
    .on(".webmention-form", {
      element(element) {
        if (outcome && /^[a-z_]{1,40}$/.test(outcome)) element.before(noticeFor(outcome), { html: true });
      },
    })
    .on("[data-webmentions]", {
      async element(element) {
        const target = element.getAttribute("data-webmentions");
        if (!target) return;
        try {
          element.setInnerContent(renderMentions(await mentionsFor(env, target)), { html: true });
        } catch (error) {
          // A D1 hiccup leaves the section empty rather than failing the page.
          config.logger.error("webmentions.render_failed", { error: error instanceof Error ? error.name : "unknown" });
        }
      },
    })
    .transform(response);
}

/** Whether a POST to `/webmention` is a person submitting the page's form. */
export function isFormSubmission(request: Request) {
  return request.method === "POST" && (request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * Turn the endpoint's answer to a form submission (an empty 202, or a 400 with
 * a stable error code) into a redirect back to the page it was about, which
 * then shows a notice. A target on another site sends the person home.
 */
export async function formResult(form: FormData, response: Response): Promise<Response> {
  const target = String(form.get("target") ?? "");
  let back: URL;
  try {
    back = new URL(target);
    if (back.origin !== site.url) throw new Error("foreign target");
  } catch {
    back = new URL("/", site.url);
  }
  let outcome = "received";
  if (response.status === 429) outcome = "rate_limited";
  else if (!response.ok) {
    const code = (await response.text()).trim();
    outcome = /^[a-z_]{1,40}$/.test(code) ? code : "rejected";
  }
  back.searchParams.set("webmention", outcome);
  back.hash = "webmentions";
  return Response.redirect(back.toString(), 303);
}

const AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);
const AVATAR_MAX_BYTES = 256 * 1024;

async function readCapped(body: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * `GET /webmention-avatar?target=…&source=…`: the photo of a received
 * mention's author, fetched through `safeFetch` and cached for a day. Only
 * photos of mentions in the inbox are served, so it is not an open proxy;
 * only raster image types under 256 KB pass (no SVG, which could carry script).
 */
export async function serveAvatar(request: Request, env: Env): Promise<Response> {
  const notFound = () => new Response("Not Found", { status: 404, headers: { "x-content-type-options": "nosniff" } });
  const url = new URL(request.url);
  const target = url.searchParams.get("target") ?? "";
  const source = url.searchParams.get("source") ?? "";
  if (!target || !source) return notFound();
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const mention = (await createD1Inbox(env.WEBMENTION_INBOX!).list(target)).find((m) => m.source === source);
  const photo = httpUrl(mention?.author?.photo);
  if (!photo) return notFound();
  try {
    const { response } = await safeFetch((input, init) => fetch(input, init), photo, { headers: { accept: "image/*" } }, { timeoutMs: 5000 });
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!response.ok || !AVATAR_TYPES.has(type) || !response.body) return notFound();
    const bytes = await readCapped(response.body, AVATAR_MAX_BYTES);
    if (!bytes) return notFound();
    const avatar = new Response(bytes, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'",
      },
    });
    await cache.put(request, avatar.clone());
    return avatar;
  } catch (error) {
    config.logger.error("webmentions.avatar_failed", { error: error instanceof Error ? error.name : "unknown" });
    return notFound();
  }
}
