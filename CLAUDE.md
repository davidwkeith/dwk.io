# dwk.io

Personal portfolio/project showcase website.

## Commands

- `npm run dev` — Astro dev server with live reload
- `npm run build` — Production build (outputs to `dist/`), including SRI hashing and security.txt signing
- `npm run check` — TypeScript check
- `npm run preview` — Preview production build locally
- `npm run deploy` — Build and deploy to the `dwk` Cloudflare Worker (static assets)

## Architecture

**Astro config:** `astro.config.ts` — static output, sitemap integration. Source in `src/`, output to `dist/`.

**Content pipeline:**

1. Astro content collections with `glob` loader for projects (`src/content/` + `src/content.config.ts`)
2. `.astro` components and pages processed by Astro
3. Static images served from `public/img/` (no build-time optimization)
4. Post-build: the `src/integrations/postbuild.ts` Astro integration (`astro:build:done` hook, registered last in `astro.config.ts`) adds SHA-384 SRI integrity attributes to local CSS/JS, then signs security.txt with OpenPGP when `GPG_PRIVATE_KEY` is set (env or `.env`)

**Global data** (`src/data/`):

- `site.ts` — Site metadata (title, URL, social links, favicon config, identity endpoints)
- `navigation.ts` — Nav menu items
- `schema.ts` — Schema.org Person JSON-LD template

**Layouts** (`src/layouts/`):

- `BaseLayout.astro` — Root HTML document structure
- `ProjectLayout.astro` — Project detail pages

**Components** (`src/components/`):

- `.astro` files for site chrome, head partials, and reusable UI elements
- CSS: `src/styles/global.css` for global styles, plus scoped component styles

**Projects** live in `src/content/projects/<name>/` with an `index.md` and assets.

**Endpoints:** Static `.ts` files in `src/pages/` generate feeds (`feed.xml`, `feed.json`), `llms.txt`, `robots.txt`, `humans.txt`, and `.well-known/` files (security.txt, did.json, etc.). WebFinger and host-meta are served dynamically by the Worker (see Deploy).

**CSP and headers:** `public/_headers` file sets Content Security Policy and other security headers (read by Workers Static Assets). The CSP is `'self'`-only apart from: the Green Web badge (`app.greenweb.org`, which redirects to a presigned `s3.nl-ams.scw.cloud` URL), Cloudflare Web Analytics (auto-injected beacon), and `'inline-speculation-rules'`. No inline styles: `style="…"` attributes are blocked, and `build.inlineStylesheets: 'never'` keeps Astro from inlining small CSS as `<style>`.

**Deploy:** Cloudflare Worker `dwk` (Workers Static Assets, config in `wrangler.jsonc`), deployed by Workers Builds on every push to `main` (`npm run deploy` does the same by hand). `worker.ts` handles the www → apex redirect, routes the paths in `worker/mounts.ts` to the `@dwk` packages, and otherwise serves the site through `worker/site.ts`: `dist/` plus Micropub posts and received webmentions, rendered at request time (see below). Worker-generated responses don't get `public/_headers` rules (`worker.ts` adds the security headers itself), and `npm run dev` doesn't run the Worker; test it with `npx wrangler dev` (local D1, R2, Queues, Durable Objects, and the cron via the Local Explorer API). `public/_redirects` must use relative URLs only; cross-host redirects go in `worker.ts`. This is a Worker, not a Pages project — don't use `wrangler pages deploy`.

**@dwk/workers composition:** every endpoint package from [davidwkeith/workers](https://github.com/davidwkeith/workers) is mounted in this one Worker, mirroring that repo's `packages/conformance-target` (the reference composition) with this site's identity:

- `worker/env.ts` — `Env`, the union of every package's binding fragment plus this site's secrets.
- `worker/config.ts` — one config per package, built from `src/data/site.ts`. `USERNAME` (`test`) is the self-hosted ActivityPub actor's handle: `acct:dwk@dwk.io` stays delegated to the Mastodon account, so the actor at `/users/test` gets its own.
- `worker/mounts.ts` — the mount table (path → package handler, first match wins; unmatched paths fall through to the static site). Handlers build lazily, so a mount whose secret is unset answers 503 while the rest of the site keeps serving.
- `worker/owner.ts` — the owner-only test surfaces behind the `OWNER_TOKEN` bearer: `POST /admin/init` (one-time D1 schema init; run it after the first deploy) and `POST /webmention/send`.
- `worker/posts.ts` — Micropub posts on the site: new posts get `/posts/<slug>/` URLs; the Worker renders `/posts/` (h-feed) and each permalink (h-entry) from the `@dwk/micropub` D1 store into the static `/post-shell/` page (itself a 404 and left out of the sitemap), and `worker/site.ts` adds them to `feed.xml`/`feed.json`. Drafts and `visibility: private` posts are never served; unlisted ones only at their permalink.
- `worker/webmentions.ts` — fills each `[data-webmentions]` element (the `Webmentions.astro` component, on project pages and posts) with that page's verified mentions from the `@dwk/webmention` inbox. Both modules use `HTMLRewriter`, so none of this shows under `npm run dev`.
- `worker/login.ts` — the Cloudflare Access-guarded owner sign-in used by both OAuth servers (IndieAuth and the Mastodon-app flow, kept apart by a signed `flow` field).

| Path | Package |
|---|---|
| `/.well-known/webfinger`, `/.well-known/host-meta[.json]` | `@dwk/webfinger`, `@dwk/host-meta` |
| `/.well-known/oauth-authorization-server`, `/auth/authorize`, `/auth/token`, `/auth/revocation` | `@dwk/indieauth` (`/auth/login` is the owner sign-in) |
| `/micropub`, `/media/*` | `@dwk/micropub` (syndicates to the actor when `ACTIVITYPUB_PUBLISH_TOKEN` is set) |
| `/microsub` | `@dwk/microsub` (feeds polled by the cron → `dwk-microsub` queue) |
| `/webmention` (+ `/webmention/send`) | `@dwk/webmention` (verification on the `dwk-webmention-verify` queue, inbox in D1, 30 req/60s per IP) |
| `/websub` | `@dwk/websub` hub for `/`, `/feed.xml`, `/feed.json` (`dwk-websub` queue; the cron pings it when a deploy changes a topic, via `worker/publish.ts`) |
| `/users/test*`, `/inbox`, `/.well-known/nodeinfo`, `/nodeinfo/*` | `@dwk/activitypub` (per-actor Durable Object `ACTOR`) |
| `/api/v1/*`, `/api/v2/*`, `/oauth/{authorize,token,revoke}` | `@dwk/mastodon-api` over the same actor |
| `/storage/<account>/*` | `@dwk/remotestorage` (Durable Object `STORAGE`) |
| `/pod/*`, `/dav/*`, `/dav-credentials` | `@dwk/solid-pod` LDP door, its WebDAV door (a separate pod), app passwords (Durable Object `POD`) |
| `/webauthn/*` | `@dwk/webauthn` (Durable Object `WEBAUTHN`; registration is owner-only) |
| `/credentials/*` | `@dwk/vc` (issuance/status owner-only; `did:web:dwk.io` resolves to the static `did.json`) |
| `/xrpc/*` | `@dwk/atproto-pds` (Durable Object `REPO`); `/.well-known/atproto-did` and `did.json` stay the static Bluesky identity |
| `/profile/card`, `/webmention-qa-source` | the owner WebID (Turtle) and the webmention.rocks/sender source page |

All D1 bindings point at the one `dwk-indieauth` database (the free-plan database limit is maxed out); the packages' table names are disjoint. R2 buckets `dwk-blobs` and `dwk-media`, queues `dwk-webmention-verify`/`dwk-websub`/`dwk-microsub`, and the `*/15 * * * *` cron (pod blob GC + Microsub polling + WebSub publish pings) are declared in `wrangler.jsonc`. Branch previews (Workers Builds runs `wrangler preview` for non-production branches) inherit nothing from the top-level config, so the `previews` block repeats every binding: Durable Object namespaces are isolated per preview, the D1 database, buckets, and queues are shared with production, and the queue consumers and cron only run in production. Preview secrets are separate too: `npx wrangler preview base-config secret put <NAME>` applies to previews created afterwards. Secrets (`wrangler secret put`, or `.dev.vars` locally, gitignored): `TOKEN_SIGNING_KEY` (required), `OWNER_TOKEN`, `ACTIVITYPUB_PUBLIC_KEY_PEM`/`ACTIVITYPUB_PRIVATE_KEY_PEM` (RSA PEMs; the ActivityPub and Mastodon mounts answer 503 without the public key), `ACTIVITYPUB_PUBLISH_TOKEN`, `ATPROTO_PASSWORD`/`ATPROTO_JWT_SECRET`, `VC_SIGNING_KEY` (P-256 private JWK), `WEBDAV_PEPPER`. The owner logs in at `/auth/login` behind a Cloudflare Access app (`ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` vars); the Worker verifies the Access JWT itself because `*.workers.dev` previews bypass Access. Note that `/auth/token` requires DPoP, so most Micropub clients can sign in but can't get tokens.

## Key Conventions

- Schema.org JSON-LD is validated at build time — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
- Speculation Rules API (`type="speculationrules"`) for moderate-eagerness prerender — use `is:inline` to prevent Astro from processing the script tag.
