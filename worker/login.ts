// Owner login for @dwk/indieauth, the Mastodon-app OAuth server, and
// @dwk/solid-oidc. Each library leaves authentication to the
// site: their `approveAuthorization` hooks send the browser here, Cloudflare
// Access authenticates the owner, and an approval redirects back to the
// authorization endpoint with a short-lived signed consent token.
import type { AuthorizationRequest } from "@dwk/indieauth";

export interface LoginEnv {
  /** Signs consent and form tokens, domain-separated from access tokens. */
  readonly TOKEN_SIGNING_KEY: string;
  /** Zero Trust team domain, e.g. `example.cloudflareaccess.com`. */
  readonly ACCESS_TEAM_DOMAIN: string;
  /** Application Audience (AUD) tag of the Access app guarding the login path. */
  readonly ACCESS_AUD: string;
}

const TOKEN_TTL_SECONDS = 300;
// Long enough to finish the Access one-time-PIN email round trip.
const LOGIN_TTL_SECONDS = 900;
const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string) {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(key: string, fields: readonly string[]) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  // JSON keeps field boundaries unambiguous even if a value contains a newline.
  return base64url(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(JSON.stringify(fields))));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Tokens are `<expiry>.<hmac>`; the purpose is the first signed field so a
// form token can never be replayed as a consent token or vice versa.
async function signToken(key: string, purpose: string, fields: readonly string[], ttl = TOKEN_TTL_SECONDS) {
  const exp = String(Math.floor(Date.now() / 1000) + ttl);
  return `${exp}.${await hmac(key, [purpose, exp, ...fields])}`;
}

async function verifyToken(key: string, purpose: string, token: string, fields: readonly string[]) {
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return timingSafeEqual(sig, await hmac(key, [purpose, exp, ...fields]));
}

/** Which OAuth server the sign-in is for; each has its own authorize URL. */
export type Flow = "indieauth" | "mastodon" | "solid-oidc";
const FLOWS: readonly Flow[] = ["indieauth", "mastodon", "solid-oidc"];

export type GrantRequest = Pick<AuthorizationRequest, "clientId" | "redirectUri" | "state" | "codeChallenge" | "scopes" | "resources">;

// Everything the approval grants. Signing the scopes and resources (not just
// the request identity) stops a parameter edited after consent from widening
// it, and signing the flow stops a consent for one server approving the other.
function grantFields(req: GrantRequest, flow: Flow) {
  return [flow, req.clientId, req.redirectUri, req.state, req.codeChallenge, JSON.stringify(req.scopes), JSON.stringify(req.resources ?? [])];
}

/**
 * Signed by `approveAuthorization` when it sends the browser to log in. Only a
 * request @dwk/indieauth has already validated (redirect_uri allowed for the
 * client, PKCE present) carries one, so the login page never acts on, or
 * redirects to, parameters that skipped that check.
 */
export function signLoginRequest(env: LoginEnv, req: GrantRequest, flow: Flow) {
  return signToken(env.TOKEN_SIGNING_KEY, "dwk-login", grantFields(req, flow), LOGIN_TTL_SECONDS);
}

export function verifyConsent(env: LoginEnv, token: string, req: GrantRequest, flow: Flow) {
  return verifyToken(env.TOKEN_SIGNING_KEY, "dwk-consent", token, grantFields(req, flow));
}

function flowFromQuery(params: URLSearchParams): Flow {
  const flow = params.get("flow");
  return FLOWS.find((f) => f === flow) ?? "indieauth";
}

// Mirrors how each server parses the request, so the fields signed here match
// what its approval hook sees when the browser comes back. The Mastodon app
// flow has no PKCE challenge or resource indicators in its validated request,
// and the Solid-OIDC one no resource indicators.
function requestFromQuery(params: URLSearchParams, flow: Flow): GrantRequest {
  const indieauth = flow === "indieauth";
  return {
    clientId: params.get("client_id") ?? "",
    redirectUri: params.get("redirect_uri") ?? "",
    state: params.get("state") ?? "",
    codeChallenge: flow === "mastodon" ? "" : (params.get("code_challenge") ?? ""),
    scopes: (params.get("scope") ?? "").split(/\s+/).filter(Boolean),
    resources: indieauth ? [...new Set(params.getAll("resource"))] : [],
  };
}

interface Jwk { kid: string; kty: string; n: string; e: string }
let accessKeys: { team: string; fetchedAt: number; keys: Jwk[] } | undefined;

async function accessKey(team: string, kid: string) {
  const fresh = accessKeys?.team === team && Date.now() - accessKeys.fetchedAt < 3_600_000;
  if (!fresh || !accessKeys!.keys.some((k) => k.kid === kid)) {
    const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
    if (!res.ok) return undefined;
    accessKeys = { team, fetchedAt: Date.now(), keys: ((await res.json()) as { keys: Jwk[] }).keys };
  }
  return accessKeys!.keys.find((k) => k.kid === kid);
}

/** The verified email from the Access JWT, or `undefined` if there isn't a valid one. */
async function accessEmail(request: Request, env: LoginEnv) {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  const [header, payload, signature] = jwt?.split(".") ?? [];
  if (!header || !payload || !signature || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return undefined;
  try {
    const { alg, kid } = JSON.parse(new TextDecoder().decode(fromBase64url(header)));
    if (alg !== "RS256") return undefined;
    const jwk = await accessKey(env.ACCESS_TEAM_DOMAIN, kid);
    if (!jwk) return undefined;
    const key = await crypto.subtle.importKey(
      "jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, fromBase64url(signature), encoder.encode(`${header}.${payload}`),
    );
    if (!valid) return undefined;
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    const now = Date.now() / 1000;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}` || !audiences.includes(env.ACCESS_AUD)) return undefined;
    if (typeof claims.exp !== "number" || claims.exp < now || (claims.nbf && claims.nbf > now)) return undefined;
    return typeof claims.email === "string" ? claims.email : undefined;
  } catch {
    return undefined;
  }
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, body: string, status: number, formAction: string) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // form-action also governs the redirects after submit, so it has to
        // allow the client's redirect_uri origin as well as this site.
        "Content-Security-Policy": `default-src 'none'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`,
        "X-Content-Type-Options": "nosniff",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

/**
 * `GET /auth/login` renders the consent page; `POST /auth/login` approves or
 * denies. Both require a valid Access JWT for the owner's email.
 */
export interface Owner {
  /** Email Cloudflare Access must vouch for. */
  readonly email: string;
  /** Canonical profile URL the approval signs in as. */
  readonly me: string;
  /** WebID a Solid-OIDC approval signs in as. */
  readonly webid: string;
  /** Issuer identifier, sent as `iss` on denial redirects (RFC 9207). */
  readonly issuer: string;
}

export async function handleLogin(request: Request, env: LoginEnv, owner: Owner, authorizeUrls: Readonly<Record<Flow, string>>) {
  const email = await accessEmail(request, env);
  if (!email || email.toLowerCase() !== owner.email.toLowerCase()) {
    return page("Not authorized", "<h1>Not authorized</h1><p>Sign in through Cloudflare Access as the site owner.</p>", 403, "'none'");
  }

  if (request.method === "GET") {
    const query = new URL(request.url).search.slice(1);
    const params = new URLSearchParams(query);
    const flow = flowFromQuery(params);
    const req = requestFromQuery(params, flow);
    if (!(await verifyToken(env.TOKEN_SIGNING_KEY, "dwk-login", params.get("login") ?? "", grantFields(req, flow)))) {
      return page("Expired", "<h1>This request expired or is invalid</h1><p>Start the sign-in again from the app.</p>", 400, "'none'");
    }
    const redirectOrigin = new URL(req.redirectUri).origin;
    const formToken = await signToken(env.TOKEN_SIGNING_KEY, "dwk-login-form", [query]);
    const scopes = req.scopes.length
      ? `<ul>${req.scopes.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
      : "<p>No scopes: sign-in only.</p>";
    const resources = (req.resources ?? []).length
      ? `<p>For use at:</p><ul>${(req.resources ?? []).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
      : "";
    return page(
      "Approve sign-in",
      `<h1>Approve sign-in</h1>
<p><strong>${escapeHtml(req.clientId)}</strong> wants to sign you in as <strong>${escapeHtml(flow === "solid-oidc" ? owner.webid : owner.me)}</strong>.</p>
<p>Requested scopes:</p>${scopes}${resources}
<p>You'll be sent back to ${escapeHtml(req.redirectUri)}</p>
<p>Signed in through Cloudflare Access as ${escapeHtml(email)}.</p>
<form method="post">
<input type="hidden" name="query" value="${escapeHtml(query)}">
<input type="hidden" name="form_token" value="${escapeHtml(formToken)}">
<button name="action" value="approve">Approve</button>
<button name="action" value="deny">Deny</button>
</form>`,
      200,
      `'self' ${redirectOrigin}`,
    );
  }

  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });

  const form = await request.formData();
  const query = String(form.get("query") ?? "");
  if (!(await verifyToken(env.TOKEN_SIGNING_KEY, "dwk-login-form", String(form.get("form_token") ?? ""), [query]))) {
    return page("Expired", "<h1>This request expired</h1><p>Start the sign-in again from the app.</p>", 400, "'none'");
  }
  const params = new URLSearchParams(query);
  const flow = flowFromQuery(params);
  const req = requestFromQuery(params, flow);

  if (form.get("action") !== "approve") {
    const denied = new URL(req.redirectUri);
    denied.searchParams.set("error", "access_denied");
    denied.searchParams.set("state", req.state);
    denied.searchParams.set("iss", owner.issuer);
    return Response.redirect(denied.toString(), 303);
  }

  params.delete("login");
  params.delete("flow");
  params.set("consent", await signToken(env.TOKEN_SIGNING_KEY, "dwk-consent", grantFields(req, flow)));
  return Response.redirect(`${authorizeUrls[flow]}?${params}`, 303);
}
