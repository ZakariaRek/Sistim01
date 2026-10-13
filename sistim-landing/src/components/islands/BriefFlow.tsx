import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { gsap } from 'gsap';
import {
  BRIEF, NEED_IDS, visibleSteps, visibleFields, isOptionalStep, normalizeMoroccanMobile,
  type Answers, type Field, type Step,
} from '../../config/brief';

/* ------------------------------------------------------------------ types */
type Dict = Record<string, any>;
interface Props {
  locale: 'ar' | 'fr' | 'en';
  s: Dict; // t(locale).brief
  intro: { kicker: string; title: string; lead: string; facts: string[] };
  cfg: { duration: number; hours: number; includesRecommendation: boolean };
  wa: string;
  eml: string;
  homeHref: string;
  newTab: string;
  waIcon: string;
  channelNames: Record<string, string>;
}
type Phase = 'intro' | 'step' | 'summary' | 'sending' | 'thanks' | 'error';

const STORE_KEY = 'sistim-brief';
const MIN_FILL_MS = 8000;
const ENDPOINT: string = import.meta.env.PUBLIC_CONSULTATION_ENDPOINT || '';
const ACCESS_KEY: string = import.meta.env.PUBLIC_CONSULTATION_ACCESS_KEY || '';

const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const decode = (e: string) => { try { return [...atob(e)].reverse().join(''); } catch { return ''; } };
const store = {
  load(): { answers: Answers; stepId: string; startedAt: number } | null {
    try { const raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
  save(v: object) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(STORE_KEY); } catch {} },
};
const isEmpty = (v: Answers[string]) => v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0);
const toUrl = (v: string) => {
  const raw = v.trim();
  if (!raw) return '';
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.toString() : null;
  } catch { return null; }
};

/** Trim a message so its URL-encoded form stays under `max` characters. */
function trimEncoded(text: string, max: number) {
  if (encodeURIComponent(text).length <= max) return text;
  let out = text;
  while (out.length > 0 && encodeURIComponent(out + '…').length > max) out = out.slice(0, Math.floor(out.length * 0.92));
  return out + '…';
}

/* ------------------------------------------------------------------ component */
export default function BriefFlow({ locale, s, intro, cfg, wa, eml, homeHref, newTab, waIcon, channelNames }: Props) {
  const rtl = locale === 'ar';
  const colon = locale === 'fr' ? ' : ' : ': ';
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<Answers>({});
  const [stepId, setStepId] = useState(BRIEF[0].id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<ReturnType<typeof store.load>>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [honeypot, setHoneypot] = useState('');
  const direction = useRef(1);
  const panel = useRef<HTMLDivElement>(null);
  const pointerPick = useRef(false);
  const advanceTimer = useRef<number>(0);
  const firstRender = useRef(true);

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const index = Math.max(0, steps.findIndex((st) => st.id === stepId));
  const step = steps[index] ?? steps[0];
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----- boot: saved progress + ?need= prefill
  useEffect(() => {
    const prev = store.load();
    if (prev && prev.answers && Object.keys(prev.answers).length) setSaved(prev);
    const need = new URLSearchParams(location.search).get('need');
    if (need && (NEED_IDS as readonly string[]).includes(need)) setAnswers((a) => ({ ...a, need }));
    return () => clearTimeout(advanceTimer.current);
  }, []);

  // ----- persist progress (works without storage too)
  useEffect(() => {
    if (phase === 'step' || phase === 'summary') store.save({ answers, stepId, startedAt });
  }, [answers, stepId, phase, startedAt]);

  // ----- step transition (direction mirrored in RTL) + focus management
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (firstRender.current) { firstRender.current = false; return; } // never steal focus on page load
    if (!reduced) {
      // opacity, not autoAlpha: a visibility:hidden panel could not receive focus below
      gsap.fromTo(el, { x: 28 * direction.current * (rtl ? -1 : 1), opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'expo.out', clearProps: 'transform,opacity' });
    }
    const target =
      el.querySelector<HTMLElement>('[aria-invalid="true"]') ||
      el.querySelector<HTMLElement>('input:checked') ||
      el.querySelector<HTMLElement>('input:not([type=hidden]), textarea, [data-focus]');
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [phase, stepId]);

  /* ------------------------------------------------------------ labels */
  const optionLabel = (f: Field, v: string) => s.options[f.options!]?.[v] ?? v;
  const display = (f: Field, v: Answers[string]): string => {
    if (isEmpty(v)) return '';
    if (f.type === 'single') return optionLabel(f, v as string);
    if (f.type === 'multi') return (v as string[]).map((x) => optionLabel(f, x)).join(', ');
    if (f.type === 'consent') return '';
    return String(v);
  };

  /* ------------------------------------------------------------ validation */
  const validateStep = useCallback((st: Step, a: Answers) => {
    const errs: Record<string, string> = {};
    for (const f of visibleFields(st, a)) {
      const v = a[f.id];
      if (f.required && isEmpty(v)) {
        errs[f.id] = f.type === 'consent' ? s.ui.consentRequired : f.type === 'single' || f.type === 'multi' ? s.ui.required : s.ui.requiredField;
        continue;
      }
      if (isEmpty(v)) continue;
      if (f.type === 'tel' && !normalizeMoroccanMobile(String(v))) errs[f.id] = s.ui.invalidPhone;
      if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) errs[f.id] = s.ui.invalidEmail;
      if (f.type === 'url' && toUrl(String(v)) === null) errs[f.id] = s.ui.invalidUrl;
    }
    return errs;
  }, [s]);

  /** Normalise values when leaving a step (phone to +212…, links to full URLs). */
  const normalise = (st: Step, a: Answers): Answers => {
    const out = { ...a };
    for (const f of visibleFields(st, a)) {
      const v = out[f.id];
      if (isEmpty(v)) continue;
      if (f.type === 'tel') out[f.id] = normalizeMoroccanMobile(String(v)) ?? v;
      if (f.type === 'url') out[f.id] = toUrl(String(v)) || v;
      if (f.type === 'text' || f.type === 'textarea' || f.type === 'email') out[f.id] = String(v).trim();
    }
    return out;
  };

  /* ------------------------------------------------------------ navigation */
  const goTo = (id: string, dir: 1 | -1) => { direction.current = dir; setErrors({}); setStepId(id); setPhase('step'); };

  const next = (a: Answers = answers) => {
    clearTimeout(advanceTimer.current);
    const errs = validateStep(step, a);
    if (Object.keys(errs).length) { setErrors(errs); requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    const clean = normalise(step, a);
    setAnswers(clean);
    const list = visibleSteps(clean);
    const i = list.findIndex((st) => st.id === step.id);
    if (editing) {
      // Back to the summary unless the edit opened new required questions
      const pending = list.find((st, k) => k > i && Object.keys(validateStep(st, clean)).length);
      if (!pending) { direction.current = 1; setEditing(false); setPhase('summary'); return; }
      return goTo(pending.id, 1);
    }
    if (i + 1 < list.length) {
      // Prefill the contact name from the first name
      if (list[i + 1].id === 'contact' && !clean.name && clean.firstName) setAnswers({ ...clean, name: clean.firstName });
      goTo(list[i + 1].id, 1);
    } else { direction.current = 1; setPhase('summary'); }
  };
  const back = () => {
    clearTimeout(advanceTimer.current);
    if (index === 0) { direction.current = -1; setPhase('intro'); return; }
    goTo(steps[index - 1].id, -1);
  };
  const skip = () => {
    const cleared = { ...answers };
    step.fields.forEach((f) => delete cleared[f.id]);
    setErrors({});
    next(cleared);
  };

  const start = (resume: boolean) => {
    if (resume && saved) {
      setAnswers(saved.answers);
      setStartedAt(saved.startedAt || Date.now());
      const list = visibleSteps(saved.answers);
      goTo(list.some((st) => st.id === saved.stepId) ? saved.stepId : list[0].id, 1);
    } else {
      store.clear();
      const need = new URLSearchParams(location.search).get('need');
      setAnswers(need && (NEED_IDS as readonly string[]).includes(need) ? { need } : {});
      setStartedAt(Date.now());
      goTo(BRIEF[0].id, 1);
    }
    setSaved(null);
  };

  /* ------------------------------------------------------------ answers */
  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
  };
  const pickSingle = (f: Field, v: string) => {
    const a = { ...answers, [f.id]: v };
    set(f.id, v);
    // One-question steps advance by themselves after a pointer pick (never on keyboard arrows)
    const only = visibleFields(step, a);
    if (pointerPick.current && only.length === 1 && only[0].type === 'single') {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => next(a), 320);
    }
    pointerPick.current = false;
  };
  const toggleMulti = (f: Field, v: string) => {
    const cur = (answers[f.id] as string[]) || [];
    let out = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    if (f.exclusive) out = v === f.exclusive ? (cur.includes(v) ? [] : [v]) : out.filter((x) => x !== f.exclusive);
    set(f.id, out);
  };

  /* ------------------------------------------------------------ summary + submit */
  const sections = useMemo(() => {
    const order: Step['section'][] = ['about', 'project', 'details', 'content', 'timing', 'contact'];
    return order.map((sec) => {
      const secSteps = steps.filter((st) => st.section === sec);
      const rows = secSteps.flatMap((st) => visibleFields(st, answers)
        .filter((f) => f.type !== 'consent' && !isEmpty(answers[f.id]))
        .map((f) => ({ label: s.fields[f.id], value: display(f, answers[f.id]) })));
      return { sec, first: secSteps[0]?.id, rows };
    }).filter((x) => x.first);
  }, [steps, answers, s]);

  const summaryText = () => {
    const lines = [`${s.text.header}`, ''];
    sections.forEach(({ sec, rows }) => {
      if (!rows.length) return;
      lines.push(`— ${s.ui.sections[sec]} —`);
      rows.forEach((r) => lines.push(`${r.label}${colon}${r.value}`));
      lines.push('');
    });
    lines.push(s.text.footer);
    return lines.join('\n');
  };
  const waHref = () => `https://wa.me/${wa}?text=${encodeURIComponent(trimEncoded(summaryText(), 3500))}`;
  const mailHref = () => {
    const subject = `${s.text.header}: ${answers.name || answers.firstName || ''}`;
    return `mailto:${decode(eml)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(trimEncoded(summaryText(), 1700))}`;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Spam checks: honeypot filled or impossibly fast fill -> pretend success, send nothing
    if (honeypot || (startedAt && Date.now() - startedAt < MIN_FILL_MS)) { setPhase('thanks'); return; }
    if (!ENDPOINT) { store.clear(); setPhase('thanks'); return; }
    setPhase('sending');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const text = summaryText();
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          ...(ACCESS_KEY ? { access_key: ACCESS_KEY } : {}),
          subject: `${s.text.header}: ${answers.name || ''}`,
          _subject: `${s.text.header}: ${answers.name || ''}`,
          from_name: 'Sistim website',
          name: answers.name, phone: answers.phone, email: answers.email || undefined,
          message: text,
          payload: { locale, timestamp: new Date().toISOString(), answers: Object.fromEntries(steps.flatMap((st) => visibleFields(st, answers).map((f) => [f.id, answers[f.id]]))) },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      store.clear();
      setPhase('thanks');
    } catch {
      setPhase('error');
    } finally { clearTimeout(timer); }
  };

  /* ------------------------------------------------------------ render helpers */
  const total = steps.length;
  const progress = phase === 'summary' || phase === 'sending' || phase === 'thanks' || phase === 'error' ? 1 : phase === 'intro' ? 0 : (index + 1) / total;
  const errId = (id: string) => `err-${id}`;
  const Err = ({ id }: { id: string }) => errors[id] ? <p id={errId(id)} className="brief-error">{errors[id]}</p> : null;

  const onKey = (e: KeyboardEvent<HTMLFormElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (e.key === 'Enter' && tag === 'TEXTAREA' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); next(); return; }
    if (e.key === 'Enter' && tag === 'INPUT' && ['radio', 'checkbox'].includes((e.target as HTMLInputElement).type)) { e.preventDefault(); next(); }
  };

  const renderChoice = (f: Field, legend: React.ReactNode, isStepQuestion: boolean) => {
    const multi = f.type === 'multi';
    const value = answers[f.id];
    return (
      <fieldset key={f.id} aria-describedby={errors[f.id] ? errId(f.id) : undefined} className={isStepQuestion ? '' : 'mt-7'}>
        <legend className={isStepQuestion ? 'contents' : 'mb-3 text-sm font-medium text-white'}>{legend}</legend>
        <div className={`grid gap-2.5 ${(f.values?.length ?? 0) > 3 ? 'sm:grid-cols-2' : ''} ${isStepQuestion ? 'mt-7' : ''}`}>
          {f.values!.map((v) => {
            const checked = multi ? ((value as string[]) || []).includes(v) : value === v;
            return (
              <label key={v} className="brief-option" data-checked={checked || undefined} onPointerDown={() => (pointerPick.current = true)}>
                <input
                  type={multi ? 'checkbox' : 'radio'} name={f.id} value={v} checked={checked}
                  aria-invalid={errors[f.id] ? true : undefined}
                  onChange={() => (multi ? toggleMulti(f, v) : pickSingle(f, v))}
                  className="brief-option-input"
                />
                <span className="brief-option-mark" aria-hidden="true" data-multi={multi || undefined} />
                <span className="flex-1">{optionLabel(f, v)}</span>
              </label>
            );
          })}
        </div>
        <Err id={f.id} />
      </fieldset>
    );
  };

  const renderInput = (f: Field, label: React.ReactNode, asTitle: boolean) => {
    const common = {
      id: `f-${f.id}`, name: f.id, autoComplete: f.autoComplete,
      'aria-invalid': errors[f.id] ? true : undefined,
      'aria-describedby': errors[f.id] ? errId(f.id) : undefined,
      'aria-required': f.required || undefined,
      value: (answers[f.id] as string) ?? '',
      onChange: (e: { target: { value: string } }) => set(f.id, e.target.value),
    };
    const ltr = f.type === 'tel' || f.type === 'url' || f.type === 'email';
    return (
      <div key={f.id} className={asTitle ? '' : 'mt-5'}>
        <label htmlFor={common.id} className={asTitle ? 'block' : 'mb-2 flex items-baseline justify-between gap-3 text-sm font-medium text-white'}>
          {label}
          {!asTitle && !f.required && f.type !== 'email' && <span className="text-xs font-normal text-muted">{s.ui.optional}</span>}
        </label>
        {f.type === 'textarea'
          ? <textarea {...common} rows={5} className={`field resize-y ${asTitle ? 'mt-7' : ''}`} />
          : <input {...common}
              type={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}
              inputMode={f.type === 'tel' ? 'tel' : f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : undefined}
              placeholder={f.type === 'tel' ? s.placeholders.phone : f.type === 'url' ? s.placeholders.url : undefined}
              dir={ltr ? 'ltr' : undefined}
              className={`field ${ltr && rtl ? 'text-right' : ''} ${asTitle ? 'mt-7' : ''}`} />}
        <Err id={f.id} />
      </div>
    );
  };

  const renderStep = (st: Step) => {
    const fields = visibleFields(st, answers);
    const title = <h2 className="brief-q">{s.steps[st.id].title}</h2>;
    const hint = s.steps[st.id].hint ? <p className="mt-3 text-muted">{s.steps[st.id].hint}</p> : null;
    const single = fields.length === 1 || (st.id === 'today' && fields[0].type === 'single' && fields.length <= 2);
    return (
      <>
        {st.note && <p className="brief-note"><span aria-hidden="true">⚠</span> {s.notes[st.note]}</p>}
        {fields.map((f, i) => {
          const isFirstQuestion = i === 0 && single;
          if (f.type === 'single' || f.type === 'multi') {
            return renderChoice(f, isFirstQuestion ? <>{title}{hint}</> : s.fields[f.id], isFirstQuestion);
          }
          if (f.type === 'consent') {
            return (
              <div key={f.id} className="mt-7">
                <label className="brief-option items-start" data-checked={answers.consent || undefined}>
                  <input type="checkbox" className="brief-option-input" checked={!!answers.consent} onChange={(e) => set('consent', e.target.checked)}
                    aria-invalid={errors.consent ? true : undefined} aria-describedby={`${errors.consent ? errId('consent') + ' ' : ''}privacy-line`} />
                  <span className="brief-option-mark mt-0.5" data-multi aria-hidden="true" />
                  <span className="flex-1">{s.fields.consent}</span>
                </label>
                <p id="privacy-line" className="mt-2 text-sm text-muted">{s.privacy}</p>
                <Err id="consent" />
              </div>
            );
          }
          const asTitle = fields.length === 1;
          return renderInput(f, asTitle ? <>{title}{hint}</> : s.fields[f.id], asTitle);
        })}
      </>
    );
  };

  const stepHeading = (st: Step) => {
    const fields = visibleFields(st, answers);
    const titled = fields.length === 1 || (st.id === 'today');
    return titled ? null : (<><h2 className="brief-q">{s.steps[st.id].title}</h2>{s.steps[st.id].hint && <p className="mt-3 text-muted">{s.steps[st.id].hint}</p>}</>);
  };

  /* ------------------------------------------------------------ views */
  const Progress = () => (
    <div className="brief-progress" aria-hidden="true">
      <span className="brief-progress-node start" />
      <span className="brief-progress-rail">
        <span className="brief-progress-track"><span className="brief-progress-fill" style={{ transform: `scaleX(${progress})` }} /></span>
        <span className="brief-progress-head" style={{ insetInlineStart: `${progress * 100}%` }} />
      </span>
      <span className="brief-progress-node end" data-on={progress === 1 || undefined} />
    </div>
  );

  const ctaRow = (primary: React.ReactNode) => (
    <div className="brief-actions">
      <button type="button" onClick={back} className="btn btn-ghost min-h-12 px-5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="arrow arrow-back" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        <span>{s.ui.back}</span>
      </button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {primary}
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (phase === 'intro') {
    body = (
      <div ref={panel} className="brief-panel">
        <p className="mb-5 flex items-center gap-3"><span className="node" aria-hidden="true" /><span className="label">{intro.kicker}</span></p>
        <h1 className="text-[clamp(2rem,1.3rem+3vw,3.4rem)] font-semibold tracking-[-0.02em] text-white">{intro.title}</h1>
        <p className="mt-5 text-lead text-muted">{intro.lead}</p>
        <ul className="mt-7 flex flex-wrap gap-2">{intro.facts.map((f) => <li key={f} className="tag min-h-9 px-3.5 text-sm">{f}</li>)}</ul>
        {saved ? (
          <div className="mt-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-5">
            <p className="font-medium text-white">{s.intro.resumeTitle}</p>
            <p className="mt-1 text-muted">{s.intro.resumeLead}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary min-h-12 px-6" onClick={() => start(true)} data-focus>{s.intro.resume}</button>
              <button type="button" className="btn btn-ghost min-h-12 px-6" onClick={() => start(false)}>{s.intro.restart}</button>
            </div>
          </div>
        ) : (
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button type="button" className="btn btn-primary min-h-14 px-8 text-lg" onClick={() => start(false)} data-focus>
              <span>{s.intro.start}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="arrow" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
            <span className="text-sm text-muted">{s.intro.time}</span>
          </div>
        )}
      </div>
    );
  } else if (phase === 'step') {
    const optional = isOptionalStep(step);
    body = (
      <form ref={panel as any} className="brief-panel" data-step={step.id} onSubmit={(e) => { e.preventDefault(); next(); }} onKeyDown={onKey} noValidate>
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.14em] text-emerald-400 [:lang(ar)_&]:font-sans [:lang(ar)_&]:text-sm">
          {fill(s.ui.stepOf, { x: String(index + 1), n: String(total) })}
          {optional && <span className="ms-3 rounded-full border border-white/15 px-2 py-0.5 text-[0.7rem] normal-case tracking-normal text-muted">{s.ui.optional}</span>}
        </p>
        {stepHeading(step)}
        {renderStep(step)}
        {ctaRow(<>
          {optional && <button type="button" onClick={skip} className="btn min-h-12 px-5 text-muted hover:text-white">{s.ui.skip}</button>}
          <button type="submit" className="btn btn-primary min-h-12 px-6">
            <span>{editing ? s.ui.backToSummary : s.ui.next}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="arrow" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </>)}
        <p className="mt-4 hidden text-end text-xs text-muted md:block">{s.ui.enterHint}</p>
      </form>
    );
  } else if (phase === 'summary' || phase === 'sending') {
    body = (
      <form ref={panel as any} className="brief-panel" onSubmit={submit} noValidate>
        <h2 className="brief-q" tabIndex={-1} data-focus>{s.ui.summaryTitle}</h2>
        <p className="mt-3 text-muted">{s.ui.summaryLead}</p>
        <dl className="mt-8 space-y-4">
          {sections.map(({ sec, first, rows }) => (
            <div key={sec} className="rounded-2xl border border-white/10 bg-navy-950/40 p-5">
              <div className="flex items-center justify-between gap-3">
                <dt className="label">{s.ui.sections[sec]}</dt>
                <button type="button" className="min-h-11 rounded-full px-4 text-sm font-medium text-emerald-400 underline-offset-4 hover:underline" onClick={() => { setEditing(true); goTo(first!, -1); }}>
                  {s.ui.edit}<span className="sr-only">: {s.ui.sections[sec]}</span>
                </button>
              </div>
              <dd className="mt-2 space-y-1.5">
                {rows.length ? rows.map((r) => (
                  <p key={r.label} className="text-white/90"><span className="text-muted">{r.label}{colon}</span><bdi>{r.value}</bdi></p>
                )) : <p className="text-muted">—</p>}
              </dd>
            </div>
          ))}
        </dl>
        {/* Honeypot: invisible to people, tempting to bots */}
        <div className="absolute -start-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label>Website <input tabIndex={-1} autoComplete="off" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
        </div>
        <div className="brief-actions">
          <button type="button" onClick={() => goTo(steps[steps.length - 1].id, -1)} className="btn btn-ghost min-h-12 px-5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="arrow arrow-back" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <span>{s.ui.back}</span>
          </button>
          <button type="submit" className="btn btn-primary min-h-13 px-7 text-[1.05rem]" disabled={phase === 'sending'} aria-busy={phase === 'sending' || undefined}>
            {phase === 'sending' ? s.ui.sending : s.ui.submit}
          </button>
        </div>
      </form>
    );
  } else {
    const ok = phase === 'thanks';
    const channel = answers.channel ? channelNames[answers.channel as string] : '';
    const vars = { name: String(answers.name || answers.firstName || ''), hours: String(cfg.hours), duration: String(cfg.duration), channel };
    body = (
      <div ref={panel} className="brief-panel">
        <span className={`grid size-14 place-items-center rounded-full ${ok ? 'bg-emerald-500 text-navy-950' : 'bg-[#f7b4a7]/15 text-[#f7b4a7]'}`} aria-hidden="true">
          {ok
            ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 6.5v7.5M12 18v.01" /></svg>}
        </span>
        <h2 className="brief-q mt-6" tabIndex={-1} data-focus>{ok ? fill(s.thanks.title, vars) : s.error.title}</h2>
        {ok ? (
          <>
            <p className="mt-3 text-muted">{s.thanks.lead}</p>
            <ol className="mt-8 space-y-3">
              {[s.thanks.step1, fill(s.thanks.step2, vars), ...(cfg.includesRecommendation ? [s.thanks.step3] : [])].map((txt: string, i: number) => (
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
  }

  const announce = phase === 'step' ? `${fill(s.ui.stepOf, { x: String(index + 1), n: String(total) })}: ${s.steps[step.id].title}`
    : phase === 'summary' ? s.ui.summaryTitle : phase === 'thanks' ? s.thanks.lead : phase === 'error' ? s.error.title : '';

  return (
    <div className="brief">
      <Progress />
      <p className="sr-only" aria-live="polite">{announce}</p>
      {body}
    </div>
  );
}
