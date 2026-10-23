// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// PLACEHOLDER domain: set SITE_URL when building (see README) or edit src/config/site.ts
const SITE_URL = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');
const HREFLANG = { ar: 'ar-MA', fr: 'fr', en: 'en' };

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    locales: ['ar', 'fr', 'en'],
    defaultLocale: 'ar',
    // Every language lives under its own prefix (/ar/, /fr/, /en/). "/" is a small entry page
    // that picks the language from the device (src/pages/index.astro), so no server redirect.
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  integrations: [
    react(),
    sitemap({
      filter: (page) => !page.includes('/templates/'),
      // hreflang alternates for every localized page, plus "/" as x-default for the home page
      serialize(item) {
        const path = new URL(item.url).pathname;
        const m = path.match(/^\/(ar|fr|en)\/(.*)$/);
        const rest = m ? m[2] : path === '/' ? '' : null;
        if (rest === null) return item;
        item.links = [
          ...Object.entries(HREFLANG).map(([loc, lang]) => ({ lang, url: `${SITE_URL}/${loc}/${rest}` })),
          ...(rest === '' ? [{ lang: 'x-default', url: `${SITE_URL}/` }] : []),
        ];
        return item;
      },
    }),
  ],
  build: { inlineStylesheets: 'always' },
  // three.js is a lazy, on-demand chunk (~130 KB gz), so the default 500 KB warning does not apply to it
  vite: { plugins: [tailwindcss()], build: { chunkSizeWarningLimit: 600 } },
});
