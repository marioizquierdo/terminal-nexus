// Animations — frame sequences drawn on an entity's own cells, and the track that decides which
// frame a building or a unit shows at any instant.
//
// One of the four families of the presentation toolkit (Mario: "particles, shaders and
// animations ... please pick the right name for them"):
//
//   - **Animations** (this file): an entity's own glyphs replaced, for a while, by a short run of
//     authored frames — a building rising through its footings, later a unit's attack pose. The only
//     family that may change the glyph an entity stands on, because it *is* that entity's drawing.
//   - **Particles** (`effects/particles.ts` and most of `effects/recipes.ts`): short-lived glyphs
//     thrown around something. Never onto an occupied cell — the compositor drops them.
//   - **Shading** (`effects/shading.ts`, and `fx.damage.flash`): glyphless changes of colour or
//     attribute over characters already drawn — a light, a tint, a rainbow sweep. The only kind of
//     effect cell allowed onto an occupied cell.
//   - **Tweens** (`tween.ts`): a number or a point moving between two values over time — the camera
//     slide, a spark's flight curve.
//
// Every one of them is a **pure function of absolute presentation time**: `f(t)` never depends on
// `f(t-1)`, and nothing here holds a clock or a counter.
//
// ## An animation is an asset: frames and a little metadata
//
// `Animation` is a list of footprint-sized frames (the same rows-of-characters shape as every other
// piece of art, a space meaning "nothing drawn here, the ground shows"), how long one pass takes,
// each frame's share of that time, and what happens after the last frame: `clear` (the entity's own
// art shows again), `hold` (the last frame stays — rubble, a pose), or `loop`.
//
// ## A track is a list of requests, not a mutable player
//
// Each target — a planned building's ordinal today, a unit's id later — has a **track**: the
// timestamped requests made of it. What the track draws at time `t` is a pure function of that list
// (`scheduleTrack`, then `trackFrameAt`), so any instant can be drawn by naming it, in any order, and a
// request made at `a` never changes a frame before `a`. The requests:
//
//   - `play` — start an animation, with a **stacking policy** for when one is already playing:
//     `replace` (cancel it and start this one — the default), `queue` (start this one when it ends),
//     or `ignore` (drop this request). A held or finished animation is not "playing".
//   - `cancel` — stop drawing at once; the entity's own art shows. Queued plays are dropped.
//   - `speed` — play the current animation faster or slower from this moment (2 is double speed,
//     0 is paused), without a jump: the frame at the moment of the change is the same either way.
//   - `finish` — jump to the end now, as if it had played out.
//
// ## Completion is data, not a callback
//
// A play request may carry **follow-ups**: effect instances (a light, a burst of sparks) and further
// plays, scheduled at the moment the animation *completes* — plays out, or is finished. A play that is
// cancelled or replaced never completes, so its follow-ups never happen. Nothing fires from the
// renderer: `scheduleTrack` works out every completion time in advance, and the effects come back as
// ordinary effect instances with absolute start times, drawn by the same effects library as anything
// else. A projectile's impact, a unit that crumbles after its death pose — all of it is one more
// follow-up, never a function called when a frame happens to be drawn.
//
// Only `play` is used live today (a building going up). The other three exist so that the
// next use — a unit's attack interrupting its walk, a fast-forwarded Pulse — is a request, not a new
// system.
//
// Presentation only: nothing in `src/build`, `src/pulse` or the kernel may import this.

import type { EffectInstance } from "./effects/types.ts"

/** What an animation does after its last frame. */
export type AnimationEnd = "clear" | "hold" | "loop"

export type AnimationFrame = Readonly<{
  /** Rows north to south, the size of the target's footprint. A space is transparent: the ground,
   *  or whatever is beneath, shows. */
  rows: readonly string[]
  /** This frame's share of one pass, relative to the others. Default 1: every frame equally long. */
  weight?: number
  /** Drawn bold. Default plain — lighter than the finished entity, which is always drawn bold. */
  bold?: boolean
}>

export type Animation = Readonly<{
  /** What it is, for tests and debugging — `place:structure.citizen.barracks`. */
  id: string
  frames: readonly AnimationFrame[]
  /** How long one pass takes at speed 1. `0` passes at once. */
  durationMs: number
  end: AnimationEnd
}>

/** An animation from frames as plain rows — the shape `src/content/art.ts` authors them in. */
export function animationOf(
  id: string,
  frames: readonly (readonly string[])[],
  durationMs: number,
  end: AnimationEnd = "clear",
): Animation {
  return { id, frames: frames.map((rows) => ({ rows })), durationMs: Math.max(0, durationMs), end }
}

/**
 * Which frame an animation shows `localMs` into its own time (its time, not the screen's: a track
 * maps one to the other). `null` when a `clear` animation has run out, or there are no frames.
 */
export function frameIndexAt(animation: Animation, localMs: number): number | null {
  const count = animation.frames.length
  if (count === 0) return null
  const { durationMs } = animation
  let local = Math.max(0, localMs)
  if (durationMs <= 0 || local >= durationMs) {
    if (animation.end === "clear") return null
    if (animation.end === "hold" || durationMs <= 0) return count - 1
    local %= durationMs
  }
  const weights = animation.frames.map((frame) => Math.max(0, frame.weight ?? 1))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 0
  const position = (local / durationMs) * total
  let reached = 0
  for (let index = 0; index < count; index += 1) {
    reached += weights[index] ?? 0
    if (position < reached) return index
  }
  return count - 1
}

/** The glyph a frame draws at a footprint offset, or `null` where it is transparent. */
export function frameGlyph(frame: AnimationFrame, offset: Readonly<{ x: number; y: number }>): string | null {
  const glyph = frame.rows[offset.y]?.[offset.x] ?? " "
  return glyph === " " ? null : glyph
}

// ---------------------------------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------------------------------

export type StackPolicy = "replace" | "queue" | "ignore"

/** An effect scheduled when an animation completes: `startMs` is replaced by the completion time
 *  plus `delayMs`. Its origin is absolute, as the caller placed it. */
export type EffectFollowUp = Readonly<{ kind: "effect"; delayMs?: number; effect: Omit<EffectInstance, "startMs"> }>

/** A further play on the same track when an animation completes, `delayMs` after it. */
export type PlayFollowUp = Readonly<{ kind: "play"; delayMs?: number; play: PlayOptions & Readonly<{ animation: Animation }> }>

export type FollowUp = EffectFollowUp | PlayFollowUp

export type PlayOptions = Readonly<{
  policy?: StackPolicy
  /** How fast it plays from the start; default 1. */
  speed?: number
  /** Scheduled when it completes; never when it is cancelled or replaced. */
  then?: readonly FollowUp[]
}>

export type PlayRequest = Readonly<{ kind: "play"; atMs: number; animation: Animation }> & PlayOptions
export type CancelRequest = Readonly<{ kind: "cancel"; atMs: number }>
export type SpeedRequest = Readonly<{ kind: "speed"; atMs: number; speed: number }>
export type FinishRequest = Readonly<{ kind: "finish"; atMs: number }>
export type TrackRequest = PlayRequest | CancelRequest | SpeedRequest | FinishRequest

export function play(animation: Animation, atMs: number, options: PlayOptions = {}): PlayRequest {
  return { kind: "play", atMs, animation, ...options }
}

export function cancel(atMs: number): CancelRequest {
  return { kind: "cancel", atMs }
}

/** Play the current animation at `speed` from `atMs` — 2 is twice as fast, 0 pauses it. */
export function accelerate(atMs: number, speed: number): SpeedRequest {
  return { kind: "speed", atMs, speed }
}

export function finish(atMs: number): FinishRequest {
  return { kind: "finish", atMs }
}

// ---------------------------------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------------------------------

/** From `atMs` on, the animation's own time advances `speed` ms per ms, from `localMs`. */
export type PaceKnot = Readonly<{ atMs: number; localMs: number; speed: number }>

/** One animation as the track actually played it. */
export type AnimationRun = Readonly<{
  request: PlayRequest
  animation: Animation
  /** When it began drawing — later than the request's time when it was queued. */
  startMs: number
  /** When it stopped drawing: its end (`clear`), a cancel or a replacement. `Infinity`: still drawn
   *  (a held last frame, or a loop nothing stopped). */
  stopMs: number
  /** When it completed — played out, or finished early — or `null` if it never did. */
  completedMs: number | null
  pace: readonly PaceKnot[]
}>

export type TrackSchedule = Readonly<{
  runs: readonly AnimationRun[]
  /** Every follow-up effect, at its absolute start time, in start order. */
  effects: readonly EffectInstance[]
  /** After this nothing the track draws changes: every run stopped or held, every follow-up effect
   *  over. `Infinity` while a loop runs; the earliest request's time when nothing ever plays. */
  settlesAtMs: number
}>

type MutableRun = {
  request: PlayRequest
  readonly animation: Animation
  startMs: number
  stopMs: number
  completedMs: number | null
  pace: PaceKnot[]
}

/** Enough to stop a follow-up that plays itself from ever ending, without limiting any real track. */
const MAX_STEPS = 10_000

function localAt(run: MutableRun | AnimationRun, timeMs: number): number {
  let knot = run.pace[0]
  for (const candidate of run.pace) if (candidate.atMs <= timeMs) knot = candidate
  if (knot === undefined) return 0
  return knot.localMs + (timeMs - knot.atMs) * knot.speed
}

/** When a playing run would reach its end, at its current pace. */
function naturalEnd(run: MutableRun): number {
  if (run.animation.end === "loop") return Number.POSITIVE_INFINITY
  const knot = run.pace[run.pace.length - 1]
  if (knot === undefined) return run.startMs
  const left = run.animation.durationMs - knot.localMs
  if (left <= 0) return knot.atMs
  if (knot.speed <= 0) return Number.POSITIVE_INFINITY
  return knot.atMs + left / knot.speed
}

/**
 * Plays a track's requests out, in time order (ties in the order given), and returns every run, every
 * follow-up effect, and when it all settles. A pure function of the list: the same requests always
 * schedule the same way, and a request at `a` changes nothing before `a`.
 */
export function scheduleTrack(requests: readonly TrackRequest[]): TrackSchedule {
  const pending = requests.map((request, index) => ({ request, order: index }))
  pending.sort((a, b) => a.request.atMs - b.request.atMs || a.order - b.order)
  let nextOrder = pending.length
  const runs: MutableRun[] = []
  const effects: EffectInstance[] = []
  let current = null as MutableRun | null
  let held = false
  let waiting: PlayRequest[] = []

  const start = (request: PlayRequest, atMs: number): void => {
    current = {
      request,
      animation: request.animation,
      startMs: atMs,
      stopMs: Number.POSITIVE_INFINITY,
      completedMs: null,
      pace: [{ atMs, localMs: 0, speed: Math.max(0, request.speed ?? 1) }],
    }
    held = false
    runs.push(current)
  }
  const stop = (atMs: number): void => {
    if (current !== null) current.stopMs = Math.min(current.stopMs, atMs)
    current = null
    held = false
  }
  const insert = (request: TrackRequest): void => {
    const entry = { request, order: nextOrder }
    nextOrder += 1
    let index = pending.length
    while (index > 0 && (pending[index - 1]?.request.atMs ?? 0) > request.atMs) index -= 1
    pending.splice(index, 0, entry)
  }
  const complete = (run: MutableRun, atMs: number): void => {
    run.completedMs = atMs
    for (const followUp of run.request.then ?? []) {
      const at = atMs + Math.max(0, followUp.delayMs ?? 0)
      if (followUp.kind === "effect") effects.push({ ...followUp.effect, startMs: at })
      else insert({ kind: "play", atMs: at, ...followUp.play })
    }
    if (run.animation.end === "hold") {
      held = true
    } else {
      stop(atMs)
    }
    const next = waiting.shift()
    if (next !== undefined) {
      if (current !== null) stop(atMs)
      start(next, atMs)
    }
  }

  let steps = 0
  for (; steps < MAX_STEPS; steps += 1) {
    const playing: MutableRun | null = held ? null : current
    const endAt = playing === null ? Number.POSITIVE_INFINITY : naturalEnd(playing)
    const next = pending[0]
    if (next === undefined && endAt === Number.POSITIVE_INFINITY) break
    // A run that ends exactly when a request arrives has ended first: it did play out.
    if (playing !== null && endAt <= (next?.request.atMs ?? Number.POSITIVE_INFINITY)) {
      complete(playing, endAt)
      continue
    }
    if (next === undefined) break
    pending.shift()
    const request = next.request
    const at = request.atMs
    switch (request.kind) {
      case "play": {
        const policy = request.policy ?? "replace"
        if (playing !== null && policy === "ignore") break
        if (playing !== null && policy === "queue") {
          waiting.push(request)
          break
        }
        waiting = []
        stop(at)
        start(request, at)
        break
      }
      case "cancel":
        waiting = []
        stop(at)
        break
      case "speed":
        if (playing !== null) playing.pace.push({ atMs: at, localMs: localAt(playing, at), speed: Math.max(0, request.speed) })
        break
      case "finish":
        // A loop finished early ends there, as if it were `clear`: only `hold` keeps its last frame.
        if (playing !== null) complete(playing, at)
        break
    }
  }

  effects.sort((a, b) => a.startMs - b.startMs)
  // Nothing on the track changes before its first request.
  let settlesAtMs = steps >= MAX_STEPS ? Number.POSITIVE_INFINITY : requests.length === 0 ? 0 : Math.min(...requests.map((r) => r.atMs))
  for (const run of runs) {
    const still = run.stopMs === Number.POSITIVE_INFINITY ? run.completedMs ?? Number.POSITIVE_INFINITY : run.stopMs
    settlesAtMs = Math.max(settlesAtMs, still)
  }
  for (const effect of effects) settlesAtMs = Math.max(settlesAtMs, effect.startMs + effect.durationMs)
  return { runs, effects, settlesAtMs }
}

/** The run drawing at `timeMs`, if any. */
export function runAt(schedule: TrackSchedule, timeMs: number): AnimationRun | null {
  for (let index = schedule.runs.length - 1; index >= 0; index -= 1) {
    const run = schedule.runs[index]
    if (run !== undefined && run.startMs <= timeMs && timeMs < run.stopMs) return run
  }
  return null
}

/** How far into its own time a run is at `timeMs`: its end once it has completed. */
export function runLocalMs(run: AnimationRun, timeMs: number): number {
  if (run.completedMs !== null && timeMs >= run.completedMs) return run.animation.durationMs
  return Math.max(0, localAt(run, timeMs))
}

export type DrawnFrame = Readonly<{ run: AnimationRun; index: number; frame: AnimationFrame }>

/** The frame a track draws at `timeMs`, or `null` — nothing playing or held, the entity's own art. */
export function trackFrameAt(schedule: TrackSchedule, timeMs: number): DrawnFrame | null {
  const run = runAt(schedule, timeMs)
  if (run === null) return null
  const index = frameIndexAt(run.animation, runLocalMs(run, timeMs))
  if (index === null) return null
  const frame = run.animation.frames[index]
  return frame === undefined ? null : { run, index, frame }
}

/** The follow-up effects painting at `timeMs`. */
export function trackEffectsAt(schedule: TrackSchedule, timeMs: number): EffectInstance[] {
  return schedule.effects.filter((effect) => timeMs >= effect.startMs && timeMs < effect.startMs + effect.durationMs)
}

/** Whether anything on the track still changes after `timeMs`. */
export function trackBusyAt(schedule: TrackSchedule, timeMs: number): boolean {
  return timeMs < schedule.settlesAtMs
}
