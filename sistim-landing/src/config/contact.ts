/**
 * SINGLE SOURCE OF TRUTH for every contact detail on the site.
 * Components, JSON-LD, the contact form and the footer all read from here.
 * Only the values below are real. Anything marked PLACEHOLDER is intentionally empty.
 */
export const CONTACT = {
  email: 'sistim01.01@gmail.com',

  /** Shown to people. Always render inside dir="ltr" so digits never flip in RTL. */
  phoneDisplay: '07 10 55 09 20',
  /** E.164 format, used for tel: links and JSON-LD. */
  phoneIntl: '+212710550920',
  /** wa.me format: country code, no "+", no leading 0. */
  whatsappNumber: '212710550920',

  instagramUrl: 'https://www.instagram.com/sistim01/',
  instagramHandle: '@sistim01',

  /** PLACEHOLDER: other social profiles (LinkedIn, Facebook, TikTok…). Empty until you add real URLs. */
  otherSocials: [] as string[],
} as const;

export const telHref = `tel:${CONTACT.phoneIntl}`;

export function whatsappHref(text?: string) {
  const base = `https://wa.me/${CONTACT.whatsappNumber}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Light obfuscation: the address never appears as plain text in the page HTML.
 * It is shipped reversed + base64 and rebuilt in the browser (see scripts/email.ts).
 */
export function encodedEmail() {
  const reversed = [...CONTACT.email].reverse().join('');
  return typeof btoa === 'function' ? btoa(reversed) : Buffer.from(reversed).toString('base64');
}
