// The motion system: ONE Lenis instance driven by the GSAP ticker, ScrollTrigger reveals,
// hero parallax, magnetic buttons, card tilt, scroll progress bar and the process timeline.
// initMotion() returns a destroy() that kills every trigger, tween and listener it created.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { EASE, DUR, STAGGER, REVEAL_START } from './tokens';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: EASE.out, duration: DUR.slow });

let lenis: Lenis | null = null;
export const getLenis = () => lenis;

export function initMotion({ reduced }: { reduced: boolean }) {
  const isRtl = document.documentElement.dir === 'rtl';
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn as EventListener, opts);
    cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts));
  };

  const ctx = gsap.context(() => {
    const timeline = document.querySelector<HTMLElement>('[data-timeline]');

    if (reduced) {
      // Static final states, no smooth scroll, no reveals.
      if (timeline) {
        timeline.style.setProperty('--progress', '1');
        timeline.querySelectorAll('[data-step]').forEach((s) => s.classList.add('is-active'));
      }
      return;
    }

    // --- Smooth scroll (single engine)
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 0.95, anchors: { offset: -88 } as any });
    lenis.on('scroll', ScrollTrigger.update);
    (window as any).__lenis = lenis; // used by the QA screenshot script
    const raf = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    cleanups.push(() => { gsap.ticker.remove(raf); lenis?.destroy(); lenis = null; });

    // --- Masked word reveals for headings (words only, never letters)
    gsap.utils.toArray<HTMLElement>('.split[data-reveal="words"]').forEach((el) => {
      gsap.to(el.querySelectorAll('.w > span'), {
        y: 0, duration: DUR.slow, ease: EASE.out, stagger: STAGGER.words,
        scrollTrigger: { trigger: el, start: REVEAL_START, once: true },
      });
    });

    // --- Soft stagger-in for cards and blocks
    ScrollTrigger.batch('[data-reveal="item"]', {
      start: REVEAL_START,
      once: true,
      onEnter: (batch) => gsap.fromTo(batch, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: DUR.slow, ease: EASE.soft, stagger: STAGGER.items, overwrite: true }),
    });

    // --- Hero parallax layers
    gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
      const depth = Number(el.dataset.parallax || 0.2);
      gsap.to(el, {
        yPercent: depth * 40, ease: 'none',
        scrollTrigger: { trigger: '#top', start: 'top top', end: 'bottom top', scrub: 0.8 },
      });
    });

    // --- Process timeline: the line fills as you scroll, steps light up as the head passes them
    if (timeline) {
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]', timeline);
      let centers: number[] = [];
      const measure = () => {
        const box = timeline.getBoundingClientRect();
        centers = steps.map((s) => {
          const node = s.querySelector('[data-step-node]')!.getBoundingClientRect();
          return (node.top + node.height / 2 - box.top) / box.height;
        });
      };
      ScrollTrigger.create({
        trigger: timeline,
        start: 'top 65%',
        end: 'bottom 65%',
        scrub: 0.6,
        onRefresh: measure,
        onUpdate: (self) => {
          timeline.style.setProperty('--progress', self.progress.toFixed(4));
          steps.forEach((s, i) => s.classList.toggle('is-active', self.progress >= centers[i] - 0.02));
        },
      });
    }

    // --- Pointer-only niceties
    if (finePointer) {
      // Magnetic primary buttons
      gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((el) => {
        const xTo = gsap.quickTo(el, 'x', { duration: DUR.base, ease: EASE.soft });
        const yTo = gsap.quickTo(el, 'y', { duration: DUR.base, ease: EASE.soft });
        listen(el, 'pointermove', (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.22);
          yTo((e.clientY - r.top - r.height / 2) * 0.3);
        });
        listen(el, 'pointerleave', () => { xTo(0); yTo(0); });
      });

      // Card tilt + glow position
      gsap.utils.toArray<HTMLElement>('[data-tilt]').forEach((el) => {
        const rx = gsap.quickTo(el, 'rotationX', { duration: DUR.base, ease: EASE.soft });
        const ry = gsap.quickTo(el, 'rotationY', { duration: DUR.base, ease: EASE.soft });
        gsap.set(el, { transformPerspective: 900 });
        listen(el, 'pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--mx', `${px * 100}%`);
          el.style.setProperty('--my', `${py * 100}%`);
          rx((0.5 - py) * 5);
          ry((px - 0.5) * 5);
        });
        listen(el, 'pointerleave', () => { rx(0); ry(0); });
      });
    }

    // Re-measure once fonts and images settle
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    listen(window, 'load', refresh);
  });

  // Direction-aware helper kept for components that slide horizontally
  document.documentElement.style.setProperty('--dir', isRtl ? '-1' : '1');

  return () => {
    cleanups.splice(0).forEach((fn) => fn());
    ctx.revert(); // kills ScrollTriggers and tweens created inside the context
  };
}
