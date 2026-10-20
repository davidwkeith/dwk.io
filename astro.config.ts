import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://dwk.io',
  output: 'static',
  compressHTML: true,
  build: {
    // CSP style-src is 'self' only, so never inline small stylesheets as <style>.
    inlineStylesheets: 'never',
  },
  integrations: [
    sitemap(),
  ],
});
