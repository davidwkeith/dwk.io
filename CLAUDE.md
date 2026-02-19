# dwk.io

Personal portfolio/project showcase website.

## Commands

- `npm run start` — Eleventy dev server with live reload
- `npm run build` — Production build (outputs to `_site/`)
- `npm run postbuild` — Adds SRI hashes and signs security.txt (runs automatically after build)
- `npm run typecheck` — Type check both Eleventy and Worker code
- `npm run dev:worker` — Local Wrangler dev server
- `npm run deploy` — Build and deploy to Cloudflare Workers
- `npm run cf-typegen` — Regenerate `worker-configuration.d.ts` types
- `npm test` — Run Worker tests (Vitest + `@cloudflare/vitest-pool-workers`)
- `npm run test:watch` — Run tests in watch mode

## Architecture

**Eleventy config:** `eleventy.config.ts` — source `src/`, output `_site/`, includes `_includes/`, layouts `_layouts/`. Uses `@dwk/eleventy-shared` plugin for shared templates and config.

**Content pipeline:**
1. WebC/Markdown templates processed by Eleventy
2. Images optimized to WebP + JPEG via `@11ty/eleventy-img`
3. Markdown images intercepted and routed through the `image` shortcode (custom markdown-it renderer override)
4. HTML minified via `html-minifier-terser` transform (production only)
5. Post-build: `scripts/postbuild.ts` adds SHA-384 SRI integrity attributes to local CSS/JS using cheerio, and signs security.txt with OpenPGP

**Global data** (`src/_data/`):
- `site.ts` — Site metadata (title, URL, social links, favicon config, identity endpoints)
- `navigation.ts` — Nav menu items
- `schema.ts` — Schema.org Person JSON-LD template

**Layouts** (`src/_layouts/`):
- `base.webc` — Root HTML document structure
- `project.webc` — Project detail pages

**Components** (`src/_includes/`):
- `main.css` / `main.js` — Global bundled styles and scripts (main.js is client-side browser JS, not TypeScript)
- `head-meta.webc`, `head-link.webc`, `head-js.webc` — Document head partials
- `custom/header.webc`, `custom/footer.webc` — Site chrome

**Projects** live in `src/projects/<name>/` with an `index.md` and assets. Shared front matter is in `src/projects/projects.11tydata.ts` (sets layout, tags, schema type).

**Worker** (`worker/index.ts`): Handles redirects, fetches static assets, and applies custom response headers using utilities from `@dwk/eleventy-shared/worker`. The CSP allows `img-src 'self' https://app.greenweb.org` (the only runtime external image).

**IndieWeb:** Homepage has a representative `h-card` (microformats2 identity) and `h-feed` wrapper. Project pages use `h-entry` markup. IndieAuth and Webmention endpoints advertised in `<head>` via `site.ts` headLinks.

## Key Conventions

- `setFreezeReservedData(false)` is set as a workaround for eleventy-plugin-webc issue #86 — when using dynamic permalinks in WebC, duplicate the permalink value in `page.url` front matter.
- Schema.org JSON-LD is validated at build time via `jsonld-lint` — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
- Speculation Rules API (`type="speculationrules"`) in `base.webc` for moderate-eagerness prerender — requires `webc:keep` to survive WebC processing.
