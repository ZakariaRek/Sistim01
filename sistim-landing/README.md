# Sistim landing page

Multilingual (Darija / French / English) static website for **Sistim**, a Moroccan digital studio: a landing page and a short free-consultation form in each language.

Stack: Astro (static output and i18n routing), React islands for the consultation form and the 3D hero, TypeScript, Tailwind CSS v4, GSAP + ScrollTrigger, Lenis and Three.js (one lazy-loaded scene, landing page only).

## Run it fff

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs the static site to dist/
npm run preview  # serves dist/ locally
```

Routes:

| Route | What |
|---|---|
| `/` | Entry page: picks the visitor's language and forwards (see below). Without JavaScript it is a 3-button language chooser. |
| `/ar/`, `/fr/`, `/en/` | Landing page in Darija (RTL), French, English |
| `/ar/consultation/`, `/fr/consultation/`, `/en/consultation/` | Free consultation: 4-screen form with a split-screen brand panel |

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
| Email, phone, WhatsApp, Instagram (single source) | `src/config/contact.ts` |
| Free consultation facts (duration, reply time, what it includes, thank-you photo) | `src/config/consultation.ts` |
| Form steps, business types, needs, phone validation | `src/config/brief.ts` (labels in `brief` in the i18n files) |
| Show or hide prices (`SHOW_PRICES`), the prices in MAD, domain | `src/config/site.ts` |
| Colours, fonts, type scale, easing and duration tokens | `src/styles/global.css` (`@theme` block); JS motion tokens in `src/scripts/tokens.ts` |
| Sections | `src/components/*.astro` (assembled in `Landing.astro`) |
| Consultation form + brand panel | `src/components/islands/ConsultFlow.tsx` (form), `ConsultPanel.tsx` (circuit, illustrations), page in `src/pages/[lang]/consultation.astro` |
| Motion system (Lenis, reveals, timeline, magnetic buttons, tilt) | `src/scripts/motion.ts` |
| 3D hero | `src/scripts/hero-scene.ts` (gated by `src/components/islands/HeroScene.tsx`) |

TypeScript checks that `ar.ts` and `fr.ts` have exactly the same shape as `en.ts`, so a missing key fails `npx tsc --noEmit`.

**Prices:** set `SHOW_PRICES = true` in `src/config/site.ts` to show "from" prices (Starter 7 500, Business booking 18 000, Business e-commerce 28 000, Custom SaaS 120 000 MAD). By default each offer shows "Request a quote", which opens the consultation form (Starter and Custom SaaS preselect the matching need on step 2).

**Placeholder left on purpose** in `src/config/contact.ts`: `otherSocials` is empty. No address is published anywhere on the site.

## Free consultation: config values

`src/config/consultation.ts` is the only place the consultation facts come from. The copy interpolates them, and the site never states more than they say:

| Value | Default | Used in |
|---|---|---|
| `DURATION_MINUTES` | `20` | Landing fact chips, process step 1, panel reassurance, thank-you step 2 |
| `REPLY_TIME_HOURS` | `24` | Landing fact chips, panel reassurance, thank-you step 2 |
| `INCLUDES` | `['call_or_chat', 'written_recommendation']` | Without `call_or_chat` the "free call or chat" line disappears everywhere. Without `written_recommendation` the intro uses a shorter lead (no recommendation promise) and the thank-you screen drops step 3. |
| `INCLUDES_ESTIMATE` | `false` | Nothing on the site mentions a price estimate. Wording for `true` is not written yet: add it to the i18n files if you switch it on. |
| `SHOW_THANKYOU_PHOTO` | `false` | `true` + a file `../brand/thankyou.jpg` (run `npm run brand` to process it) shows that photo in the panel on the thank-you screen with an "Illustrative image" label. No photo is used otherwise. |

## The consultation form

Four screens, about one minute:

1. **Business type** (required): six cards with an icon each. A tap or click moves on by itself after a beat; keyboard users press Enter.
2. **What do you need** (optional, with Skip): five cards plus an optional one-line sentence.
3. **Name**: first and last name.
4. **WhatsApp number + consent**: Moroccan 06/07 formats and `+212…` are normalised to `+212…`; any other international number starting with `+` (8 to 15 digits) is accepted. A health business sees "Do not send us any patient data."

Nothing else is asked (no budget, deadline, links or channel); the rest is discussed in the consultation. Progress is saved in the visitor's browser (if storage is available) and cleared after a successful send.

The right-hand panel (a banner on phones) is decorative and `aria-hidden`: a circuit that draws one more segment and lights one more node for each completed step, finishing with a pulse and spark lines on the thank-you screen; a very large "س"; and a hand-drawn line illustration that changes with the business type (health, shop, architect, finance, freelancer, generic). With reduced motion the circuit is shown fully drawn and still. There is no Three.js or canvas on this page.

## Receiving the requests

The form has no backend of its own. On submit it builds a plain-text summary in the visitor's language plus a JSON payload (locale, timestamp, answers) and POSTs it to `PUBLIC_CONSULTATION_ENDPOINT`. If that is empty, nothing is sent: the visitor lands on the thank-you screen and uses **Continue on WhatsApp** (short pre-filled message) or the email button. If the POST fails, the visitor sees the same buttons with a friendly error, so the lead is never lost.

Spam protection: a hidden honeypot field plus a minimum fill time (3 seconds).

1. Copy `.env.example` to `.env`.
2. Pick one service:
   - **Formspree:** create an account at formspree.io, click **New form**, then copy the endpoint (looks like `https://formspree.io/f/abcdwxyz`). Set `PUBLIC_CONSULTATION_ENDPOINT=https://formspree.io/f/abcdwxyz` and leave `PUBLIC_CONSULTATION_ACCESS_KEY` empty.
   - **Web3Forms:** at web3forms.com, enter `sistim01.01@gmail.com` to receive an access key by email. Set `PUBLIC_CONSULTATION_ENDPOINT=https://api.web3forms.com/submit` and `PUBLIC_CONSULTATION_ACCESS_KEY=<your key>`. Web3Forms keys are meant to be public; no secret goes into the site.
3. Rebuild (`npm run build`). On Vercel, Netlify or Cloudflare, add the same variables in the project's environment settings instead of `.env`.
4. Send yourself a test request. The first Formspree submission asks you to confirm the form by email.

## Language detection on "/"

`/` reads `localStorage["sistim-lang"]` first. If nothing is stored, it takes the first entry of `navigator.languages` whose primary subtag is `ar`, `fr` or `en` (any Arabic variant goes to `/ar/`). If none matches, it goes to `/en/`. It forwards with `location.replace`, so Back never loops. The language switcher (and the footer language links) store the manual choice, which always wins afterwards. `/` stays indexable and is the hreflang `x-default`.

To test it:

- **Chrome:** Settings → Languages, move French (or Arabic, or Spanish) to the top, then open `http://localhost:4321/` in a new window.
- **DevTools:** run `localStorage.removeItem('sistim-lang')` to forget a manual choice. Use **More tools → Sensors → Locale** to emulate another locale.
- **Scripted:** with `npm run preview` running, `node scripts/qa-lang.mjs` simulates ar-MA, fr-FR, en-US, es-ES, a stored preference, a switcher click and no JavaScript, then prints where each one lands.

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
3. Add `'xx'` to `i18n.locales` and to `HREFLANG` in `astro.config.mjs`, and to the detection list in `src/pages/index.astro`.
4. Add it to the list in `scripts/og-images.mjs` and run the script.

The `[lang]` pages pick new locales up automatically.

## QA scripts (local only)

With `npm run preview` running:

```bash
node scripts/qa-shots.mjs http://localhost:4321 375,768,1440 ar,fr,en --full   # screenshots + overflow + console check
node scripts/qa-interact.mjs                                                    # mobile menu, reduced motion, focus
node scripts/qa-lang.mjs                                                        # language detection on "/"
node scripts/qa-landing-consult.mjs                                             # consultation CTAs, band, mobile bar
node scripts/qa-consult.mjs                                                     # consultation form end to end, all locales, illustrations, RTL
node scripts/lighthouse.mjs http://localhost:4321                                # mobile Lighthouse (add --desktop)
```

For `qa-consult.mjs`, build with `PUBLIC_CONSULTATION_ENDPOINT=https://formspree.io/f/qa-test`: the script intercepts that URL, so nothing is really sent. For Lighthouse, build with `SITE_URL=http://localhost:4321` so canonical URLs match the audited host. Screenshots go to `qa/` (git-ignored). Run `npx playwright install chromium` once first.

## Deploy it yourself

The site is fully static: build once and upload `dist/`. No server redirects are needed.

### Vercel (step by step)

1. Push the repository to GitHub yourself.
2. On vercel.com: **Add New → Project**, import the repository.
3. If the repository root is the `Sistim` folder, set **Root Directory** to `sistim-landing`.
4. Framework preset: **Astro** (detected). Build command `npm run build`, output directory `dist`.
5. **Environment Variables:** `SITE_URL=https://your-domain.ma`, plus `PUBLIC_CONSULTATION_ENDPOINT` (and `PUBLIC_CONSULTATION_ACCESS_KEY` for Web3Forms).
6. Deploy, then add your domain under **Settings → Domains** and follow the DNS instructions.
7. Check `https://your-domain/sitemap-index.xml`, `/robots.txt` and send one test request.

### Other hosts

- **Cloudflare Pages:** build command `npm run build`, output directory `dist`, root directory `sistim-landing` if needed, the same environment variables, and `NODE_VERSION=22` or newer.
- **Netlify:** build command `npm run build`, publish directory `dist`, base directory `sistim-landing` if needed, the same environment variables.
