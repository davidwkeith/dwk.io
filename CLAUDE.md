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

**Deploy:** Cloudflare Worker `dwk` (Workers Static Assets, config in `wrangler.jsonc`) via `wrangler deploy`. `worker.ts` handles the www → apex redirect, serves `/.well-known/webfinger` and `/.well-known/host-meta`(`.json`) via the `@dwk/webfinger` and `@dwk/host-meta` packages (config built from `src/data/site.ts`), and otherwise serves `dist/`. Worker-generated responses don't get `public/_headers` rules, and `npm run dev` doesn't serve these two endpoints; test them with `npx wrangler dev`. `public/_redirects` must use relative URLs only; cross-host redirects go in `worker.ts`. This is a Worker, not a Pages project — don't use `wrangler pages deploy`.

**IndieWeb:** Homepage has a representative `h-card` (microformats2 identity) and `h-feed` wrapper. Project pages use `h-entry` markup. IndieAuth and Webmention endpoints advertised in `<head>` via `site.ts` headLinks.

**IndieAuth:** Self-hosted via `@dwk/indieauth` in `worker.ts`: `/auth/authorize`, `/auth/token`, `/auth/revocation`, and `/.well-known/oauth-authorization-server`. Codes and tokens live in the `AUTH_DB` D1 database (schema created lazily); tokens are signed with the `TOKEN_SIGNING_KEY` secret. The owner logs in at `/auth/login` (`worker/login.ts`), which is guarded by a Cloudflare Access app (`ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` vars). The Worker verifies the Access JWT itself, because `*.workers.dev` previews bypass Access, so login only works on dwk.io. Approval redirects back to `/auth/authorize` with an HMAC consent token covering the client, redirect URI, state, PKCE challenge, scopes and resources. Note that `/auth/token` requires DPoP, so most Micropub clients can sign in but can't get tokens. For local testing, put `TOKEN_SIGNING_KEY` in `.dev.vars` (gitignored).

**Webmention:** Self-hosted via `@dwk/webmention` in `worker.ts` at `POST /webmention` (replaces the earlier third-party `webmention.io` endpoint). The receiver validates `source`/`target` synchronously and returns `202`, then enqueues the pair on the `WEBMENTION_QUEUE` Cloudflare Queue; the Worker's `queue` handler verifies the source links to the target and upserts the result into the `WEBMENTION_INBOX` D1 binding (table created lazily). `WEBMENTION_INBOX` points at the same `dwk-indieauth` database as `AUTH_DB` — the D1 free-plan database limit was maxed out, and the package just needs any D1 database, using its own `webmentions` table. Test the queue consumer with `npx wrangler dev`, since `npm run dev` doesn't run the Worker's `queue` handler.

## Key Conventions

- Schema.org JSON-LD is validated at build time — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
- Speculation Rules API (`type="speculationrules"`) for moderate-eagerness prerender — use `is:inline` to prevent Astro from processing the script tag.
