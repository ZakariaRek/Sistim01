// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// PLACEHOLDER domain: set SITE_URL when building (see README) or edit src/config/site.ts
const SITE_URL = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    locales: ['ar', 'fr', 'en'],
    defaultLocale: 'ar',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    react(),
    sitemap({
      i18n: { defaultLocale: 'ar', locales: { ar: 'ar-MA', fr: 'fr', en: 'en' } },
    }),
  ],
  build: { inlineStylesheets: 'always' },
  // three.js is a lazy, on-demand chunk (~130 KB gz), so the default 500 KB warning does not apply to it
  vite: { plugins: [tailwindcss()], build: { chunkSizeWarningLimit: 600 } },
});
