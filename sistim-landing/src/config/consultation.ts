/**
 * Free consultation facts. The site copy interpolates these values and only states
 * what is set here. Change a value, rebuild, and every page follows.
 */

/** Length of the free consultation call/chat, in minutes. */
export const DURATION_MINUTES = 20;

/** How the consultation can happen. Allowed ids: 'whatsapp_call' | 'whatsapp_chat' | 'phone'. */
export const CHANNELS = ['whatsapp_call', 'whatsapp_chat', 'phone'] as const;

/** We contact the visitor within this many hours after they send the brief. */
export const REPLY_TIME_HOURS = 24;

/**
 * What the consultation includes. Allowed ids:
 * 'call_or_chat' (the conversation itself),
 * 'written_recommendation' (the right offer, the steps and a timeline, in writing).
 */
export const INCLUDES = ['call_or_chat', 'written_recommendation'] as const;

/** true = the site may promise a price estimate. false = it never mentions one. */
export const INCLUDES_ESTIMATE = false;

export type Channel = (typeof CHANNELS)[number];
export const includesRecommendation = (INCLUDES as readonly string[]).includes('written_recommendation');
