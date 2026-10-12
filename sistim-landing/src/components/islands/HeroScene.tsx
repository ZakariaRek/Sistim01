import { useEffect, useRef, useState } from 'react';

/**
 * React island that decides whether the 3D hero runs at all, then lazy-loads Three.js.
 * Off for reduced motion, small screens, low-power devices, Save-Data and missing WebGL:
 * the static SVG circuit underneath stays as the poster.
 */
export default function HeroScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = window.innerWidth < 768;
    const lowPower = (nav.hardwareConcurrency ?? 8) < 4 || (nav.deviceMemory ?? 8) < 4 || nav.connection?.saveData;
    if (reduced || small || lowPower) return;
    if (!document.createElement('canvas').getContext('webgl2')) return;

    let destroy: (() => void) | undefined;
    let cancelled = false;
    const boot = () =>
      import('../../scripts/hero-scene').then(({ createHeroScene }) => {
        if (cancelled || !wrap.current || !canvas.current) return;
        destroy = createHeroScene(wrap.current, canvas.current, {
          rtl: document.documentElement.dir === 'rtl',
          onFirstFrame: () => { setReady(true); document.getElementById('top')?.setAttribute('data-scene', 'on'); },
        });
      });
    const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: object) => number) | undefined;
    const handle = idle ? idle(boot, { timeout: 2500 }) : window.setTimeout(boot, 1200);

    return () => {
      cancelled = true;
      if (idle) (window as any).cancelIdleCallback?.(handle); else clearTimeout(handle);
      destroy?.();
    };
  }, []);

  return (
    <div ref={wrap} className="hero-scene absolute inset-0" aria-hidden="true">
      <canvas
        ref={canvas}
        className="h-full w-full transition-opacity duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}
