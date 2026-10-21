// The Worker's `Env`: the union of every mounted @dwk package's binding
// fragment (spec/composition-contract.md in davidwkeith/workers), plus this
// site's own bindings, vars, and secrets. Expressed as an extends-chain so the
// compiler proves the fragments agree on shared bindings (AUTH_DB, BLOBS,
// GC_DB, TOKEN_SIGNING_KEY). `wrangler.jsonc` satisfies it.
import type { ActivityPubEnv } from "@dwk/activitypub";
import type { AtprotoPdsEnv } from "@dwk/atproto-pds";
import type { IndieAuthEnv } from "@dwk/indieauth";
import type { MastodonApiEnv } from "@dwk/mastodon-api";
import type { MicropubEnv } from "@dwk/micropub";
import type { MicrosubEnv } from "@dwk/microsub";
import type { RemoteStorageEnv } from "@dwk/remotestorage";
import type { SolidPodEnv } from "@dwk/solid-pod";
import type { VcEnv } from "@dwk/vc";
import type { WebAuthnEnv } from "@dwk/webauthn";
import type { WebmentionEnv, WebmentionHandler } from "@dwk/webmention";
import type { WebSubEnv } from "@dwk/websub";
import type { LoginEnv } from "./login";

// Minimal shape of the native Workers Rate Limiting binding; no published
// package exports this type, and the Workers runtime globals aren't loaded
// into this (Astro, DOM-lib) TypeScript project.
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** The Workers `ExecutionContext`, borrowed from a package handler signature. */
export type Ctx = Parameters<WebmentionHandler>[2];

export interface Env
  extends IndieAuthEnv,
    LoginEnv,
    WebmentionEnv,
    MicropubEnv,
    MicrosubEnv,
    WebSubEnv,
    ActivityPubEnv,
    MastodonApiEnv,
    RemoteStorageEnv,
    SolidPodEnv,
    WebAuthnEnv,
    VcEnv,
    AtprotoPdsEnv {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
  readonly WEBMENTION_RATE_LIMITER: RateLimiter;
  /** Always bound here; narrows the pod packages' optional `GC_DB`. */
  readonly GC_DB: NonNullable<SolidPodEnv["GC_DB"]>;

  // Secrets. Every one of these is optional at the type level so a missing
  // secret disables the mounts that need it (they answer 503) instead of
  // taking the whole site down — see `worker/mounts.ts`.

  /**
   * Shared-secret bearer that acts as the site owner on the test surfaces:
   * `/admin/init`, `/webmention/send`, the Solid pods (`/pod`, `/dav`,
   * `/dav-credentials`), remoteStorage writes, WebAuthn registration, and VC
   * issuance. Interim until those packages authenticate via Solid-OIDC.
   */
  readonly OWNER_TOKEN?: string;
  /** ActivityPub actor keypair (PEM; the private half signs deliveries). */
  readonly ACTIVITYPUB_PUBLIC_KEY_PEM?: string;
  readonly ACTIVITYPUB_PRIVATE_KEY_PEM?: string;
  /** Bearer for the actor's owner publish endpoints; also wires Micropub → fediverse syndication. */
  readonly ACTIVITYPUB_PUBLISH_TOKEN?: string;
  /** AT Protocol session credentials. */
  readonly ATPROTO_PASSWORD?: string;
  readonly ATPROTO_JWT_SECRET?: string;
}
