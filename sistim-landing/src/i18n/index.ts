import { ar } from './ar';
import { fr } from './fr';
import { en } from './en';

export const LOCALES = ['ar', 'fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';

/** Every locale must match the English shape exactly (TypeScript checks this). */
export type Dict = typeof en;
const dicts: Record<Locale, Dict> = { ar, fr, en };

export const LOCALE_META: Record<Locale, { lang: string; dir: 'rtl' | 'ltr'; short: string; native: string; og: string; path: string }> = {
  ar: { lang: 'ar-MA', dir: 'rtl', short: 'AR', native: 'الدارجة', og: 'ar_MA', path: '/ar/' },
  fr: { lang: 'fr', dir: 'ltr', short: 'FR', native: 'Français', og: 'fr_FR', path: '/fr/' },
  en: { lang: 'en', dir: 'ltr', short: 'EN', native: 'English', og: 'en_US', path: '/en/' },
};

export const t = (locale: Locale): Dict => dicts[locale];

/** Fill {placeholders} in a template string. */
export const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/** Localised URL for a page: localePath('fr', 'consultation') -> '/fr/consultation/' */
export const localePath = (locale: Locale, page = '') => `${LOCALE_META[locale].path}${page ? `${page.replace(/^\/|\/$/g, '')}/` : ''}`;
