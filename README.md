# dwk.io

DWK's Cyber Home — personal portfolio and project showcase.

## Development

```sh
npm run start        # Eleventy dev server with live reload
npm run dev:worker   # Wrangler dev server (Workers + static assets)
npm run build        # Production build (outputs to _site/)
npm test             # Run Worker tests
npm run typecheck    # Type check Eleventy and Worker code
npm run deploy       # Build and deploy to Cloudflare Workers
npm run cf-typegen   # Regenerate worker-configuration.d.ts
```

The `postbuild` script runs automatically after `build` and handles:
- SRI integrity hashes on CSS/JS assets
- OpenPGP signing of `security.txt` (when `GPG_PRIVATE_KEY` is set)
