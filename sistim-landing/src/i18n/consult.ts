// Consultation copy filled in from src/config/consultation.ts, so the site never states
// more than the config allows.
import { CHANNELS, DURATION_MINUTES, REPLY_TIME_HOURS, includesRecommendation } from '../config/consultation';
import { fill, LOCALE_META, t, type Locale } from './index';

export function consultCopy(locale: Locale) {
  const d = t(locale);
  // In-sentence channel names (lower case where the language needs it)
  const channelNames = CHANNELS.map((c) => d.consult.channelNames[c]);
  const list = new Intl.ListFormat(LOCALE_META[locale].lang, { type: 'disjunction' }).format(channelNames);
  const vars = { duration: String(DURATION_MINUTES), hours: String(REPLY_TIME_HOURS), channels: list };
  return {
    cta: d.consult.cta,
    title: d.consult.title,
    lead: includesRecommendation ? d.consult.lead : d.consult.leadNoRec,
    band: d.consult.band,
    facts: [fill(d.consult.facts.duration, vars), fill(d.consult.facts.channels, vars), fill(d.consult.facts.reply, vars)],
    vars,
  };
}
