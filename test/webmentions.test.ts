import type { VerifiedMention } from "@dwk/webmention";
import { describe, expect, it } from "vitest";
import { renderMentions } from "../worker/webmentions";

const target = "https://dwk.io/anglesite/";

function mention(overrides: Partial<VerifiedMention>): VerifiedMention {
  return { source: "https://alice.example/1", target, verifiedAt: Date.UTC(2026, 9, 20), ...overrides };
}

describe("renderMentions", () => {
  it("says so when there are none", () => {
    expect(renderMentions([])).toBe("<p>No responses yet.</p>");
  });

  it("groups by interaction type, replies first, as mf2 h-cites", () => {
    const html = renderMentions([
      mention({ source: "https://bob.example/like", interactionType: "like", author: { name: "Bob" } }),
      mention({ source: "https://alice.example/reply", interactionType: "reply", author: { name: "Alice" }, content: "<p>Nice!</p>" }),
      mention({ source: "https://carol.example/post" }),
    ]);
    expect(html.indexOf("Replies (1)")).toBeLessThan(html.indexOf("Likes (1)"));
    expect(html.indexOf("Likes (1)")).toBeLessThan(html.indexOf("Mentions (1)"));
    expect(html).toContain('<li class="p-comment h-cite">');
    expect(html).toContain('<li class="p-like h-cite">');
    expect(html).toContain('<li class="p-mention h-cite">');
    expect(html).toContain('<div class="e-content p-name"><p>Nice!</p></div>');
    expect(html).toContain('<a class="u-url" href="https://alice.example/reply" rel="ugc nofollow">');
  });

  it("only shows content for replies", () => {
    const html = renderMentions([mention({ interactionType: "like", content: "<p>liked text</p>" })]);
    expect(html).not.toContain("liked text");
  });

  it("escapes author names and drops non-http author URLs", () => {
    const html = renderMentions([mention({ author: { name: "<script>x</script>", url: "javascript:alert(1)" } })]);
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('<span class="p-author h-card">');
  });

  it("names an anonymous author by the source's host", () => {
    expect(renderMentions([mention({ source: "https://anon.example/x" })])).toContain('<span class="p-author h-card">anon.example</span>');
  });
});
