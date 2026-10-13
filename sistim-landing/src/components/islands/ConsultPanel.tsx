import { useEffect, useRef, type ReactNode } from 'react';
import type { TypeId } from '../../config/brief';

/* ------------------------------------------------------------------ circuit geometry
   One route of 4 segments (one per completed form step). Segment k is drawn and node k is
   lit when step k is completed. The last node is the "live on the internet" moment: it
   pulses and throws the same little spark lines as the logo's top-right spark. */
interface Geometry {
  viewBox: string;
  start: [number, number];
  segs: string[];
  nodes: [number, number][];
  extras: string[];
  extraNodes: [number, number][];
  spark: string[];
}

const PANEL: Geometry = {
  viewBox: '0 0 600 800',
  start: [56, 744],
  segs: ['M56 744 V610 L92 574 V430', 'M92 430 V250 L132 210 V120', 'M132 120 H380 L420 80 H520', 'M520 80 V300 L556 336 V560'],
  nodes: [[92, 430], [132, 120], [520, 80], [556, 560]],
  extras: ['M92 430 H34', 'M132 120 V64 H80', 'M420 80 V36 H470', 'M556 336 H590', 'M56 610 H22'],
  extraNodes: [[34, 430], [80, 64], [470, 36], [590, 336], [22, 610]],
  spark: ['M538 538 L528 524', 'M556 530 L556 514', 'M574 538 L584 526'],
};

const BANNER: Geometry = {
  viewBox: '0 0 600 160',
  start: [145, 120],
  segs: ['M145 120 H195 L216 99 H230', 'M230 99 V56 L248 38 H328', 'M328 38 H382 L400 56 V96', 'M400 96 L420 116 H458'],
  nodes: [[230, 99], [328, 38], [400, 96], [458, 116]],
  extras: ['M145 120 H100 L84 104 H30', 'M458 116 H520 L540 96 H590', 'M400 56 H470 L484 40 H540'],
  extraNodes: [[30, 104], [590, 96], [540, 40]],
  spark: ['M442 100 L432 88', 'M458 94 L458 78', 'M470 102 L478 94'],
};

function Circuit({ g, completed, finished, className }: { g: Geometry; completed: number; finished: boolean; className?: string }) {
  return (
    <svg className={className} viewBox={g.viewBox} preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true" focusable="false">
      {/* the unlit route and side branches */}
      <g stroke="#fff" strokeOpacity="0.12" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {g.segs.map((d) => <path key={d} d={d} />)}
        {g.extras.map((d) => <path key={d} d={d} strokeOpacity="0.09" />)}
      </g>
      <g stroke="#fff" strokeOpacity="0.2" strokeWidth="1.6" fill="#2C3548">
        {g.extraNodes.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" />)}
      </g>
      {/* the lit route: one segment per completed step */}
      <g stroke="#3CCB98" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgb(22 171 121 / 0.7))' }}>
        {g.segs.map((d, i) => (
          <path key={d} d={d} pathLength={1} className="cx-seg" style={{ strokeDashoffset: i < completed ? 0 : 1, transitionDelay: '0s' }} />
        ))}
      </g>
      {/* nodes */}
      <circle cx={g.start[0]} cy={g.start[1]} r="7" fill="#16AB79" />
      {g.nodes.map(([x, y], i) => {
        const on = i < completed;
        const last = i === g.nodes.length - 1;
        return (
          <g key={`${x}-${y}`}>
            {last && finished && <circle cx={x} cy={y} r="11" fill="#3CCB98" className="cx-pulse" />}
            <circle cx={x} cy={y} r="10" className="cx-node" fill={on ? '#16AB79' : '#2C3548'} stroke={on ? '#7FDCBB' : '#fff'} strokeOpacity={on ? 1 : 0.28} strokeWidth="2" />
          </g>
        );
      })}
      {/* spark lines, like the logo's top-right spark */}
      <g stroke="#7FDCBB" strokeWidth="2.4" strokeLinecap="round" className="cx-spark" style={{ opacity: finished ? 1 : 0 }}>
        {g.spark.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ illustrations
   Original line drawings, 2px rounded strokes, white + emerald only. 320 x 240 each. */
const S = { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const A = { ...S, stroke: '#3CCB98' } as const;
const NAVY = '#2C3548';

type IllId = 'generic' | Exclude<TypeId, 'other'>;
const ILLUSTRATIONS: Record<IllId, ReactNode> = {
  generic: (
    <>
      <g {...S}><circle cx="160" cy="120" r="30" /><path d="M64 56 V34 M64 56 V78 M64 56 H42 M64 56 H86" strokeOpacity="0.7" /></g>
      <g {...A}>
        <circle cx="160" cy="120" r="10" />
        <path d="M190 120 H252 L274 98 H300 M130 120 H68 L46 142 H20 M160 90 V52 L182 30 H224 M160 150 V188 L138 210 H98" />
        <circle cx="300" cy="98" r="6" fill={NAVY} /><circle cx="20" cy="142" r="6" fill={NAVY} />
        <circle cx="224" cy="30" r="6" fill={NAVY} /><circle cx="98" cy="210" r="6" fill={NAVY} />
        <path d="M252 190 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" />
      </g>
    </>
  ),
  health: (
    <>
      <g {...S}>
        <path d="M30 196 H292" />
        <path d="M66 196 V92 H196 V196 M58 92 H204" />
        <rect x="118" y="146" width="30" height="50" rx="3" />
        <rect x="82" y="108" width="24" height="24" rx="3" /><rect x="158" y="108" width="24" height="24" rx="3" />
        <circle cx="131" cy="58" r="24" />
        <rect x="216" y="116" width="72" height="68" rx="8" />
        <path d="M216 138 H288 M236 108 V124 M268 108 V124" />
      </g>
      <g {...A}><path d="M131 44 V72 M117 58 H145 M236 160 l8 8 l16 -16" /></g>
    </>
  ),
  shop: (
    <>
      <g {...S}>
        <path d="M30 196 H292" />
        <path d="M70 112 V196 H206 V112" />
        <path d="M62 112 L74 74 H202 L214 112 Z" />
        <path d="M62 112 q12.7 18 25.3 0 q12.7 18 25.3 0 q12.7 18 25.3 0 q12.7 18 25.3 0 q12.7 18 25.3 0 q12.7 18 25.3 0" />
        <rect x="84" y="140" width="42" height="56" rx="3" />
        <rect x="146" y="134" width="44" height="36" rx="3" />
        <rect x="236" y="150" width="60" height="46" rx="4" />
      </g>
      <g {...A}><path d="M266 150 V196 M236 160 H296 M278 176 H290" /></g>
    </>
  ),
  architect: (
    <>
      <g {...S}>
        <rect x="40" y="48" width="160" height="130" rx="4" strokeDasharray="5 6" />
        <path d="M40 91 H200 M40 134 H200 M93 48 V178 M147 48 V178" strokeOpacity="0.25" />
        <path d="M70 112 V160 H170 V112" />
        <rect x="108" y="130" width="24" height="30" />
        <path d="M40 198 H200 M40 190 V206 M200 190 V206" strokeOpacity="0.6" />
        <circle cx="250" cy="62" r="8" />
        <path d="M250 70 L222 176 M250 70 L278 176 M236 124 H264" />
      </g>
      <g {...A}><path d="M70 112 L120 76 L170 112 M278 176 L276 190 M214 198 Q250 216 286 198" strokeDasharray="0" /></g>
    </>
  ),
  finance: (
    <>
      <g {...S}>
        <rect x="52" y="44" width="104" height="152" rx="10" />
        <rect x="66" y="58" width="76" height="30" rx="5" />
        <circle cx="76" cy="116" r="7" /><circle cx="104" cy="116" r="7" /><circle cx="132" cy="116" r="7" />
        <circle cx="76" cy="144" r="7" /><circle cx="104" cy="144" r="7" /><circle cx="132" cy="144" r="7" />
        <circle cx="76" cy="172" r="7" /><circle cx="104" cy="172" r="7" />
        <path d="M186 196 H298 M186 196 V64" />
        <rect x="200" y="156" width="18" height="40" rx="2" /><rect x="228" y="128" width="18" height="68" rx="2" />
      </g>
      <g {...A}>
        <circle cx="132" cy="172" r="7" />
        <rect x="256" y="96" width="18" height="100" rx="2" />
        <path d="M196 140 L224 112 L250 124 L286 78 M286 78 L274 80 M286 78 L284 90" />
      </g>
    </>
  ),
  freelancer: (
    <>
      <g {...S}>
        <rect x="64" y="64" width="150" height="100" rx="8" />
        <rect x="76" y="76" width="126" height="76" rx="3" />
        <path d="M44 164 H234 L224 182 H54 Z" />
        <path d="M124 98 H184 M124 112 H168 M88 136 H190" strokeOpacity="0.8" />
        <g transform="rotate(7 264 140)">
          <rect x="232" y="92" width="66" height="96" rx="8" fill={NAVY} />
          <rect x="242" y="102" width="46" height="36" rx="4" />
          <path d="M242 166 H272" />
        </g>
      </g>
      <g {...A}>
        <circle cx="100" cy="104" r="12" />
        <g transform="rotate(7 264 140)"><path d="M242 152 H266" /></g>
      </g>
    </>
  ),
};

function Illustrations({ type }: { type: TypeId | null }) {
  const active: IllId = type && type !== 'other' ? type : 'generic';
  return (
    <div className="ill-box" data-active={active}>
      <div className="ill-float">
        {(Object.keys(ILLUSTRATIONS) as IllId[]).map((k) => (
          <svg key={k} className="ill" data-on={k === active || undefined} viewBox="0 0 320 240" aria-hidden="true" focusable="false" data-ill={k}>
            {ILLUSTRATIONS[k]}
          </svg>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reassurance icons */
const ICONS = {
  duration: 'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',
  reply: 'M4 5h16v11H9l-5 4z',
  free: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export interface PanelProps {
  completed: number;
  finished: boolean;
  type: TypeId | null;
  reassurance: { id: keyof typeof ICONS; text: string }[];
  handle: string;
  badgeSrc: string;
  photo: { src: string; label: string } | null;
  reduced: boolean;
}

export default function ConsultPanel({ completed, finished, type, reassurance, handle, photo, reduced }: PanelProps) {
  const root = useRef<HTMLElement>(null);
  const lit = reduced ? 4 : completed;
  const done = reduced ? true : finished;

  // Pause every loop while the panel is off-screen or the tab is hidden
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let visible = true;
    const apply = () => el.classList.toggle('is-paused', !visible || document.hidden);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; apply(); });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', apply); };
  }, []);

  return (
    <aside ref={root} className="consult-area-panel consult-panel" aria-hidden="true">
      {/* Mobile banner: circuit + badge, progress still wires the lines */}
      <div className="consult-banner lg:hidden">
        <div className="consult-grain" />
        <Circuit g={BANNER} completed={lit} finished={done} className="absolute inset-0 h-full w-full rtl:-scale-x-100" />
        <picture className="consult-banner-badge">
          <source srcSet="/brand/mark.avif" type="image/avif" />
          <source srcSet="/brand/mark.webp" type="image/webp" />
          <img src="/brand/mark.png" width="56" height="56" alt="" />
        </picture>
      </div>

      {/* Desktop panel */}
      <div className="consult-art hidden lg:flex">
        <div className="consult-glow" />
        <div className="consult-grain" />
        <picture className="consult-glyph">
          <source srcSet="/brand/glyph.webp" type="image/webp" />
          <img src="/brand/glyph.png" width="900" height="624" alt="" />
        </picture>
        <Circuit g={PANEL} completed={lit} finished={done} className="absolute inset-0 h-full w-full rtl:-scale-x-100" />

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-10 pt-10">
          {photo && done ? (
            <figure className="consult-photo">
              <img src={photo.src} alt="" loading="lazy" />
              <figcaption>{photo.label}</figcaption>
            </figure>
          ) : (
            <Illustrations type={type} />
          )}
        </div>

        <div className="consult-reassure">
          <ul>
            {reassurance.map((r) => (
              <li key={r.id}>
                <span className="consult-reassure-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[r.id]} /></svg>
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
          <p className="consult-reassure-foot">
            <picture>
              <source srcSet="/brand/mark.webp" type="image/webp" />
              <img src="/brand/mark.png" width="28" height="28" alt="" />
            </picture>
            <span dir="ltr">{handle}</span>
          </p>
        </div>
      </div>
    </aside>
  );
}
