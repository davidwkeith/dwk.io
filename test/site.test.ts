// The site as the Worker serves it: `dist/` plus Micropub posts and received
// webmentions from local D1.
import { createMicropubStore } from "@dwk/micropub";
import { createD1Inbox } from "@dwk/webmention";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetD1 } from "./reset";

const NOW = 1_760_000_000;

async function post(slug: string, properties: Record<string, unknown[]>) {
  await createMicropubStore(env).insertPost({ url: `https://dwk.io/posts/${slug}`, type: "h-entry", properties, now: NOW });
}

const get = (path: string) => SELF.fetch(`https://dwk.io${path}`, { redirect: "manual" });

beforeEach(async () => {
  await resetD1();
  await createMicropubStore(env).init();
  await post("hello", {
    name: ["Hello IndieWeb"],
    content: [{ html: "<p>First post.</p>" }],
    category: ["indieweb"],
    published: ["2026-10-20T10:00:00Z"],
    syndication: ["https://bsky.app/profile/dwk.io/post/abc"],
  });
  await post("note", { content: ['A note "><script>alert(1)</script>'], "in-reply-to": ["https://example.com/post"], published: ["2026-10-21T10:00:00Z"] });
  await post("draft", { name: ["Draft"], content: ["x"], "post-status": ["draft"] });
  await post("private", { name: ["Private"], content: ["x"], visibility: ["private"] });
  await post("unlisted", { name: ["Unlisted"], content: ["x"], visibility: ["unlisted"] });
});

describe("posts", () => {
  it("canonicalizes the index to a trailing slash and permalinks to none", async () => {
    expect((await get("/posts")).headers.get("location")).toBe("https://dwk.io/posts/");
    expect((await get("/posts/hello/")).headers.get("location")).toBe("https://dwk.io/posts/hello");
  });

  it("lists public posts newest first as an h-feed, leaving out drafts, private, and unlisted ones", async () => {
    const res = await get("/posts/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div class="h-feed">');
    expect(html.indexOf("/posts/note")).toBeLessThan(html.indexOf("/posts/hello"));
    for (const slug of ["draft", "private", "unlisted"]) expect(html).not.toContain(`/posts/${slug}`);
    // The index takes no webmentions.
    expect(html).not.toContain("data-webmentions");
  });

  it("renders a permalink as an h-entry with its head filled in", async () => {
    const res = await get("/posts/hello");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    const html = await res.text();
    expect(html).toContain("<title>Hello IndieWeb — DWK's Cyber Home</title>");
    expect(html).toContain('<link rel="canonical" href="https://dwk.io/posts/hello">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain('<article class="h-entry"><h2 class="p-name">Hello IndieWeb</h2>');
    expect(html).toContain('<span class="p-category">indieweb</span>');
    // Other sites are labelled by host.
    expect(html).toContain('class="u-syndication" rel="syndication" href="https://bsky.app/profile/dwk.io/post/abc">bsky.app</a>');
    expect(html).toContain('data-webmentions="https://dwk.io/posts/hello"');
    expect(html).toContain('<input type="hidden" name="target" value="https://dwk.io/posts/hello">');
  });

  it("escapes a note's text, in the body and in the head's attributes, and links its reply context", async () => {
    const html = await (await get("/posts/note")).text();
    expect(html).toContain("A note &quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
    // The title lands in quoted attributes too (og:title etc.); `"` must not close them.
    expect(html).not.toContain('"><script>');
    expect(html).toContain('<a class="u-in-reply-to" href="https://example.com/post">');
  });

  it("serves unlisted posts at their permalink but never drafts, private, or unknown posts", async () => {
    expect((await get("/posts/unlisted")).status).toBe(200);
    for (const path of ["/posts/draft", "/posts/private", "/posts/missing"]) expect((await get(path)).status).toBe(404);
  });

  it("keeps the shell from being a page of its own", async () => {
    for (const path of ["/post-shell", "/post-shell/"]) expect((await get(path)).status).toBe(404);
  });
});

describe("feeds", () => {
  it("merges public posts into the JSON Feed by date", async () => {
    const feed = (await (await get("/feed.json")).json()) as { items: { url: string; title?: string; date_published: string }[]; hubs: unknown };
    const urls = feed.items.map((i) => i.url);
    expect(urls.slice(0, 2)).toEqual(["https://dwk.io/posts/note", "https://dwk.io/posts/hello"]);
    expect(urls).toContain("https://dwk.io/anglesite/");
    expect(urls.some((u) => /draft|private|unlisted/.test(u))).toBe(false);
    // A note has no title; the projects keep theirs.
    expect(feed.items[0].title).toBeUndefined();
    const dates = feed.items.map((i) => i.date_published);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(feed.hubs).toEqual([{ type: "WebSub", url: "https://dwk.io/websub" }]);
  });

  it("adds public posts to the Atom feed as entries", async () => {
    const xml = await (await get("/feed.xml")).text();
    expect(xml).toContain("<entry><title>Hello IndieWeb</title>");
    expect(xml).toContain("<id>https://dwk.io/posts/hello</id>");
    expect(xml).toContain('<category term="indieweb"/>');
    expect(xml).not.toContain("/posts/unlisted");
    expect(xml.trimEnd().endsWith("</feed>")).toBe(true);
  });
});

describe("webmentions", () => {
  it("shows a page's verified mentions, whichever trailing-slash form they target", async () => {
    const inbox = createD1Inbox(env.WEBMENTION_INBOX!);
    await inbox.store({ source: "https://alice.example/reply", target: "https://dwk.io/anglesite/", verifiedAt: Date.now(), interactionType: "reply", author: { name: "Alice" }, content: "<p>Nice work!</p>" });
    await inbox.store({ source: "https://bob.example/like", target: "https://dwk.io/anglesite", verifiedAt: Date.now(), interactionType: "like", author: { name: "Bob" } });
    const html = await (await get("/anglesite/")).text();
    expect(html).toContain("Replies (1)");
    expect(html).toContain("<p>Nice work!</p>");
    expect(html).toContain("Likes (1)");
  });

  it("says so when a page has none", async () => {
    expect(await (await get("/anglesite/")).text()).toContain('<div data-webmentions="https://dwk.io/anglesite/"><p>No responses yet.</p></div>');
  });
});

describe("sitemap and llms.txt", () => {
  it("lists the posts' sitemap in the index", async () => {
    const index = await (await get("/sitemap-index.xml")).text();
    expect(index).toContain("<loc>https://dwk.io/sitemap-0.xml</loc>");
    expect(index).toContain("<loc>https://dwk.io/sitemap-posts.xml</loc>");
  });

  it("maps the posts index and every listed post, with lastmod", async () => {
    const res = await get("/sitemap-posts.xml");
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    const xml = await res.text();
    expect(xml).toContain("<loc>https://dwk.io/posts/</loc>");
    expect(xml).toContain("<url><loc>https://dwk.io/posts/hello</loc><lastmod>2025-10-09T08:53:20.000Z</lastmod></url>");
    expect(xml).toContain("<loc>https://dwk.io/posts/note</loc>");
    for (const slug of ["draft", "private", "unlisted"]) expect(xml).not.toContain(`/posts/${slug}`);
  });

  it("is still a valid sitemap when the posts can't be read", async () => {
    await resetD1();
    const xml = await (await get("/sitemap-posts.xml")).text();
    expect(xml).toMatch(/^<\?xml[^>]*><urlset [^>]*><url><loc>https:\/\/dwk\.io\/posts\/<\/loc><\/url><\/urlset>$/);
  });

  it("adds a Posts section to llms.txt, ahead of Optional", async () => {
    const text = await (await get("/llms.txt")).text();
    expect(text).toContain("- [Hello IndieWeb](https://dwk.io/posts/hello): First post.");
    expect(text).toContain("All posts: https://dwk.io/posts/");
    expect(text.indexOf("## Projects")).toBeLessThan(text.indexOf("## Posts"));
    expect(text.indexOf("## Posts")).toBeLessThan(text.indexOf("## Optional"));
    expect(text).not.toContain("/posts/unlisted");
  });

  it("leaves llms.txt as built when the posts can't be read", async () => {
    await resetD1();
    expect(await (await get("/llms.txt")).text()).not.toContain("## Posts");
  });
});

describe("cross-origin embedding", () => {
  it("lets other sites show the profile photo and images, but not embed pages", async () => {
    for (const path of ["/icon-512.png", "/img/memoji.png"]) {
      expect((await get(path)).headers.get("cross-origin-resource-policy"), path).toBe("cross-origin");
    }
    expect((await get("/")).headers.get("cross-origin-resource-policy")).toBe("same-origin");
  });
});

describe("authorship", () => {
  it("names the author visibly on h-feeds and h-entries, with nothing hidden", async () => {
    for (const path of ["/", "/anglesite/", "/posts/", "/posts/hello"]) {
      const html = await (await get(path)).text();
      expect(html, path).toMatch(/class="p-author h-card" href="https:\/\/dwk\.io"/);
      expect(html, path).not.toMatch(/<[^>]*class="[^"]*(p-author|u-url)[^"]*"[^>]*\shidden/);
    }
  });

  it("gives the representative h-card a visible photo and note", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain('<img class="u-photo" src="/icon-512.png"');
    expect(html).toContain('<span class="p-note">Software Engineer &amp; Educator — Specification Literacy</span>');
  });
});
