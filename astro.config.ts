import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import postbuild from './src/integrations/postbuild';

export default defineConfig({
  site: 'https://dwk.io',
  output: 'static',
  compressHTML: true,
  build: {
    // CSP style-src is 'self' only, so never inline small stylesheets as <style>.
    inlineStylesheets: 'never',
  },
  integrations: [
    // The Worker renders posts into /post-shell/; it isn't a page of its own.
    // It serves the posts' own sitemap (worker/site.ts), listed in the index here.
    sitemap({ filter: (page) => !page.includes('/post-shell/'), customSitemaps: ['https://dwk.io/sitemap-posts.xml'] }),
    // Keep last so it sees every file the other integrations write.
    postbuild(),
  ],
});
