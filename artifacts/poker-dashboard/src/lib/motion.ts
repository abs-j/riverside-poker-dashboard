// Small, pure helpers for animation so they can be unit tested without a browser.

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Value between `from` and `to` after `elapsed` of `duration` milliseconds, eased out. */
export function tween(from: number, to: number, elapsed: number, duration: number) {
  if (duration <= 0) return to;
  return from + (to - from) * easeOutCubic(elapsed / duration);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}
