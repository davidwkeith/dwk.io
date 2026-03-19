# dwk.io Eleventy → Astro Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert dwk.io from Eleventy 3 + Cloudflare Workers to Astro 5 + Cloudflare Pages while preserving all content, IndieWeb features, and the retro 1990s visual design.

**Architecture:** Static Astro site with content collections for projects, static endpoints for feeds and well-known files, Cloudflare Pages `_headers`/`_redirects` for security and routing. Post-build SRI hashing and security.txt signing via `@dwk/eleventy-shared/postbuild`.

**Tech Stack:** Astro 5, TypeScript (strict), `@astrojs/sitemap`, Cloudflare Pages

**Spec:** `docs/superpowers/specs/2026-03-19-eleventy-to-astro-migration-design.md`

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `astro.config.ts` | Astro build config (static output, sitemap, compressHTML) |
| `tsconfig.json` | Astro TypeScript config (replaces current) |
| `src/content.config.ts` | Content collection schema for projects |
| `src/layouts/BaseLayout.astro` | Root HTML document structure |
| `src/layouts/ProjectLayout.astro` | Project detail pages (wraps BaseLayout) |
| `src/components/HeadMeta.astro` | Meta tags (viewport, OG, Twitter, fediverse) |
| `src/components/HeadLink.astro` | Link tags (canonical, feeds, IndieAuth, favicons) |
| `src/components/HeadSchema.astro` | Schema.org JSON-LD injection |
| `src/components/Header.astro` | Site header (logo, title, feed icon) |
| `src/components/Footer.astro` | Footer (social icons, CC BY 4.0, Green Web badge) |
| `src/styles/global.css` | Retro CSS (ported from main.css) |
| `src/data/site.ts` | Site metadata + identity config |
| `src/data/navigation.ts` | Nav menu items |
| `src/data/schema.ts` | Schema.org Person JSON-LD |
| `src/pages/index.astro` | Homepage (h-card, h-feed, project list) |
| `src/pages/404.astro` | Error page |
| `src/pages/[...slug].astro` | Dynamic route for project pages |
| `src/pages/robots.txt.ts` | Robots.txt endpoint |
| `src/pages/humans.txt.ts` | Humans.txt endpoint |
| `src/pages/llms.txt.ts` | LLMs.txt endpoint |
| `src/pages/feed.xml.ts` | Atom feed endpoint |
| `src/pages/feed.json.ts` | JSON Feed endpoint |
| `src/pages/.well-known/gpc.json.ts` | GPC endpoint |
| `src/pages/.well-known/security.txt.ts` | Security.txt endpoint |
| `src/pages/.well-known/webfinger.ts` | Webfinger endpoint (extensionless) |
| `src/pages/.well-known/host-meta.ts` | Host-meta endpoint (extensionless) |
| `src/pages/.well-known/nostr.json.ts` | Nostr endpoint |
| `src/pages/.well-known/did.json.ts` | DID document endpoint |
| `src/pages/.well-known/atproto-did.ts` | ATProto DID endpoint (extensionless) |
| `src/pages/.well-known/dnt-policy.txt.ts` | DNT policy endpoint |
| `src/content/projects/noodle.md` | Noodle project (migrated) |
| `src/content/projects/pulletsforever.md` | Pullets Forever project (migrated) |
| `src/content/projects/crontab-clock.md` | Crontab Clock project (migrated) |
| `src/content/projects/fractionformatter.md` | FractionFormatter project (migrated) |
| `public/_headers` | Cloudflare Pages security headers |
| `public/_redirects` | Cloudflare Pages redirects |
| `public/manifest.webmanifest` | Web manifest (hand-written) |
| `public/.well-known/keybase.txt` | Keybase proof (static file) |

### Files to modify

| File | Change |
|------|--------|
| `package.json` | Replace dependencies, update scripts |
| `scripts/postbuild.ts` | Change build dir from `_site` to `dist`, remove dotenv import |
| `.gitignore` | Add `dist/`, `.astro/`, remove `_site/` |

### Files to delete

| File | Reason |
|------|--------|
| `eleventy.config.ts` | Replaced by `astro.config.ts` |
| `wrangler.jsonc` | No worker; Pages deploy uses CLI args |
| `vitest.config.ts` | Worker tests removed |
| `worker-configuration.d.ts` | Auto-generated worker types |
| `worker/` (entire directory) | No more worker |
| `src/ambient.d.ts` | Eleventy type declarations |
| `src/types.ts` | Replaced by Astro's built-in types + Zod |
| `src/_layouts/` | Replaced by `src/layouts/` |
| `src/_includes/` | Replaced by `src/components/` + `src/styles/` |
| `src/index.webc` | Replaced by `src/pages/index.astro` |
| `src/index.11tydata.ts` | Schema inline in index.astro |
| `src/feed.xml.11ty.ts` | Replaced by `src/pages/feed.xml.ts` |
| `src/feed.json.11ty.ts` | Replaced by `src/pages/feed.json.ts` |
| `src/llms.txt.11ty.ts` | Replaced by `src/pages/llms.txt.ts` |
| `src/projects/` | Content moves to `src/content/projects/` |
| `src/_data/` | Replaced by `src/data/` |
| `src/.well-known/keybase.txt.webc` | Moves to `public/.well-known/keybase.txt` |

### Files to move (images)

| From | To |
|------|-----|
| `img/memoji.png` | `public/img/memoji.png` |
| `img/jsonfeed.svg` | `public/img/jsonfeed.svg` |
| `img/social/*.png` | `public/img/social/*.png` |
| `src/projects/*/logo.*` | `src/content/projects/` (alongside .md files) |

---

## Task 1: Scaffold Astro project and install dependencies

**Files:**
- Modify: `package.json`
- Create: `astro.config.ts`
- Create: `tsconfig.json`
- Modify: `.gitignore`

- [ ] **Step 1: Update package.json**

Replace the entire `package.json` with Astro dependencies and scripts:

```json
{
  "name": "@dwk/dwk.io",
  "version": "2.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "postbuild": "node --experimental-strip-types scripts/postbuild.ts",
    "preview": "astro preview",
    "check": "astro check",
    "deploy": "npm run build && wrangler pages deploy dist/ --project-name dwk"
  },
  "keywords": [],
  "author": {
    "name": "David W. Keith",
    "email": "git@dwk.io",
    "url": "https://dwk.io/"
  },
  "license": "ISC",
  "description": "DWK's Cyber Home",
  "type": "module",
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "@astrojs/sitemap": "^3.2.0",
    "@dwk/eleventy-shared": "^0.2.0",
    "astro": "^5.7.0",
    "cheerio": "^1.2.0",
    "openpgp": "^6.3.0",
    "typescript": "^5.9.3",
    "wrangler": "^4.66.0"
  }
}
```

- [ ] **Step 2: Create astro.config.ts**

```typescript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dwk.io',
  output: 'static',
  compressHTML: true,
  integrations: [
    sitemap(),
  ],
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@data/*": ["src/data/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.astro",
    "scripts/**/*.ts"
  ]
}
```

- [ ] **Step 4: Update .gitignore**

Replace `_site/` with `dist/` and add `.astro/`:

```
node_modules/
dist/
.astro/
.cache/
.DS_Store
.env
*.log
*.tmp
.wrangler/
.superpowers/
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: Clean install with Astro and all dependencies

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json astro.config.ts tsconfig.json .gitignore
git commit -m "build: scaffold Astro project with dependencies"
```

---

## Task 2: Create static assets and Cloudflare Pages config

**Files:**
- Create: `public/_headers`
- Create: `public/_redirects`
- Create: `public/manifest.webmanifest`
- Move: `src/.well-known/keybase.txt.webc` → `public/.well-known/keybase.txt`
- Move: `img/` → `public/img/`

- [ ] **Step 1: Create public/_headers**

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

- [ ] **Step 2: Create public/_redirects**

```
/security.txt /.well-known/security.txt 301
/.well-known/avatar /icon-512.png 302
https://www.dwk.io/* https://dwk.io/:splat 301
```

- [ ] **Step 3: Create public/manifest.webmanifest**

```json
{
  "name": "DWK's Cyber Home",
  "short_name": "DWK",
  "description": "David W. Keith's personal website.",
  "lang": "en",
  "start_url": "/",
  "display": "browser",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 4: Move keybase.txt to public/**

Strip the WebC front matter and copy the plain text content to `public/.well-known/keybase.txt`.

```bash
mkdir -p public/.well-known
# Copy content without the YAML front matter (first 4 lines)
tail -n +5 src/.well-known/keybase.txt.webc > public/.well-known/keybase.txt
```

- [ ] **Step 5: Move images to public/**

```bash
mkdir -p public/img/social
cp img/memoji.png public/img/
cp img/jsonfeed.svg public/img/
cp img/social/*.png public/img/social/
```

- [ ] **Step 6: Generate favicon assets**

Generate the favicon sizes from `img/memoji.png` and place them in `public/`. Use sharp or a similar tool:

```bash
npx sharp-cli -i img/memoji.png -o public/icon-512.png resize 512 512
npx sharp-cli -i img/memoji.png -o public/icon-192.png resize 192 192
npx sharp-cli -i img/memoji.png -o public/apple-touch-icon.png resize 180 180
npx sharp-cli -i img/memoji.png -o public/favicon.ico resize 32 32
```

Note: The apple-touch-icon ideally should have a #000000 background with 20px padding matching the current `eleventy-plugin-gen-favicons` config. If the simple resize doesn't match, manually adjust using an image editor.

- [ ] **Step 7: Commit**

```bash
git add public/
git commit -m "feat: add Cloudflare Pages config, static assets, and favicons"
```

---

## Task 3: Create data files and content collection

**Files:**
- Create: `src/data/site.ts`
- Create: `src/data/navigation.ts`
- Create: `src/data/schema.ts`
- Create: `src/content.config.ts`
- Create: `src/content/projects/noodle.md`
- Create: `src/content/projects/pulletsforever.md`
- Create: `src/content/projects/crontab-clock.md`
- Create: `src/content/projects/fractionformatter.md`

- [ ] **Step 1: Create src/data/site.ts**

Port from `src/_data/site.ts`, dropping Eleventy-specific fields. Add identity config that was in `eleventy.config.ts`:

```typescript
export const site = {
  title: "DWK's Cyber Home",
  description: "David W. Keith's personal website.",
  url: "https://dwk.io",
  language: "en",
  fediverseCreator: "@dwk@xn--4t8h.dwk.io",
  copyright: `CC-BY-4.0 David W. Keith ${new Date().getFullYear()}`,
  rating: "general",
  colorScheme: { content: "dark light" },
  hasNavigation: true,
  logo: {
    src: "/img/memoji.png",
    alt: "Memoji of DWK's head",
  },
  defaultOgImage: "/img/memoji.png",
  headLinks: [
    { rel: "authorization_endpoint", href: "https://indieauth.com/auth" },
    { rel: "token_endpoint", href: "https://tokens.indieauth.com/token" },
    { rel: "webmention", href: "https://webmention.io/dwk.io/webmention" },
    { rel: "code-repository", href: "https://gitlab.com/dwk-io/dwk.io.git" },
    { rel: "content-repository", href: "https://gitlab.com/dwk-io/dwk.io.git" },
    { rel: "issues", href: "https://gitlab.com/dwk-io/dwk.io/-/issues" },
    { rel: "code-license", href: "https://opensource.org/license/isc-license-txt" },
    { rel: "content-license", href: "https://spdx.org/licenses/CC-BY-4.0.html" },
    { rel: "donation", href: "https://www.buymeacoffee.com/davidwkeith" },
    { rel: "root", href: "https://dwk.io" },
  ],
  social: {
    blog: "https://pulletsforever.com",
    bluesky: "https://bsky.app/profile/dwk.io",
    facebook: "https://www.facebook.com/davidwkeith",
    github: "https://github.com/davidwkeith",
    gitlab: "https://gitlab.com/davidwkeith",
    keybase: "https://keybase.io/dwkeith",
    linkedin: "https://www.linkedin.com/in/davidwkeith",
    mastodon: "https://xn--4t8h.dwk.io/@Dwk",
    reddit: "https://www.reddit.com/user/dwkeith",
    email: "mailto:me@dwk.io",
  },
  identity: {
    securityContact: "mailto:security@dwk.io",
    webfinger: { handle: "dwk", instance: "xn--4t8h.dwk.io" },
    nostr: { handle: "dwk", pubkey: "096a5ff28249cae96026c34167163991fb6e9729fe6257c688b40fa7e684698c" },
    atprotoDid: "did:plc:rxtknc5m5ixmscnq3xdamqxc",
    didDocument: {
      services: [
        { id: "website", type: "LinkedDomains", endpoint: "https://dwk.io" },
        { id: "mastodon", type: "LinkedDomains", endpoint: "https://xn--4t8h.dwk.io/@dwk" },
        { id: "bluesky", type: "LinkedDomains", endpoint: "https://bsky.app/profile/dwk.io" },
      ],
    },
  },
} as const;
```

- [ ] **Step 2: Create src/data/navigation.ts**

```typescript
export const navigation = [
  { text: "Home", url: "/" },
  { text: "Projects", url: "/projects/" },
] as const;
```

- [ ] **Step 3: Create src/data/schema.ts**

Port directly from `src/_data/schema.ts`:

```typescript
export const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  description: "Cyberhome of David W. Keith",
  author: {
    "@type": "Person",
    name: "David W. Keith",
    url: "https://dwk.io",
    image: "https://dwk.io/icon-512.png",
    email: "mailto:me@dwk.io",
    alumniOf: [
      { "@type": "CollegeOrUniversity", name: "Cornell College", url: "https://cornellcollege.edu/" },
      { "@type": "HighSchool", name: "St. Johnsbury Academy", url: "https://stjacademy.org" },
    ],
    sameAs: [
      "https://bsky.app/profile/dwk.io",
      "https://github.com/davidwkeith",
      "https://gitlab.com/davidwkeith",
      "https://keybase.io/dwkeith",
      "https://www.facebook.com/davidwkeith",
      "https://www.linkedin.com/in/davidwkeith",
      "https://www.reddit.com/user/dwkeith",
      "https://xn--4t8h.dwk.io/@dwk",
    ],
    affiliation: { "@type": "Organization", name: "Silicon Valley Bicycle Coalition", url: "https://bikesiliconvalley.org" },
    birthDate: "1978-12-14",
    birthPlace: { "@type": "Place", name: "Boston, MA", url: "https://www.boston.gov" },
    callSign: "N1UEU",
    familyName: "Keith",
    givenName: "David",
    additionalName: "William",
    gender: "Male",
    height: "173 cm",
    nationality: { "@type": "Country", name: "United States of America", url: "https://www.usa.gov" },
  },
} as const;
```

- [ ] **Step 4: Create src/content.config.ts**

```typescript
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

- [ ] **Step 5: Migrate project markdown files**

Create `src/content/projects/` and migrate all 4 project files, dropping the `permalink` and `page.url` fields. Copy image assets alongside, renaming where needed to avoid collisions (two projects have `logo.png`).

```bash
mkdir -p src/content/projects
# Copy images with unique names
cp src/projects/noodle/logo.png src/content/projects/noodle-logo.png
cp src/projects/pulletsforever/logo.svg src/content/projects/pulletsforever-logo.svg
cp src/projects/crontab-clock/logo.png src/content/projects/crontab-clock-logo.png
cp src/projects/fractionformatter/logo.webp src/content/projects/fractionformatter-logo.webp
```

Then create each `.md` file with updated `hero.src` paths pointing to the co-located renamed image (e.g., `./noodle-logo.png`).

- [ ] **Step 6: Commit**

```bash
git add src/data/ src/content.config.ts src/content/projects/
git commit -m "feat: add data files and content collection with migrated projects"
```

---

## Task 4: Create components

**Files:**
- Create: `src/components/HeadMeta.astro`
- Create: `src/components/HeadLink.astro`
- Create: `src/components/HeadSchema.astro`
- Create: `src/components/Header.astro`
- Create: `src/components/Footer.astro`

- [ ] **Step 1: Create src/components/HeadMeta.astro**

Port from `head-meta.webc`. Props replace WebC data bindings:

```astro
---
interface Props {
  title?: string;
  description?: string;
  url: string;
}

import { site } from '../data/site';

const { title, description, url } = Astro.props;
const pageTitle = title ?? site.title;
const pageDescription = description ?? site.description;
const ogImage = new URL(site.defaultOgImage, site.url).toString();
---

<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content={Astro.generator}>
<meta name="color-scheme" content={site.colorScheme.content}>
{pageDescription && <meta name="description" content={pageDescription} />}

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:url" content={url}>
<meta property="og:title" content={pageTitle}>
<meta property="og:description" content={pageDescription}>
<meta property="og:image" content={ogImage}>
<meta property="og:image:alt" content={pageTitle}>
<meta property="og:image:width" content="1200">
<meta property="og:site_name" content={site.title}>
<meta property="og:locale" content="en_US">

<!-- Twitter -->
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content={pageTitle}>
<meta name="twitter:description" content={pageDescription}>
<meta name="twitter:image" content={ogImage}>
<meta name="twitter:image:alt" content={pageTitle}>

{site.fediverseCreator && <meta name="fediverse:creator" content={site.fediverseCreator} />}
{site.copyright && <meta name="copyright" content={site.copyright} />}
{site.rating && <meta name="rating" content={site.rating} />}
```

- [ ] **Step 2: Create src/components/HeadLink.astro**

Port from `head-link.webc`. Replace favicon plugin call with static links:

```astro
---
interface Props {
  canonicalUrl: string;
}

import { site } from '../data/site';

const { canonicalUrl } = Astro.props;
---

<link rel="canonical" href={canonicalUrl}>
{site.headLinks.map(link => (
  <link rel={link.rel} href={link.href} />
))}

<!-- Favicons -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">

<!-- Feeds -->
<link rel="alternate" type="application/json" href={`${site.url}/feed.json`} title="JSON Feed" />
<link rel="alternate" type="application/atom+xml" href={`${site.url}/feed.xml`} title="Atom Feed" />

<!-- Other -->
<link rel="dns-prefetch" href="https://app.greenweb.org">
<link type="text/plain" rel="author" href={`${site.url}/humans.txt`} />
```

- [ ] **Step 3: Create src/components/HeadSchema.astro**

Port from `head-js.webc`. Serialize JSON-LD with basic validation:

```astro
---
interface Props {
  schema: Record<string, unknown>;
  pageUrl: string;
}

const { schema, pageUrl } = Astro.props;
const schemaWithUrl = { ...schema, url: pageUrl };
const jsonLd = JSON.stringify(schemaWithUrl);

if (!schema['@type']) {
  console.warn(`HeadSchema: missing @type for ${pageUrl}`);
}
---

<script is:inline type="application/ld+json" set:html={jsonLd} />
```

- [ ] **Step 4: Create src/components/Header.astro**

Port from `custom/header.webc`. Replace eleventy-image with standard img tags (static assets in public/):

```astro
---
import { site } from '../data/site';
---

<header>
  <h1>
    <a href="/" class="hero-image">
      <img src={site.logo.src} alt={site.logo.alt} width="64" height="64" loading="eager" fetchpriority="high">
    </a>
    {site.title}
  </h1>
  <div class="feedicon">
    <a href={`${site.url}/feed.json`} title="JSON Feed (RSS)">
      <img src="/img/jsonfeed.svg" alt="JSON Feed" width="32" height="32">
    </a>
  </div>
</header>

<style>
  header {
    display: flex;
    gap: 1em .5em;
    flex-wrap: wrap;
    align-items: center;
    border: 2px solid var(--border-color);
    background-color: var(--header-background);
    color: var(--header-text);
    padding: 1rem;
    text-align: center;
  }

  header:after {
    content: "";
    display: table;
    clear: both;
  }

  h1 {
    margin: 0;
    font-size: 2.5rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
  }

  h1 img {
    vertical-align: middle;
  }

  a.hero-image {
    display: inline-block;
    vertical-align: middle;
    margin-right: 0.5em;
    text-decoration: none;
  }

  .feedicon img {
    width: 2em;
    height: 2em;
    position: absolute;
    top: 1em;
    right: 1em;
  }
</style>
```

- [ ] **Step 5: Create src/components/Footer.astro**

Port from `custom/footer.webc`. Replace eleventy-image with standard img tags:

```astro
---
import { site } from '../data/site';
import { schema } from '../data/schema';
---

<footer>
  <ul>
    {Object.entries(site.social).map(([service, url]) => (
      <li>
        <a href={url} rel="me external">
          <img src={`/img/social/${service}.png`} alt={`${service} icon`} title={service} width="32" height="32">
        </a>
      </li>
    ))}
  </ul>
  <p>
    <a property="dct:title" rel="cc:attributionURL" href={site.url}>{site.title}</a>
    {' '}by{' '}
    <a rel="cc:attributionURL dct:creator author me" property="cc:attributionName" href={schema.author.url}>{schema.author.name}</a>
    {' '}is licensed under{' '}
    <a href="https://creativecommons.org/licenses/by/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">
      Creative Commons Attribution 4.0 International
      <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt="Creative Commons logo" width="22" height="22" style="width:1rem;height:1rem;margin-left:0.5rem;vertical-align:text-bottom;">
      <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt="Attribution Required" width="22" height="22" style="width:1rem;height:1rem;margin-left:0.5rem;vertical-align:text-bottom;">
    </a>
  </p>
  <div class="greenweb-wrapper">
    <img id="greenweb-badge" width="200" height="95"
      src="https://app.greenweb.org/api/v3/greencheckimage/dwk.io?nocache=true"
      alt="This website runs on green hosting - verified by thegreenwebfoundation.org">
  </div>
</footer>

<style>
  ul {
    list-style: none;
    padding: 0;
    text-align: center;
  }

  ul > li {
    display: inline-block;
  }

  ul > li > a {
    display: inline-block;
    padding: 1rem;
  }

  p {
    margin: 1rem auto;
    max-width: 30rem;
    font-size: 0.9rem;
    line-height: 1.5;
    text-align: center;
  }

  .greenweb-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 4rem;
  }
</style>
```

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat: add Astro head, header, and footer components"
```

---

## Task 5: Create layouts and global CSS

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`
- Create: `src/layouts/ProjectLayout.astro`

- [ ] **Step 1: Create src/styles/global.css**

Copy `src/_includes/main.css` verbatim:

```bash
mkdir -p src/styles
cp src/_includes/main.css src/styles/global.css
```

- [ ] **Step 2: Create src/layouts/BaseLayout.astro**

```astro
---
import '../styles/global.css';
import HeadMeta from '../components/HeadMeta.astro';
import HeadLink from '../components/HeadLink.astro';
import HeadSchema from '../components/HeadSchema.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { site } from '../data/site';
import { schema as defaultSchema } from '../data/schema';

interface Props {
  title?: string;
  description?: string;
  schema?: Record<string, unknown>;
}

const { title, description, schema: pageSchema } = Astro.props;
const pageTitle = title ? `${title} — ${site.title}` : site.title;
const canonicalUrl = new URL(Astro.url.pathname, site.url).toString();
const resolvedSchema = pageSchema ?? defaultSchema;
---

<!doctype html>
<html lang="en">
  <head>
    <title>{pageTitle}</title>
    <HeadMeta title={title ?? site.title} description={description} url={canonicalUrl} />
    <HeadLink canonicalUrl={canonicalUrl} />
    <HeadSchema schema={resolvedSchema} pageUrl={canonicalUrl} />
  </head>
  <body>
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <Header />
    <main id="main-content">
      <slot />
    </main>
    <Footer />
    <script is:inline type="speculationrules">
    {
      "prerender": [{ "where": { "href_matches": "/*" }, "eagerness": "moderate" }]
    }
    </script>
  </body>
</html>
```

- [ ] **Step 3: Create src/layouts/ProjectLayout.astro**

```astro
---
import BaseLayout from './BaseLayout.astro';
import { site } from '../data/site';
import { schema as globalSchema } from '../data/schema';

interface Props {
  title: string;
  description?: string;
  date: Date;
  hero?: { src: string; alt: string; title?: string; caption?: string };
  schema: Record<string, unknown>;
  slug: string;
}

const { title, description, date, hero, schema: projectSchema, slug } = Astro.props;

const mergedSchema = {
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  license: "https://spdx.org/licenses/CC-BY-4.0.html",
  author: globalSchema.author,
  ...projectSchema,
};

const projectUrl = new URL(`/${slug}/`, site.url).toString();
const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
---

<BaseLayout title={title} description={description} schema={mergedSchema}>
  <article class="h-entry">
    <h2 class="p-name">{title}</h2>
    <ul class="post-metadata">
      <li><time class="dt-published" datetime={date.toISOString()}>{formattedDate}</time></li>
    </ul>
    {hero && (
      <figure class="project-hero-image">
        <img src={hero.src} alt={hero.alt} title={hero.title} width="150" height="150">
        {hero.caption && <figcaption>{hero.caption}</figcaption>}
      </figure>
    )}
    <div class="e-content">
      <slot />
    </div>
    <a class="u-url" href={projectUrl} style="display:none"></a>
    <span class="p-author h-card" style="display:none">
      <a class="p-name u-url" href={globalSchema.author.url}>{globalSchema.author.name}</a>
    </span>
  </article>
</BaseLayout>

<style>
  .project-hero-image img {
    height: 150px;
    width: 150px;
  }

  .project-hero-image figcaption {
    font-size: 0.8em;
    color: #444;
    margin-top: 0.5em;
  }

  figure {
    float: left;
  }

  article {
    padding-top: 1em;
  }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/ src/layouts/
git commit -m "feat: add base and project layouts with global CSS"
```

---

## Task 6: Create pages (homepage, 404, project route)

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/pages/404.astro`
- Create: `src/pages/[...slug].astro`

- [ ] **Step 1: Create src/pages/index.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { schema } from '../data/schema';

const projects = (await getCollection('projects')).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: schema.author,
};
---

<BaseLayout description="The Cyber Home of DWK" schema={pageSchema}>
  <div class="h-card">
    <a class="p-name u-url u-uid" href={site.url}>{schema.author.name}</a>
    <data class="u-photo" value={`${site.url}/icon-512.png`}></data>
  </div>
  <div class="h-feed">
    <h2 class="p-name">Projects</h2>
    <ul>
      {projects.map(project => (
        <li class="h-entry">
          <a class="u-url p-name" href={`/${project.id}/`}>{project.data.title}</a>
        </li>
      ))}
    </ul>
  </div>
</BaseLayout>
```

- [ ] **Step 2: Create src/pages/404.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="404 Not Found">
  <h2>Content not found</h2>
  <p>The page you're looking for doesn't exist. <a href="/">Go home</a>.</p>
</BaseLayout>
```

- [ ] **Step 3: Create src/pages/[...slug].astro**

```astro
---
import { getCollection, render } from 'astro:content';
import ProjectLayout from '../layouts/ProjectLayout.astro';

export async function getStaticPaths() {
  const projects = await getCollection('projects');
  return projects.map(project => ({
    params: { slug: project.id },
    props: { project },
  }));
}

const { project } = Astro.props;
const { Content } = await render(project);
---

<ProjectLayout
  title={project.data.title}
  description={project.data.description}
  date={project.data.date}
  hero={project.data.hero}
  schema={project.data.schema}
  slug={project.id}
>
  <Content />
</ProjectLayout>
```

- [ ] **Step 4: Verify build**

Run: `npx astro build`
Expected: Build succeeds, `dist/` contains `index.html`, `404.html`, and project pages

- [ ] **Step 5: Commit**

```bash
git add src/pages/
git commit -m "feat: add homepage, 404, and project pages"
```

---

## Task 7: Create feed and text endpoints

**Files:**
- Create: `src/pages/feed.xml.ts`
- Create: `src/pages/feed.json.ts`
- Create: `src/pages/robots.txt.ts`
- Create: `src/pages/humans.txt.ts`
- Create: `src/pages/llms.txt.ts`

- [ ] **Step 1: Create src/pages/feed.xml.ts**

Hand-built Atom XML (preserves exact output format):

```typescript
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { schema } from '../data/schema';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export const GET: APIRoute = async () => {
  const projects = await getCollection('projects');
  const author = schema.author;
  const feedUrl = `${site.url}/feed.xml`;

  const mostRecent = projects.length > 0
    ? new Date(Math.max(...projects.map(p => p.data.date.getTime())))
    : new Date();

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(site.title)}</title>
  <subtitle>${escapeXml(site.description)}</subtitle>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(site.url)}" rel="alternate" type="text/html"/>
  <id>${escapeXml(site.url)}</id>
  <updated>${mostRecent.toISOString()}</updated>
  <author>
    <name>${escapeXml(author.name)}</name>
    <email>${escapeXml(author.email.replace('mailto:', ''))}</email>
    <uri>${escapeXml(author.url)}</uri>
  </author>
  <icon>${escapeXml(`${site.url}/icon-512.png`)}</icon>
  <rights>${escapeXml(site.copyright)}</rights>
  <generator>Astro</generator>
`;

  for (const project of projects) {
    const url = `${site.url}/${project.id}/`;
    const summary = project.data.description;

    xml += `  <entry>
    <title>${escapeXml(project.data.title)}</title>
    <link href="${escapeXml(url)}" rel="alternate" type="text/html"/>
    <id>${escapeXml(url)}</id>
    <published>${project.data.date.toISOString()}</published>
    <updated>${project.data.date.toISOString()}</updated>
${summary ? `    <summary>${escapeXml(summary)}</summary>\n` : ''}    <author>
      <name>${escapeXml(author.name)}</name>
      <uri>${escapeXml(author.url)}</uri>
    </author>
  </entry>
`;
  }

  xml += `</feed>\n`;
  return new Response(xml);
};
```

- [ ] **Step 2: Create src/pages/feed.json.ts**

```typescript
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';
import { schema } from '../data/schema';

export const GET: APIRoute = async () => {
  const projects = await getCollection('projects');
  const author = schema.author;

  const feed = {
    version: "https://jsonfeed.org/version/1",
    title: site.title,
    home_page_url: site.url,
    feed_url: `${site.url}/feed.json`,
    description: site.description,
    icon: `${site.url}/icon-512.png`,
    author: { name: author.name, url: author.url, avatar: author.image },
    items: projects.map(project => ({
      id: `${site.url}/${project.id}/`,
      title: project.data.title,
      url: `${site.url}/${project.id}/`,
      summary: project.data.description,
      date_published: project.data.date.toISOString(),
      date_modified: project.data.date.toISOString(),
      author: { name: author.name, url: author.url, avatar: author.image },
      tags: project.data.tags,
    })),
  };

  return new Response(JSON.stringify(feed));
};
```

- [ ] **Step 3: Create src/pages/robots.txt.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../data/site';

export const GET: APIRoute = () => {
  return new Response(`User-agent: *
Disallow:

Sitemap: ${site.url}/sitemap-index.xml`);
};
```

- [ ] **Step 4: Create src/pages/humans.txt.ts**

```typescript
import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';

function getCommitHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'unknown';
  }
}

export const GET: APIRoute = () => {
  const now = new Date();
  const buildDate = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: 'numeric', timeZoneName: 'short', timeZone: 'UTC',
  });

  return new Response(`/* TEAM */
\tDavid W. Keith @dwk.io

/* THANKS */
\tThanks to the Astro team for creating such a great static site generator.
\tThanks to the contributors of the projects I use on this site.
\tThanks to the contributors of the projects I have used in the past.
\tThanks to my family and friends for their support.

/* SITE */
Build Date: ${buildDate}
Generator: Astro
Package Version: 2.0.0
Commit Hash: ${getCommitHash()}`);
};
```

- [ ] **Step 5: Create src/pages/llms.txt.ts**

```typescript
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '../data/site';

export const GET: APIRoute = async () => {
  const projects = (await getCollection('projects'))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const projectList = projects
    .map(p => {
      const desc = p.data.schema?.abstract || p.data.description || p.data.title;
      return `- [${p.data.title}](${site.url}/${p.id}/): ${desc}`;
    })
    .join('\n');

  return new Response(`# ${site.title}

> ${site.description} A portfolio and project showcase for David W. Keith (DWK).

This site is built with Astro and hosted on Cloudflare Pages. It uses a 1990s retro aesthetic with monospace typography and supports both dark and light modes.

## Projects

${projectList}

## Optional

- [JSON Feed](${site.url}/feed.json): RSS-like feed of project updates
- [Sitemap](${site.url}/sitemap-index.xml): XML sitemap`);
};
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/feed.xml.ts src/pages/feed.json.ts src/pages/robots.txt.ts src/pages/humans.txt.ts src/pages/llms.txt.ts
git commit -m "feat: add feed, robots, humans, and llms endpoints"
```

---

## Task 8: Create well-known endpoints

**Files:**
- Create: all 8 files in `src/pages/.well-known/`

- [ ] **Step 1: Create src/pages/.well-known/gpc.json.ts**

```typescript
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify({
    gpc: true,
    lastUpdate: new Date().toISOString().split('T')[0],
  }));
};
```

- [ ] **Step 2: Create src/pages/.well-known/security.txt.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  return new Response(`Contact: ${site.identity.securityContact}
Expires: ${expires.toISOString()}
Preferred-Languages: ${site.language}
Canonical: ${site.url}/.well-known/security.txt`);
};
```

- [ ] **Step 3: Create src/pages/.well-known/webfinger.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const { handle, instance } = site.identity.webfinger;

  return new Response(JSON.stringify({
    subject: `acct:${handle}@${instance}`,
    aliases: [`https://${instance}/@${handle}`, `https://${instance}/users/${handle}`],
    links: [
      { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: `https://${instance}/@${handle}` },
      { rel: "self", type: "application/activity+json", href: `https://${instance}/users/${handle}` },
      { rel: "http://ostatus.org/schema/1.0/subscribe", template: `https://${instance}/authorize_interaction?uri={uri}` },
    ],
  }));
};
```

- [ ] **Step 4: Create src/pages/.well-known/host-meta.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/jrd+json" template="${site.url}/.well-known/webfinger?resource={uri}"/>
</XRD>`);
};
```

- [ ] **Step 5: Create src/pages/.well-known/nostr.json.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const { handle, pubkey } = site.identity.nostr;
  return new Response(JSON.stringify({
    names: { [handle]: pubkey, _: pubkey },
    relays: {},
  }));
};
```

- [ ] **Step 6: Create src/pages/.well-known/did.json.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const domain = new URL(site.url).hostname;
  return new Response(JSON.stringify({
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"],
    id: `did:web:${domain}`,
    service: site.identity.didDocument.services.map(s => ({
      id: `did:web:${domain}#${s.id}`,
      type: s.type,
      serviceEndpoint: s.endpoint,
    })),
  }));
};
```

- [ ] **Step 7: Create src/pages/.well-known/atproto-did.ts**

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  return new Response(site.identity.atprotoDid);
};
```

- [ ] **Step 8: Create src/pages/.well-known/dnt-policy.txt.ts**

This file contains the full EFF DNT policy text. The `site.url` is interpolated for the canonical URL line. Create this file with the complete policy text from the current build output at `_site/.well-known/dnt-policy.txt`, replacing the hardcoded URL with `${site.url}`.

```typescript
import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  // Full EFF DNT policy — see _site/.well-known/dnt-policy.txt for reference
  return new Response(`Do Not Track Compliance Policy
...
be posted via HTTPS at ${site.url}/.well-known/dnt-policy.txt
...`);
  // Note: implementer should copy the full policy text from the current output
};
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/.well-known/
git commit -m "feat: add all well-known endpoints"
```

---

## Task 9: Update postbuild script and verify full build

**Files:**
- Modify: `scripts/postbuild.ts`

- [ ] **Step 1: Update scripts/postbuild.ts**

Change build directory from `_site` to `dist` and remove `dotenv` import:

```typescript
import { addSriHashes, signSecurityTxt } from "@dwk/eleventy-shared/postbuild";

const buildDir = "./dist";

try {
  await addSriHashes(buildDir);
  await signSecurityTxt(buildDir);
} catch (e) {
  console.error("Postbuild error:", e);
  process.exit(1);
}
```

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Astro build succeeds, `dist/` contains all pages and endpoints

- [ ] **Step 3: Run postbuild**

Run: `npm run postbuild`
Expected: SRI hashes added, security.txt signing skipped (no GPG key)

- [ ] **Step 4: Verify output files exist**

Run: `find dist -type f | sort`

Expected key files: `index.html`, `404.html`, project pages, `feed.xml`, `feed.json`, `robots.txt`, `humans.txt`, `llms.txt`, `sitemap-index.xml`, all `.well-known/*` files, `_headers`, `_redirects`, `manifest.webmanifest`, `keybase.txt`

- [ ] **Step 5: Commit**

```bash
git add scripts/postbuild.ts
git commit -m "build: update postbuild script for Astro dist/ output"
```

---

## Task 10: Clean up old Eleventy files

- [ ] **Step 1: Delete old Eleventy config and worker files**

```bash
git rm eleventy.config.ts wrangler.jsonc vitest.config.ts worker-configuration.d.ts
git rm -r worker/
```

- [ ] **Step 2: Delete old source files**

```bash
git rm src/ambient.d.ts src/types.ts
git rm -r src/_layouts/ src/_includes/ src/_data/
git rm src/index.webc src/index.11tydata.ts
git rm src/feed.xml.11ty.ts src/feed.json.11ty.ts src/llms.txt.11ty.ts
git rm -r src/projects/
git rm -r src/.well-known/
```

- [ ] **Step 3: Delete old image directory** (now in public/)

```bash
git rm -r img/
```

- [ ] **Step 4: Run final build to confirm everything still works**

Run: `npm run build && npm run postbuild`
Expected: Clean build with no errors

- [ ] **Step 5: Run astro check**

Run: `npx astro check`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git status
git commit -m "chore: remove old Eleventy files, worker, and WebC components"
```

Note: The `git rm` commands above already stage the deletions. Verify with `git status` that only expected deletions are staged before committing.

---

## Task 11: Update CLAUDE.md and final verification

- [ ] **Step 1: Update CLAUDE.md**

Update the site-level `CLAUDE.md` to reflect Astro architecture, commands, and conventions. Key changes:
- Replace Eleventy references with Astro
- Update commands (`npm run start` → `npm run dev`, `npm run typecheck` → `npm run check`)
- Remove worker-related sections
- Update architecture description
- Remove WebC and eleventy-plugin references
- Update deploy command to `wrangler pages deploy dist/`

- [ ] **Step 2: Preview the site locally**

Run: `npx astro preview`
Expected: Site loads, all pages render with retro theme

- [ ] **Step 3: Spot-check key outputs**

Verify: homepage h-card, project pages h-entry, feed links, rel="me" social links, dark mode

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Astro migration"
```
