# dwk.io

DWK's Cyber Home — built with [Eleventy](https://www.11ty.dev/) and hosted on [Cloudflare Pages](https://pages.cloudflare.com/).

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
npm run start    # Dev server with live reload
npm run build    # Production build (outputs to _site/)
```

The `postbuild` script runs automatically after `build` and handles:
- SRI integrity hashes on CSS/JS assets
- OpenPGP signing of `security.txt` (when `GPG_PRIVATE_KEY` is set)

## TODO
  - [ ] [IndieWebify.Me](https://indiewebify.me)
  - [ ] [llms.txt](https://llmstxt.org/)
  - [ ] [Support Pages Functions](https://developers.cloudflare.com/pages/functions/)