// How far one cursor key moves the cursor — or a list's highlight — decided from when and how the key
// arrives. Rewritten for the owner's third round on the menu spike (2026-09-30, feedback F79): "I often
// try to move to a position a few tiles away and then the cursor starts jumping ahead ... Instead of
// accelerating on fast taps based only on time, try based on number of taps within two different time
// windows: a double-tap (400ms) and a fast-double-tap (300ms) ... The keyboard press events should be
// handled in a way that limit the scroll speed more than strictly activating the fast movement."
//
// **Taps and holds are two things.** A *tap* is a key pressed and let go; a *hold* is a key kept down,
// which the operating system repeats at its own delay and rate. Each has its own rule:
//
//   - **Taps speed up by counting, never by time alone.** A tap moves `tapStep`. Taps of the same arrow
//     each within `doubleTapMs` of the one before are a run, and the run keeps its speed. Every
//     `tapsToSpeedUp`-th tap since the speed last changed, if it came within `fastTapMs` of the tap
//     before it, doubles the speed, up to `tapTopStep`: so the third tap of a run — the last one a
//     little quicker — moves 2 ("the user tap 3 times at least before activating speed, and the last one
//     needs to be a bit faster"), and three more at 2, the last quick again, reach 4 ("after another 3
//     taps it doubles again"). A slower gap, another arrow, or any other key starts over at one.
//   - **A hold runs at the game's own cadence**, whatever the operating system's repeat rate: its
//     repeats move the cursor at most once every `holdMoveMs` (on average exactly that often, when the
//     keyboard repeats faster), `holdFirstStep` tiles a move at first and `holdLongStep` once the key has
//     been repeating for `holdLongMs`. A hold breaks a run of taps: the tap after it is one tile, so
//     "keep-pressing, releasing, and tapping to adjust" (the owner, Q66) stays precise.
//   - **The fast move** (Shift, Option, PageUp/PageDown, Home/End) is not a speed at all but a **jump**
//     of `jumpStep` tiles. Held, it jumps again at most once every `jumpRepeatMs`, so each jump is seen
//     to land.
//
// Every one of those numbers is a setting (`src/build/all-settings.ts`) — most of them Experiments in
// Settings' Keyboard navigation section since the owner's F85, the rest tuned constants — and
// `moveTuning` reads each as it is now, so a change in Settings changes the next key.
//
// **How a repeat is told from a tap.** Where the terminal reports key events (the kitty keyboard
// protocol, `src/view/key-events.ts`, behind the Key releases Experiment), it says so: a press is a
// tap, a repeat is a hold's, and a release ends the hold at once. Where it does not — a classic
// terminal, or the Experiment off — a press of the same arrow within the **hold window** (the
// `holdWindowMs` Experiment) of the one before is taken for a held key's repeat, and anything slower
// is a tap for the counting rule. The same intent lands on the same tile either way, as long as the
// taps are slower than the hold window and the keyboard's repeat delay is shorter than it (a test
// holds that parity).
//
// Pure: time comes in as a number, and nothing here names a clock (the architecture test holds
// `src/build` to that). The session keeps one of these beside the reducer, never inside it — the
// reducer only ever sees an ordinary `move-cursor` or `highlight` of the size chosen here.

import type { CursorKey } from "../menu/list-keys.ts"
import type { KeyPhase } from "../view/key-events.ts"
import { DEFAULT_SETTINGS } from "../settings/types.ts"
import type { SettingSource } from "./all-settings.ts"
import { setting } from "./all-settings.ts"
import { defaultExperiments } from "./experiments.ts"

/** What a cursor key did: a tap (at whatever speed its run has reached), a hold's move (0 tiles for a
 *  repeat that came before the cadence allowed one), a jump (0 for a held jump's repeat that came too
 *  soon), or a release that ended a hold. The playtest summary prints it with its tiles. */
export type MoveKind = "tap" | "hold" | "jump" | "release"

/** The numbers, handed in so the rules stay pure functions a test can drive with any of them. */
export type MoveTuning = Readonly<{
  tapStep: number
  doubleTapMs: number
  fastTapMs: number
  tapsToSpeedUp: number
  tapTopStep: number
  holdMoveMs: number
  holdFirstStep: number
  holdLongStep: number
  holdLongMs: number
  jumpStep: number
  jumpRepeatMs: number
  holdWindowMs: number
}>

/** The rules as the game runs them: each number as it is now — a live Experiment's value, or the tuned
 *  constant — read without caring which (`setting`), so a change in Settings changes the feel at once
 *  and a number can move between tiers without this changing. */
export function moveTuning(from: SettingSource): MoveTuning {
  return {
    tapStep: setting(from, "tapStep"),
    doubleTapMs: setting(from, "doubleTapMs"),
    fastTapMs: setting(from, "fastTapMs"),
    tapsToSpeedUp: setting(from, "tapsToSpeedUp"),
    tapTopStep: setting(from, "tapTopStep"),
    holdMoveMs: setting(from, "holdMoveMs"),
    holdFirstStep: setting(from, "holdFirstStep"),
    holdLongStep: setting(from, "holdLongStep"),
    holdLongMs: setting(from, "holdLongMs"),
    jumpStep: setting(from, "jumpStep"),
    jumpRepeatMs: setting(from, "jumpRepeatMs"),
    holdWindowMs: setting(from, "holdWindowMs"),
  }
}

/** The rules at this build's defaults: what a key is without a session to say otherwise (a test driving
 *  the keyboard adapter on its own). */
export const DEFAULT_MOVE_TUNING: MoveTuning = moveTuning({ experiments: defaultExperiments(), settings: DEFAULT_SETTINGS })

/** What the rules remember about the last cursor key: which it was, when its last event came, the run
 *  of taps it is part of, and the hold it is part of, if any. */
export type MoveMemory = Readonly<{
  dx: number
  dy: number
  jump: boolean
  /** When this key's last event (a press or a repeat) arrived. */
  at: number
  /** The run of taps: when its last tap came (`null` once a hold broke it), its step, and how many taps
   *  have come since the step last changed. */
  tapAt: number | null
  step: number
  taps: number
  /** The hold: when its first repeat came (`null` when the key is not being held), and when its next
   *  move is due. */
  holdStart: number | null
  holdDue: number
}>

/** One cursor key through the rules: what it did, how many tiles, and what to remember. `tiles` 0
 *  means send nothing. */
export type MoveStep = Readonly<{ kind: MoveKind; tiles: number; memory: MoveMemory }>

/** How far a press on its own moves: a tap, or the fast move's jump. What every key is without a clock
 *  (a driver, a test), and what a run of taps starts from. */
export function pressTiles(key: CursorKey, tuning: Pick<MoveTuning, "tapStep" | "jumpStep">): number {
  return key.jump ? tuning.jumpStep : tuning.tapStep
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
  const fresh: MoveMemory = { dx: key.dx, dy: key.dy, jump: key.jump, at: now, tapAt: null, step: tuning.tapStep, taps: 0, holdStart: null, holdDue: now }

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
    // A hold. Its first repeat moves at once and breaks any run of taps; after that, a move is due every
    // `holdMoveMs`. A repeat a little late keeps the cadence (the next move is due on time, not a whole
    // interval after the late one), so a keyboard repeating every 40 ms still averages one move per
    // cadence rather than one per two repeats; one very late never makes up for the moves it missed.
    const holding = same && previous !== null && previous.holdStart !== null
    const holdStart = holding ? (previous.holdStart as number) : now
    const holdDue = holding ? previous.holdDue : now
    const base: MoveMemory = { ...fresh, holdStart, holdDue }
    if (now < holdDue) return { kind: "hold", tiles: 0, memory: base }
    const tiles = now - holdStart >= tuning.holdLongMs ? tuning.holdLongStep : tuning.holdFirstStep
    const due = Math.max(holdDue + tuning.holdMoveMs, now + tuning.holdMoveMs / 2)
    return { kind: "hold", tiles, memory: { ...base, holdDue: due } }
  }

  // A tap. It continues the run when it is the same arrow, the last thing that arrow did was a tap (a
  // hold breaks a run), and it came within the double-tap window; otherwise it starts over at one.
  const lastTap = same && previous !== null ? previous.tapAt : null
  if (previous === null || lastTap === null || now - lastTap > tuning.doubleTapMs) {
    return { kind: "tap", tiles: tuning.tapStep, memory: { ...fresh, tapAt: now, taps: 1 } }
  }
  const taps = previous.taps + 1
  const speedUp = taps >= tuning.tapsToSpeedUp && now - lastTap <= tuning.fastTapMs && previous.step < tuning.tapTopStep
  const step = speedUp ? Math.min(tuning.tapTopStep, previous.step * 2) : previous.step
  return { kind: "tap", tiles: step, memory: { ...fresh, tapAt: now, step, taps: speedUp ? 0 : taps } }
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
