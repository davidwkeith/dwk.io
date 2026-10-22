// Micropub and Microsub clients that can't do DPoP: the IndieAuth server issues
// them unbound Bearer tokens (worker/config.ts `bearerTokens`), and the
// resource servers accept those (`acceptBearerTokens`). The token endpoint
// itself is @dwk/indieauth's and tested there; this is the composition.
import { createIndieAuthStore, signAccessToken } from "@dwk/indieauth";
import { createMicropubStore } from "@dwk/micropub";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as config from "../worker/config";
import { resetD1 } from "./reset";

const MICROPUB = "https://dwk.io/micropub";

/** A token as the IndieAuth server mints it: unbound unless a `jkt` is given. */
async function mint(scope: string, jkt?: string) {
  const minted = await signAccessToken(env.TOKEN_SIGNING_KEY!, {
    issuer: "https://dwk.io",
    me: config.me,
    clientId: "https://quill.p3k.io/",
    scope,
    ...(jkt ? { jkt } : {}),
    lifetimeSeconds: 3600,
  });
  await createIndieAuthStore(env).recordToken({
    jti: minted.claims.jti,
    clientId: "https://quill.p3k.io/",
    me: config.me,
    scope,
    jkt: jkt ?? "",
    issuedAt: minted.claims.iat,
    expiresAt: minted.claims.exp,
  });
  return minted;
}

const post = (authorization: string) =>
  SELF.fetch(MICROPUB, {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify({ type: ["h-entry"], properties: { content: ["Posted with a Bearer token"] } }),
    redirect: "manual",
  });

beforeEach(async () => {
  await resetD1();
  await createIndieAuthStore(env).init();
  await createMicropubStore(env).init();
});

describe("Bearer tokens", () => {
  it("are issued for Micropub and Microsub scopes only, for at most an hour", () => {
    const { bearerTokens } = config.indieauth(env);
    expect(bearerTokens?.lifetimeSeconds).toBe(3600);
    expect(bearerTokens?.scopes).toEqual(["create", "update", "delete", "media", "read", "follow", "mute", "block", "channels"]);
    expect(config.micropub(env).acceptBearerTokens).toBe(true);
    expect(config.microsub.acceptBearerTokens).toBe(true);
  });

  it("let a client post through Micropub, and the post shows on the site", async () => {
    const { token } = await mint("create");
    const res = await post(`Bearer ${token}`);
    expect(res.status).toBe(201);
    const location = res.headers.get("location")!;
    expect(location).toMatch(/^https:\/\/dwk\.io\/posts\/[0-9a-z-]+$/);
    expect(await (await SELF.fetch(location)).text()).toContain("Posted with a Bearer token");
  });

  it("let Quill post, which sends the token in both the header and the form body", async () => {
    const { token } = await mint("create");
    const res = await SELF.fetch(MICROPUB, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      body: new URLSearchParams({ h: "entry", access_token: token, content: "Posted from Quill" }),
      redirect: "manual",
    });
    expect(res.status).toBe(201);
  });

  it("are refused under the DPoP scheme, and once revoked", async () => {
    const { token, claims } = await mint("create");
    expect((await post(`DPoP ${token}`)).status).toBe(401);
    await createIndieAuthStore(env).revokeToken(claims.jti);
    expect((await post(`Bearer ${token}`)).status).toBe(401);
  });

  it("don't stand in for a DPoP-bound token sent without its proof", async () => {
    const { token } = await mint("create", "some-key-thumbprint");
    expect((await post(`Bearer ${token}`)).status).toBe(401);
  });
});
