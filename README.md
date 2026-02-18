# dwk.io

DWK's Cyber Home — built with [Eleventy](https://www.11ty.dev/) and deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/) with [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

## Setup

```sh
npm install
```

### security.txt signing (optional)

The build can sign `/.well-known/security.txt` with an OpenPGP cleartext signature per [RFC 9116 Section 2.3](https://www.rfc-editor.org/rfc/rfc9116#section-2.3). To enable, add the following to a `.env` file or your CI environment:

```sh
GPG_PRIVATE_KEY="-----BEGIN PGP PRIVATE KEY BLOCK-----
...
-----END PGP PRIVATE KEY BLOCK-----"

# Only needed if the key is passphrase-protected
GPG_PASSPHRASE="your-passphrase"
```

If `GPG_PRIVATE_KEY` is not set, the build succeeds with an unsigned `security.txt`.

## Development

```sh
npm run start        # Eleventy dev server with live reload
npm run dev:worker   # Wrangler dev server (Workers + static assets)
npm run build        # Production build (outputs to _site/)
npm run typecheck    # Type check Eleventy and Worker code
npm run deploy       # Build and deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate worker-configuration.d.ts
```

The `postbuild` script runs automatically after `build` and handles:
- SRI integrity hashes on CSS/JS assets
- OpenPGP signing of `security.txt` (when `GPG_PRIVATE_KEY` is set)

## TODO
  - [ ] [IndieWebify.Me](https://indiewebify.me)
  - [x] [llms.txt](https://llmstxt.org/)
  - [x] ~~[Support Pages Functions](https://developers.cloudflare.com/pages/functions/)~~ Migrated to Workers
