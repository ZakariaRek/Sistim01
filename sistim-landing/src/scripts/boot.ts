// Entry script for every page: small DOM wiring + the motion system.
import { initMotion } from './motion';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

// --- Email: rebuilt at runtime from a reversed base64 string (light anti-scraping)
export function decodeEmail(encoded: string) {
  try { return [...atob(encoded)].reverse().join(''); } catch { return ''; }
}
document.querySelectorAll<HTMLAnchorElement>('a[data-eml]').forEach((a) => {
  const email = decodeEmail(a.dataset.eml || '');
  if (!email) return;
  a.href = `mailto:${email}`;
  a.querySelectorAll('[data-eml-text]').forEach((el) => (el.textContent = email));
});

// --- Language memory: any switcher click stores the choice  rrtr
document.querySelectorAll<HTMLAnchorElement>('a[data-lang-link]').forEach((a) => {
  a.addEventListener('click', () => {
    try { localStorage.setItem('sistim-lang', a.dataset.langLink || 'ar'); } catch {}
  });
});

// --- Suggest FR/EN on the Darija root for French/English browsers (never auto-redirects)
const box = document.getElementById('lang-suggest');
if (box) {
  let saved: string | null = null;
  try { saved = localStorage.getItem('sistim-lang'); } catch {}
  const pref = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
  const target = pref.startsWith('fr') ? 'fr' : pref.startsWith('en') ? 'en' : null;
  if (!saved && target) {
    const strings = JSON.parse(box.dataset.suggest || '{}')[target];
    box.setAttribute('lang', target);
    box.querySelector('[data-suggest-text]')!.textContent = strings.text;
    const go = box.querySelector<HTMLAnchorElement>('[data-suggest-go]')!;
    go.textContent = strings.go;
    go.href = `/${target}/`;
    go.addEventListener('click', () => { try { localStorage.setItem('sistim-lang', target); } catch {} });
    box.querySelector('[data-suggest-stay]')!.textContent = strings.stay;
    box.querySelector('[data-suggest-stay]')!.addEventListener('click', () => {
      try { localStorage.setItem('sistim-lang', 'ar'); } catch {}
      box.hidden = true;
    });
    setTimeout(() => (box.hidden = false), 1800);
  }
}

// --- Offer buttons preselect the "need" in the contact form
document.querySelectorAll<HTMLElement>('[data-need]').forEach((el) =>
  el.addEventListener('click', () => window.dispatchEvent(new CustomEvent('sistim:need', { detail: Number(el.dataset.need) }))),
);

// --- Pause loops when off-screen or when the tab is hidden
const loopObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.target.classList.toggle('offscreen', !e.isIntersecting)),
  { rootMargin: '100px' },
);
document.querySelectorAll('[data-loop]').forEach((el) => loopObserver.observe(el));
const onVisibility = () => root.classList.toggle('tab-hidden', document.hidden);
document.addEventListener('visibilitychange', onVisibility);

// --- Circuit traces draw themselves when they scroll into view
const drawObserver = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); drawObserver.unobserve(e.target); }
  }),
  { rootMargin: '0px 0px -12% 0px' },
);
document.querySelectorAll('.draw-on-scroll').forEach((el) => drawObserver.observe(el));

// --- Motion (Lenis + GSAP). Skipped entirely for reduced motion.
let destroyMotion = initMotion({ reduced: reduced.matches });
(window as any).__sistimMotion = true;

reduced.addEventListener('change', () => {
  destroyMotion();
  root.classList.toggle('motion', !reduced.matches);
  destroyMotion = initMotion({ reduced: reduced.matches });
});

// Teardown when the page is really unloaded (kept alive for the back/forward cache)
window.addEventListener('pagehide', (e) => {
  if (e.persisted) return;
  destroyMotion();
  loopObserver.disconnect();
  drawObserver.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
});
