// The Solid-OIDC provider at /oidc (@dwk/solid-oidc) and the /pod that trusts
// it. The flow itself is the package's and tested there; this is the
// composition: discovery, CORS, the owner sign-in redirect, the WebID's
// issuer, and the pod accepting the provider's DPoP-bound tokens.
import { generateSigningJwk, importSigningKey, mintAccessToken, type Jwk } from "@dwk/solid-oidc";
import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import * as config from "../worker/config";

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const sha256 = async (text: string) => base64url(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
const segment = (value: unknown) => base64url(encoder.encode(JSON.stringify(value)));

/** A client's DPoP key: its RFC 7638 thumbprint and a proof signer. */
async function dpopKey() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const { kty, crv, x, y } = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const jwk = { kty, crv, x, y };
  return {
    jkt: await sha256(JSON.stringify({ crv, kty, x, y })),
    async proof(htm: string, htu: string, token: string) {
      const input = `${segment({ typ: "dpop+jwt", alg: "ES256", jwk })}.${segment({
        jti: crypto.randomUUID(),
        htm,
        htu,
        iat: Math.floor(Date.now() / 1000),
        ath: await sha256(token),
      })}`;
      const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, encoder.encode(input));
      return `${input}.${base64url(signature)}`;
    },
  };
}

async function accessToken(signingKey: Jwk, jkt: string) {
  const { token } = await mintAccessToken(await importSigningKey(signingKey), {
    issuer: config.oidc.issuer,
    webid: config.ownerWebId,
    clientId: "https://app.example/id",
    scope: "openid webid",
    jkt,
    audience: ["solid"],
    lifetimeSeconds: 300,
    now: Math.floor(Date.now() / 1000),
  });
  return token;
}

const put = async (url: string, token: string, key: Awaited<ReturnType<typeof dpopKey>>) =>
  SELF.fetch(url, {
    method: "PUT",
    headers: { authorization: `DPoP ${token}`, dpop: await key.proof("PUT", url, token), "content-type": "text/plain" },
    body: "hello from Solid-OIDC",
  });

describe("Solid-OIDC provider", () => {
  it("serves discovery at the site origin, readable cross-origin", async () => {
    const res = await SELF.fetch(config.oidc.discovery, { headers: { origin: "https://app.example" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toMatchObject({
      issuer: "https://dwk.io",
      authorization_endpoint: config.oidc.authorize,
      token_endpoint: config.oidc.token,
      jwks_uri: config.oidc.jwks,
    });
  });

  it("answers the token endpoint's CORS preflight", async () => {
    const res = await SELF.fetch(config.oidc.token, { method: "OPTIONS", headers: { origin: "https://app.example" } });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-headers")).toContain("DPoP");
  });

  it("publishes only the public half of its key", async () => {
    const { keys } = (await (await SELF.fetch(config.oidc.jwks)).json()) as { keys: Record<string, unknown>[] };
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256" });
    expect(keys[0]).not.toHaveProperty("d");
  });

  it("sends an authorization request to the owner sign-in", async () => {
    const url = new URL(config.oidc.authorize);
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: "https://app.example/id",
      redirect_uri: "https://app.example/callback",
      scope: "openid webid",
      state: "s",
      code_challenge: await sha256("verifier"),
      code_challenge_method: "S256",
    }).toString();
    const res = await SELF.fetch(url.toString(), { redirect: "manual" });
    expect(res.status).toBe(302);
    const login = new URL(res.headers.get("location")!);
    expect(`${login.origin}${login.pathname}`).toBe(config.auth.login);
    expect(login.searchParams.get("flow")).toBe("solid-oidc");
    expect(login.searchParams.get("login")).toBeTruthy();
  });

  it("is named as the issuer in the WebID profile", async () => {
    expect(await (await SELF.fetch("https://dwk.io/profile/card")).text()).toContain("solid:oidcIssuer <https://dwk.io>");
  });

  it("is not configured without its signing key", () => {
    expect(() => config.solidOidc({ ...env, OIDC_SIGNING_KEY: undefined })).toThrow(config.NotConfiguredError);
  });
});

describe("the pod trusts the provider", () => {
  it("accepts a write with the provider's DPoP-bound token", async () => {
    const key = await dpopKey();
    const token = await accessToken(JSON.parse(env.OIDC_SIGNING_KEY!) as Jwk, key.jkt);
    const url = `https://dwk.io/pod/oidc-${crypto.randomUUID()}.txt`;
    const res = await put(url, token, key);
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    expect(await (await SELF.fetch(url, { headers: { authorization: `DPoP ${token}`, dpop: await key.proof("GET", url, token) } })).text()).toBe(
      "hello from Solid-OIDC",
    );
  });

  it("refuses a token signed by any other key", async () => {
    const key = await dpopKey();
    const token = await accessToken(await generateSigningJwk(), key.jkt);
    const res = await put(`https://dwk.io/pod/oidc-${crypto.randomUUID()}.txt`, token, key);
    expect(res.status).toBe(401);
  });
});
