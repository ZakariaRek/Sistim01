import { useEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { consultState } from '../../lib/logo3d/store';
import { ENABLE_3D_LOGO, MAX_PIXEL_RATIO, MAX_PIXEL_RATIO_MOBILE } from '../../config/logo3d';
import { TYPE_ICON } from './typeIcons';
import type { LogoController } from '../../lib/logo3d/scene';

interface Props {
  /** Business type labels in the page language, for the chip under the logo. */
  types: Record<string, { label: string }>;
}

/**
 * The decorative 3D logo. Shows the traced poster at once, then crossfades to a WebGL canvas.
 * Falls back to the poster (with a CSS turn, or a glow for reduced motion) when 3D is off,
 * unsupported or lost. Three.js is imported dynamically so it never touches the initial bundle.
 */
export default function Logo3D({ types }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrl = useRef<LogoController | null>(null);
  const [mode, setMode] = useState<'poster' | 'webgl' | 'fallback'>('poster');
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [turn, setTurn] = useState(0);
  const state = useStore(consultState);
  const prev = useRef(consultState.get());
  const mountedAt = useRef(0);

  // 1) decide whether 3D can run at all
  useEffect(() => {
    mountedAt.current = performance.now();
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const supported = (() => {
      try { return !!document.createElement('canvas').getContext('webgl2') || !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
    })();
    setMode(ENABLE_3D_LOGO && !mq.matches && supported ? 'webgl' : 'fallback');
  }, []);

  // 2) start the scene once the canvas exists
  useEffect(() => {
    if (mode !== 'webgl') return;
    let cancelled = false;
    let controller: LogoController | null = null;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const lowPower = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    const phone = window.matchMedia('(max-width: 1023px), (pointer: coarse)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    import('../../lib/logo3d/scene')
      .then(({ createLogoScene }) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        try {
          controller = createLogoScene(canvas, {
            lowPower,
            maxDpr: phone ? MAX_PIXEL_RATIO_MOBILE : MAX_PIXEL_RATIO,
            pointer: finePointer,
            onFirstFrame: () => setReady(true),
            onContextLost: () => { setReady(false); setMode('fallback'); },
          });
          ctrl.current = controller;
          if (new URLSearchParams(location.search).has('qa3d')) (canvas as any).__logo = controller; // QA hook
        } catch {
          setMode('fallback');
        }
      })
      .catch(() => setMode('fallback'));

    return () => {
      cancelled = true;
      controller?.dispose();
      ctrl.current = null;
    };
  }, [mode]);

  // 3) react to the form: step / business type / status
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    if (performance.now() - mountedAt.current < 600) return; // hydration or restored progress: no spin
    const changedStep = state.step !== before.step;
    const changedType = state.businessType !== before.businessType && state.businessType !== null;
    const sent = state.status === 'thanks' && before.status !== 'thanks';

    if (mode === 'webgl' && ctrl.current) {
      if (sent) ctrl.current.celebrate();
      else if (changedStep) ctrl.current.spin(state.direction);
      else if (changedType) ctrl.current.spin(1);
    } else if (mode === 'fallback' && (sent || changedStep || changedType)) {
      setTurn((n) => n + 1); // re-trigger the CSS turn / glow
    }
  }, [state, mode]);

  const type = state.businessType && types[state.businessType] ? state.businessType : null;

  return (
    <div className="logo3d" data-mode={mode} data-ready={ready || undefined} data-reduced={reduced || undefined} aria-hidden="true">
      <div className="logo3d-glow" />
      <div className="logo3d-stage">
        <img
          key={mode === 'fallback' ? turn : 'poster'}
          className="logo3d-poster"
          data-turn={mode === 'fallback' && turn > 0 ? 'on' : undefined}
          src="/brand/logo-s-poster.webp"
          width={900}
          height={625}
          alt=""
          decoding="async"
        />
        {mode === 'webgl' && <canvas ref={canvasRef} className="logo3d-canvas" />}
      </div>
      <div className="logo3d-chip" data-on={type ? 'true' : undefined}>
        {type && (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={TYPE_ICON[type]} /></svg>
            <span>{types[type].label}</span>
          </>
        )}
      </div>
    </div>
  );
}
