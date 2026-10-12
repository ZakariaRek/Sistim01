import { useEffect, useId, useState, type FormEvent } from 'react';

type Strings = {
  name: string; need: string; needPlaceholder: string; needs: string[]; message: string; messagePlaceholder: string;
  submit: string; email: string; required: string; privacy: string; template: string; subject: string;
};
type Props = { s: Strings; wa: string; eml: string; newTab: string; waIcon: string };

const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const decode = (e: string) => { try { return [...atob(e)].reverse().join(''); } catch { return ''; } };

/** Backend-free contact form: composes a WhatsApp message (or a mailto fallback) in the page language. */
export default function ContactForm({ s, wa, eml, newTab, waIcon }: Props) {
  const id = useId();
  const [name, setName] = useState('');
  const [need, setNeed] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ name?: boolean; need?: boolean }>({});

  // Offer cards preselect the need
  useEffect(() => {
    const onNeed = (e: Event) => {
      const i = (e as CustomEvent<number>).detail;
      if (s.needs[i]) { setNeed(s.needs[i]); setErrors((x) => ({ ...x, need: false })); }
    };
    window.addEventListener('sistim:need', onNeed);
    return () => window.removeEventListener('sistim:need', onNeed);
  }, [s.needs]);

  const validate = () => {
    const next = { name: !name.trim(), need: !need };
    setErrors(next);
    if (next.name) document.getElementById(`${id}-name`)?.focus();
    else if (next.need) document.getElementById(`${id}-need`)?.focus();
    return !next.name && !next.need;
  };
  const text = () => fill(s.template, { name: name.trim(), need, message: message.trim() }).trim();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const url = `https://wa.me/${wa}?text=${encodeURIComponent(text())}`;
    // window.open(..., 'noopener') always returns null, so detach the opener by hand instead
    const win = window.open(url, '_blank');
    if (win) win.opener = null;
    else window.location.href = url; // popup blocked: open in this tab
  };
  const onEmail = () => {
    if (!validate()) return;
    const subject = fill(s.subject, { name: name.trim() });
    window.location.href = `mailto:${decode(eml)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text())}`;
  };

  const err = (field: 'name' | 'need') =>
    errors[field] ? <p id={`${id}-${field}-err`} className="mt-2 text-sm text-[#f7b4a7]">{s.required}</p> : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="mb-2 block text-sm font-medium text-white">{s.name}</label>
          <input
            id={`${id}-name`} name="name" autoComplete="name" required className="field"
            value={name}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: false })); }}
            aria-invalid={errors.name || undefined}
            aria-describedby={errors.name ? `${id}-name-err` : undefined}
          />
          {err('name')}
        </div>
        <div>
          <label htmlFor={`${id}-need`} className="mb-2 block text-sm font-medium text-white">{s.need}</label>
          <div className="relative">
            <select
              id={`${id}-need`} name="need" required className="field pe-10"
              value={need}
              onChange={(e) => { setNeed(e.target.value); if (errors.need) setErrors((x) => ({ ...x, need: false })); }}
              aria-invalid={errors.need || undefined}
              aria-describedby={errors.need ? `${id}-need-err` : undefined}
            >
              <option value="" disabled>{s.needPlaceholder}</option>
              {s.needs.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <svg className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </div>
          {err('need')}
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-msg`} className="mb-2 block text-sm font-medium text-white">{s.message}</label>
        <textarea
          id={`${id}-msg`} name="message" rows={5} className="field resize-y"
          placeholder={s.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="btn btn-primary min-h-13 px-6" data-magnetic>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={waIcon} /></svg>
          <span>{s.submit}</span>
          <span className="sr-only">{newTab}</span>
        </button>
        <button type="button" onClick={onEmail} className="btn btn-ghost min-h-13 px-6">{s.email}</button>
      </div>
      <p className="text-sm text-muted">{s.privacy}</p>
    </form>
  );
}
