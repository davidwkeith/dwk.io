// Received webmentions, rendered into the page they target. Pages opt in with
// the `Webmentions.astro` component; its `[data-webmentions]` element names
// the target URL and gets the verified mentions from the @dwk/webmention inbox
// as mf2 `h-cite` comments, likes, reposts, bookmarks, and mentions
// (https://indieweb.org/comments-presentation).
import { createD1Inbox, type VerifiedMention } from "@dwk/webmention";
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

function authorCard(mention: VerifiedMention) {
  const url = httpUrl(mention.author?.url);
  const name = escapeHtml(mention.author?.name || (url ? new URL(url).host : new URL(mention.source).host));
  // No avatar: the CSP keeps images on this origin.
  return url ? `<a class="p-author h-card" href="${escapeHtml(url)}">${name}</a>` : `<span class="p-author h-card">${name}</span>`;
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

/** Fill each `[data-webmentions]` element in an HTML response with its target's mentions. */
export function withMentions(response: Response, env: Env): Response {
  if (!isHtml(response)) return response;
  return rewriter()
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
