/**
 * Tuning for the 3D logo in the consultation page's visual panel.
 * Rebuild after changing a value. Set ENABLE_3D_LOGO to false to ship the poster image only.
 */

/** false = never load Three.js; the poster image (with a CSS turn on each step) is shown instead. */
export const ENABLE_3D_LOGO = true;

/** Turns of the letter on each step change (forward on Next, reverse on Back). */
export const STEP_SPIN_TURNS = 1;
/** Duration of a step spin. Never shorter than MIN_SPIN_MS, and never faster than MAX_TURNS_PER_SECOND. */
export const STEP_SPIN_MS = 1400;
/** GSAP ease for step spins. Gentle eases keep the peak speed near one turn per second. */
export const STEP_SPIN_EASE = 'sine.inOut';

/** Automatic full spin when nothing else happens. Paused while a form field has focus. */
export const IDLE_SPIN_EVERY_MS = 9000;
/** Slow sway either side of front-facing while idle, so the letter always stays readable. */
export const IDLE_SWAY_DEG = 20;
/** Vertical float, in scene units (the letter is 3 units wide). */
export const IDLE_FLOAT = 0.06;

/** Damped pointer tilt, desktop with a fine pointer only. 0 disables it. */
export const POINTER_TILT_DEG = 12;

/** Celebration spin when the form is sent: turns and duration, decelerating onto the front pose. */
export const SUBMIT_SPIN_TURNS = 2;
export const SUBMIT_SPIN_MS = 2800;
export const SUBMIT_SPIN_EASE = 'sine.out';

/** Safety rules for every spin: nothing flashes, nothing turns faster than this. */
export const MIN_SPIN_MS = 1000;
export const MAX_TURNS_PER_SECOND = 1.15;

/** Pixel ratio caps. */
export const MAX_PIXEL_RATIO = 2;
export const MAX_PIXEL_RATIO_MOBILE = 1.5;

/** Peak angular speed of a GSAP ease relative to its average speed (used to enforce MAX_TURNS_PER_SECOND). */
export const EASE_PEAK_FACTOR: Record<string, number> = {
  none: 1, linear: 1, 'sine.inOut': 1.58, 'sine.out': 1.58, 'sine.in': 1.58,
  'power1.inOut': 2, 'power1.out': 2, 'power2.inOut': 2.7, 'power2.out': 3, 'power3.inOut': 3, 'power3.out': 4,
};
