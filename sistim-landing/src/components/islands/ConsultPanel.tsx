import { useEffect, useRef, type ReactNode } from 'react';

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
      {/* the lit route: one segment per completed step. The glow is a wider, fainter stroke underneath
          (no SVG filter: filters on a large group are costly under an animating canvas) */}
      <g stroke="#3CCB98" strokeLinecap="round" strokeLinejoin="round">
        {g.segs.map((d, i) => (
          <path key={`glow-${d}`} d={d} pathLength={1} className="cx-seg" strokeWidth="9" strokeOpacity="0.2" style={{ strokeDashoffset: i < completed ? 0 : 1 }} />
        ))}
        {g.segs.map((d, i) => (
          <path key={d} d={d} pathLength={1} className="cx-seg" strokeWidth="2.6" style={{ strokeDashoffset: i < completed ? 0 : 1 }} />
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

/* ------------------------------------------------------------------ reassurance icons */
const ICONS = {
  duration: 'M12 7v5l3 2 M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',
  reply: 'M4 5h16v11H9l-5 4z',
  free: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export interface PanelProps {
  completed: number;
  finished: boolean;
  reassurance: { id: keyof typeof ICONS; text: string }[];
  handle: string;
  photo: { src: string; label: string } | null;
  reduced: boolean;
  /** The 3D logo island, rendered by the Astro page (hydrates separately, client:idle). */
  logo?: ReactNode;
}

export default function ConsultPanel({ completed, finished, reassurance, handle, photo, reduced, logo }: PanelProps) {
  const root = useRef<HTMLElement>(null);
  const lit = reduced ? 4 : completed;
  const done = reduced ? true : finished;

  // Pause the CSS loops while the panel is off-screen or the tab is hidden
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
      {/* One panel for every width: a short banner on phones, the full panel from 1024px up */}
      <div className="consult-art">
        <div className="consult-glow" />
        <div className="consult-grain" />
        {/* the circuit sits behind the transparent 3D canvas; progress still wires it */}
        <Circuit g={BANNER} completed={lit} finished={done} className="absolute inset-0 h-full w-full rtl:-scale-x-100 lg:hidden" />
        <Circuit g={PANEL} completed={lit} finished={done} className="absolute inset-0 hidden h-full w-full rtl:-scale-x-100 lg:block" />

        <div className="consult-logo" data-photo={photo && done ? 'true' : undefined}>{logo}</div>
        {photo && done && (
          <figure className="consult-photo">
            <img src={photo.src} alt="" loading="lazy" />
            <figcaption>{photo.label}</figcaption>
          </figure>
        )}

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
