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
import { signLoginRequest, verifyConsent, type GrantRequest } from "./login";
import { isOwner } from "./owner";

export const logger = consoleLogger({ minLevel: "info" });

/**
 * Local part of the test identity's `acct:` handle and ActivityPub username.
 * `acct:dwk@dwk.io` stays delegated to the Mastodon account (see `webfinger`
 * below), so the self-hosted actor gets its own handle.
 */
export const USERNAME = "test";

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

const { handle, instance } = site.identity.webfinger;
const mastodonProfile = `https://${instance}/@${handle}`;
const mastodonActor = `https://${instance}/users/${handle}`;

// The owner's handle (`@dwk@dwk.io`) resolves to the Mastodon account on the
// instance, so it works from anywhere on the fediverse.
const ownerAccount: ResourceRecord = {
  aliases: [mastodonProfile, mastodonActor],
  links: [
    { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: mastodonProfile },
    { rel: "self", type: "application/activity+json", href: mastodonActor },
    { rel: "http://ostatus.org/schema/1.0/subscribe", template: `https://${instance}/authorize_interaction?uri={uri}` },
  ],
};

// The test identity: the self-hosted ActivityPub actor plus remoteStorage
// discovery for the `/storage/<USERNAME>` account.
const testAccount: ResourceRecord = {
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
    [`acct:${handle}@${host}`]: ownerAccount,
    [`acct:${handle}@${instance}`]: ownerAccount,
    [site.url]: ownerAccount,
    [me]: ownerAccount,
    [`acct:${USERNAME}@${host}`]: testAccount,
    [actorIri]: testAccount,
  },
  logger,
};

export const hostMeta: HostMetaConfig = { webfingerUrl: `${site.url}/.well-known/webfinger`, logger };

// ---------------------------------------------------------------------------
// Identity

/** Scopes the IndieAuth server issues: Micropub's plus Microsub's. */
const scopesSupported = ["profile", "email", "create", "update", "delete", "media", "read", "follow", "mute", "block", "channels"];

export function indieauth(env: Env): IndieAuthConfig {
  return {
    baseUrl: site.url,
    authorizationEndpoint: auth.authorize,
    tokenEndpoint: auth.token,
    revocationEndpoint: auth.revocation,
    scopesSupported,
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

export function micropub(env: Env): MicropubConfig {
  const publishToken = env.ACTIVITYPUB_PUBLISH_TOKEN;
  return {
    baseUrl: site.url,
    me,
    syndicateTo: [{ uid: FEDIVERSE_TARGET_UID, name: `@${USERNAME}@${host}` }],
    // Micropub → fediverse syndication rides the actor's owner publish
    // endpoint, so it is only on when that endpoint is (same token).
    ...(publishToken ? { fediverse: { publishUrl: `${actorIri}/publish`, publishToken } } : {}),
    logger,
  };
}

export const microsub: MicrosubConfig = { baseUrl: site.url, me, logger };

export const webmention: WebmentionConfig = { baseUrl: site.url, logger };

export const websub: WebSubConfig = {
  baseUrl: site.url,
  hubUrl: `${site.url}/websub`,
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
      name: `${schema.author.name} (test actor)`,
      summary: "Test actor for the self-hosted @dwk/workers composition on dwk.io.",
      icon: schema.author.image,
      url: me,
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
