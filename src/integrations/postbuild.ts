import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import * as cheerio from 'cheerio';
import * as openpgp from 'openpgp';

/**
 * Post-build steps that operate on the finished output in `dist/`:
 * SRI hashes on local CSS/JS, then an OpenPGP signature on security.txt.
 */
export default function postbuild(): AstroIntegration {
  return {
    name: 'dwk:postbuild',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const buildDir = fileURLToPath(dir);
        await addSriHashes(buildDir, logger);
        // Signing must run last: anything that touches security.txt afterwards
        // would invalidate the signature.
        await signSecurityTxt(buildDir, logger);
      },
    },
  };
}

/** Add SHA-384 integrity attributes to local <link rel="stylesheet"> and <script src> tags. */
async function addSriHashes(buildDir: string, logger: AstroIntegrationLogger) {
  const files = await fs.readdir(buildDir, { recursive: true });
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const hashes = new Map<string, string>();

  for (const file of htmlFiles) {
    const htmlPath = path.join(buildDir, file);
    const $ = cheerio.load(await fs.readFile(htmlPath, 'utf8'));
    let changed = false;

    for (const el of $('link[rel="stylesheet"][href], script[src]')) {
      const $el = $(el);
      const url = $el.attr('src') ?? $el.attr('href')!;
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue; // absolute, protocol-relative or data: URL

      const assetPath = path.join(buildDir, url.split(/[?#]/)[0]);
      let integrity = hashes.get(assetPath);
      if (!integrity) {
        try {
          const digest = crypto.createHash('sha384').update(await fs.readFile(assetPath)).digest('base64');
          integrity = `sha384-${digest}`;
          hashes.set(assetPath, integrity);
        } catch (e) {
          logger.warn(`SRI: could not read ${assetPath}: ${(e as Error).message}`);
          continue;
        }
      }
      $el.attr('integrity', integrity);
      $el.attr('crossorigin', 'anonymous');
      changed = true;
    }

    if (changed) await fs.writeFile(htmlPath, $.html());
  }
  logger.info(`SRI: hashed ${hashes.size} asset(s).`);
}

/**
 * Sign .well-known/security.txt with an OpenPGP cleartext signature (RFC 9116 §2.3).
 * Uses GPG_PRIVATE_KEY and optional GPG_PASSPHRASE; skipped when no key is set,
 * except on production Workers Builds, where a missing key fails the build.
 */
async function signSecurityTxt(buildDir: string, logger: AstroIntegrationLogger) {
  try {
    process.loadEnvFile(); // local .env; never overrides variables already set
  } catch {
    // no .env file
  }

  const armoredKey = process.env.GPG_PRIVATE_KEY;
  // Workers Builds sets WORKERS_CI; the key must be a *build* secret there, not a runtime secret.
  const isProductionCi = process.env.WORKERS_CI === '1' && process.env.WORKERS_CI_BRANCH === 'main';
  if (!armoredKey && isProductionCi) {
    throw new Error('PGP: GPG_PRIVATE_KEY build secret is not set; refusing to deploy unsigned security.txt.');
  }
  if (!armoredKey) {
    logger.warn('PGP: GPG_PRIVATE_KEY not set, skipping security.txt signing.');
    return;
  }

  let privateKey = await openpgp.readPrivateKey({ armoredKey });
  if (!privateKey.isDecrypted()) {
    const passphrase = process.env.GPG_PASSPHRASE;
    if (!passphrase) throw new Error('PGP: key is passphrase-protected but GPG_PASSPHRASE is not set.');
    privateKey = await openpgp.decryptKey({ privateKey, passphrase });
  }

  const securityTxtPath = path.join(buildDir, '.well-known', 'security.txt');
  const message = await openpgp.createCleartextMessage({ text: await fs.readFile(securityTxtPath, 'utf8') });
  await fs.writeFile(securityTxtPath, await openpgp.sign({ message, signingKeys: privateKey }));
  logger.info('PGP: signed security.txt.');
}
