// Consultation copy filled in from src/config/consultation.ts, so the site never states
// more than the config allows.
import { DURATION_MINUTES, REPLY_TIME_HOURS, includesCall, includesRecommendation } from '../config/consultation';
import { fill, t, type Locale } from './index';

export function consultCopy(locale: Locale) {
  const d = t(locale);
  const vars = { duration: String(DURATION_MINUTES), hours: String(REPLY_TIME_HOURS) };
  const facts = [
    includesCall ? fill(d.brief.panel.duration, vars) : '',
    fill(d.brief.panel.reply, vars),
    d.brief.panel.free,
  ].filter(Boolean);
  return {
    cta: d.consult.cta,
    title: d.consult.title,
    lead: includesRecommendation ? d.consult.lead : d.consult.leadNoRec,
    band: d.consult.band,
    facts,
    vars,
  };
}
