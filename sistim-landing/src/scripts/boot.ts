// Entry script for the landing page: shared wiring + loops/visibility + the motion system.
import './common';
import { initMotion } from './motion';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

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

// --- Mobile bottom bar: shown once the hero is gone, hidden while the final CTA or footer is on screen
const bar = document.getElementById('mobile-bar');
const barObserver = bar
  ? (() => {
      const state = new Map<Element, boolean>();
      const hero = document.getElementById('top');
      const blockers = [document.getElementById('contact'), document.querySelector('footer')].filter(Boolean) as Element[];
      const update = () => {
        const heroVisible = hero ? state.get(hero) ?? true : false;
        const blocked = blockers.some((b) => state.get(b));
        const show = !heroVisible && !blocked;
        bar.classList.toggle('is-visible', show);
        bar.toggleAttribute('inert', !show);
      };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => state.set(e.target, e.isIntersecting));
        update();
      });
      [hero, ...blockers].forEach((el) => el && io.observe(el));
      return io;
    })()
  : null;

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
  barObserver?.disconnect();
  document.removeEventListener('visibilitychange', onVisibility);
});
