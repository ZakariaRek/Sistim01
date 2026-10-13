import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { NEED_IDS, OPTIONAL_STEPS, STEP_IDS, TYPE_IDS, normalizePhone, type NeedId, type TypeId } from '../../config/brief';
import ConsultPanel from './ConsultPanel';

type Dict = Record<string, any>;
interface Props {
  locale: 'ar' | 'fr' | 'en';
  s: Dict; // t(locale).brief
  copy: { cta: string; title: string; lead: string };
  cfg: { duration: number; hours: number; includesCall: boolean; includesRecommendation: boolean };
  wa: string;
  eml: string;
  handle: string;
  homeHref: string;
  newTab: string;
  waIcon: string;
  photoSrc?: string;
  children?: ReactNode; // header (logo, language switcher, close) rendered by the Astro page
}
interface Answers {
  type?: TypeId;
  need?: NeedId;
  sentence?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  consent?: boolean;
}
type Phase = 'form' | 'sending' | 'thanks' | 'error';

const STORE_KEY = 'sistim-consult';
const MIN_FILL_MS = 3000;
const ENDPOINT: string = import.meta.env.PUBLIC_CONSULTATION_ENDPOINT || '';
const ACCESS_KEY: string = import.meta.env.PUBLIC_CONSULTATION_ACCESS_KEY || '';

const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const decode = (e: string) => { try { return [...atob(e)].reverse().join(''); } catch { return ''; } };
const store = {
  load(): { answers: Answers; step: number; startedAt: number } | null {
    try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  save(v: object) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch {} },
};

const TYPE_ICON: Record<TypeId, string> = {
  health: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.5c0 5.6-7.5 10.2-7.5 10.2z',
  shop: 'M5 8h14l-1.2 12H6.2z M9 8V6a3 3 0 0 1 6 0v2',
  architect: 'M3.5 20.5L12 4l8.5 16.5 M7.5 14h9',
  finance: 'M5 20v-7 M12 20V5 M19 20v-9 M3 20h18',
  freelancer: 'M5 6h14v9H5z M3 19h18',
  other: 'M12 3v6 M12 15v6 M3 12h6 M15 12h6',
};
const ARROW = 'M5 12h14M13 6l6 6-6 6';

export default function ConsultFlow({ locale, s, copy, cfg, wa, eml, handle, homeHref, newTab, waIcon, photoSrc, children }: Props) {
  const rtl = locale === 'ar';
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('form');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [reduced, setReduced] = useState(false);
  const startedAt = useRef(Date.now());
  const bodyRef = useRef<HTMLDivElement>(null);
  const pointerPick = useRef(false);
  const advanceTimer = useRef(0);
  const firstRender = useRef(true);
  const stepId = STEP_IDS[step];

  // ----- boot: reduced motion, saved progress, ?need= from an offer card
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);

    const saved = store.load();
    let next: Answers = {};
    if (saved?.answers) {
      next = saved.answers;
      setStep(Math.min(Math.max(0, saved.step || 0), STEP_IDS.length - 1));
      startedAt.current = saved.startedAt || Date.now();
    }
    const need = new URLSearchParams(location.search).get('need');
    if (need && (NEED_IDS as readonly string[]).includes(need) && !next.need) next = { ...next, need: need as NeedId };
    setAnswers(next);
    return () => { mq.removeEventListener('change', onChange); clearTimeout(advanceTimer.current); };
  }, []);

  // ----- persist progress (works without storage too)
  useEffect(() => {
    if (phase === 'form') store.save({ answers, step, startedAt: startedAt.current });
  }, [answers, step, phase]);

  // ----- step transition (direction mirrored in RTL) + focus
  const direction = useRef(1);
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (firstRender.current) { firstRender.current = false; return; } // never steal focus on page load
    if (!reduced) {
      // opacity, not autoAlpha: a visibility:hidden panel cannot receive focus
      gsap.fromTo(el, { x: 24 * direction.current * (rtl ? -1 : 1), opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'expo.out', clearProps: 'transform,opacity' });
    }
    const target = el.querySelector<HTMLElement>('input:checked') || el.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]), [data-focus]');
    target?.focus({ preventScroll: true });
  }, [step, phase]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => {
    setAnswers((a) => ({ ...a, [k]: v }));
    if (errors[k as string]) setErrors((e) => { const n = { ...e }; delete n[k as string]; return n; });
  };

  /* ------------------------------------------------------------ labels + messages */
  const typeLabel = (t?: TypeId) => (t ? s.types[t].label : '');
  const needLabel = (n?: NeedId) => (n ? s.needs[n] : '');
  const fullName = () => `${(answers.firstName || '').trim()} ${(answers.lastName || '').trim()}`.trim();

  const summaryText = () => {
    const t = s.text;
    const lines = [t.header, '', `${t.name}: ${fullName()}`, `${t.phone}: ${normalizePhone(answers.phone || '') || answers.phone || ''}`, `${t.type}: ${typeLabel(answers.type)}`];
    if (answers.need) lines.push(`${t.need}: ${needLabel(answers.need)}`);
    if (answers.sentence?.trim()) lines.push(`${t.sentence}: ${answers.sentence.trim()}`);
    lines.push('', t.footer);
    return lines.join('\n');
  };
  /** Short WhatsApp opener: name, business type and need if given. */
  const waHref = () => {
    const details = [typeLabel(answers.type), needLabel(answers.need)].filter(Boolean).join(s.text.comma);
    const text = fill(s.wa.message, { name: (answers.firstName || '').trim(), details });
    return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  };
  const mailHref = () => {
    const subject = `${s.text.header}: ${fullName()}`;
    return `mailto:${decode(eml)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summaryText())}`;
  };

  /* ------------------------------------------------------------ validation + navigation */
  const validate = (id: (typeof STEP_IDS)[number], a: Answers) => {
    const errs: Record<string, string> = {};
    if (id === 'type' && !a.type) errs.type = s.ui.required;
    if (id === 'name') {
      if (!a.firstName?.trim()) errs.firstName = s.ui.requiredName;
      if (!a.lastName?.trim()) errs.lastName = s.ui.requiredName;
    }
    if (id === 'phone') {
      if (!a.phone?.trim() || !normalizePhone(a.phone)) errs.phone = s.ui.invalidPhone;
      if (!a.consent) errs.consent = s.ui.consentRequired;
    }
    return errs;
  };

  const go = (to: number, dir: 1 | -1) => { direction.current = dir; setErrors({}); setStep(to); };

  const next = (a: Answers = answers) => {
    clearTimeout(advanceTimer.current);
    const errs = validate(stepId, a);
    if (Object.keys(errs).length) {
      setErrors(errs);
      requestAnimationFrame(() => bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (stepId === 'phone') { void submit(a); return; }
    go(step + 1, 1);
  };
  const back = () => { clearTimeout(advanceTimer.current); if (step > 0) go(step - 1, -1); };
  const skip = () => { clearTimeout(advanceTimer.current); setAnswers((a) => ({ ...a, need: undefined, sentence: undefined })); go(step + 1, 1); };

  const pickType = (t: TypeId) => {
    const a = { ...answers, type: t };
    set('type', t);
    // Pointer picks move on by themselves after a beat; keyboard picks wait for Enter
    if (pointerPick.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => next(a), 350);
    }
    pointerPick.current = false;
  };

  /* ------------------------------------------------------------ submit */
  async function submit(a: Answers) {
    const phone = normalizePhone(a.phone || '') || a.phone || '';
    setAnswers({ ...a, phone });
    // Spam checks: honeypot filled or impossibly fast -> look successful, send nothing
    if (honeypot || Date.now() - startedAt.current < MIN_FILL_MS) { setPhase('thanks'); return; }
    if (!ENDPOINT) { store.clear(); setPhase('thanks'); return; }
    setPhase('sending');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          ...(ACCESS_KEY ? { access_key: ACCESS_KEY } : {}),
          subject: `${s.text.header}: ${fullName()}`,
          _subject: `${s.text.header}: ${fullName()}`,
          from_name: 'Sistim website',
          name: fullName(),
          phone,
          message: summaryText(),
          payload: {
            locale,
            timestamp: new Date().toISOString(),
            answers: { type: a.type, need: a.need ?? null, sentence: a.sentence?.trim() || null, firstName: a.firstName?.trim(), lastName: a.lastName?.trim(), phone },
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      store.clear();
      setPhase('thanks');
    } catch {
      setPhase('error');
    } finally { clearTimeout(timer); }
  }

  const onKey = (e: KeyboardEvent<HTMLFormElement>) => {
    const el = e.target as HTMLInputElement;
    if (e.key === 'Enter' && el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'checkbox')) { e.preventDefault(); next(); }
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); next(); };

  /* ------------------------------------------------------------ pieces */
  const completed = phase === 'thanks' ? 4 : step;
  const errId = (id: string) => `err-${id}`;
  const Err = ({ id }: { id: string }) => (errors[id] ? <p id={errId(id)} className="brief-error">{errors[id]}</p> : null);
  const stepText = fill(s.ui.stepOf, { x: String(step + 1), n: String(STEP_IDS.length) });
  const optional = (OPTIONAL_STEPS as readonly string[]).includes(stepId);

  const arrow = (extra = '') => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`arrow ${extra}`} aria-hidden="true"><path d={ARROW} /></svg>
  );

  const reassurance = [
    ...(cfg.includesCall ? [{ id: 'duration' as const, text: fill(s.panel.duration, { duration: String(cfg.duration) }) }] : []),
    { id: 'reply' as const, text: fill(s.panel.reply, { hours: String(cfg.hours) }) },
    { id: 'free' as const, text: s.panel.free },
  ];

  const title = (id: (typeof STEP_IDS)[number]) => (
    <>
      <h2 className="brief-q">{s.steps[id].title}</h2>
      {s.steps[id].hint && <p className="mt-3 text-muted">{s.steps[id].hint}</p>}
    </>
  );

  const progress = (
    <div className="consult-steps" role="progressbar" aria-label={s.ui.progress} aria-valuemin={1} aria-valuemax={STEP_IDS.length} aria-valuenow={step + 1} aria-valuetext={stepText}>
      {STEP_IDS.map((id, i) => <span key={id} data-on={i <= step || undefined} data-done={i < step || undefined} />)}
    </div>
  );

  /* ------------------------------------------------------------ screens */
  let screen: ReactNode;
  if (phase === 'thanks' || phase === 'error') {
    const ok = phase === 'thanks';
    const vars = { name: (answers.firstName || '').trim(), hours: String(cfg.hours), duration: String(cfg.duration) };
    const steps = [s.thanks.step1, fill(s.thanks.step2, vars), ...(cfg.includesRecommendation ? [s.thanks.step3] : [])];
    screen = (
      <div ref={bodyRef}>
        <span className={`grid size-14 place-items-center rounded-full ${ok ? 'bg-emerald-500 text-navy-950' : 'bg-[#f7b4a7]/15 text-[#f7b4a7]'}`} aria-hidden="true">
          {ok
            ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 6.5v7.5M12 18v.01" /></svg>}
        </span>
        <h1 className="brief-q mt-6" tabIndex={-1} data-focus>{ok ? fill(s.thanks.title, vars) : s.error.title}</h1>
        {ok ? (
          <>
            <p className="mt-3 text-muted">{s.thanks.lead}</p>
            <ol className="mt-8 space-y-3">
              {steps.map((txt, i) => (
                <li key={i} className="flex gap-4 rounded-2xl border border-white/10 bg-navy-950/40 p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-emerald-500/50 font-mono text-xs text-emerald-400" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pt-1 text-white/90">{txt}</span>
                </li>
              ))}
            </ol>
          </>
        ) : <p className="mt-3 text-muted">{s.error.lead}</p>}
        <div className="mt-9 flex flex-wrap gap-3">
          <a href={waHref()} target="_blank" rel="noopener" className="btn btn-primary min-h-13 px-6">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={waIcon} /></svg>
            <span>{s.thanks.whatsapp}</span><span className="sr-only">{newTab}</span>
          </a>
          <a href={mailHref()} className="btn btn-ghost min-h-13 px-6">{s.thanks.email}</a>
          <a href={homeHref} className="btn min-h-13 px-5 text-muted hover:text-white">{s.thanks.home}</a>
        </div>
      </div>
    );
  } else {
    screen = (
      <form onSubmit={onSubmit} onKeyDown={onKey} noValidate data-step={stepId}>
        <div ref={bodyRef}>
          {stepId === 'type' && (
            <fieldset aria-describedby={errors.type ? errId('type') : undefined}>
              <legend className="contents">{title('type')}</legend>
              <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
                {TYPE_IDS.map((id) => {
                  const checked = answers.type === id;
                  return (
                    <label key={id} className="type-card" data-checked={checked || undefined} onPointerDown={() => (pointerPick.current = true)}>
                      <input type="radio" name="type" value={id} checked={checked} className="brief-option-input"
                        aria-invalid={errors.type ? true : undefined}
                        onChange={() => pickType(id)}
                        onClick={() => { if (pointerPick.current && checked) pickType(id); }} />
                      <span className="type-card-icon" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={TYPE_ICON[id]} /></svg>
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium leading-snug">{s.types[id].label}</span>
                        {s.types[id].hint && <span className="mt-0.5 block text-sm text-muted">{s.types[id].hint}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
              <Err id="type" />
            </fieldset>
          )}

          {stepId === 'need' && (
            <>
              <fieldset>
                <legend className="contents">{title('need')}</legend>
                <div className="mt-7 grid gap-2.5">
                  {NEED_IDS.map((id) => {
                    const checked = answers.need === id;
                    return (
                      <label key={id} className="brief-option" data-checked={checked || undefined}>
                        <input type="radio" name="need" value={id} checked={checked} className="brief-option-input" onChange={() => set('need', id)} />
                        <span className="brief-option-mark" aria-hidden="true" />
                        <span className="flex-1">{s.needs[id]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <div className="mt-6">
                <label htmlFor="f-sentence" className="mb-2 flex items-baseline justify-between gap-3 text-sm font-medium text-white">
                  {s.fields.sentence}<span className="text-xs font-normal text-muted">{s.ui.optional}</span>
                </label>
                <input id="f-sentence" name="sentence" maxLength={140} autoComplete="off" className="field" placeholder={s.fields.sentencePlaceholder}
                  value={answers.sentence ?? ''} onChange={(e) => set('sentence', e.target.value)} />
              </div>
            </>
          )}

          {stepId === 'name' && (
            <>
              {title('name')}
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="f-first" className="mb-2 block text-sm font-medium text-white">{s.fields.firstName}</label>
                  <input id="f-first" name="firstName" autoComplete="given-name" required className="field" value={answers.firstName ?? ''}
                    onChange={(e) => set('firstName', e.target.value)}
                    aria-invalid={errors.firstName ? true : undefined} aria-describedby={errors.firstName ? errId('firstName') : undefined} />
                </div>
                <div>
                  <label htmlFor="f-last" className="mb-2 block text-sm font-medium text-white">{s.fields.lastName}</label>
                  <input id="f-last" name="lastName" autoComplete="family-name" required className="field" value={answers.lastName ?? ''}
                    onChange={(e) => set('lastName', e.target.value)}
                    aria-invalid={errors.lastName ? true : undefined} aria-describedby={errors.lastName ? errId('lastName') : undefined} />
                </div>
              </div>
              {(errors.firstName || errors.lastName) && <p id={errId(errors.firstName ? 'firstName' : 'lastName')} className="brief-error">{errors.firstName || errors.lastName}</p>}
            </>
          )}

          {stepId === 'phone' && (
            <>
              {title('phone')}
              {answers.type === 'health' && <p className="brief-note mt-6"><span aria-hidden="true">⚠</span> {s.notes.health}</p>}
              <div className="mt-7">
                <label htmlFor="f-phone" className="mb-2 block text-sm font-medium text-white">{s.fields.phone}</label>
                <input id="f-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" required placeholder="06 12 34 56 78"
                  className={`field ${rtl ? 'text-right' : ''}`} value={answers.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
                  aria-invalid={errors.phone ? true : undefined} aria-describedby={errors.phone ? errId('phone') : undefined} />
                <Err id="phone" />
              </div>
              <div className="mt-6">
                <label className="brief-option items-start" data-checked={answers.consent || undefined}>
                  <input type="checkbox" className="brief-option-input" checked={!!answers.consent} onChange={(e) => set('consent', e.target.checked)}
                    aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? errId('consent') : undefined} />
                  <span className="brief-option-mark mt-0.5" data-multi aria-hidden="true" />
                  <span className="flex-1 text-[0.95rem]">{s.fields.consent}</span>
                </label>
                <Err id="consent" />
              </div>
              {/* Honeypot: invisible to people, tempting to bots */}
              <div className="absolute -start-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                <label>Website <input tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
              </div>
            </>
          )}
        </div>

        <div className="brief-actions">
          {step > 0 ? (
            <button type="button" onClick={back} className="btn btn-ghost min-h-12 px-5">
              {arrow('arrow-back')}<span>{s.ui.back}</span>
            </button>
          ) : <span />}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {optional && <button type="button" onClick={skip} className="btn min-h-12 px-5 text-muted hover:text-white">{s.ui.skip}</button>}
            {stepId !== 'phone' && <span className="hidden text-xs text-muted xl:inline">{s.ui.enterHint}</span>}
            {stepId === 'phone' ? (
              <button type="submit" className="btn btn-primary min-h-13 px-6 text-[1.02rem]" disabled={phase === 'sending'} aria-busy={phase === 'sending' || undefined}>
                {phase === 'sending' ? s.ui.sending : s.ui.submit}
              </button>
            ) : (
              <button type="submit" className="btn btn-primary min-h-12 px-6"><span>{s.ui.next}</span>{arrow()}</button>
            )}
          </div>
        </div>
      </form>
    );
  }

  const live = phase === 'form' ? `${stepText}: ${s.steps[stepId].title}` : phase === 'thanks' ? s.thanks.lead : phase === 'error' ? s.error.title : '';

  return (
    <div className="consult-grid">
      <div className="consult-area-header">{children}</div>

      <ConsultPanel
        completed={completed}
        finished={phase === 'thanks'}
        type={answers.type ?? null}
        reassurance={reassurance}
        handle={handle}
        badgeSrc="/brand/mark.png"
        photo={photoSrc ? { src: photoSrc, label: s.thanks.photoLabel } : null}
        reduced={reduced}
      />

      <main id="main" tabIndex={-1} className="consult-area-form outline-none">
        <div className="consult-form-inner">
          {phase === 'form' && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="flex items-center gap-3"><span className="node" aria-hidden="true" /><span className="label">{copy.cta}</span></p>
                <p className="font-mono text-xs uppercase tracking-[0.12em] text-emerald-400 [:lang(ar)_&]:font-sans [:lang(ar)_&]:text-sm [:lang(ar)_&]:normal-case">{stepText}</p>
              </div>
              {progress}
            </div>
          )}
          {/* Page heading + lead: full size on the first screen, readable-only afterwards */}
          {phase === 'form' && <h1 className={step === 0 ? 'consult-h1' : 'sr-only'}>{copy.title}</h1>}
          {step === 0 && phase === 'form' && <p className="consult-lead">{copy.lead}</p>}
          {screen}
        </div>
        <p className="sr-only" aria-live="polite">{live}</p>
      </main>
    </div>
  );
}
