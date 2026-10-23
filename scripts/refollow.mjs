#!/usr/bin/env node
// Re-follow, from the self-hosted actor, every account in a Mastodon
// "Follows" export (Preferences → Import and export → Data export →
// following_accounts.csv). A Mastodon `Move` carries followers over but not
// the accounts the old account follows, so this replays them: each handle is
// resolved to its actor IRI with WebFinger and a `Follow` is posted to the
// actor's outbox (`@dwk/activitypub` owner publish, bearer
// ACTIVITYPUB_PUBLISH_TOKEN). Accounts already in /users/dwk/following
// (accepted follows) are skipped, so a rerun only retries what's left.
//
//   ACTIVITYPUB_PUBLISH_TOKEN=… node scripts/refollow.mjs following_accounts.csv [--dry-run]
//
// Options: --actor <iri> (default https://dwk.io/users/dwk), --delay <ms>
// between follows (default 1000), --dry-run (resolve and report, post nothing),
// --lookup <origin> (default https://xn--4t8h.dwk.io, the old instance): when a
// handle's own WebFinger fails (a domain that once delegated it and no longer
// does), ask that Mastodon instance's public lookup API for the account's IRI.

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    actor: { type: "string", default: "https://dwk.io/users/dwk" },
    delay: { type: "string", default: "1000" },
    "dry-run": { type: "boolean", default: false },
    lookup: { type: "string", default: "https://xn--4t8h.dwk.io" },
  },
});

const [csvPath] = positionals;
const token = process.env.ACTIVITYPUB_PUBLISH_TOKEN;
const dryRun = values["dry-run"];
if (!csvPath || (!token && !dryRun)) {
  console.error("usage: ACTIVITYPUB_PUBLISH_TOKEN=… node scripts/refollow.mjs <following_accounts.csv> [--dry-run] [--actor <iri>] [--delay <ms>]");
  process.exit(2);
}

const actor = values.actor.replace(/\/$/, "");
const ownHost = new URL(actor).host;
const delayMs = Number(values.delay);
const AS2 = "application/activity+json";

/** The `Account address` column (first field) of each data row, as `user@host`. */
function handlesFrom(csv) {
  const rows = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = rows[0]?.toLowerCase() ?? "";
  const body = header.startsWith("account address") ? rows.slice(1) : rows;
  return body.map((line) => line.split(",")[0].trim().replace(/^"|"$/g, "").replace(/^@/, "")).filter((h) => /^[^@\s]+@[^@\s]+$/.test(h));
}

/** The actor IRIs this actor already follows (accepted), across every page. */
async function alreadyFollowing() {
  const seen = new Set();
  for (let page = 1; ; page++) {
    const res = await fetch(`${actor}/following?page=${page}`, { headers: { accept: AS2 } });
    if (!res.ok) throw new Error(`GET ${actor}/following?page=${page}: HTTP ${res.status}`);
    const items = (await res.json()).orderedItems ?? [];
    if (items.length === 0) return seen;
    for (const item of items) seen.add(typeof item === "string" ? item : item.id);
  }
}

/**
 * Resolve `user@host` to its actor IRI: WebFinger first, then the `--lookup`
 * instance's record of the account. Throws with both reasons if neither works.
 */
async function resolve(handle) {
  try {
    return await webfinger(handle);
  } catch (error) {
    if (!values.lookup) throw error;
    const url = new URL("/api/v1/accounts/lookup", values.lookup);
    url.searchParams.set("acct", handle);
    const res = await fetch(url, { headers: { accept: "application/json" } });
    const uri = res.ok ? (await res.json()).uri : undefined;
    if (typeof uri !== "string") throw new Error(`${error.message}; ${url.host} lookup HTTP ${res.status}`);
    return uri;
  }
}

/** Resolve `user@host` to its ActivityPub actor IRI via WebFinger, or throw. */
async function webfinger(handle) {
  const host = handle.slice(handle.lastIndexOf("@") + 1);
  const url = new URL(`https://${host}/.well-known/webfinger`);
  url.searchParams.set("resource", `acct:${handle}`);
  const res = await fetch(url, { headers: { accept: "application/jrd+json, application/json" } });
  if (!res.ok) throw new Error(`WebFinger HTTP ${res.status}`);
  const self = ((await res.json()).links ?? []).find(
    (link) => link.rel === "self" && /activity\+json|ld\+json/.test(link.type ?? "") && link.href,
  );
  if (!self) throw new Error("WebFinger has no ActivityPub self link");
  return self.href;
}

async function follow(iri) {
  const res = await fetch(`${actor}/outbox`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": AS2 },
    body: JSON.stringify({ type: "Follow", object: iri }),
  });
  if (!res.ok) throw new Error(`outbox HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const handles = [...new Set(handlesFrom(await readFile(csvPath, "utf8")))];
const following = await alreadyFollowing();
const counts = { followed: 0, skipped: 0, failed: 0 };
console.log(`${handles.length} accounts in ${csvPath}; ${following.size} already followed by ${actor}${dryRun ? " (dry run)" : ""}`);

for (const handle of handles) {
  if (handle.endsWith(`@${ownHost}`)) {
    console.log(`skip    ${handle} (this site)`);
    counts.skipped++;
    continue;
  }
  try {
    const iri = await resolve(handle);
    if (following.has(iri)) {
      console.log(`skip    ${handle} (already following)`);
      counts.skipped++;
      continue;
    }
    if (!dryRun) {
      await follow(iri);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    console.log(`${dryRun ? "would" : "follow"}  ${handle} → ${iri}`);
    counts.followed++;
  } catch (error) {
    console.error(`FAIL    ${handle}: ${error.message}`);
    counts.failed++;
  }
}

console.log(`${dryRun ? "would follow" : "followed"} ${counts.followed}, skipped ${counts.skipped}, failed ${counts.failed}`);
if (!dryRun && counts.followed > 0) {
  console.log(`Follows are pending until each server Accepts; rerun later to retry any that never land in ${actor}/following.`);
}
process.exitCode = counts.failed > 0 ? 1 : 0;
