#!/usr/bin/env node
// Re-follow, from the self-hosted actor, every account in a Mastodon
// "Follows" export (Preferences → Import and export → Data export →
// following_accounts.csv). A Mastodon `Move` carries followers over but not
// the accounts the old account follows, so this replays them: each handle is
// resolved to its actor IRI with WebFinger and a `Follow` is posted to the
// actor's outbox (`@dwk/activitypub` owner publish, bearer
// ACTIVITYPUB_PUBLISH_TOKEN).
//
//   ACTIVITYPUB_PUBLISH_TOKEN=… node scripts/refollow.mjs following_accounts.csv [--dry-run]
//
// Skipped: accounts already in /users/dwk/following (accepted), and accounts
// a previous run already sent a Follow to (recorded in the --state file),
// whose Accept may still be on its way; the actor retries their delivery
// itself. --resend posts those again, for follows that never landed.
//
// Options: --actor <iri> (default https://dwk.io/users/dwk), --delay <ms>
// between follows (default 1000), --dry-run (resolve and report, post nothing),
// --state <file> (default <csv>.sent.json), --resend, --lookup <origin>
// (default https://xn--4t8h.dwk.io, the old instance): when a handle's own
// WebFinger fails (a domain that once delegated it and no longer does), ask
// that Mastodon instance's public lookup API for the account's IRI.

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    actor: { type: "string", default: "https://dwk.io/users/dwk" },
    delay: { type: "string", default: "1000" },
    "dry-run": { type: "boolean", default: false },
    lookup: { type: "string", default: "https://xn--4t8h.dwk.io" },
    state: { type: "string" },
    resend: { type: "boolean", default: false },
  },
});

const [csvPath] = positionals;
const token = process.env.ACTIVITYPUB_PUBLISH_TOKEN;
const dryRun = values["dry-run"];
const delayMs = Number(values.delay);
if (!csvPath || (!token && !dryRun) || !Number.isFinite(delayMs) || delayMs < 0) {
  console.error(
    "usage: ACTIVITYPUB_PUBLISH_TOKEN=… node scripts/refollow.mjs <following_accounts.csv> [--dry-run] [--resend] [--actor <iri>] [--delay <ms>] [--state <file>] [--lookup <origin>]",
  );
  process.exit(2);
}

const actor = values.actor.replace(/\/$/, "");
const ownHost = new URL(actor).host;
const statePath = values.state ?? `${csvPath}.sent.json`;
const AS2 = "application/activity+json";
/** Every request gets a deadline, so one hung server can't stall the run. */
const timeout = () => AbortSignal.timeout(10_000);

/** The `Account address` column (first field) of each data row, as `user@host`. */
function handlesFrom(csv) {
  const rows = csv.split(/\r?\n/).filter((line) => line.trim() !== "");
  const header = rows[0]?.toLowerCase() ?? "";
  const body = header.startsWith("account address") ? rows.slice(1) : rows;
  return body.map((line) => line.split(",")[0].trim().replace(/^"|"$/g, "").replace(/^@/, "")).filter((h) => /^[^@\s]+@[^@\s]+$/.test(h));
}

/** An absolute `https:` IRI, or throw: never post a Follow at anything else. */
function httpsIri(value, source) {
  if (typeof value !== "string" || !URL.canParse(value) || new URL(value).protocol !== "https:") {
    throw new Error(`${source} gave no https: actor IRI`);
  }
  return value;
}

/**
 * The actor IRIs this actor already follows (accepted), across every page.
 * Stops at an empty page, or at one that adds nothing new, in case the server
 * ignores `page` and keeps serving the same items.
 */
async function alreadyFollowing() {
  const seen = new Set();
  for (let page = 1; ; page++) {
    const res = await fetch(`${actor}/following?page=${page}`, { headers: { accept: AS2 }, signal: timeout() });
    if (!res.ok) throw new Error(`GET ${actor}/following?page=${page}: HTTP ${res.status}`);
    const before = seen.size;
    for (const item of (await res.json()).orderedItems ?? []) seen.add(typeof item === "string" ? item : item.id);
    if (seen.size === before) return seen;
  }
}

/** IRIs a previous run posted a Follow to (`--state`); empty when there's no file yet. */
async function readState() {
  try {
    return new Set(JSON.parse(await readFile(statePath, "utf8")));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
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
    let res;
    try {
      res = await fetch(url, { headers: { accept: "application/json" }, signal: timeout() });
    } catch (lookupError) {
      throw new Error(`${error.message}; ${url.host} lookup: ${lookupError.message}`);
    }
    if (!res.ok) throw new Error(`${error.message}; ${url.host} lookup HTTP ${res.status}`);
    return httpsIri((await res.json()).uri, `${error.message}; ${url.host} lookup`);
  }
}

/** Resolve `user@host` to its ActivityPub actor IRI via WebFinger, or throw. */
async function webfinger(handle) {
  const host = handle.slice(handle.lastIndexOf("@") + 1);
  const url = new URL(`https://${host}/.well-known/webfinger`);
  url.searchParams.set("resource", `acct:${handle}`);
  const res = await fetch(url, { headers: { accept: "application/jrd+json, application/json" }, signal: timeout() });
  if (!res.ok) throw new Error(`WebFinger HTTP ${res.status}`);
  const self = ((await res.json()).links ?? []).find(
    (link) => link.rel === "self" && /activity\+json|ld\+json/.test(link.type ?? "") && link.href,
  );
  if (!self) throw new Error("WebFinger has no ActivityPub self link");
  return httpsIri(self.href, "WebFinger");
}

async function follow(iri) {
  const res = await fetch(`${actor}/outbox`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": AS2 },
    body: JSON.stringify({ type: "Follow", object: iri }),
    signal: timeout(),
  });
  if (!res.ok) throw new Error(`outbox HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

const handles = [...new Set(handlesFrom(await readFile(csvPath, "utf8")))];
const following = await alreadyFollowing();
const sent = await readState();
const counts = { followed: 0, skipped: 0, failed: 0 };
console.log(
  `${handles.length} accounts in ${csvPath}; ${following.size} already followed by ${actor}, ${sent.size} sent before (${statePath})${dryRun ? " (dry run)" : ""}`,
);

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
    if (sent.has(iri) && !values.resend) {
      console.log(`skip    ${handle} (sent before, awaiting Accept; --resend to post again)`);
      counts.skipped++;
      continue;
    }
    if (!dryRun) {
      await follow(iri);
      sent.add(iri);
      // Saved after every post, so an interrupted run never re-sends.
      await writeFile(statePath, `${JSON.stringify([...sent], null, 2)}\n`);
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
  console.log(
    `Follows stay pending until each server Accepts; the actor retries delivery itself. Rerun later to see which landed in ${actor}/following, and with --resend to post the rest again.`,
  );
}
process.exitCode = counts.failed > 0 ? 1 : 0;
