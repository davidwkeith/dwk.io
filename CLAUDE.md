# dwk.io

Personal portfolio/project showcase website.

## Commands

- `npm run dev` — Astro dev server with live reload
- `npm run build` — Production build (outputs to `dist/`)
- `npm run postbuild` — Adds SRI hashes and signs security.txt (runs automatically after build)
- `npm run check` — TypeScript check
- `npm run preview` — Preview production build locally
- `npm run deploy` — Build and deploy to Cloudflare Pages

## Architecture

**Astro config:** `astro.config.ts` — static output, sitemap integration. Source in `src/`, output to `dist/`.

**Content pipeline:**

1. Astro content collections with `glob` loader for projects (`src/content/` + `src/content.config.ts`)
2. `.astro` components and pages processed by Astro
3. Static images served from `public/img/` (no build-time optimization)
4. Post-build: `scripts/postbuild.ts` adds SHA-384 SRI integrity attributes to local CSS/JS using `@dwk/eleventy-shared/postbuild`, and signs security.txt with OpenPGP

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

**CSP and headers:** `public/_headers` file sets Content Security Policy and other security headers for Cloudflare Pages. The CSP allows `img-src 'self' https://app.greenweb.org` (the only runtime external image).

**Deploy:** Cloudflare Pages via `wrangler pages deploy dist/`.

**IndieWeb:** Homepage has a representative `h-card` (microformats2 identity) and `h-feed` wrapper. Project pages use `h-entry` markup. IndieAuth and Webmention endpoints advertised in `<head>` via `site.ts` headLinks.

## Key Conventions

- Schema.org JSON-LD is validated at build time — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
- Speculation Rules API (`type="speculationrules"`) for moderate-eagerness prerender — use `is:inline` to prevent Astro from processing the script tag.
