# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio/project showcase website for dwk.io, built with Eleventy (11ty) v3 using ES modules and WebC components. Hosted on Cloudflare Pages.

## Commands

- `npm run start` — Dev server with live reload
- `npm run build` — Production build (outputs to `_site/`)
- `npm run postbuild` — Adds SRI hashes to CSS/JS assets (runs automatically after build)

There are no tests or linting commands configured.

## Architecture

**Eleventy config:** `eleventy.config.js` — source is `src/`, output is `_site/`, includes are `_includes/`, layouts are `_layouts/`. Template engines: WebC for HTML/Markdown, plus 11ty.js.

**Content pipeline:**
1. WebC/Markdown templates processed by Eleventy
2. Images optimized to WebP + JPEG via `@11ty/eleventy-img`
3. Markdown images are intercepted and routed through the `image` shortcode (custom markdown-it renderer override)
4. HTML minified via `html-minifier-terser` transform
5. Post-build: `scripts/postbuild.js` adds SHA-384 SRI integrity attributes to local CSS/JS using cheerio

**Global data** (`src/_data/`):
- `site.js` — Site metadata (title, URL, social links, favicon config)
- `navigation.js` — Nav menu items
- `schema.js` — Schema.org Person JSON-LD template

**Layouts** (`src/_layouts/`):
- `base.webc` — Root HTML document structure
- `project.webc` — Project detail pages

**Components** (`src/_includes/`):
- `main.css` / `main.js` — Global bundled styles and scripts
- `head-meta.webc`, `head-link.webc`, `head-js.webc` — Document head partials
- `custom/header.webc`, `custom/footer.webc` — Site chrome

**Projects** live in `src/projects/<name>/` with an `index.md` and assets. Shared front matter is in `src/projects/projects.11tydata.js` (sets layout, tags, schema type).

**Generated files** in `src/`: `_headers.11ty.js` and `_redirects.11ty.js` produce Cloudflare Pages config; `feed.json.11ty.js` produces JSON Feed; `sitemap.xml.webc`, `robots.txt.webc`, `humans.txt.webc` produce standard web files.

## Key Conventions

- `setFreezeReservedData(false)` is set as a workaround for eleventy-plugin-webc issue #86 — when using dynamic permalinks in WebC, duplicate the permalink value in `page.url` front matter.
- Schema.org JSON-LD is validated at build time via `jsonld-lint` — invalid schema will fail the build.
- Images require alt text; missing alt logs a warning.
- 1990s retro theme: monospace typography (Courier New), silver/gray light mode, dark cyan/blue dark mode. Both modes supported via `prefers-color-scheme`.
