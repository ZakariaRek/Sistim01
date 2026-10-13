/**
 * The free-consultation brief, as data. One step = one screen.
 * Every visible word comes from the i18n files:
 *   step title/hint  -> brief.steps[step.id]
 *   field label      -> brief.fields[field.id]
 *   option labels    -> brief.options[field.options][optionId]
 * showIf decides whether a step is part of the flow for the current answers.
 */
import { CHANNELS } from './consultation';

export type Answers = Record<string, string | string[] | boolean | undefined>;

export type FieldType = 'text' | 'textarea' | 'url' | 'tel' | 'email' | 'single' | 'multi' | 'consent';

export interface Field {
  id: string;
  type: FieldType;
  /** Key of the option list in brief.options (for single / multi). */
  options?: string;
  /** Option ids, in display order. */
  values?: readonly string[];
  required?: boolean;
  /** Option that clears the others when picked (multi). */
  exclusive?: string;
  autoComplete?: string;
  /** Show the field only when this returns true (inside a visible step). */
  showIf?: (a: Answers) => boolean;
}

export interface Step {
  id: string;
  /** Group used by the summary "Edit" links. */
  section: 'about' | 'project' | 'details' | 'content' | 'timing' | 'contact';
  fields: Field[];
  /** Note shown on the step (key in brief.notes). */
  note?: string;
  showIf?: (a: Answers) => boolean;
}

const is = (field: string, value: string) => (a: Answers) => a[field] === value;
const YES_NO = ['yes', 'no'] as const;

export const BRIEF: Step[] = [
  { id: 'about', section: 'about', fields: [
    { id: 'firstName', type: 'text', required: true, autoComplete: 'given-name' },
    { id: 'businessName', type: 'text', autoComplete: 'organization' },
    { id: 'city', type: 'text', autoComplete: 'address-level2' },
  ] },
  { id: 'businessType', section: 'about', fields: [
    { id: 'businessType', type: 'single', required: true, options: 'businessType', values: ['health', 'shop', 'architect', 'finance', 'freelancer', 'other'] },
  ] },
  { id: 'need', section: 'project', fields: [
    { id: 'need', type: 'single', required: true, options: 'need', values: ['portfolio', 'booking', 'store', 'saas', 'unsure'] },
  ] },
  { id: 'today', section: 'project', fields: [
    { id: 'today', type: 'single', required: true, options: 'today', values: ['nothing', 'social', 'website'] },
    { id: 'websiteUrl', type: 'url', showIf: is('today', 'website') },
  ] },
  { id: 'goals', section: 'project', fields: [
    { id: 'goals', type: 'multi', required: true, options: 'goals', values: ['clients', 'bookings', 'sell', 'showWork', 'saveTime'] },
  ] },

  // --- Adaptive: health
  { id: 'healthPractitioners', section: 'details', note: 'health', showIf: is('businessType', 'health'), fields: [
    { id: 'healthPractitioners', type: 'single', required: true, options: 'practitioners', values: ['1', '2-5', '6+'] },
  ] },
  { id: 'healthBooking', section: 'details', note: 'health', showIf: is('businessType', 'health'), fields: [
    { id: 'healthBooking', type: 'single', required: true, options: 'yesNo', values: YES_NO },
  ] },
  { id: 'healthReminders', section: 'details', note: 'health', showIf: is('businessType', 'health'), fields: [
    { id: 'healthReminders', type: 'single', required: true, options: 'yesNo', values: YES_NO },
  ] },
  { id: 'healthRecords', section: 'details', note: 'health', showIf: is('businessType', 'health'), fields: [
    { id: 'healthRecords', type: 'single', required: true, options: 'yesNo', values: ['yes', 'no', 'later'] },
  ] },

  // --- Adaptive: shop / artisan
  { id: 'shopProducts', section: 'details', showIf: is('businessType', 'shop'), fields: [
    { id: 'shopProducts', type: 'single', required: true, options: 'products', values: ['lt20', '20-50', '50-200', '200+'] },
  ] },
  { id: 'shopPayments', section: 'details', showIf: is('businessType', 'shop'), fields: [
    { id: 'shopPayments', type: 'multi', required: true, options: 'payments', values: ['cod', 'card', 'transfer'] },
  ] },
  { id: 'shopDelivery', section: 'details', showIf: is('businessType', 'shop'), fields: [
    { id: 'shopDelivery', type: 'single', required: true, options: 'delivery', values: ['self', 'courier', 'notYet'] },
  ] },
  { id: 'shopAbroad', section: 'details', showIf: is('businessType', 'shop'), fields: [
    { id: 'shopAbroad', type: 'single', required: true, options: 'yesNo', values: YES_NO },
  ] },

  // --- Adaptive: architect / designer
  { id: 'archProjects', section: 'details', showIf: is('businessType', 'architect'), fields: [
    { id: 'archProjects', type: 'single', required: true, options: 'projects', values: ['1-5', '6-15', '16+'] },
  ] },
  { id: 'archPhotos', section: 'details', showIf: is('businessType', 'architect'), fields: [
    { id: 'archPhotos', type: 'single', required: true, options: 'yesNo', values: ['yes', 'no', 'partly'] },
  ] },
  { id: 'archQuote', section: 'details', showIf: is('businessType', 'architect'), fields: [
    { id: 'archQuote', type: 'single', required: true, options: 'yesNo', values: YES_NO },
  ] },

  // --- Adaptive: custom platform (chosen as the need)
  { id: 'saasProblem', section: 'details', showIf: is('need', 'saas'), fields: [
    { id: 'saasProblem', type: 'textarea', required: true },
  ] },
  { id: 'saasUsers', section: 'details', showIf: is('need', 'saas'), fields: [
    { id: 'saasUsers', type: 'text', required: true },
  ] },
  { id: 'saasTools', section: 'details', showIf: is('need', 'saas'), fields: [
    { id: 'saasTools', type: 'text' },
  ] },
  { id: 'saasMustHave', section: 'details', showIf: is('need', 'saas'), fields: [
    { id: 'saasMustHave', type: 'text', required: true },
  ] },

  // --- Adaptive: finance / consulting
  { id: 'financeOutput', section: 'details', showIf: is('businessType', 'finance'), fields: [
    { id: 'financeOutput', type: 'textarea', required: true },
  ] },
  { id: 'financeUsers', section: 'details', showIf: is('businessType', 'finance'), fields: [
    { id: 'financeUsers', type: 'text', required: true },
  ] },

  { id: 'ready', section: 'content', fields: [
    { id: 'ready', type: 'multi', required: true, options: 'ready', values: ['logo', 'photos', 'texts', 'colors', 'domain', 'none'], exclusive: 'none' },
  ] },
  { id: 'languages', section: 'content', fields: [
    { id: 'languages', type: 'multi', required: true, options: 'languages', values: ['ar', 'fr', 'en'] },
  ] },
  { id: 'references', section: 'content', fields: [
    { id: 'ref1', type: 'url' },
    { id: 'ref2', type: 'url' },
    { id: 'ref3', type: 'url' },
  ] },
  { id: 'mood', section: 'content', fields: [
    { id: 'mood', type: 'single', options: 'mood', values: ['clean', 'bold', 'warm', 'premium'] },
  ] },
  { id: 'timing', section: 'timing', fields: [
    { id: 'timing', type: 'single', required: true, options: 'timing', values: ['asap', '2weeks', 'month', 'flexible'] },
  ] },
  { id: 'budget', section: 'timing', fields: [
    { id: 'budget', type: 'single', options: 'budget', values: ['lt5k', '5-15k', '15-30k', '30k+', 'quote'] },
  ] },
  { id: 'contact', section: 'contact', fields: [
    { id: 'channel', type: 'single', required: true, options: 'channel', values: CHANNELS },
    { id: 'bestTime', type: 'single', required: true, options: 'bestTime', values: ['morning', 'afternoon', 'evening'] },
    { id: 'phone', type: 'tel', required: true, autoComplete: 'tel' },
    { id: 'name', type: 'text', required: true, autoComplete: 'name' },
    { id: 'email', type: 'email', autoComplete: 'email' },
    { id: 'consent', type: 'consent', required: true },
  ] },
  { id: 'notes', section: 'contact', fields: [
    { id: 'notes', type: 'textarea' },
  ] },
];

export const visibleSteps = (a: Answers) => BRIEF.filter((s) => !s.showIf || s.showIf(a));
export const visibleFields = (s: Step, a: Answers) => s.fields.filter((f) => !f.showIf || f.showIf(a));
export const isOptionalStep = (s: Step) => s.fields.every((f) => !f.required);

/** Moroccan mobile number (06/07…, +212…, 00212…) -> "+2126XXXXXXXX", or null if invalid. */
export function normalizeMoroccanMobile(raw: string): string | null {
  const v = raw.replace(/[\s.\-()]/g, '');
  const m = v.match(/^(?:\+212|00212|212|0)([67]\d{8})$/);
  return m ? `+212${m[1]}` : null;
}

/** Map an offer/need hint from the landing page (?need=…) to a valid need id. */
export const NEED_IDS = ['portfolio', 'booking', 'store', 'saas', 'unsure'] as const;
