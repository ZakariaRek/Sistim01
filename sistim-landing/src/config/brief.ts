/**
 * The free-consultation form: 4 short screens.
 *   1. business type (required)   2. need (optional)   3. name (required)   4. WhatsApp number + consent
 * Labels come from the i18n files (brief.types, brief.needs, brief.steps, brief.fields).
 */

export const TYPE_IDS = ['health', 'shop', 'architect', 'finance', 'freelancer', 'other'] as const;
export const NEED_IDS = ['portfolio', 'booking', 'store', 'saas', 'unsure'] as const;
export const STEP_IDS = ['type', 'need', 'name', 'phone'] as const;

export type TypeId = (typeof TYPE_IDS)[number];
export type NeedId = (typeof NEED_IDS)[number];
export type StepId = (typeof STEP_IDS)[number];

/** Steps the visitor may skip. */
export const OPTIONAL_STEPS: readonly StepId[] = ['need'];

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/**
 * Normalise a phone number to "+<digits>", or return null when it is not acceptable:
 *  - Moroccan local mobile, 06/07 XX XX XX XX   -> +2126…/+2127…
 *  - Moroccan international, +212 / 00212 …      -> must have exactly 9 digits after 212
 *  - any other international number with "+" (or "00"), 8 to 15 digits
 * Arabic-Indic digits are accepted too.
 */
export function normalizePhone(raw: string): string | null {
  const latin = raw.replace(/[٠-٩۰-۹]/g, (d) => String(ARABIC_INDIC.indexOf(d) >= 0 ? ARABIC_INDIC.indexOf(d) : PERSIAN.indexOf(d)));
  const v = latin.replace(/[\s.\-()‎‏⁦⁩]/g, '');
  const local = v.match(/^0([67]\d{8})$/);
  if (local) return `+212${local[1]}`;
  const intl = v.match(/^(?:\+|00)(\d+)$/);
  if (!intl) return null;
  const digits = intl[1];
  if (digits.startsWith('212')) {
    const rest = digits.slice(3).replace(/^0/, '');
    return /^\d{9}$/.test(rest) ? `+212${rest}` : null;
  }
  return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
}
