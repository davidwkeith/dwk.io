# dwk.io: Eleventy → Astro Migration Design

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Convert dwk.io from Eleventy 3 + Cloudflare Workers to Astro 5 + Cloudflare Pages

## Summary

Migrate dwk.io (personal portfolio with 4 project pages) from Eleventy 3 with WebC components and a Cloudflare Worker runtime to Astro 5 with static output and Cloudflare Pages hosting. The `@dwk/eleventy-shared` package is dropped entirely for this site; all features are reimplemented natively in Astro. The retro 1990s visual design and all IndieWeb/federation endpoints are preserved exactly.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | Full Anglesite adoption (Option A) | Simple portfolio site doesn't need a worker runtime; Cloudflare Pages `_headers`/`_redirects` handle everything the worker did |
| Visual design | Keep retro theme as-is | Strong existing identity; port CSS directly, no Anglesite design interview |
| CMS | Skip Keystatic | Developer edits markdown directly; Keystatic adds unnecessary React dependency |
| Well-known endpoints | All 11 preserved | Owner is an IndieWeb developer who actively uses all identity/federation endpoints |
| Shared package | Drop for this site | Other monorepo sites keep using it; features reimplemented natively in Astro |

## Project Structure

```
sites/dwk.io/
├── astro.config.ts
├── tsconfig.json
├── package.json
├── scripts/
│   └── postbuild.ts             # SRI hashing + security.txt signing (kept)
├── public/
│   ├── _headers                 # Cloudflare Pages security headers
│   ├── _redirects               # Cloudflare Pages redirects
│   ├── img/                     # Static images (memoji, social icons, jsonfeed)
│   └── .well-known/
│       └── keybase.txt          # Static file (no templating needed)
├── src/
│   ├── layouts/
│   │   ├── BaseLayout.astro     # Root HTML document
│   │   └── ProjectLayout.astro  # Project detail pages
│   ├── components/
│   │   ├── Header.astro         # Site header with logo + nav
│   │   ├── Footer.astro         # Footer with social icons + CC BY 4.0
│   │   ├── HeadMeta.astro       # Viewport, OG, Twitter, fediverse meta tags
│   │   ├── HeadLink.astro       # Canonical, feeds, IndieAuth, webmention links
│   │   └── HeadSchema.astro     # Schema.org JSON-LD script injection
│   ├── pages/
│   │   ├── index.astro          # Homepage with h-card + h-feed
│   │   ├── 404.astro            # Error page
│   │   ├── robots.txt.ts        # Astro static endpoint
│   │   ├── humans.txt.ts        # Astro static endpoint
│   │   ├── sitemap.xml          # Via @astrojs/sitemap integration
│   │   ├── llms.txt.ts          # Astro static endpoint
│   │   ├── feed.xml.ts          # Atom feed (via @astrojs/rss)
│   │   ├── feed.json.ts         # JSON Feed v1
│   │   └── .well-known/
│   │       ├── gpc.json.ts
│   │       ├── security.txt.ts
│   │       ├── webfinger.ts     # Extensionless output
│   │       ├── host-meta.ts     # Extensionless output
│   │       ├── nostr.json.ts
│   │       ├── did.json.ts
│   │       ├── atproto-did.ts   # Extensionless output
│   │       └── dnt-policy.txt.ts
│   ├── content/
│   │   └── projects/            # 4 project .md files
│   ├── content.config.ts        # Astro content collection schema
│   ├── data/
│   │   ├── site.ts              # Site metadata + identity config
│   │   ├── navigation.ts        # Nav menu items
│   │   └── schema.ts            # Schema.org Person JSON-LD
│   └── styles/
│       └── global.css           # Retro CSS (ported from main.css)
```

## File Mapping

### Layouts

| Eleventy | Astro | Notes |
|----------|-------|-------|
| `src/_layouts/base.webc` | `src/layouts/BaseLayout.astro` | Root HTML with skip-link, header, main, footer, global CSS import, speculation rules (`<script is:inline type="speculationrules">` — `is:inline` prevents Astro from processing it) |
| `src/_layouts/project.webc` | `src/layouts/ProjectLayout.astro` | Wraps BaseLayout; adds h-entry, hero image, metadata |

### Components

| Eleventy | Astro | Notes |
|----------|-------|-------|
| `src/_includes/head-meta.webc` | `src/components/HeadMeta.astro` | Props: title, description, url, image, site data |
| `src/_includes/head-link.webc` | `src/components/HeadLink.astro` | Props: canonical URL, site data (headLinks, feeds); includes dns-prefetch for greenweb.org and `<link rel="author">` for humans.txt |
| `src/_includes/head-js.webc` | `src/components/HeadSchema.astro` | Props: schema object; serializes JSON-LD (validation inlined — see Schema Validation section) |
| `src/_includes/custom/header.webc` | `src/components/Header.astro` | Logo, site title, JSON Feed icon (no nav rendering — nav data exists but header doesn't use it currently) |
| `src/_includes/custom/footer.webc` | `src/components/Footer.astro` | Social icons with rel="me", CC BY 4.0, Green Web badge |
| `src/_includes/main.css` | `src/styles/global.css` | Ported as-is; component-scoped styles move to `<style>` blocks |
| `src/_includes/main.js` | Dropped | Currently empty/minimal; not needed |

### Pages

| Eleventy | Astro | Notes |
|----------|-------|-------|
| `src/index.webc` + `src/index.11tydata.ts` | `src/pages/index.astro` | Homepage with h-card, h-feed, project list; schema override to `ProfilePage` with `mainEntity` pointing to Person data from `schema.ts` |
| `src/projects/*/index.md` | `src/content/projects/*.md` | Same content; drop `page.url` workaround from front matter |
| Shared plugin 404 virtual template | `src/pages/404.astro` | Simple error page using BaseLayout |

### Endpoints (Static)

| Eleventy | Astro | Notes |
|----------|-------|-------|
| `src/feed.xml.11ty.ts` | `src/pages/feed.xml.ts` | Atom feed; use `@astrojs/rss` |
| `src/feed.json.11ty.ts` | `src/pages/feed.json.ts` | JSON Feed v1; hand-built |
| `src/llms.txt.11ty.ts` | `src/pages/llms.txt.ts` | llmstxt.org format |
| Shared plugin: robots.txt | `src/pages/robots.txt.ts` | Simple text output |
| Shared plugin: humans.txt | `src/pages/humans.txt.ts` | Include git commit hash |
| Shared plugin: sitemap.xml | `@astrojs/sitemap` integration | Auto-generated |
| Shared plugin: gpc.json | `src/pages/.well-known/gpc.json.ts` | Static JSON |
| Shared plugin: security.txt | `src/pages/.well-known/security.txt.ts` | Generated; signed by postbuild |
| Shared plugin: webfinger | `src/pages/.well-known/webfinger.ts` | Extensionless; JRD+JSON |
| Shared plugin: host-meta | `src/pages/.well-known/host-meta.ts` | Extensionless; XRD+XML |
| Shared plugin: nostr.json | `src/pages/.well-known/nostr.json.ts` | Nostr pubkey |
| Shared plugin: did.json | `src/pages/.well-known/did.json.ts` | DID document |
| Shared plugin: atproto-did | `src/pages/.well-known/atproto-did.ts` | Extensionless; plain text |
| Shared plugin: dnt-policy.txt | `src/pages/.well-known/dnt-policy.txt.ts` | DNT policy |
| `src/.well-known/keybase.txt.webc` | `public/.well-known/keybase.txt` | Static file, no templating |

## Hosting & Security

### Replaces: Cloudflare Worker (`worker/index.ts`)

The worker performed three functions, all replaced by Cloudflare Pages static files:

**1. Security headers → `public/_headers`**

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer-when-downgrade
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https://app.greenweb.org; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()

/.well-known/webfinger
  Content-Type: application/jrd+json; charset=utf-8
  Access-Control-Allow-Origin: *

/.well-known/host-meta
  Content-Type: application/xrd+xml; charset=utf-8

/.well-known/nostr.json
  Content-Type: application/json; charset=utf-8
  Access-Control-Allow-Origin: *

/.well-known/atproto-did
  Content-Type: text/plain; charset=utf-8

/.well-known/did.json
  Content-Type: application/did+ld+json; charset=utf-8

/feed.xml
  Content-Type: application/atom+xml; charset=utf-8

/_astro/*
  Cache-Control: public, max-age=31536000, immutable
```

**2. Redirects → `public/_redirects`**

```
/security.txt /.well-known/security.txt 301
/.well-known/avatar /icon-512.png 302
https://www.dwk.io/* https://dwk.io/:splat 301
```

**3. Static asset serving** → handled natively by Cloudflare Pages.

### Post-Build (Kept)

- `scripts/postbuild.ts` continues to use `addSriHashes()` and `signSecurityTxt()` from `@dwk/eleventy-shared/postbuild`. These utilities operate on built HTML files and have no Eleventy dependency. The only change: output directory `_site/` → `dist/`.
- Alternative: inline the SRI logic if we want to fully drop the shared package dependency. The signing requires `openpgp` which the shared package wraps.

## Favicon & Web Manifest

Currently `eleventy-plugin-gen-favicons` generates multiple favicon sizes, an Apple touch icon (with custom background/padding), `icon-512.png`, and `manifest.webmanifest` from the source `img/memoji.png`. This plugin is removed.

**Replacement:** Pre-generate all favicon assets and check them into `public/`:
- `public/favicon.ico` — 32x32 ICO
- `public/icon-192.png` — 192x192 PNG
- `public/icon-512.png` — 512x512 PNG
- `public/apple-touch-icon.png` — 180x180 PNG with #000000 background and 20px padding
- `public/manifest.webmanifest` — hand-written JSON referencing the above icons

The `<link>` tags for favicons move to `HeadLink.astro` as static markup (no plugin call). A one-time script or manual image export generates the icons before the migration; after that they're static assets.

This also resolves the `/.well-known/avatar` → `/icon-512.png` redirect — the file will exist in `public/`.

## Schema Validation

The current site validates JSON-LD at build time via `getSchema()` from `@dwk/eleventy-shared`. Since we're dropping the shared package for build-time use, validation is handled by:
- The Zod content collection schema validates front matter structure
- `HeadSchema.astro` does a runtime `JSON.stringify()` check and logs warnings for missing required fields (`@type`, `name`)
- Schema structure is simple enough that type-safe props prevent most errors

If stricter validation is needed later, `schema-dts` (TypeScript types for Schema.org) can be added as a dev dependency.

## Content Collections

```typescript
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default(['project']),
    hero: z.object({
      src: z.string(),
      alt: z.string(),
      title: z.string().optional(),
      caption: z.string().optional(),
    }).optional(),
    schema: z.record(z.any()),
  }),
});

export const collections = { projects };
```

### Schema Defaults for Projects

Currently `projects.11tydata.ts` sets default schema fields (`@type: CreativeWork`, `license`, `author`) that deep-merge with each project's front matter. In Astro, these defaults are applied in `ProjectLayout.astro` at render time:

```typescript
// In ProjectLayout.astro frontmatter
const defaultSchema = {
  "@type": "CreativeWork",
  license: "https://spdx.org/licenses/CC-BY-4.0.html",
  author: schema.author,  // from src/data/schema.ts
};
const mergedSchema = { ...defaultSchema, ...entry.data.schema };
```

This keeps project markdown files clean — they only specify overrides like `@type: SoftwareSourceCode`.

### Front Matter Changes

Project markdown files drop the WebC workaround fields:

```diff
 ---
 title: Noodle
 description: A self-hosted search engine...
 date: 2026-02-04T00:00:00.000Z
-permalink: /noodle/
-page:
-  url: /noodle/
 hero:
   src: src/projects/noodle/logo.png
   alt: Noodle logo, a blue letter N
 schema:
   "@type": SoftwareSourceCode
   ...
 ---
```

Permalinks are determined by file path in the content collection + the `[...slug].astro` dynamic route.

## Image Handling

| Current (Eleventy) | New (Astro) |
|---------------------|-------------|
| `eleventy-img` plugin | `astro:assets` built-in |
| WebP + JPEG formats | WebP + JPEG formats (same) |
| `eleventy:widths="128,64"` | `widths={[64, 128]}` prop |
| `loading="lazy"` default | `loading="lazy"` default |
| Output to `_site/img/` | Output to `dist/_astro/` |
| `createRequire` for node_modules resolution | Direct imports |

Static images (social icons, memoji, jsonfeed.svg) move to `public/img/` and are served unprocessed.

Project hero images referenced in front matter as relative paths are resolved by the Astro Image component at build time.

## Astro Configuration

```typescript
// astro.config.ts
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dwk.io',
  output: 'static',
  compressHTML: true,  // Minify HTML in production (replaces html-minifier-terser)
  build: {
    format: 'file',  // Produces about.html instead of about/index.html
  },
  integrations: [
    sitemap(),
  ],
});
```

Key settings:
- `output: 'static'` — all pages pre-rendered at build time
- `compressHTML: true` — replaces the `html-minifier-terser` transform; Astro handles minification natively
- `build.format: 'file'` — produces `about.html` instead of `about/index.html` for regular pages
- `site` — used by sitemap integration and canonical URLs

### Extensionless Endpoints

`build.format: 'file'` does NOT produce extensionless output for `.ts` endpoints. For endpoints like `webfinger`, `host-meta`, and `atproto-did` that must be served without a file extension, Astro static endpoints control their output filename via the file name itself: a file named `webfinger.ts` that exports a `GET()` function produces `dist/.well-known/webfinger` (no extension) because the `.ts` is stripped and there's no remaining extension. This works correctly for our extensionless endpoints without any special configuration.

## Dependencies

### Added
- `astro` ^5.x
- `@astrojs/sitemap`
- `@astrojs/rss`

### Kept
- `@dwk/eleventy-shared` (postbuild utilities only — `addSriHashes`, `signSecurityTxt`)
- `cheerio` (direct devDependency; optional peer dependency of `@dwk/eleventy-shared`, required by `addSriHashes()`)
- `openpgp` (direct devDependency; optional peer dependency of `@dwk/eleventy-shared`, required by `signSecurityTxt()`)
- `wrangler` (still needed for `wrangler pages deploy dist/`)

### Removed
- `@11ty/eleventy`
- `@11ty/eleventy-plugin-webc`
- `@11ty/eleventy-img`
- `eleventy-plugin-gen-favicons`
- `@cloudflare/vitest-pool-workers`
- `@cloudflare/workers-types`
- `vitest`
- `html-minifier-terser` (replaced by Astro's built-in `compressHTML: true`)
- `dotenv` (Astro has built-in `.env` support via Vite)
- All Eleventy-related type packages

## Files Removed

- `eleventy.config.ts`
- `wrangler.jsonc`
- `vitest.config.ts`
- `worker/` (entire directory: `index.ts`, `tsconfig.json`, `__tests__/`)
- `src/ambient.d.ts`
- `src/types.ts`
- `src/_layouts/` (replaced by `src/layouts/`)
- `src/_includes/` (replaced by `src/components/` + `src/styles/`)
- `src/index.webc`
- `src/index.11tydata.ts`
- `src/.well-known/keybase.txt.webc` (moved to `public/.well-known/keybase.txt`)
- `src/feed.xml.11ty.ts`
- `src/feed.json.11ty.ts`
- `src/llms.txt.11ty.ts`
- `src/projects/projects.11tydata.ts` (replaced by content collection schema)
- `worker-configuration.d.ts` (auto-generated Cloudflare Workers types; no longer needed)
- All `*.11ty.js` virtual template references

## IndieWeb Features (Preserved)

All IndieWeb markup ports directly to Astro templates — same HTML output:

- **h-card** in Header component: `p-name`, `u-url`, `u-uid`, `u-photo`
- **h-feed** on homepage: wraps project list
- **h-entry** in ProjectLayout: `p-name`, `dt-published`, `e-content`, `u-url`, `p-author`
- **rel="me"** links in Footer component
- **Feeds**: Atom (`feed.xml`) and JSON Feed (`feed.json`) with `<link rel="alternate">` discovery
- **IndieAuth/Webmention**: `<link>` tags in HeadLink component

## Deploy Changes

| Current | New |
|---------|-----|
| `npm run build` (Eleventy → `_site/`) | `npm run build` (Astro → `dist/`) |
| `npm run postbuild` (SRI + signing) | `npm run postbuild` (same, different path) |
| `wrangler deploy` (Worker + static assets) | `wrangler pages deploy dist/` |

## Testing Strategy

The Cloudflare Worker tests (`worker/__tests__/index.test.ts`) are deleted since the worker is removed. The security headers and redirects behavior can be verified by:

1. **Build verification** — `astro check` (TypeScript) + `astro build` (produces `dist/`)
2. **Output inspection** — verify all expected files exist in `dist/` with correct content
3. **Local preview** — `astro preview` serves the built site for manual checking
4. **Post-deploy** — curl-based smoke tests against the live site to verify headers, redirects, and well-known endpoints

## Monorepo Impact

- Changes are self-contained within `sites/dwk.io/`
- `@dwk/eleventy-shared` remains available for other Eleventy sites in the monorepo
- No changes to monorepo root `package.json` or workspace config
- The submodule commit updates normally after migration
