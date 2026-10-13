/**
 * Free consultation facts. The site copy interpolates these values and only states
 * what is set here. Change a value, rebuild, and every page follows.
 */

/** Length of the free consultation call or chat, in minutes. */
export const DURATION_MINUTES = 20;

/** We contact the visitor on WhatsApp within this many hours after they send the form. */
export const REPLY_TIME_HOURS = 24;

/**
 * What the consultation includes. Allowed ids:
 * 'call_or_chat' (the conversation itself),
 * 'written_recommendation' (the right offer, the steps and a timeline, in writing).
 */
export const INCLUDES = ['call_or_chat', 'written_recommendation'] as const;

/** true = the site may promise a price estimate. false = it never mentions one. */
export const INCLUDES_ESTIMATE = false;

/**
 * true = show ./brand/thankyou.jpg in the visual panel of the thank-you screen, labelled
 * "Illustrative image". Needs the file to exist; otherwise no photo is used anywhere.
 */
export const SHOW_THANKYOU_PHOTO = false;

export const includesCall = (INCLUDES as readonly string[]).includes('call_or_chat');
export const includesRecommendation = (INCLUDES as readonly string[]).includes('written_recommendation');
