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

### security.txt signing key

Signing happens at build time, so `GPG_PRIVATE_KEY` (and `GPG_PASSPHRASE`, if the key has one) must be
**build** secrets: Cloudflare dashboard → Workers → `dwk` → Settings → Build → Variables and secrets.
Runtime secrets (`wrangler secret put`) are only visible to `worker.js` and won't work. Production builds
on `main` fail if the key is missing. For local `npm run deploy`, put the same values in `.env`.

Use a signing-only subkey rather than the primary key:

```sh
gpg --armor --export-secret-subkeys '<SIGNING_SUBKEY_ID>!'
```
