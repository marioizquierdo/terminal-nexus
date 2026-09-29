// How far one cursor key moves the cursor, decided from when the key events arrive — the held-key
// ramp (gate 5H, simplified after the owner's playtest of 2026-09-28: "one keypress should move 1,
// then holding the key (or tapping repeatedly fast) should start scrolling already at speed 2, and
// 300ms later increase speed to 4. Holding shift should behave fundamentally different... it should
// move the cursor 12 tiles").
//
// **Terminals send no key-up.** A held key is a stream of auto-repeated presses: the first one, a
// pause (the terminal's repeat delay — a few hundred milliseconds on a Mac, set by the user), then
// presses a few tens of milliseconds apart. So "held" is read from the gaps, and every number is a
// Experiment:
//
//   - a press is a **tap**, and moves the tap step (one tile) — a single press stays precise;
//   - a press of the **same arrow** within `holdWindowMs` of the one before it is part of a **run** —
//     the terminal's first repeat of a held key, or fast tapping, alike — and moves the hold step (two
//     tiles) at once; once the run has been moving for `rampMs`, the fast step (four);
//   - a different arrow, anything else pressed (`reset`), or a pause longer than the window, starts
//     over at a tap. A terminal whose repeat delay is longer than the window only loses its first
//     repeat to it: that one is a tap, and the repeats after it, tens of milliseconds apart, a run;
//   - the **fast move** (Shift, Option, PageUp/PageDown, Home/End) is not a speed at all but a
//     **jump** of `jumpStep` tiles. Held, it jumps again at most once every `jumpRepeatMs`: the
//     terminal repeats far faster than an eye can follow a twelve-tile jump, so the repeats in between
//     are dropped, and each jump is seen to land (the view's slide and the cursor's glide take about
//     that long) before the next one starts.
//
// Pure: time comes in as a number, and nothing here names a clock (the architecture test holds
// `src/build` to that). The session keeps one of these beside the reducer, never inside it — the
// reducer only ever sees an ordinary `move-cursor` of the size chosen here.

import type { DebugFlags } from "./debug.ts"
import type { CursorKey } from "./keyboard.ts"

/** What kind of move a cursor key made: a tap, a run at the hold step, a run at the fast step, or
 *  the fast move's jump. The playtest summary prints it. */
export type MoveKind = "tap" | "hold" | "fast" | "jump"

export type RampFlags = Pick<
  DebugFlags,
  "tapStep" | "holdStep" | "fastStep" | "jumpStep" | "rampMs" | "holdWindowMs" | "jumpRepeatMs"
>

/** What the ramp remembers about the last cursor key that moved: its direction, whether it was a
 *  jump, when it came, and when the run it belongs to started moving at the hold step (`null` for a
 *  tap or a jump). */
export type RampMemory = Readonly<{
  dx: number
  dy: number
  jump: boolean
  at: number
  runStart: number | null
}>

/** One cursor key through the ramp. `tiles` is 0 for a held jump's repeat that came too soon: the
 *  session sends nothing for it. */
export type RampStep = Readonly<{ kind: MoveKind; tiles: number; memory: RampMemory }>

/** One cursor key through the ramp: what kind of move it is, how many tiles, and what to remember. */
export function rampStep(previous: RampMemory | null, key: CursorKey, now: number, flags: RampFlags): RampStep {
  const same = previous !== null && previous.dx === key.dx && previous.dy === key.dy && previous.jump === key.fast
  const gap = previous === null ? Number.POSITIVE_INFINITY : now - previous.at
  const remember = (runStart: number | null): RampMemory => ({ dx: key.dx, dy: key.dy, jump: key.fast, at: now, runStart })

  if (key.fast) {
    // A held jump's repeat, too soon after the last jump: dropped, and the last jump's time kept, so
    // the next one is timed from the jump the player actually saw.
    if (same && previous !== null && gap < flags.jumpRepeatMs) return { kind: "jump", tiles: 0, memory: previous }
    return { kind: "jump", tiles: flags.jumpStep, memory: remember(null) }
  }
  if (same && previous !== null && gap <= flags.holdWindowMs) {
    const runStart = previous.runStart ?? now
    const fast = now - runStart >= flags.rampMs
    return { kind: fast ? "fast" : "hold", tiles: fast ? flags.fastStep : flags.holdStep, memory: remember(runStart) }
  }
  return { kind: "tap", tiles: flags.tapStep, memory: remember(null) }
}

/** The ramp as the session holds it: its memory, and the kind of move the last cursor key made. */
export class SpeedRamp {
  private memory: RampMemory | null = null
  private lastKind: MoveKind | null = null

  /** How many tiles this cursor key moves, arriving at `now` milliseconds; 0 means send nothing. */
  step(key: CursorKey, now: number, flags: RampFlags): number {
    const next = rampStep(this.memory, key, now, flags)
    this.memory = next.memory
    this.lastKind = next.kind
    return next.tiles
  }

  /** Anything but a cursor key was pressed: the next arrow starts from scratch. */
  reset(): void {
    this.memory = null
  }

  /** The kind of move the last cursor key made, or `null` before any. */
  get kind(): MoveKind | null {
    return this.lastKind
  }
}
