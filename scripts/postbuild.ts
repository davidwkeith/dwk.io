import dotenv from 'dotenv';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import { readPrivateKey, decryptKey, createCleartextMessage, sign } from 'openpgp';

dotenv.config();

const buildDir = './_site';

async function generateSriHash(filePath: string): Promise<string> {
  const fileContent = await fs.readFile(filePath);
  const hash = crypto.createHash('sha384').update(fileContent).digest('base64');
  return `sha384-${hash}`;
}

async function processHtmlFile(filePath: string): Promise<void> {
  const htmlContent = await fs.readFile(filePath, 'utf8');
  const $ = cheerio.load(htmlContent);

  const promises: Promise<void>[] = [];

  $('link[rel="stylesheet"], script').each((_i, el) => {
    const $el = $(el);
    const srcAttr = $el.attr('src') || $el.attr('href');
    if (srcAttr && !srcAttr.startsWith('http') && !srcAttr.startsWith('//')) {
      const assetPath = path.join(buildDir, srcAttr);
      promises.push(
        generateSriHash(assetPath).then(integrity => {
          $el.attr('integrity', integrity);
          $el.attr('crossorigin', 'anonymous');
        }).catch(e => {
          console.warn(`SRI: Could not process ${assetPath}: ${(e as Error).message}`);
        })
      );
    }
  });

  await Promise.all(promises);

  await fs.writeFile(filePath, $.html());
}

/**
 * Signs the security.txt file with an OpenPGP cleartext signature per RFC 9116 Section 2.3.
 * Requires the GPG_PRIVATE_KEY environment variable to contain the armored private key.
 * If the key is passphrase-protected, GPG_PASSPHRASE must also be set.
 * Skips signing gracefully if GPG_PRIVATE_KEY is not set.
 */
async function signSecurityTxt(): Promise<void> {
  const securityTxtPath = path.join(buildDir, '.well-known', 'security.txt');
  const armoredKey = process.env.GPG_PRIVATE_KEY;

  if (!armoredKey) {
    console.warn('PGP: GPG_PRIVATE_KEY not set, skipping security.txt signing.');
    return;
  }

  const content = await fs.readFile(securityTxtPath, 'utf8');

  let privateKey = await readPrivateKey({ armoredKey });
  if (!privateKey.isDecrypted()) {
    const passphrase = process.env.GPG_PASSPHRASE;
    if (!passphrase) {
      throw new Error('PGP: Key is passphrase-protected but GPP_PASSPHRASE is not set.');
    }
    privateKey = await decryptKey({ privateKey, passphrase });
  }

  const message = await createCleartextMessage({ text: content });
  const signedContent = await sign({ message, signingKeys: privateKey });

  await fs.writeFile(securityTxtPath, signedContent as string);
  console.log('PGP: Successfully signed security.txt.');
}

async function main(): Promise<void> {
  try {
    const files = await fs.readdir(buildDir, { recursive: true });
    const htmlFiles = files
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.html'))
      .map(file => path.join(buildDir, file));

    for (const htmlFile of htmlFiles) {
      await processHtmlFile(htmlFile);
    }
    console.log('SRI: Successfully added integrity attributes to HTML files.');

    await signSecurityTxt();
  } catch (e) {
    console.error('Postbuild error:', e);
    process.exit(1);
  }
}

main();
