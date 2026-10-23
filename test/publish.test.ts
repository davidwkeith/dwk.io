import { createMicropubStore } from "@dwk/micropub";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishChangedTopics } from "../worker/publish";
import { resetD1 } from "./reset";

const TOPICS = ["https://dwk.io/", "https://dwk.io/feed.xml", "https://dwk.io/feed.json", "https://dwk.io/posts/"];

/** The topics the cron enqueued a WebSub distribution for. */
function published(send: { mock: { calls: unknown[][] } }) {
  return send.mock.calls.map(([job]) => (job as { topic: string }).topic).sort();
}

let send: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  // Capture the hub's distribution jobs instead of fetching the real topics.
  send = vi.fn(async () => undefined);
  vi.spyOn(env.WEBSUB_QUEUE, "send").mockImplementation(send as never);
  await resetD1();
  await createMicropubStore(env).init();
});

describe("publishChangedTopics", () => {
  it("pings every topic once, then only the ones whose content changed", async () => {
    await publishChangedTopics(env);
    expect(published(send)).toEqual([...TOPICS].sort());

    send.mockClear();
    await publishChangedTopics(env);
    expect(send).not.toHaveBeenCalled();

    // A new post changes both feeds and the posts h-feed, not the static home page.
    await createMicropubStore(env).insertPost({ url: "https://dwk.io/posts/new", type: "h-entry", properties: { content: ["New"] }, now: 1_760_000_000 });
    send.mockClear();
    await publishChangedTopics(env);
    expect(published(send)).toEqual(["https://dwk.io/feed.json", "https://dwk.io/feed.xml", "https://dwk.io/posts/"]);
  });

  it("still pings the other topics when one fails, and retries the failed one next run", async () => {
    send.mockImplementation(async (job: { topic: string }) => {
      if (job.topic.endsWith("feed.xml")) throw new Error("queue down");
    });
    await expect(publishChangedTopics(env)).rejects.toThrow("feed.xml");
    expect(published(send)).toEqual([...TOPICS].sort());

    send.mockReset();
    send.mockImplementation(async () => undefined);
    await publishChangedTopics(env);
    expect(published(send)).toEqual(["https://dwk.io/feed.xml"]);
  });
});
