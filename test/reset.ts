import { env } from "cloudflare:test";

/**
 * Drop the tables the site's own code reads and writes. Local D1 outlives a
 * single test here, and each store recreates its table on first use.
 */
export async function resetD1() {
  await env.MICROPUB_DB.prepare("DROP TABLE IF EXISTS posts").run();
  await env.WEBMENTION_INBOX!.prepare("DROP TABLE IF EXISTS webmentions").run();
  await env.WEBMENTION_INBOX!.prepare("DROP TABLE IF EXISTS webmentions_sent").run();
  await env.MICROPUB_DB.prepare("DROP TABLE IF EXISTS dwk_webmention_outbox").run();
  await env.WEBSUB_DB.prepare("DROP TABLE IF EXISTS dwk_websub_published").run();
}
