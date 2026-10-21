// The "send a Webmention" form on project pages and posts, and the avatars of
// received mentions' authors (worker/webmentions.ts).
import { createD1Inbox } from "@dwk/webmention";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serveAvatar } from "../worker/webmentions";
import { resetD1 } from "./reset";

const TARGET = "https://dwk.io/anglesite/";

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetD1();
  // Accepted mentions are queued for verification; don't fetch real sources.
  vi.spyOn(env.WEBMENTION_QUEUE, "send").mockImplementation((async () => undefined) as never);
});

const submit = (fields: Record<string, string>, accept = "text/html,application/xhtml+xml") =>
  SELF.fetch("https://dwk.io/webmention", {
    method: "POST",
    headers: { accept, "content-type": "application/x-www-form-urlencoded", "cf-connecting-ip": crypto.randomUUID() },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });

describe("the webmention form", () => {
  it("sends a person back to the page with a received notice", async () => {
    const res = await submit({ source: "https://alice.example/reply", target: TARGET });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${TARGET}?webmention=received#webmentions`);
    expect(env.WEBMENTION_QUEUE.send).toHaveBeenCalledOnce();
  });

  it("carries the endpoint's error code back to the page", async () => {
    const res = await submit({ source: "not a url", target: TARGET });
    expect(res.headers.get("location")).toBe(`${TARGET}?webmention=invalid_source#webmentions`);
  });

  it("sends a target on another site home rather than off-site", async () => {
    const res = await submit({ source: "https://alice.example/reply", target: "https://elsewhere.example/" });
    expect(res.headers.get("location")).toBe("https://dwk.io/?webmention=target_not_supported#webmentions");
  });

  it("leaves a sender's own (non-browser) request alone", async () => {
    const res = await submit({ source: "https://alice.example/reply", target: TARGET }, "*/*");
    expect(res.status).toBe(202);
  });

  it("shows the notice on the page, and only for well-formed codes", async () => {
    const received = await (await SELF.fetch(`${TARGET}?webmention=received`)).text();
    expect(received).toContain('class="webmention-notice webmention-notice-received"');
    expect(received).toContain('<section class="webmentions" id="webmentions">');
    const bogus = await (await SELF.fetch(`${TARGET}?webmention=%3Cscript%3E`)).text();
    expect(bogus).not.toContain("webmention-notice");
    expect(bogus).not.toContain("<script>");
  });
});

describe("mention avatars", () => {
  const SOURCE = "https://alice.example/reply";
  const avatar = (source = SOURCE) =>
    serveAvatar(new Request(`https://dwk.io/webmention-avatar?${new URLSearchParams({ target: TARGET, source })}`), env);

  beforeEach(async () => {
    await createD1Inbox(env.WEBMENTION_INBOX!).store({
      source: SOURCE,
      target: TARGET,
      verifiedAt: Date.now(),
      interactionType: "reply",
      author: { name: "Alice", url: "https://alice.example/", photo: "https://alice.example/me.png" },
    });
  });

  /** Answer the avatar fetch with `body` as `type`, and cache nothing. */
  function upstream(type: string, body: BodyInit = new Uint8Array([137, 80, 78, 71])) {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { headers: { "content-type": type } }));
    vi.spyOn((caches as unknown as { default: Cache }).default, "match").mockResolvedValue(undefined);
    vi.spyOn((caches as unknown as { default: Cache }).default, "put").mockResolvedValue(undefined);
    return fetchSpy;
  }

  it("are rendered through the proxy, which serves the author's photo", async () => {
    const page = await (await SELF.fetch(TARGET)).text();
    expect(page).toContain('<img class="u-photo" src="/webmention-avatar?target=https%3A%2F%2Fdwk.io%2Fanglesite%2F&amp;source=https%3A%2F%2Falice.example%2Freply"');
    const fetchSpy = upstream("image/png");
    const res = await avatar();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(String(fetchSpy.mock.calls[0]![0])).toBe("https://alice.example/me.png");
  });

  it("serve only photos of mentions in the inbox, so it isn't an open proxy", async () => {
    const fetchSpy = upstream("image/png");
    expect((await avatar("https://mallory.example/x")).status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuse SVG and oversized images", async () => {
    upstream("image/svg+xml", "<svg onload=alert(1)/>");
    expect((await avatar()).status).toBe(404);
    vi.restoreAllMocks();
    upstream("image/png", new Uint8Array(300 * 1024));
    expect((await avatar()).status).toBe(404);
  });
});
