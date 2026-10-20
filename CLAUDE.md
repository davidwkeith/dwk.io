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

**Endpoints:** Static `.ts` files in `src/pages/` generate feeds (`feed.xml`, `feed.json`), `llms.txt`, `robots.txt`, `humans.txt`, and `.well-known/` files (webfinger, host-meta, security.txt, etc.).

**CSP and headers:** `public/_headers` file sets Content Security Policy and other security headers (read by Workers Static Assets). The CSP is `'self'`-only apart from: the Green Web badge (`app.greenweb.org`, which redirects to a presigned `s3.nl-ams.scw.cloud` URL), Cloudflare Web Analytics (auto-injected beacon), and `'inline-speculation-rules'`. No inline styles: `style="…"` attributes are blocked, and `build.inlineStylesheets: 'never'` keeps Astro from inlining small CSS as `<style>`.

**Deploy:** Cloudflare Worker `dwk` (Workers Static Assets, config in `wrangler.jsonc`) via `wrangler deploy`. `worker.js` only handles the www → apex redirect and otherwise serves `dist/`. `public/_redirects` must use relative URLs only; cross-host redirects go in `worker.js`. This is a Worker, not a Pages project — don't use `wrangler pages deploy`.

**IndieWeb:** Homepage has a representative `h-card` (microformats2 identity) and `h-feed` wrapper. Project pages use `h-entry` markup. IndieAuth and Webmention endpoints advertised in `<head>` via `site.ts` headLinks.

## Key Conventions

- Schema.org JSON-LD is validated at build time — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
- Speculation Rules API (`type="speculationrules"`) for moderate-eagerness prerender — use `is:inline` to prevent Astro from processing the script tag.
