# Sistim landing page

Multilingual (Darija / French / English) static landing page for **Sistim**, a Moroccan digital studio in Marrakesh.

Stack: Astro (static output and i18n routing), React islands for the contact form and the 3D hero, TypeScript, Tailwind CSS v4, GSAP + ScrollTrigger, Lenis and Three.js (one lazy-loaded scene).

## Run it fff

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs the static site to dist/
npm run preview  # serves dist/ locally
```

Routes: `/` Darija (RTL, default), `/fr/` French, `/en/` English.

## Before you deploy: set your domain

Canonical URLs, hreflang tags, the sitemap, `robots.txt` and Open Graph images all need the real domain. It is a **placeholder** (`https://example.com`) until you set it:

```bash
SITE_URL=https://your-domain.ma npm run build
```

Or change the default in **both** `src/config/site.ts` and `astro.config.mjs`.

## Where to edit things

| What | File |
|---|---|
| All text (one file per language, same keys) | `src/i18n/ar.ts`, `src/i18n/fr.ts`, `src/i18n/en.ts` |
| Email, phone, WhatsApp, Instagram, city (single source) | `src/config/contact.ts` |
| Show or hide prices (`SHOW_PRICES`), the prices in MAD, domain | `src/config/site.ts` |
| Colours, fonts, type scale, easing and duration tokens | `src/styles/global.css` (`@theme` block); JS motion tokens in `src/scripts/tokens.ts` |
| Sections | `src/components/*.astro` (assembled in `Landing.astro`) |
| Motion system (Lenis, reveals, timeline, magnetic buttons, tilt) | `src/scripts/motion.ts` |
| 3D hero | `src/scripts/hero-scene.ts` (gated by `src/components/islands/HeroScene.tsx`) |

TypeScript checks that `ar.ts` and `fr.ts` have exactly the same shape as `en.ts`, so a missing key fails the build.

**Prices:** set `SHOW_PRICES = true` in `src/config/site.ts` to show "from" prices (Starter 7 500, Business booking 18 000, Business e-commerce 28 000, Custom SaaS 120 000 MAD). By default each offer shows "Request a quote".

**Contact form:** there is no backend. It composes a WhatsApp message (`wa.me/212710550920`) in the page language, with a `mailto:` fallback. The email is never written as plain text in the HTML; it is rebuilt in the browser. (It does appear in the Organization JSON-LD, which you asked for.)

**Placeholders left on purpose** in `src/config/contact.ts`: `streetAddress` and `otherSocials` are empty. Add real values only.

## Brand assets

The originals in `../brand/` are never modified. Web versions are derived from them:

```bash
npm run brand                 # transparent PNG/WebP/AVIF logos + favicon set into public/
node scripts/og-images.mjs    # 1200×630 Open Graph image per language into public/og/
node scripts/contrast.mjs     # WCAG contrast table for the palette
```

Palette sampled from the logo files (`scripts/sample-palette.mjs`): navy `#232B3B`, emerald `#16AB79`, white. Self-hosted font: Readex Pro (variable, Arabic + Latin) in `public/fonts/`.

## Add a language

1. Copy `src/i18n/en.ts` to `src/i18n/xx.ts`, export `xx`, translate the values.
2. Register it in `src/i18n/index.ts` (`LOCALES`, `dicts`, `LOCALE_META` with `lang`, `dir`, labels and `path: '/xx/'`).
3. Add `'xx'` to `i18n.locales` and the sitemap `locales` map in `astro.config.mjs`.
4. Create `src/pages/xx/index.astro` containing `<Landing locale="xx" />`.
5. Add it to the list in `scripts/og-images.mjs` and run the script.

## QA scripts (local only)

With `npm run preview` running:

```bash
node scripts/qa-shots.mjs http://localhost:4321 375,768,1440 ar,fr,en --full   # screenshots + overflow + console check
node scripts/qa-interact.mjs                                                    # menu, form, reduced motion, focus
node scripts/lighthouse.mjs http://localhost:4321                                # mobile Lighthouse (add --desktop)
```

For Lighthouse, build with `SITE_URL=http://localhost:4321` so canonical URLs match the audited host. Screenshots go to `qa/` (git-ignored). Run `npx playwright install chromium` once first.

## Deploy it yourself

The site is fully static: build once and upload `dist/`.

- **Cloudflare Pages:** create a project from your Git repo (or upload `dist/` directly). Build command `npm run build`, output directory `dist`, environment variable `SITE_URL=https://your-domain.ma`, and `NODE_VERSION=22` or newer.
- **Netlify:** build command `npm run build`, publish directory `dist`, environment variable `SITE_URL`. Or drag and drop the `dist/` folder into the Netlify dashboard.
- **Vercel:** import the repo; it detects Astro. Output `dist`, add `SITE_URL` in Project Settings → Environment Variables.

Then point your domain at the host and re-check that `https://your-domain/sitemap-index.xml` and `/robots.txt` show the right domain.
