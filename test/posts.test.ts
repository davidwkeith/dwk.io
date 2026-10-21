import type { Mf2Object, MicropubCommands, PostRecord } from "@dwk/micropub";
import { describe, expect, it } from "vitest";
import { generatePostUrl, titleOf, viewOf } from "../worker/posts";

function record(properties: Record<string, unknown[]>, overrides: Partial<PostRecord> = {}): PostRecord {
  return { url: "https://dwk.io/posts/x", type: "h-entry", properties, deleted: false, createdAt: 1_760_000_000, updatedAt: 1_760_000_100, ...overrides };
}

function urlFor(properties: Record<string, unknown[]>, slug?: string) {
  const post = { type: ["h-entry"], properties } as unknown as Mf2Object;
  return generatePostUrl(post, { slug } as unknown as MicropubCommands);
}

describe("generatePostUrl", () => {
  it("prefers mp-slug, then the name, slugified, with no trailing slash", () => {
    expect(urlFor({ name: ["Ignored"] }, "My Slug!")).toBe("https://dwk.io/posts/my-slug");
    expect(urlFor({ name: ["Crème Brûlée, at Home"] })).toBe("https://dwk.io/posts/creme-brulee-at-home");
  });

  it("gives a nameless note a short timestamp slug", () => {
    expect(urlFor({ content: ["hi"] })).toMatch(/^https:\/\/dwk\.io\/posts\/[0-9a-z]+$/);
  });

  it("caps slugs at 60 characters without a trailing dash", () => {
    const url = urlFor({ name: ["word ".repeat(30)] }) as string;
    const slug = url.split("/").pop()!;
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });
});

describe("titleOf", () => {
  it("uses the name, else the start of the note's text", () => {
    expect(titleOf(record({ name: ["Hello"], content: ["Body"] }))).toBe("Hello");
    expect(titleOf(record({ content: ["A  short\nnote"] }))).toBe("A short note");
    expect(titleOf(record({ content: ["x".repeat(80)] }))).toBe(`${"x".repeat(59)}…`);
    expect(titleOf(record({}))).toBe("Note");
  });
});

describe("viewOf", () => {
  it("escapes plain-text content into paragraphs", () => {
    const view = viewOf(record({ content: ["one <b>\nline\n\ntwo"] }));
    expect(view.contentHtml).toBe("<p>one &lt;b&gt;<br>line</p><p>two</p>");
  });

  it("keeps the owner's HTML content and derives a text summary", () => {
    const view = viewOf(record({ content: [{ html: "<p>Hi <em>there</em></p>" }] }));
    expect(view.contentHtml).toBe("<p>Hi <em>there</em></p>");
    expect(view.summary).toBe("Hi there");
  });

  it("renders same-origin photos as images and links the rest", () => {
    const view = viewOf(record({ photo: [{ value: "https://dwk.io/media/a.jpg", alt: "A cat" }, "https://elsewhere.example/b.jpg", "javascript:x"] }));
    expect(view.contentHtml).toContain('<img class="u-photo" src="https://dwk.io/media/a.jpg" alt="A cat">');
    expect(view.contentHtml).toContain('<a class="u-photo" href="https://elsewhere.example/b.jpg">Photo</a>');
    expect(view.contentHtml).not.toContain("javascript:");
  });

  it("dates by `published`, falling back to the creation time", () => {
    expect(viewOf(record({ published: ["2026-10-20T10:00:00Z"] })).published.toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(viewOf(record({ published: ["not a date"] })).published.getTime()).toBe(1_760_000_000_000);
  });
});
