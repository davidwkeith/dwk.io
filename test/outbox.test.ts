import { createMicropubStore, type PostRecord } from "@dwk/micropub";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_TARGETS_PER_RUN, sendPostWebmentions, targetsOf } from "../worker/outbox";
import { resetD1 } from "./reset";

const NOW = 1_760_000_000;

/**
 * A stand-in for the web: every page on another site advertises a Webmention
 * endpoint at `/wm` on its own host, and each POST to one is recorded.
 */
function fakeWeb() {
  const notified: { source: string; target: string }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if ((init?.method ?? "GET").toUpperCase() === "POST") {
      const body = new URLSearchParams(String(init?.body));
      notified.push({ source: body.get("source")!, target: body.get("target")! });
      return new Response(null, { status: 202 });
    }
    const html = `<!doctype html><link rel="webmention" href="https://${url.host}/wm"><p>${url}</p>`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  };
  /** Targets notified, sorted, then forgotten. */
  const take = () => notified.splice(0).map((n) => n.target).sort();
  return { fetch, notified, take };
}

const store = () => createMicropubStore(env);

async function post(slug: string, properties: Record<string, unknown[]>, now = NOW) {
  await store().insertPost({ url: `https://dwk.io/posts/${slug}`, type: "h-entry", properties, now });
}

let web: ReturnType<typeof fakeWeb>;
const run = () => sendPostWebmentions(env, { fetch: web.fetch as never });

beforeEach(async () => {
  await resetD1();
  await store().init();
  web = fakeWeb();
});

describe("targetsOf", () => {
  it("is the response context and content links to other sites, deduplicated, without fragments", async () => {
    const record = {
      url: "https://dwk.io/posts/x",
      properties: {
        "in-reply-to": ["https://alice.example/post"],
        "like-of": [{ type: ["h-cite"], properties: { url: ["https://bob.example/photo"] } }],
        content: [{ html: '<p><a href="https://alice.example/post#c1">again</a> <a href="/anglesite/">mine</a> <a href="https://dwk.io/cv/">mine too</a> <a href="mailto:x@example.com">mail</a> <a href="https://carol.example/">carol</a></p>' }],
        syndication: ["https://bsky.app/profile/dwk.io/post/abc"],
        photo: ["https://elsewhere.example/p.jpg"],
      },
    } as unknown as PostRecord;
    expect((await targetsOf(record)).sort()).toEqual(["https://alice.example/post", "https://bob.example/photo", "https://carol.example/"]);
  });
});

describe("sendPostWebmentions", () => {
  it("notifies a new post's targets once, with the post as the source", async () => {
    await post("reply", { "in-reply-to": ["https://alice.example/post"], content: [{ html: '<a href="https://carol.example/">c</a>' }] });
    await run();
    expect(web.notified).toEqual(
      expect.arrayContaining([
        { source: "https://dwk.io/posts/reply", target: "https://alice.example/post" },
        { source: "https://dwk.io/posts/reply", target: "https://carol.example/" },
      ]),
    );
    expect(web.take()).toHaveLength(2);
    await run();
    expect(web.take()).toEqual([]);
  });

  it("re-notifies an edited post's old and new targets", async () => {
    await post("edit", { content: [{ html: '<a href="https://old.example/">o</a>' }] });
    await run();
    web.take();
    await store().updateProperties("https://dwk.io/posts/edit", { content: [{ html: '<a href="https://new.example/">n</a>' }] }, NOW + 60);
    await run();
    expect(web.take()).toEqual(["https://new.example/", "https://old.example/"]);
    // The removed link was dropped from what's remembered for the next edit.
    await store().updateProperties("https://dwk.io/posts/edit", { content: [{ html: '<a href="https://new.example/">n2</a>' }] }, NOW + 120);
    await run();
    expect(web.take()).toEqual(["https://new.example/"]);
  });

  it("re-notifies a deleted post's targets after it answers 410 Gone", async () => {
    await post("gone", { "in-reply-to": ["https://alice.example/post"] });
    await run();
    web.take();
    await store().setDeleted("https://dwk.io/posts/gone", true, NOW + 60);
    expect((await SELF.fetch("https://dwk.io/posts/gone")).status).toBe(410);
    await run();
    expect(web.take()).toEqual(["https://alice.example/post"]);
    await run();
    expect(web.take()).toEqual([]);
  });

  it("never notifies for a draft, and retracts a post made private", async () => {
    await post("draft", { "in-reply-to": ["https://alice.example/post"], "post-status": ["draft"] });
    await post("later-private", { "in-reply-to": ["https://bob.example/post"] });
    await run();
    expect(web.take()).toEqual(["https://bob.example/post"]);
    await store().updateProperties("https://dwk.io/posts/later-private", { "in-reply-to": ["https://bob.example/post"], visibility: ["private"] }, NOW + 60);
    await run();
    expect(web.take()).toEqual(["https://bob.example/post"]);
    await run();
    expect(web.take()).toEqual([]);
  });

  it(`sends at most ${MAX_TARGETS_PER_RUN} per run and picks the rest up next time`, async () => {
    for (let i = 0; i < MAX_TARGETS_PER_RUN + 2; i++) {
      await post(`p${i}`, { "in-reply-to": [`https://site${i}.example/`] }, NOW + i);
    }
    await run();
    expect(web.take()).toHaveLength(MAX_TARGETS_PER_RUN);
    await run();
    expect(web.take()).toHaveLength(2);
  });
});
