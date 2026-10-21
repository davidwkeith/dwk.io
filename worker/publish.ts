// WebSub publish pings for the static site. The feeds only change on deploy,
// and Workers Builds gives no post-deploy hook, so the cron hashes each topic
// as served from `dist/` and tells the hub about the ones whose content
// changed since the last run.
import { createPublishNotifier } from "@dwk/websub";
import * as config from "./config";
import type { Env } from "./env";

// Shares the dwk-indieauth database; the name is disjoint from every package's.
const TABLE = "dwk_websub_published";

async function sha256(body: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", body);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function publishChangedTopics(env: Env): Promise<void> {
  const db = env.WEBSUB_DB;
  const notifyPublish = createPublishNotifier(config.websub);
  // Lazy schema, like the packages without a store-init API.
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLE} (topic TEXT PRIMARY KEY, sha256 TEXT NOT NULL)`).run();
  for (const topic of config.websub.allowedTopics ?? []) {
    const res = await env.ASSETS.fetch(new Request(topic));
    if (!res.ok) throw new Error(`dwk: topic ${topic} answered ${res.status}`);
    const hash = await sha256(await res.arrayBuffer());
    const row = await db.prepare(`SELECT sha256 FROM ${TABLE} WHERE topic = ?`).bind(topic).first<{ sha256: string }>();
    if (row?.sha256 === hash) continue;
    await notifyPublish(env, topic);
    await db
      .prepare(`INSERT INTO ${TABLE} (topic, sha256) VALUES (?, ?) ON CONFLICT (topic) DO UPDATE SET sha256 = excluded.sha256`)
      .bind(topic, hash)
      .run();
  }
}
