// Micropub → fediverse syndication: a post with `mp-syndicate-to` reaches the
// ActivityPub actor's outbox through the publish endpoint, dispatched
// in-process (worker/mounts.ts `siteFetch`), since on its Custom Domain the
// Worker can't fetch its own hostname. The actor's secrets are test-only.
import { createIndieAuthStore, signAccessToken } from "@dwk/indieauth";
import { createMicropub, createMicropubStore, FEDIVERSE_TARGET_UID } from "@dwk/micropub";
import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as config from "../worker/config";
import type { Ctx, Env } from "../worker/env";
import { siteFetch } from "../worker/mounts";
import { resetD1 } from "./reset";

function pem(label: string, der: ArrayBuffer) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(der)));
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END ${label}-----\n`;
}

async function actorEnv(): Promise<Env> {
  const keys = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  return {
    ...env,
    ACTIVITYPUB_PUBLISH_TOKEN: "test-publish-token",
    ACTIVITYPUB_PUBLIC_KEY_PEM: pem("PUBLIC KEY", (await crypto.subtle.exportKey("spki", keys.publicKey)) as ArrayBuffer),
    ACTIVITYPUB_PRIVATE_KEY_PEM: pem("PRIVATE KEY", (await crypto.subtle.exportKey("pkcs8", keys.privateKey)) as ArrayBuffer),
  };
}

async function bearer(scope: string) {
  const minted = await signAccessToken(env.TOKEN_SIGNING_KEY!, {
    issuer: "https://dwk.io",
    me: config.me,
    clientId: "https://quill.p3k.io/",
    scope,
    lifetimeSeconds: 3600,
  });
  await createIndieAuthStore(env).recordToken({
    jti: minted.claims.jti,
    clientId: "https://quill.p3k.io/",
    me: config.me,
    scope,
    jkt: "",
    issuedAt: minted.claims.iat,
    expiresAt: minted.claims.exp,
  });
  return minted.token;
}

beforeEach(async () => {
  await resetD1();
  await createIndieAuthStore(env).init();
  await createMicropubStore(env).init();
});

afterEach(() => vi.restoreAllMocks());

describe("Micropub → fediverse syndication", () => {
  it("publishes the post to the actor's outbox without fetching dwk.io over the network", async () => {
    const apEnv = await actorEnv();
    const networkFetch = vi.spyOn(globalThis, "fetch");
    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as Ctx;
    const micropub = createMicropub(config.micropub(apEnv, siteFetch(apEnv)));

    const res = await micropub(
      new Request("https://dwk.io/micropub", {
        method: "POST",
        headers: { authorization: `Bearer ${await bearer("create")}` },
        body: new URLSearchParams({ h: "entry", content: "Hello, fediverse", "mp-syndicate-to": FEDIVERSE_TARGET_UID }),
      }),
      apEnv,
      ctx,
    );
    expect(res.status).toBe(201);
    await Promise.all(pending);

    const outbox = await siteFetch(apEnv)("https://dwk.io/users/dwk/outbox", { headers: { accept: "application/activity+json" } });
    expect(((await outbox.json()) as { totalItems: number }).totalItems).toBe(1);

    // The post records its fediverse copy (u-syndication), and the copy
    // dereferences, linking back to the post.
    const permalink = res.headers.get("location")!;
    const post = await createMicropubStore(apEnv).getPost(permalink);
    const [copy] = (post?.properties.syndication ?? []) as string[];
    expect(copy).toMatch(/^https:\/\/dwk\.io\/users\/dwk\/outbox\/[0-9a-f-]+\/object$/);
    const note = await siteFetch(apEnv)(copy!, { headers: { accept: "application/activity+json" } });
    expect(await note.json()).toMatchObject({ id: copy, type: "Note", url: permalink });
    // A browser following the u-syndication link lands back on the post.
    const browser = await siteFetch(apEnv)(copy!, { headers: { accept: "text/html" }, redirect: "manual" });
    expect(browser.status).toBe(302);
    expect(browser.headers.get("location")).toBe(permalink);
    expect(await (await siteFetch(apEnv)(permalink)).text()).toContain(`class="u-syndication" rel="syndication" href="${copy}">Fediverse</a>`);
    const toSelf = networkFetch.mock.calls.filter(([input]) => new URL(input instanceof Request ? input.url : String(input)).origin === "https://dwk.io");
    expect(toSelf).toEqual([]);
  });

  it("serves the site's own feeds in-process, as the WebSub hub fetches them", async () => {
    const networkFetch = vi.spyOn(globalThis, "fetch");
    const res = await siteFetch(env)("https://dwk.io/feed.xml");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<feed");
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("leaves other sites to an ordinary fetch", async () => {
    const networkFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    await siteFetch(env)("https://example.com/");
    expect(networkFetch).toHaveBeenCalledOnce();
  });
});
