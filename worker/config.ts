// Each mounted @dwk package's config, built from `site.ts` and the Worker's
// bindings (no package reads env directly — spec/composition-contract.md in
// davidwkeith/workers). One function per package, so a missing secret only
// disables the mount that needs it (see `worker/mounts.ts`).
import type { ActivityPubConfig } from "@dwk/activitypub";
import type { AtprotoPdsConfig } from "@dwk/atproto-pds";
import type { HostMetaConfig } from "@dwk/host-meta";
import type { IndieAuthConfig } from "@dwk/indieauth";
import { consoleLogger } from "@dwk/log";
import type { MastodonApiConfig } from "@dwk/mastodon-api";
import { FEDIVERSE_TARGET_UID, type MicropubConfig } from "@dwk/micropub";
import type { MicrosubConfig } from "@dwk/microsub";
import { parseScopes, remoteStorageLink, type RemoteStorageConfig } from "@dwk/remotestorage";
import type { SolidPodConfig } from "@dwk/solid-pod";
import type { VcConfig } from "@dwk/vc";
import type { WebAuthnConfig } from "@dwk/webauthn";
import type { ResourceRecord, WebfingerConfig } from "@dwk/webfinger";
import type { WebmentionConfig } from "@dwk/webmention";
import type { WebSubConfig } from "@dwk/websub";
import { schema } from "../src/data/schema";
import { site } from "../src/data/site";
import type { Env } from "./env";
import { generatePostUrl } from "./posts";
import { signLoginRequest, verifyConsent, type GrantRequest } from "./login";
import { hasBearer, isOwner } from "./owner";

export const logger = consoleLogger({ minLevel: "info" });

/**
 * Local part of the owner's `acct:` handle (`@dwk@dwk.io`) and the self-hosted
 * ActivityPub actor's username.
 */
export const USERNAME = site.identity.fediverse.handle;

export const host = new URL(site.url).host;
/** The owner's IndieAuth profile URL. */
export const me = `${site.url}/`;
/** The owner's WebID (owner of the Solid pods); served from `/profile/card`. */
export const ownerWebId = `${site.url}/profile/card#me`;
export const owner = { email: site.social.email.replace(/^mailto:/, ""), me, issuer: site.url };

export const auth = {
  authorize: `${site.url}/auth/authorize`,
  token: `${site.url}/auth/token`,
  revocation: `${site.url}/auth/revocation`,
  introspection: `${site.url}/auth/introspect`,
  login: `${site.url}/auth/login`,
  /** Mastodon-app OAuth (served by @dwk/mastodon-api). */
  mastodonAuthorize: `${site.url}/oauth/authorize`,
};

export const actorIri = `${site.url}/users/${USERNAME}`;

/** Thrown when a mount's required secret is unset; the mount answers 503. */
export class NotConfiguredError extends Error {
  constructor(readonly binding: string) {
    super(`missing secret ${binding}`);
    this.name = "NotConfiguredError";
  }
}

function requireSecret<K extends keyof Env & string>(env: Env, name: K): NonNullable<Env[K]> {
  const value = env[name];
  if (value === undefined || value === null || value === "") throw new NotConfiguredError(name);
  return value as NonNullable<Env[K]>;
}

// ---------------------------------------------------------------------------
// Discovery

// The owner's handle (`@dwk@dwk.io`): the self-hosted ActivityPub actor plus
// remoteStorage discovery for the `/storage/<USERNAME>` account. The site's
// URLs resolve to it too, so IndieWeb profiles discover the actor.
const ownerAccount: ResourceRecord = {
  subject: `acct:${USERNAME}@${host}`,
  aliases: [actorIri],
  links: [
    { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: me },
    { rel: "self", type: "application/activity+json", href: actorIri },
    remoteStorageLink({ storageRoot: `${site.url}/storage/${USERNAME}`, authEndpoint: auth.authorize }),
  ],
};

export const webfinger: WebfingerConfig = {
  resources: {
    [`acct:${USERNAME}@${host}`]: ownerAccount,
    [actorIri]: ownerAccount,
    [site.url]: ownerAccount,
    [me]: ownerAccount,
  },
  logger,
};

export const hostMeta: HostMetaConfig = { webfingerUrl: `${site.url}/.well-known/webfinger`, logger };

// ---------------------------------------------------------------------------
// Identity

/** Scopes the IndieAuth server issues: Micropub's plus Microsub's. */
const scopesSupported = ["profile", "email", "create", "update", "delete", "media", "read", "follow", "mute", "block", "channels"];

/**
 * Most Micropub and Microsub clients can't do DPoP, so a token request without
 * a proof gets an unbound Bearer token, carrying only these resource scopes;
 * one with a proof is still DPoP-bound. Clients like Quill never refresh, so
 * tokens live 30 days (revocable at /auth/revocation; the Bearer lifetime may
 * not exceed the access-token one).
 */
const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const bearerTokens = { lifetimeSeconds: TOKEN_LIFETIME_SECONDS, scopes: scopesSupported.filter((s) => s !== "profile" && s !== "email") };

export function indieauth(env: Env): IndieAuthConfig {
  return {
    baseUrl: site.url,
    authorizationEndpoint: auth.authorize,
    tokenEndpoint: auth.token,
    revocationEndpoint: auth.revocation,
    scopesSupported,
    accessTokenLifetimeSeconds: TOKEN_LIFETIME_SECONDS,
    bearerTokens,
    // Token introspection (IndieAuth §6.1) for resource servers elsewhere, which
    // authenticate with the INTROSPECTION_TOKEN bearer. Served and advertised
    // only when that secret is set.
    ...(env.INTROSPECTION_TOKEN
      ? { introspectionEndpoint: auth.introspection, authorizeIntrospection: (req: Request) => hasBearer(req, env.INTROSPECTION_TOKEN) }
      : {}),
    // Only issue tokens for resource servers on this site.
    resourceIndicatorPolicy: (resource) => new URL(resource).origin === site.url,
    // The owner signs in at /auth/login behind Cloudflare Access (worker/login.ts);
    // the approval comes back as a signed consent token.
    async approveAuthorization(req, httpRequest) {
      const url = new URL(httpRequest.url);
      const consent = url.searchParams.get("consent");
      if (consent && (await verifyConsent(env, consent, req, "indieauth"))) {
        return {
          me,
          scopes: req.scopes,
          profile: {
            name: schema.author.name,
            url: me,
            photo: schema.author.image,
            ...(req.scopes.includes("email") ? { email: owner.email } : {}),
          },
        };
      }
      url.searchParams.delete("consent");
      url.searchParams.set("flow", "indieauth");
      url.searchParams.set("login", await signLoginRequest(env, req, "indieauth"));
      return Response.redirect(`${auth.login}${url.search}`, 302);
    },
    logger,
  };
}

// ---------------------------------------------------------------------------
// IndieWeb publishing and reading

/**
 * `siteFetch` carries the syndication request to the actor's publish endpoint
 * (worker/mounts.ts): a Worker on a Custom Domain can't `fetch` its own
 * hostname (Cloudflare answers 522), so it never goes over the network.
 */
export function micropub(env: Env, siteFetch?: typeof fetch): MicropubConfig {
  const publishToken = env.ACTIVITYPUB_PUBLISH_TOKEN;
  return {
    baseUrl: site.url,
    me,
    generatePostUrl,
    // Accept the IndieAuth server's Bearer tokens (`bearerTokens` above).
    acceptBearerTokens: true,
    syndicateTo: [{ uid: FEDIVERSE_TARGET_UID, name: `@${USERNAME}@${host}` }],
    // Micropub → fediverse syndication rides the actor's owner publish
    // endpoint, so it is only on when that endpoint is (same token).
    ...(publishToken
      ? { fediverse: { publishUrl: `${actorIri}/publish`, publishToken, ...(siteFetch ? { fetch: siteFetch } : {}) } }
      : {}),
    logger,
  };
}

export const microsub: MicrosubConfig = { baseUrl: site.url, me, acceptBearerTokens: true, logger };

export const webmention: WebmentionConfig = { baseUrl: site.url, logger };

export const websub: WebSubConfig = {
  baseUrl: site.url,
  hubUrl: site.hub,
  // The site's feeds are the topics this hub distributes.
  allowedTopics: [me, `${site.url}/feed.xml`, `${site.url}/feed.json`],
  logger,
};

// ---------------------------------------------------------------------------
// Fediverse

export function activitypub(env: Env): ActivityPubConfig {
  return {
    baseUrl: site.url,
    actor: {
      username: USERNAME,
      name: schema.author.name,
      summary: site.identity.fediverse.bio,
      icon: schema.author.image,
      url: me,
      discoverable: true,
      // The Mastodon account this actor is the `Move` target of.
      alsoKnownAs: site.identity.fediverse.alsoKnownAs,
    },
    publicKeyPem: requireSecret(env, "ACTIVITYPUB_PUBLIC_KEY_PEM"),
    privateKeyPem: env.ACTIVITYPUB_PRIVATE_KEY_PEM,
    publishToken: env.ACTIVITYPUB_PUBLISH_TOKEN,
    logger,
  };
}

export function mastodonApi(env: Env): Omit<MastodonApiConfig, "backend"> {
  return {
    baseUrl: site.url,
    instance: { title: site.title, description: site.description, contactEmail: owner.email, languages: [site.language] },
    account: {
      username: USERNAME,
      displayName: schema.author.name,
      note: site.identity.fediverse.bio,
      url: me,
      avatar: schema.author.image,
      // First deploy of this composition; without it clients render the epoch.
      createdAt: "2026-10-21T00:00:00.000Z",
    },
    // Same Access-guarded login as IndieAuth, under its own flow name so a
    // consent token from one flow can never approve the other.
    async approveAuthorization(req, httpRequest) {
      const url = new URL(httpRequest.url);
      const grant: GrantRequest = {
        clientId: req.clientId,
        redirectUri: req.redirectUri,
        state: req.state ?? "",
        codeChallenge: "",
        scopes: req.scopes,
        resources: [],
      };
      const consent = url.searchParams.get("consent");
      if (consent && (await verifyConsent(env, consent, grant, "mastodon"))) return { approved: true };
      url.searchParams.delete("consent");
      url.searchParams.set("flow", "mastodon");
      url.searchParams.set("login", await signLoginRequest(env, grant, "mastodon"));
      return Response.redirect(`${auth.login}${url.search}`, 302);
    },
  };
}

// ---------------------------------------------------------------------------
// Storage: Solid pods, remoteStorage, WebDAV

/**
 * Interim owner authentication for the pods: the OWNER_TOKEN bearer resolves
 * to the owner WebID. Replaced by Solid-OIDC once that package is composed in.
 */
function podAuthenticate(env: Env): SolidPodConfig["authenticate"] {
  return async (request) =>
    (await isOwner(env, request)) ? { webid: ownerWebId, jti: crypto.randomUUID(), jkt: "dwk-owner" } : null;
}

export function solidPod(env: Env): SolidPodConfig {
  return { baseUrl: `${site.url}/pod`, owner: ownerWebId, authenticate: podAuthenticate(env), logger };
}

// The WebDAV door gets its own pod: the per-pod Durable Object is keyed by
// baseUrl, and mounting both doors on one pod needs verb-based dispatch.
export function davPod(env: Env): SolidPodConfig {
  return { baseUrl: `${site.url}/dav`, owner: ownerWebId, authenticate: podAuthenticate(env), logger };
}

export function remotestorage(env: Env): RemoteStorageConfig {
  return {
    baseUrl: site.url,
    parsePath: (pathname) => {
      const match = /^\/storage\/([^/]+)(\/.*)?$/.exec(pathname);
      if (!match || match[1] === undefined) return null;
      return { account: decodeURIComponent(match[1]), path: match[2] ?? "/" };
    },
    // The OWNER_TOKEN bearer gets read-write on every module; anything else is
    // anonymous (public document reads only).
    authenticate: async (request) =>
      (await isOwner(env, request)) ? { scopes: parseScopes("*:rw"), subject: ownerWebId } : null,
    logger,
  };
}

// ---------------------------------------------------------------------------
// Credentials: passkeys, Verifiable Credentials, AT Protocol

export function webauthn(env: Env): WebAuthnConfig {
  return {
    rpId: host,
    rpName: site.title,
    origin: site.url,
    // Registration binds a passkey to a caller-supplied user id, so only the
    // owner may register; authentication ceremonies are open by design.
    authorize: async (operation, request) => operation.startsWith("authenticate/") || (await isOwner(env, request)),
    logger,
  };
}

export function vc(env: Env): VcConfig {
  return {
    baseUrl: site.url,
    status: { enabled: true },
    // Issuance and status updates are owner-only; verification is public.
    authorize: (_operation, request) => isOwner(env, request),
    logger,
  };
}

// did:web:dwk.io resolves to the static /.well-known/did.json (the site's
// LinkedDomains document) and /.well-known/atproto-did stays the real
// Bluesky did:plc, so this PDS is reachable at /xrpc/* for testing only.
export function atproto(env: Env): AtprotoPdsConfig {
  return {
    baseUrl: site.url,
    password: env.ATPROTO_PASSWORD,
    jwtSecret: env.ATPROTO_JWT_SECRET,
    logger,
  };
}
