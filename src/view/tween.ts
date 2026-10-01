// Interpolation (Mario: "interpolations are easy and powerful" — the thing every major
// game engine formalises). A **tween** is a value moving from one number, or one point, to another
// over a window of presentation time, along an easing curve.
//
// Like every effect (see `docs/system-design/effects.md`), a tween is a **pure function of absolute time**: it is a
// record of where it started, where it is going, when and for how long, and `tweenAt(tween, now)`
// answers where it is without remembering anything about the frame before. Retargeting mid-flight
// (`retarget`) starts a new tween from wherever the old one is drawn at that instant, so a second
// scroll in the middle of the first continues smoothly rather than snapping.
//
// Presentation only: nothing in `src/build` or the kernel may import this. The state always holds
// the destination; a tween is how the screen gets there.

/** An easing curve maps progress through the window, `[0,1]`, onto progress along the path. */
export type Easing = (progress: number) => number

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export const EASINGS = {
  /** Constant speed — a projectile, a sweep. */
  linear: (progress: number): number => clamp01(progress),
  /** Fast at first and settling at the end: a slide that starts where the player's eye already is.
   *  The camera's curve. */
  easeOut: (progress: number): number => 1 - (1 - clamp01(progress)) ** 3,
  /** A gentler deceleration — the effects library's expansions (blast rings, debris). */
  easeOutQuad: (progress: number): number => 1 - (1 - clamp01(progress)) ** 2,
  /** Slow, fast, slow: something that starts from rest and comes to rest. */
  easeInOut: (progress: number): number => {
    const t = clamp01(progress)
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
  },
} as const satisfies Record<string, Easing>

export type EasingName = keyof typeof EASINGS

/** A number or a point on its way somewhere. `durationMs <= 0` is already there. */
export type Tween<T> = Readonly<{ from: T; to: T; startMs: number; durationMs: number; easing: EasingName }>

/** How far through its window a tween is at `now`, eased, in `[0,1]`. */
export function tweenProgress(tween: Tween<unknown>, now: number): number {
  if (tween.durationMs <= 0) return 1
  const raw = (now - tween.startMs) / tween.durationMs
  if (raw >= 1) return 1
  return EASINGS[tween.easing](raw)
}

/** Whether the tween is still moving at `now`. */
export function tweenActive(tween: Tween<unknown>, now: number): boolean {
  return tween.durationMs > 0 && now < tween.startMs + tween.durationMs
}

/** When the tween arrives. */
export function tweenEnd(tween: Tween<unknown>): number {
  return tween.startMs + Math.max(0, tween.durationMs)
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/** A number's value at `now`. */
export function numberAt(tween: Tween<number>, now: number): number {
  const progress = tweenProgress(tween, now)
  return progress >= 1 ? tween.to : lerp(tween.from, tween.to, progress)
}

export type Point = Readonly<{ x: number; y: number }>

/** A point's value at `now`, in **whole tiles** — the Grid has no half tiles to draw. */
export function tileAt<P extends Point>(tween: Tween<P>, now: number): Point {
  const progress = tweenProgress(tween, now)
  if (progress >= 1) return { x: tween.to.x, y: tween.to.y }
  return {
    x: Math.round(lerp(tween.from.x, tween.to.x, progress)),
    y: Math.round(lerp(tween.from.y, tween.to.y, progress)),
  }
}

/** A tween standing still at `at`. */
export function still<T>(at: T, now: number, easing: EasingName = "easeOut"): Tween<T> {
  return { from: at, to: at, startMs: now, durationMs: 0, easing }
}

/**
 * Point `tween` somewhere new at `now`: unchanged if it is already going there; otherwise a fresh
 * tween from wherever it is drawn at this instant (`current`), taking `durationMs` — or none, when it
 * is already drawn at the new target.
 */
export function retarget<T>(
  tween: Tween<T>,
  to: T,
  now: number,
  durationMs: number,
  current: (tween: Tween<T>, now: number) => T,
  same: (a: T, b: T) => boolean,
): Tween<T> {
  if (same(tween.to, to)) return tween
  const from = current(tween, now)
  return { from, to, startMs: now, durationMs: same(from, to) ? 0 : durationMs, easing: tween.easing }
}

export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y
