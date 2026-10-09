// How far one cursor key moves the cursor — or a list's highlight — decided from when and how the key
// arrives.
//
// **No acceleration.** An arrow moves `tapStep` tiles on the map (one row in a list), whether it is
// tapped slowly, tapped quickly or held; Shift (Option, PageUp/PageDown, Home/End) moves `jumpStep`.
// Speed comes from Shift, never from how fast or how long a key is pressed — the convention of every
// roguelike surveyed (`docs/history/reports/2026-10-09-roguelike-navigation.md`), and the owner's call
// after playing both: "Lets start by removing the acceleration, that was a bad idea." (The counted taps
// and the long hold that went further were built from his earlier playtest and are gone.)
//
//   - **A tap** moves `tapStep`.
//   - **A hold runs at the game's own cadence**, whatever the operating system's repeat rate: its
//     repeats move the cursor at most once every `holdMoveMs` (on average exactly that often, when the
//     keyboard repeats faster; every repeat when it is off), `tapStep` tiles a move.
//   - **The fast move** is a jump of `jumpStep` tiles: further than an arrow by default, less far when
//     the player sets it so, which makes Shift the slow, exact move. It goes `jumpStepDown` up or down,
//     fewer than across, since a row is about twice as tall on screen as a column is wide. Held, it jumps again at most once
//     every `jumpRepeatMs`, so each jump is seen to land. In a list it goes to the first or last row.
//
// Every one of those numbers is a setting (`src/build/all-settings.ts`), and `moveTuning` reads each as
// it is now, so a change in Settings changes the next key.
//
// **How a repeat is told from a tap.** Where the terminal reports key events (the kitty keyboard
// protocol, `src/terminal/key-events.ts`, behind the Key releases Experiment), it says so: a press is a
// tap, a repeat is a hold's, and a release ends the hold at once. Where it does not — a classic
// terminal, or the Experiment off — a press of the same arrow within the **hold window** (the
// `holdWindowMs` Experiment) of the one before is taken for a held key's repeat. The same intent lands
// on the same tile either way (a test holds that parity).
//
// Pure: time comes in as a number, and nothing here names a clock (the architecture test holds
// `src/build` to that). The session keeps one of these beside the reducer, never inside it — the
// reducer only ever sees an ordinary `move-cursor` or `highlight` of the size chosen here.

import type { CursorKey } from "../terminal/list-keys.ts"
import type { KeyPhase } from "../terminal/key-events.ts"
import { DEFAULT_SETTINGS } from "../settings/types.ts"
import type { SettingSource } from "./all-settings.ts"
import { setting } from "./all-settings.ts"
import { defaultExperiments } from "./experiments.ts"

/** What a cursor key did: a tap, a hold's move (0 tiles for a repeat that came before the cadence
 *  allowed one), a jump (0 for a held jump's repeat that came too soon), or a release that ended a
 *  hold. The playtest summary prints it with its tiles. */
export type MoveKind = "tap" | "hold" | "jump" | "release"

/** The numbers, handed in so the rules stay pure functions a test can drive with any of them. */
export type MoveTuning = Readonly<{
  /** How far an arrow goes: a tap, and each move of a held arrow. */
  tapStep: number
  holdMoveMs: number
  /** The fast move's jump left or right, and up or down. */
  jumpStep: number
  jumpStepDown: number
  jumpRepeatMs: number
  holdWindowMs: number
}>

/** The rules as the game runs them: each number as it is now — a live Experiment's value, or the tuned
 *  constant — read without caring which (`setting`). */
export function moveTuning(from: SettingSource): MoveTuning {
  return {
    tapStep: setting(from, "tapStep"),
    holdMoveMs: setting(from, "holdMoveMs"),
    jumpStep: setting(from, "jumpStep"),
    jumpStepDown: setting(from, "jumpStepDown"),
    jumpRepeatMs: setting(from, "jumpRepeatMs"),
    holdWindowMs: setting(from, "holdWindowMs"),
  }
}

/** The rules for a list's highlight: the arrow moves one row, whatever the map's step is, and the hold's
 *  pace is the map cursor's own ("use the same timings, consistency here will be very useful"). */
export function listTuning(tuning: MoveTuning): MoveTuning {
  return { ...tuning, tapStep: 1 }
}

/** The rules at this build's defaults: what a key is without a session to say otherwise (a test driving
 *  the keyboard adapter on its own). */
export const DEFAULT_MOVE_TUNING: MoveTuning = moveTuning({ experiments: defaultExperiments(), settings: DEFAULT_SETTINGS })

/** What the rules remember about the last cursor key: which it was, when its last event came, and the
 *  hold it is part of, if any. */
export type MoveMemory = Readonly<{
  dx: number
  dy: number
  jump: boolean
  /** When this key's last event (a press or a repeat) arrived. */
  at: number
  /** The hold: when its first repeat came (`null` when the key is not being held), and when its next
   *  move is due. */
  holdStart: number | null
  holdDue: number
}>

/** One cursor key through the rules: what it did, how many tiles, and what to remember. `tiles` 0
 *  means send nothing. */
export type MoveStep = Readonly<{ kind: MoveKind; tiles: number; memory: MoveMemory }>

/** How far a press on its own moves: a tap, or the fast move's jump. What every key is without a clock
 *  (a driver, a test). */
export function pressTiles(key: CursorKey, tuning: Pick<MoveTuning, "tapStep" | "jumpStep" | "jumpStepDown">): number {
  if (!key.jump) return tuning.tapStep
  return key.dy !== 0 ? tuning.jumpStepDown : tuning.jumpStep
}

/** Whether this is a repeat of a held key: the terminal says so, or — when it says nothing — the same
 *  key came again within the hold window. */
function isRepeat(same: boolean, gap: number, phase: KeyPhase | null, tuning: MoveTuning): boolean {
  if (phase !== null) return phase === "repeat"
  return same && gap <= tuning.holdWindowMs
}

/**
 * One cursor key through the rules. `phase` is what the terminal said the event was — a press, a
 * repeat, a release — or `null` when it says nothing and timing must decide.
 */
export function moveStep(previous: MoveMemory | null, key: CursorKey, now: number, phase: KeyPhase | null, tuning: MoveTuning): MoveStep {
  const same = previous !== null && previous.dx === key.dx && previous.dy === key.dy && previous.jump === key.jump
  const gap = previous === null ? Number.POSITIVE_INFINITY : now - previous.at
  const fresh: MoveMemory = { dx: key.dx, dy: key.dy, jump: key.jump, at: now, holdStart: null, holdDue: now }

  // A release ends the hold of the key it names, at once; any other key's release changes nothing.
  if (phase === "release") {
    if (!same || previous === null) return { kind: "release", tiles: 0, memory: previous ?? fresh }
    return { kind: "release", tiles: 0, memory: { ...previous, holdStart: null } }
  }

  if (key.jump) {
    // A held jump's repeat — or, with no phase to go by, the same jump again — too soon after the last
    // jump: dropped, and the last jump's time kept, so the next is timed from the jump the player saw.
    const soon = same && previous !== null && gap < tuning.jumpRepeatMs && phase !== "press"
    if (soon) return { kind: "jump", tiles: 0, memory: previous }
    return { kind: "jump", tiles: pressTiles(key, tuning), memory: fresh }
  }

  if (isRepeat(same, gap, phase, tuning)) {
    // A hold. Its first repeat moves at once; after that, a move is due every `holdMoveMs`. A repeat a
    // little late keeps the cadence (the next move is due on time, not a whole interval after the late
    // one), so a keyboard repeating every 40 ms still averages one move per cadence rather than one per
    // two repeats; one very late never makes up for the moves it missed.
    const holding = same && previous !== null && previous.holdStart !== null
    const holdStart = holding ? (previous.holdStart as number) : now
    const holdDue = holding ? previous.holdDue : now
    const base: MoveMemory = { ...fresh, holdStart, holdDue }
    if (now < holdDue) return { kind: "hold", tiles: 0, memory: base }
    const due = Math.max(holdDue + tuning.holdMoveMs, now + tuning.holdMoveMs / 2)
    return { kind: "hold", tiles: tuning.tapStep, memory: { ...base, holdDue: due } }
  }

  // A tap: one step, however quickly it follows the last.
  return { kind: "tap", tiles: tuning.tapStep, memory: fresh }
}

/** The last cursor key's move, for the playtest summary and the tests. */
export type Move = Readonly<{ kind: MoveKind; tiles: number }>

/** The rules as the session holds them: their memory, and the move the last cursor key made. */
export class KeyMotion {
  private memory: MoveMemory | null = null
  private last: Move | null = null

  /** How many tiles this cursor key moves, arriving at `now` milliseconds with the phase the terminal
   *  gave it (or `null`); 0 means send nothing. */
  step(key: CursorKey, now: number, phase: KeyPhase | null, tuning: MoveTuning): number {
    const next = moveStep(this.memory, key, now, phase, tuning)
    this.memory = next.memory
    this.last = { kind: next.kind, tiles: next.tiles }
    return next.tiles
  }

  /** Anything but a cursor key was pressed: the next arrow starts from scratch, and there is no last
   *  move to report. */
  reset(): void {
    this.memory = null
    this.last = null
  }

  /** The move the last cursor key made since anything else was pressed, or `null`. */
  get move(): Move | null {
    return this.last
  }
}
