// Outgoing webmentions for Micropub posts (https://www.w3.org/TR/webmention/#sending-webmentions).
// @dwk/micropub has no publish hook, so the cron reconciles: each run compares
// every post with the version it last sent webmentions for, and
// - notifies the targets of a new or edited post, an edit's old targets
//   included, so they can see a link was removed (§3.1.4);
// - re-notifies everyone a deleted, or now private, post had mentioned, once
//   it answers 410/404, so they drop the mention (§3.1.5).
import type { PostRecord } from "@dwk/micropub";
import { createD1SentLog, extractLinks, resendForDeletedSource, sendWebmentions, type FetchLike } from "@dwk/webmention";
import { site } from "../src/data/site";
import * as config from "./config";
import type { Env } from "./env";
import { allLivePosts, isPublic, outboundHtml } from "./posts";

// Shares the dwk-indieauth database; the name is disjoint from every package's.
const TABLE = "dwk_webmention_outbox";
/**
 * Targets notified per run. Each costs a few subrequests (discovery, maybe a
 * redirect, the POST); the rest wait for the next run, 15 minutes on.
 */
export const MAX_TARGETS_PER_RUN = 10;

interface Sent {
  readonly updatedAt: number;
  readonly targets: string[];
}

/** A post's Webmention targets: the absolute http(s) links it makes to other sites. */
export async function targetsOf(record: PostRecord): Promise<string[]> {
  const links = await extractLinks(outboundHtml(record), record.url);
  const own = new URL(site.url).host;
  return [
    ...new Set(
      links.flatMap((link) => {
        const url = new URL(link);
        url.hash = "";
        return (url.protocol === "https:" || url.protocol === "http:") && url.host !== own ? [url.toString()] : [];
      }),
    ),
  ];
}

export async function sendPostWebmentions(env: Env, options: { fetch?: FetchLike } = {}): Promise<void> {
  const db = env.MICROPUB_DB;
  const sentLog = createD1SentLog(env.WEBMENTION_INBOX!);
  const sendOptions = { fetch: options.fetch, logger: config.logger, sentLog };
  // Lazy schema, like the packages without a store-init API.
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (url TEXT PRIMARY KEY, updated_at INTEGER NOT NULL, targets TEXT NOT NULL)`).run();
  type Row = { url: string; updated_at: number; targets: string };
  const { results } = (await db.prepare(`SELECT url, updated_at, targets FROM ${TABLE}`).all()) as { results: Row[] };
  const sent = new Map<string, Sent>(results.map((r) => [r.url, { updatedAt: r.updated_at, targets: JSON.parse(r.targets) as string[] }]));

  let budget = MAX_TARGETS_PER_RUN;
  const retract = async (url: string) => {
    const previous = sent.get(url)!;
    budget -= previous.targets.length;
    await resendForDeletedSource(url, sendOptions);
    await db.prepare(`DELETE FROM ${TABLE} WHERE url = ?`).bind(url).run();
  };

  // Posts that left the store's live list were deleted (or are no longer posts).
  const live = await allLivePosts(env);
  const liveUrls = new Set(live.map((p) => p.url));
  for (const url of sent.keys()) {
    if (budget <= 0) return;
    if (!liveUrls.has(url)) await retract(url);
  }

  // Oldest change first, so a backlog drains in order.
  for (const record of live.sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (budget <= 0) return;
    const previous = sent.get(record.url);
    if (!isPublic(record)) {
      if (previous) await retract(record.url);
      continue;
    }
    if (previous?.updatedAt === record.updatedAt) continue;
    const targets = await targetsOf(record);
    const notify = [...new Set([...(previous?.targets ?? []), ...targets])];
    // One post's targets go out together; a post too big for what's left of
    // this run waits for the next one, unless it's the run's first.
    if (notify.length > budget && budget < MAX_TARGETS_PER_RUN) return;
    budget -= notify.length;
    const outcomes = await sendWebmentions(record.url, notify, sendOptions);
    for (const outcome of outcomes) {
      // Never retried: a dead endpoint would be pinged every 15 minutes forever.
      if (outcome.endpoint && !outcome.delivered) {
        config.logger.error("webmention.send_failed", { targetHost: new URL(outcome.target).host, status: outcome.status });
      }
    }
    await db
      .prepare(`INSERT INTO ${TABLE} (url, updated_at, targets) VALUES (?, ?, ?) ON CONFLICT (url) DO UPDATE SET updated_at = excluded.updated_at, targets = excluded.targets`)
      .bind(record.url, record.updatedAt, JSON.stringify(targets))
      .run();
  }
}
