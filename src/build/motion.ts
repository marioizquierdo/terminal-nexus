// The held-key speed ramp (gate 5H, Q54): how far one arrow key moves the cursor, decided from when
// the key events arrive — so the only thing driving a long move is no longer the terminal's own
// key-repeat rate. The owner's own description (2026-09-26): "different speed modes: slow (1 tile per
// pulse), normal (2), fast (4) and faster (8). It starts at normal speed, and quickly changes to fast;
// faster is activated anytime with shift; if the user changes direction... then the speed changes to
// slow".
//
// **Terminals send no key-up.** A held key is a stream of auto-repeated presses: the first one, a
// pause (the terminal's repeat delay, a few hundred milliseconds), then presses a few tens of
// milliseconds apart. So "held" is read from the gaps, and every threshold is a Debug Mode flag:
//
//   - a press is a **tap**, and moves the slow step (one tile) — a single press stays precise;
//   - presses of the same arrow at most `repeatGapMs` apart are a **hold**: the normal step at first,
//     the fast step once held for `rampMs`;
//   - a fast move (Shift, Option, PageUp/Home) is the faster step, always;
//   - a press of a **different** arrow within `repeatDelayMs` of the last one is a **change of
//     direction**: with `slowAfterTurn` on, that hold stays at the slow step, for pointing precisely
//     after an overshoot, until the arrow is let go (a pause longer than the repeat delay) or anything
//     else is pressed (`reset`);
//   - a second press of the same arrow within the repeat delay may be the terminal's first repeat, so
//     it moves the slow step and keeps a slow-after-a-turn hold going.
//
// Pure: time comes in as a number, and nothing here names a clock (the architecture test holds
// `src/build` to that). The session keeps one of these beside the reducer, never inside it — the
// reducer only ever sees an ordinary `move-cursor` of the size chosen here.

import type { DebugFlags } from "./debug.ts"
import type { CursorKey } from "./keyboard.ts"

export type SpeedTier = "slow" | "normal" | "fast" | "faster"

export type RampFlags = Pick<
  DebugFlags,
  "slowStep" | "normalStep" | "fastStep" | "fasterStep" | "rampMs" | "repeatGapMs" | "repeatDelayMs" | "slowAfterTurn"
>

/** What the ramp remembers about the last cursor key: its direction and when it came, whether it was
 *  part of a hold and since when, and whether that hold is a slow one after a turn. */
export type RampMemory = Readonly<{
  dx: number
  dy: number
  at: number
  holding: boolean
  holdStart: number
  slow: boolean
}>

export type RampStep = Readonly<{ tier: SpeedTier; tiles: number; memory: RampMemory }>

export function tilesFor(tier: SpeedTier, flags: RampFlags): number {
  switch (tier) {
    case "slow":
      return flags.slowStep
    case "normal":
      return flags.normalStep
    case "fast":
      return flags.fastStep
    default:
      return flags.fasterStep
  }
}

/** One cursor key through the ramp: its tier, how many tiles that is, and what to remember. */
export function rampStep(previous: RampMemory | null, key: CursorKey, now: number, flags: RampFlags): RampStep {
  const same = previous !== null && previous.dx === key.dx && previous.dy === key.dy
  const gap = previous === null ? Number.POSITIVE_INFINITY : now - previous.at
  const repeating = same && gap <= flags.repeatGapMs
  const remember = (tier: SpeedTier, holding: boolean, holdStart: number, slow: boolean): RampStep => ({
    tier,
    tiles: tilesFor(tier, flags),
    memory: { dx: key.dx, dy: key.dy, at: now, holding, holdStart, slow },
  })

  if (key.fast) {
    // Top gear, whatever else is going on. Remembered as part of a hold, so letting go of Shift while
    // the arrow is still held carries on at the pace the hold has reached, and an arrow the other way
    // straight after it is a change of direction.
    const holdStart = repeating && previous.holding ? previous.holdStart : now
    return remember("faster", repeating, holdStart, false)
  }
  if (repeating) {
    const holdStart = previous.holding ? previous.holdStart : now
    const tier: SpeedTier = previous.slow ? "slow" : now - holdStart >= flags.rampMs ? "fast" : "normal"
    return remember(tier, true, holdStart, previous.slow)
  }
  if (same && gap <= flags.repeatDelayMs) {
    // A second press, or the terminal's first repeat after its delay: one slow step either way, and a
    // slow hold after a turn carries on through it.
    return remember("slow", false, now, previous.slow)
  }
  const turned = flags.slowAfterTurn && previous !== null && !same && gap <= flags.repeatDelayMs
  return remember("slow", false, now, turned)
}

/** The ramp as the session holds it: its memory, and the tier the last cursor key went at. */
export class SpeedRamp {
  private memory: RampMemory | null = null
  private lastTier: SpeedTier | null = null

  /** How many tiles this cursor key moves, arriving at `now` milliseconds. */
  step(key: CursorKey, now: number, flags: RampFlags): number {
    const next = rampStep(this.memory, key, now, flags)
    this.memory = next.memory
    this.lastTier = next.tier
    return next.tiles
  }

  /** Anything but a cursor key was pressed: the next arrow starts from scratch. */
  reset(): void {
    this.memory = null
  }

  /** The tier the last cursor key went at, or `null` before any. */
  get tier(): SpeedTier | null {
    return this.lastTier
  }
}
