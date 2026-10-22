// Token introspection (IndieAuth §6.1, RFC 7662) for resource servers off this
// site: served at /auth/introspect behind the INTROSPECTION_TOKEN bearer
// (vitest.config.ts sets a test value), and only when that secret is set. The
// endpoint itself is @dwk/indieauth's and tested there; this is the composition.
import { createIndieAuthStore, signAccessToken } from "@dwk/indieauth";
import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import * as config from "../worker/config";
import { resetD1 } from "./reset";

const INTROSPECT = "https://dwk.io/auth/introspect";

async function mint(scope: string) {
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
  return minted;
}

const introspect = (token: string, authorization?: string) =>
  SELF.fetch(INTROSPECT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...(authorization ? { authorization } : {}) },
    body: new URLSearchParams({ token }),
  });

beforeEach(async () => {
  await resetD1();
  await createIndieAuthStore(env).init();
});

describe("token introspection", () => {
  it("is advertised in the metadata, with the iss flag", async () => {
    const metadata = (await (await SELF.fetch("https://dwk.io/.well-known/oauth-authorization-server")).json()) as Record<string, unknown>;
    expect(metadata.introspection_endpoint).toBe(INTROSPECT);
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true);
  });

  it("refuses callers without the introspection bearer, including the owner's", async () => {
    const { token } = await mint("create");
    for (const authorization of [undefined, "Bearer wrong", `Bearer ${env.OWNER_TOKEN ?? "owner"}`]) {
      const res = await introspect(token, authorization);
      expect(res.status, authorization).toBe(401);
      expect(res.headers.get("www-authenticate")).toContain("Bearer");
    }
  });

  it("reports a live token, and an inactive one once revoked", async () => {
    const { token, claims } = await mint("create media");
    const auth = `Bearer ${env.INTROSPECTION_TOKEN}`;
    const res = await introspect(token, auth);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ active: true, me: config.me, client_id: "https://quill.p3k.io/", scope: "create media", token_type: "Bearer" });
    await createIndieAuthStore(env).revokeToken(claims.jti);
    expect(await (await introspect(token, auth)).json()).toEqual({ active: false });
    expect(await (await introspect("not-a-token", auth)).json()).toEqual({ active: false });
  });

  it("is neither served nor advertised without the secret", () => {
    const indieauth = config.indieauth({ ...env, INTROSPECTION_TOKEN: undefined });
    expect(indieauth.introspectionEndpoint).toBeUndefined();
    expect(indieauth.authorizeIntrospection).toBeUndefined();
  });
});
