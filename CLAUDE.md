# dwk.io

Personal portfolio/project showcase website.

## Commands

- `npm run dev` — Astro dev server with live reload
- `npm run build` — Production build (outputs to `dist/`), including SRI hashing and security.txt signing
- `npm run check` — TypeScript check (includes `test/`)
- `npm test` — Build, then run the Vitest suite in `test/` inside workerd (`@cloudflare/vitest-plugin`, bindings from `wrangler.jsonc`); CI runs `check` and `test` on every PR (`.github/workflows/test.yml`)
- `npm run preview` — Preview production build locally
- `npm run deploy` — Build and deploy to the `dwk` Cloudflare Worker (static assets)
- `ACTIVITYPUB_PUBLISH_TOKEN=… node scripts/refollow.mjs following_accounts.csv [--dry-run]` — after the Mastodon `Move`, re-follow from `/users/dwk` every account in the old account's Follows export (WebFinger, falling back to the old instance's lookup API). It skips accounts already in `/users/dwk/following` and ones a previous run sent a Follow to (`<csv>.sent.json`); `--resend` posts those again

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

**CSP and headers:** `public/_headers` file sets Content Security Policy and other security headers (read by Workers Static Assets). The CSP is `'self'`-only apart from: the Green Web badge (`app.greenweb.org`, which redirects to a presigned `s3.nl-ams.scw.cloud` URL), Cloudflare Web Analytics (auto-injected beacon), and `'inline-speculation-rules'`. `Cross-Origin-Resource-Policy` is `same-origin` except on the icons and `/img/*`, which are `cross-origin` so other sites (Quill showing the IndieAuth profile photo, feed readers) can display them. No inline styles: `style="…"` attributes are blocked, and `build.inlineStylesheets: 'never'` keeps Astro from inlining small CSS as `<style>`.

**Deploy:** Cloudflare Worker `dwk` (Workers Static Assets, config in `wrangler.jsonc`), deployed by Workers Builds on every push to `main` (`npm run deploy` does the same by hand). `worker.ts` handles the www → apex redirect, routes the paths in `worker/mounts.ts` to the `@dwk` packages, and otherwise serves the site through `worker/site.ts`: `dist/` plus Micropub posts and received webmentions, rendered at request time (see below). Worker-generated responses don't get `public/_headers` rules (`worker.ts` adds the security headers itself), and `npm run dev` doesn't run the Worker; test it with `npx wrangler dev` (local D1, R2, Queues, Durable Objects, and the cron via the Local Explorer API). `public/_redirects` must use relative URLs only; cross-host redirects go in `worker.ts`. This is a Worker, not a Pages project — don't use `wrangler pages deploy`.

**@dwk/workers composition:** every endpoint package from [davidwkeith/workers](https://github.com/davidwkeith/workers) is mounted in this one Worker, mirroring that repo's `packages/conformance-target` (the reference composition) with this site's identity:

- `worker/env.ts` — `Env`, the union of every package's binding fragment plus this site's secrets.
- `worker/config.ts` — one config per package, built from `src/data/site.ts`. `USERNAME` (`dwk`, from `site.identity.fediverse`) is the self-hosted ActivityPub actor's handle: `acct:dwk@dwk.io` resolves to the actor at `/users/dwk`, whose `alsoKnownAs` names the Mastodon account at `xn--4t8h.dwk.io` it is the `Move` target of.
- `worker/mounts.ts` — the mount table (path → package handler, first match wins; unmatched paths fall through to the static site). Handlers build lazily, so a mount whose secret is unset answers 503 while the rest of the site keeps serving. `siteFetch` carries the Worker's requests to its own site (Micropub syndicating through the actor's `/publish`, the WebSub hub fetching the feeds): on its Custom Domain a `fetch` to `dwk.io` answers 522, so they are dispatched in-process to the mount or the static site.
- `worker/owner.ts` — the owner-only test surfaces behind the `OWNER_TOKEN` bearer: `POST /admin/init` (one-time D1 schema init; run it after the first deploy) and `POST /webmention/send`.
- `worker/posts.ts` — Micropub posts on the site: new posts get `/posts/<slug>` URLs (no trailing slash: on a slug collision `@dwk/micropub` appends `-xxxx`); the Worker renders `/posts/` (h-feed) and each permalink (h-entry) from the `@dwk/micropub` D1 store into the static `/post-shell/` page (itself a 404 and left out of the sitemap), and `worker/site.ts` adds them to `feed.xml`/`feed.json` and `llms.txt` and serves `/sitemap-posts.xml` (listed in `sitemap-index.xml` through `@astrojs/sitemap`'s `customSitemaps`). Drafts and `visibility: private` posts are never served; unlisted ones only at their permalink.
- `worker/outbox.ts` — outgoing webmentions for posts. `@dwk/micropub` has no publish hook, so the cron compares each post with the version it last sent for (`dwk_webmention_outbox` table) and notifies the links in its response context and content (other sites only; not syndication links or photos): new and edited posts' old and new targets, and, via `resendForDeletedSource` and the `webmentions_sent` log, a deleted (410) or now-private (404) post's targets. At most 10 targets per run; failed deliveries are logged, not retried.
- `worker/webmentions.ts` — fills each `[data-webmentions]` element (the `Webmentions.astro` component, on project pages and posts) with that page's verified mentions from the `@dwk/webmention` inbox. Authors' photos go through `/webmention-avatar` (the CSP keeps images on this origin): only photos of mentions in the inbox, raster types under 256 KB, cached a day. The component's form posts to `/webmention`; a browser submission (`Accept: text/html`) is redirected back to the page with `?webmention=<outcome>#webmentions`, which the page shows as a notice, while senders' own requests still get the endpoint's 202/400. Both modules use `HTMLRewriter`, so none of this shows under `npm run dev`.
- `worker/login.ts` — the Cloudflare Access-guarded owner sign-in used by both OAuth servers (IndieAuth and the Mastodon-app flow, kept apart by a signed `flow` field).

| Path | Package |
|---|---|
| `/.well-known/webfinger`, `/.well-known/host-meta[.json]` | `@dwk/webfinger`, `@dwk/host-meta` |
| `/.well-known/oauth-authorization-server`, `/auth/authorize`, `/auth/token`, `/auth/revocation`, `/auth/introspect` | `@dwk/indieauth` (`/auth/login` is the owner sign-in; introspection only when `INTROSPECTION_TOKEN` is set) |
| `/micropub`, `/media/*` | `@dwk/micropub` (syndicates to the actor when `ACTIVITYPUB_PUBLISH_TOKEN` is set: the Note links back to the post as its `url`, and the post records the Note as its `u-syndication`) |
| `/microsub` | `@dwk/microsub` (feeds polled by the cron → `dwk-microsub` queue) |
| `/webmention` (+ `/webmention/send`) | `@dwk/webmention` (verification on the `dwk-webmention-verify` queue, inbox in D1, 30 req/60s per IP) |
| `/websub` | `@dwk/websub` hub for `/`, `/feed.xml`, `/feed.json` (`dwk-websub` queue; the cron pings it when a deploy changes a topic, via `worker/publish.ts`) |
| `/users/dwk*`, `/inbox`, `/.well-known/nodeinfo`, `/nodeinfo/*` | `@dwk/activitypub` (per-actor Durable Object `ACTOR`) |
| `/api/v1/*`, `/api/v2/*`, `/oauth/{authorize,token,revoke}` | `@dwk/mastodon-api` over the same actor |
| `/storage/<account>/*` | `@dwk/remotestorage` (Durable Object `STORAGE`) |
| `/pod/*`, `/dav/*`, `/dav-credentials` | `@dwk/solid-pod` LDP door, its WebDAV door (a separate pod), app passwords (Durable Object `POD`) |
| `/webauthn/*` | `@dwk/webauthn` (Durable Object `WEBAUTHN`; registration is owner-only) |
| `/credentials/*` | `@dwk/vc` (issuance/status owner-only; `did:web:dwk.io` resolves to the static `did.json`) |
| `/xrpc/*` | `@dwk/atproto-pds` (Durable Object `REPO`); `/.well-known/atproto-did` and `did.json` stay the static Bluesky identity |
| `/profile/card`, `/webmention-qa-source` | the owner WebID (Turtle) and the webmention.rocks/sender source page |

All D1 bindings point at the one `dwk-indieauth` database (the free-plan database limit is maxed out); the packages' table names are disjoint. R2 buckets `dwk-blobs` and `dwk-media`, queues `dwk-webmention-verify`/`dwk-websub`/`dwk-microsub`, and the `*/15 * * * *` cron (pod blob GC + Microsub polling + WebSub publish pings + outgoing webmentions) are declared in `wrangler.jsonc`. Branch previews (Workers Builds runs `wrangler preview` for non-production branches) inherit nothing from the top-level config, so the `previews` block repeats every binding: Durable Object namespaces are isolated per preview, the D1 database, buckets, and queues are shared with production, and the queue consumers and cron only run in production. The owner logs in at `/auth/login` behind a Cloudflare Access app (`ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` vars); the Worker verifies the Access JWT itself because `*.workers.dev` previews bypass Access. The dwk.io zone's SSL/TLS encryption mode must be **Full (strict)**: a Worker subrequest to any hostname in its own zone, even a DNS-only one such as the Mastodon instance at `xn--4t8h.dwk.io`, goes through Cloudflare's proxy with the zone's mode, and under Flexible the origin's HTTP→HTTPS redirect loops (`too_many_redirects`), so inbound ActivityPub signatures from that instance fail with `key_unresolved`. `/auth/token` issues DPoP-bound tokens to clients that send a proof, and to the rest (most Micropub/Microsub clients) an unbound Bearer token: Micropub/Microsub scopes only, 30 days (as are DPoP-bound tokens: clients like Quill never refresh), revocable (`bearerTokens` in `worker/config.ts`; Micropub and Microsub set `acceptBearerTokens`).

**Secrets:** set with `wrangler secret put` (production) or in `.dev.vars` (local, gitignored; template: `.dev.vars.example`). A mount whose secret is unset answers `503 not_configured` naming the binding, so the site keeps serving. `TOKEN_SIGNING_KEY` is the only one every deploy needs.

| Secret | Used by | Value |
|---|---|---|
| `TOKEN_SIGNING_KEY` | IndieAuth tokens, login/consent tokens, Micropub, Microsub, Mastodon API | random |
| `OWNER_TOKEN` | `/admin/init`, `/webmention/send`, pod and remoteStorage writes, `/dav-credentials`, WebAuthn registration, VC issuance | random; keep it, it is the owner's bearer |
| `INTROSPECTION_TOKEN` | the bearer resource servers send to `/auth/introspect` (IndieAuth §6.1); unset, the endpoint isn't served or advertised | random; give it to the resource server |
| `ACTIVITYPUB_PUBLIC_KEY_PEM`, `ACTIVITYPUB_PRIVATE_KEY_PEM` | the actor's signatures (the public half is published in the actor document) | RSA 2048 PEMs |
| `ACTIVITYPUB_PUBLISH_TOKEN` | `POST /users/dwk/outbox` and `/publish`; also turns on Micropub → fediverse syndication | random; keep it |
| `ATPROTO_PASSWORD`, `ATPROTO_JWT_SECRET` | `com.atproto.server.createSession` (identifier `dwk.io`) and its JWTs | random; keep the password |
| `VC_SIGNING_KEY` | signs credentials and status lists as `did:web:dwk.io#key-0` | P-256 private JWK |
| `WEBDAV_PEPPER` | app-password hashing for the WebDAV door | random |

One-time setup, from a checkout of `main` with `wrangler` logged in (`account_id` is pinned in `wrangler.jsonc`). Values that are needed again are kept in a shell variable and echoed once so they can go into a password manager; piping `openssl` straight into `wrangler` loses them.

```sh
# Resources the bindings reference (the deploy fails until they exist).
npx wrangler r2 bucket create dwk-blobs
npx wrangler r2 bucket create dwk-media
npx wrangler queues create dwk-webmention-verify
npx wrangler queues create dwk-websub
npx wrangler queues create dwk-microsub

# Random secrets whose value is never needed again.
for name in TOKEN_SIGNING_KEY ATPROTO_JWT_SECRET WEBDAV_PEPPER; do
  openssl rand -base64 32 | tr -d '\n' | npx wrangler secret put "$name"
done

# Random secrets that are also bearer tokens or passwords: keep the echoed values.
for name in OWNER_TOKEN ACTIVITYPUB_PUBLISH_TOKEN ATPROTO_PASSWORD INTROSPECTION_TOKEN; do
  value=$(openssl rand -base64 32 | tr -d '\n'); echo "$name=$value"
  printf '%s' "$value" | npx wrangler secret put "$name"
done

# ActivityPub actor keypair: files, not the interactive prompt, so the multi-line PEM stays intact.
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ap.pem
openssl pkey -in ap.pem -pubout -out ap.pub.pem
npx wrangler secret put ACTIVITYPUB_PUBLIC_KEY_PEM < ap.pub.pem
npx wrangler secret put ACTIVITYPUB_PRIVATE_KEY_PEM < ap.pem
rm ap.pem ap.pub.pem

# VC issuer key.
node -e "crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']).then(async k=>process.stdout.write(JSON.stringify(await crypto.subtle.exportKey('jwk',k.privateKey))))" > vc.jwk
npx wrangler secret put VC_SIGNING_KEY < vc.jwk
rm vc.jwk

# After the first deploy with the secrets in place (a secret put redeploys; allow a few seconds):
# create the D1 tables of the packages that expose a schema-init API. Idempotent.
curl -X POST https://dwk.io/admin/init -H "Authorization: Bearer $OWNER_TOKEN"
```

Previews do not inherit production secrets. Set a Preview's own with `npx wrangler preview secret put <NAME> --name <branch>` (same `<` / `printf` forms as above), or once for every future Preview with `npx wrangler preview base-config secret put <NAME>`.

## Testing

- Unit tests import `worker/` modules directly; integration tests drive the whole Worker through `SELF.fetch` with local D1 seeded via the packages' own stores. Local D1 persists across tests, so call `resetD1()` (`test/reset.ts`) in `beforeEach`.
- `cloudflare:test` is typed by the minimal `test/cloudflare-test.d.ts`, not `@cloudflare/workers-types`: installing that package makes the `@dwk` packages' binding types disagree in `worker/env.ts`.
- Spy on `env.WEBSUB_QUEUE.send` (see `test/publish.test.ts`) so the hub's queue consumer doesn't fetch the real dwk.io.
- With npm 10, `npm install` of vitest packages fails with `Cannot read properties of null (reading 'edgesOut')` (an arborist bug); use `npx npm@11 install …`. `npm ci` is unaffected.

## Key Conventions

- Schema.org JSON-LD is validated at build time — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
- Speculation Rules API (`type="speculationrules"`) for moderate-eagerness prerender — use `is:inline` to prevent Astro from processing the script tag.
