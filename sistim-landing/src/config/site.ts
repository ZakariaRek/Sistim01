/**
 * Site-wide settings. Edit these, rebuild, done.
 */

/**
 * PLACEHOLDER: your real domain, used for canonical URLs, hreflang, sitemap and Open Graph.
 * You can also set it at build time: SITE_URL=https://your-domain.ma npm run build
 */
export const SITE_URL = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '');

/** false = every offer shows "Request a quote". true = show the "from" prices below. */
export const SHOW_PRICES = false;

/** "From" prices in MAD, only displayed when SHOW_PRICES is true. */
export const PRICES = {
  starter: 7500,
  businessBooking: 18000,
  businessEcommerce: 28000,
  customSaas: 120000,
} as const;

export const BRAND_NAME = 'Sistim';
