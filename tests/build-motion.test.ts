// Movement feel, reworked after the owner's 2026-09-28 playtest, settled by his settings export
// of 2026-09-30, and reworked again by his third round the same day (taps speed up by counting, a
// hold runs at the game's own cadence, and key events are read where the terminal reports them), then
// once more when he asked for no acceleration, where only Shift changes the speed: an arrow moves its step
// however it is pressed, and the arrow's step and Shift's step and pace are Experiments.
// Taps, holds and the Shift jump, the cursor glide, the share-of-view scroll
// margin, clicks that scroll armed or not, the sliding view, the refused-placement flash, the lone-Esc
// timeout and the frame timer. Every timing claim is made against an injected clock — a number — so
// nothing here waits, except the one lifecycle test of the frame timer itself, which has to.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { edgeClickCamera, marginForView, shareOfSpan } from "../src/build/camera.ts"
import { EXPERIMENT_FIELDS, defaultExperiments } from "../src/build/experiments.ts"
import { cellForTile, menuEntryRow } from "../src/build/layout.ts"
import { DEFAULT_MOVE_TUNING, moveStep, moveTuning } from "../src/build/motion.ts"
import type { MoveMemory, MoveTuning } from "../src/build/motion.ts"
import { SETTLED_EXPERIMENTS, TUNING } from "../src/build/tuning.ts"
import { defaultValue } from "../src/build/all-settings.ts"
import type { SettingName } from "../src/build/all-settings.ts"
import type { CursorKey } from "../src/terminal/list-keys.ts"
import { encodeKeyEvent } from "../src/terminal/key-events.ts"
import type { KeyPhase } from "../src/terminal/key-events.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import type { BuildContext } from "../src/build/state.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { DEFAULT_LEVEL } from "../src/cli/levels.ts"
import type { LevelDestination } from "../src/cli/route.ts"
import { starterContext } from "../src/cli/starter.ts"
import type { Coord } from "../src/grid/types.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { BuildAnimation, FRAME_MS, nextFrameDelay } from "../src/view/build-live.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { KeyReader } from "../src/terminal/key-reader.ts"
import { keysFromChunk } from "../src/terminal/playback.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import {
  DOWN,
  ESC,
  LEFT,
  MINIMUM,
  OPEN_GROUND,
  RIGHT,
  SHIFT_DOWN,
  SHIFT_LEFT,
  SHIFT_RIGHT,
  TAB,
  UP,
  buildSide,
  clickTile,
  compose,
  screenText,
  timed,
} from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

/** A Build Phase with the Nexus power picked and the keyboard on the map, in plain navigation. */
function exploring(context: BuildContext = starterContext(), cursor: Coord = OPEN_GROUND, terminal = MINIMUM): Side {
  const side = buildSide({ context, cursor, terminal })
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.dispatch({ kind: "focus", target: "grid" })
  return side
}


/** The rules the game runs at this build's defaults: an arrow one tile, Shift ten. */
const TUNED: MoveTuning = DEFAULT_MOVE_TUNING

/** Taps a player makes as fast as they can, inside the old "quick tap" window: still one step each. */
const QUICK = 150

/** A key event as the rules see it: when it came, and what the terminal said it was (`null`: nothing). */
type At = readonly [number, KeyPhase | null]

/** What each event did, as `kind tiles`: `tap 2`, `hold 1`, `hold 0` (a repeat the cadence dropped). */
function moves(key: CursorKey, events: readonly At[], tuning: MoveTuning = TUNED, from: MoveMemory | null = null): string[] {
  let memory = from
  return events.map(([at, phase]) => {
    const step = moveStep(memory, key, at, phase, tuning)
    memory = step.memory
    return `${step.kind} ${step.tiles}`
  })
}

/** The memory after some events, to go on from. */
function after(key: CursorKey, events: readonly At[], tuning: MoveTuning = TUNED): MoveMemory | null {
  let memory: MoveMemory | null = null
  for (const [at, phase] of events) memory = moveStep(memory, key, at, phase, tuning).memory
  return memory
}

/** Presses with nothing said about them (a classic terminal), at these times. */
const presses = (times: readonly number[]): At[] => times.map((at) => [at, null] as const)

/** Taps `gap` ms apart, from `start`: the times. */
const taps = (start: number, count: number, gap: number): number[] => Array.from({ length: count }, (_, index) => start + index * gap)

/** A terminal's auto-repeat, as a classic terminal sends it: one press at `start`, a pause of `delay`
 *  (the keyboard's repeat delay — inside the hold window here, as the Experiment is meant to be set), then
 *  `repeats` presses `every` ms apart. The times. */
function held(start: number, repeats: number, delay = 180, every = 30): number[] {
  return [start, ...Array.from({ length: repeats }, (_, index) => start + delay + index * every)]
}

/** The same hold as a terminal reporting key events sends it: a press, repeats, and a release. */
function heldEvents(start: number, repeats: number, delay = 180, every = 30): At[] {
  const times = held(start, repeats, delay, every)
  const release = (times.at(-1) ?? start) + every
  return [...times.map((at, index) => [at, index === 0 ? "press" : "repeat"] as const), [release, "release"] as const]
}

const EAST = { dx: 1, dy: 0, jump: false }
const WEST = { dx: -1, dy: 0, jump: false }
const JUMP_EAST = { dx: 1, dy: 0, jump: true }

const tap = (tiles: number): string => `tap ${tiles}`
const hold = (tiles: number): string => `hold ${tiles}`

// --- Taps and holds (the owner's third round) --------------------------------------------------

test("the motion rules run on each number as it is now: the navigation Experiments, and nothing accelerates", () => {
  // Every number is its setting's value, whichever tier it stands on — at this build's defaults here.
  for (const [name, value] of Object.entries(TUNED)) assert.equal(value, defaultValue(name as SettingName), `${name} is not its setting's value`)
  // The keyboard navigation Experiments, in the order Settings lists them: how far an arrow and Shift go,
  // how often a held key moves, then the terminal's own two.
  const movement = [...Object.keys(TUNED), "keyReleases", "cursorGlideMs"]
  assert.deepEqual(
    EXPERIMENT_FIELDS.map((spec) => spec.field).filter((field) => movement.includes(field)),
    ["tapStep", "jumpStep", "jumpStepDown", "jumpRepeatMs", "holdMoveMs", "holdWindowMs", "keyReleases"],
  )
  for (const name of ["tapStep", "jumpRepeatMs"] as const) assert.ok(!(name in TUNING), `${name} is still a tuned value`)
  // The owner's Shift jump: 9 across, 6 up or down, since a row is about twice as tall as a column is wide.
  assert.deepEqual([TUNED.jumpStep, TUNED.jumpStepDown], [9, 6])
  assert.deepEqual([moves(JUMP_EAST, presses([0])), moves({ dx: 0, dy: 1, jump: true }, presses([0]))], [["jump 9"], ["jump 6"]])
  // Acceleration is gone (the owner: "that was a bad idea"), and so are the held-key ramp's numbers — an old
  // export naming any of them is still read quietly.
  const gone = ["acceleration", "doubleTapMs", "fastTapMs", "tapsToSpeedUp", "tapTopStep", "holdLongMs", "holdLongStep", "holdStep", "fastStep", "rampMs", "holdFirstStep"]
  for (const name of gone) {
    assert.ok(!(name in TUNING) && !EXPERIMENT_FIELDS.some((spec) => spec.field === name), `${name} is still a setting`)
    assert.ok(SETTLED_EXPERIMENTS.has(name), `an old export's ${name} would be reported as unknown`)
  }
})

test("a navigation number changed in Settings changes the very next key", () => {
  const start = { x: 0, y: 13 }
  // The jump distance, one step up: a Shift jump goes that far, with a clock and without one (a driver).
  const jump = exploring(starterContext(), start)
  jump.build.dispatch({ kind: "setting-adjust", field: "jumpStep", step: 1 })
  const far = jump.build.state.experiments.jumpStep
  assert.notEqual(far, TUNED.jumpStep)
  timed(jump, [[SHIFT_RIGHT, 0]])
  assert.equal(jump.build.state.cursor.x, start.x + far)
  jump.build.handleData(SHIFT_RIGHT, jump.layout)
  assert.equal(jump.build.state.cursor.x, start.x + 2 * far)
  // The hold pace reaches the rules as the session reads it.
  const paced = exploring(starterContext(), start)
  paced.build.dispatch({ kind: "setting-adjust", field: "holdMoveMs", step: 1 })
  const live = moveTuning(paced.build.state)
  assert.ok(live.holdMoveMs > TUNED.holdMoveMs)
  const holding = held(0, 60, 180, 25)
  const movesAt = (tuning: MoveTuning): number => moves(EAST, presses(holding), tuning).filter((move) => move.startsWith("hold") && !move.endsWith(" 0")).length
  assert.ok(movesAt(live) < movesAt(TUNED), "a slower hold pace did not move less often")
})

test("a tap moves one tile, slow taps and quick ones alike", () => {
  const slow = 500
  assert.deepEqual(moves(EAST, presses(taps(0, 4, slow))), [tap(1), tap(1), tap(1), tap(1)])
  const side = exploring()
  timed(side, taps(0, 4, slow).map((at) => [RIGHT, at] as const))
  assert.equal(side.build.state.cursor.x, OPEN_GROUND.x + 4)
  assert.deepEqual(side.build.lastMove, { kind: "tap", tiles: 1 })
})

test("a held arrow moves at the game's own cadence, the same average speed whatever the keyboard's repeat rate", () => {
  const window = 2_000
  for (const every of [25, 30, 40]) {
    const times = held(0, Math.floor(window / every), 180, every)
    const got = moves(EAST, presses(times))
    assert.equal(got[0], tap(1))
    assert.equal(got[1], hold(TUNED.tapStep), `${every} ms: the first repeat did not move at once`)
    // Moves come at most as often as the cadence allows, on average exactly that often.
    const moveTimes = times.filter((_, index) => index > 0 && !(got[index] ?? "").endsWith(" 0"))
    const span = (moveTimes.at(-1) ?? 0) - (moveTimes[0] ?? 0)
    const expected = span / TUNED.holdMoveMs + 1
    assert.ok(Math.abs(moveTimes.length - expected) <= 1, `${every} ms repeats: ${moveTimes.length} moves in ${span} ms, not about ${expected}`)
    for (let index = 1; index < moveTimes.length; index += 1) {
      const gap = (moveTimes[index] as number) - (moveTimes[index - 1] as number)
      assert.ok(gap >= TUNED.holdMoveMs / 2, `${every} ms repeats: two moves ${gap} ms apart`)
    }
    // Most repeats move nothing at all: the keyboard repeats faster than the cadence.
    assert.ok(got.filter((move) => move === hold(0)).length > 0, `${every} ms repeats: every repeat moved`)
  }
  // A keyboard that repeats slower than the cadence moves once a repeat — "at most", never catching up.
  const slow = moves(EAST, presses(held(0, 5, 180, TUNED.holdMoveMs + 30)))
  assert.deepEqual(slow.slice(1), Array.from({ length: 5 }, () => hold(TUNED.tapStep)))
})

test("without key events, a press within the hold window is a held key's repeat and a slower one a tap; the window is live", () => {
  const gap = 180
  assert.ok(gap < TUNED.holdWindowMs)
  // Presses 180 ms apart are a hold in the default window: a tap, then the hold's moves on its cadence.
  assert.deepEqual(moves(EAST, presses(taps(0, 3, gap))), [tap(1), hold(TUNED.tapStep), hold(TUNED.tapStep)])
  // The same presses, the window narrowed below the gap: taps, one tile each.
  const narrow = { ...TUNED, holdWindowMs: gap - 10 }
  assert.deepEqual(moves(EAST, presses(taps(0, 3, gap)), narrow), [tap(1), tap(1), tap(1)])
  // The Experiment is what the session reads: a tap is never held back by the cadence.
  const tuned = exploring()
  for (let step = 0; step < 10 && tuned.build.state.experiments.holdWindowMs >= gap; step += 1) {
    tuned.build.dispatch({ kind: "experiment-adjust", field: "holdWindowMs", step: -1 })
  }
  assert.ok(tuned.build.state.experiments.holdWindowMs < gap, "the hold window does not go below the gap")
  timed(tuned, taps(0, 3, gap).map((at) => [RIGHT, at] as const))
  assert.deepEqual(tuned.build.lastMove, { kind: "tap", tiles: 1 })
  assert.equal(tuned.build.state.cursor.x, OPEN_GROUND.x + 3)
  // A keyboard whose repeat delay is longer than the window loses only its first repeat to a tap.
  assert.deepEqual(moves(EAST, presses(held(0, 2, TUNED.holdWindowMs + 50))), [tap(1), tap(1), hold(TUNED.tapStep)])
})

test("with key events the terminal says which is which: quick taps are taps, and a release ends a hold at once", () => {
  const gap = 150 // inside the hold window, where a classic terminal's presses would read as a hold
  assert.deepEqual(moves(EAST, taps(0, 3, gap).map((at) => [at, "press"] as const)), [tap(1), tap(1), tap(1)])
  // A hold: its press, its repeats on the cadence, its release — and the tap after it is one tile.
  const events = heldEvents(0, 20)
  const got = moves(EAST, [...events, [1_000, "press"]])
  assert.equal(got[0], tap(1))
  assert.equal(got[1], hold(TUNED.tapStep))
  assert.equal(got.at(-2), "release 0")
  assert.equal(got.at(-1), tap(1))
  // A repeat after the release starts a new hold, moving at once; another key's release changes nothing.
  const released = after(EAST, events)
  assert.equal(released?.holdStart, null, "the release did not end the hold")
  const stillHeld = after(EAST, heldEvents(0, 20).slice(0, -1))
  assert.notEqual(moveStep(stillHeld, WEST, 900, "release", TUNED).memory.holdStart, null, "another key's release ended the hold")
})

// --- No acceleration: Shift is the only change of speed (the owner: "that was a bad idea") -----------

test("an arrow always moves its step: quick taps and long holds never go further", () => {
  // Twelve taps as fast as a player makes them: one tile each.
  assert.deepEqual(moves(EAST, presses(taps(0, 12, QUICK)).map(([at]) => [at, "press"] as const)), Array.from({ length: 12 }, () => tap(1)))
  // A hold of three seconds, the keyboard repeating every 30 ms: every move is one tile, to the end.
  const got = moves(EAST, presses(held(0, 100, 180, 30)))
  assert.deepEqual([...new Set(got.filter((move) => move !== hold(0)))].sort(), [hold(1), tap(1)])
  // Through the session, with a clock: eight quick taps, eight tiles.
  const side = exploring(starterContext(), { x: 0, y: 13 })
  side.build.setKeyReleases(true)
  timed(side, taps(0, 8, QUICK).map((at) => [RIGHT, at] as const))
  assert.equal(side.build.state.cursor.x, 8)
})

test("the arrow's step is how far a tap and each move of a held arrow go, and Shift can be the slow move", () => {
  const five = { ...TUNED, tapStep: 5, jumpStep: 1 }
  assert.deepEqual(moves(EAST, presses(taps(0, 4, 500)), five), [tap(5), tap(5), tap(5), tap(5)])
  assert.deepEqual(moves(EAST, presses(held(0, 3, 180, five.holdMoveMs + 30)), five), [tap(5), hold(5), hold(5), hold(5)])
  assert.deepEqual(moves(JUMP_EAST, presses([0, 500]), five), ["jump 1", "jump 1"])
  // And through the session: the map cursor goes five, Shift one — and a list still goes one row.
  const side = exploring(starterContext(), { x: 0, y: 13 })
  for (const [field, steps] of [["tapStep", 4], ["jumpStep", -9]] as const) {
    for (let step = 0; step < Math.abs(steps); step += 1) side.build.dispatch({ kind: "setting-adjust", field, step: steps > 0 ? 1 : -1 })
  }
  assert.deepEqual([side.build.state.experiments.tapStep, side.build.state.experiments.jumpStep], [5, 1])
  timed(side, [[RIGHT, 0], [RIGHT, 500], [SHIFT_RIGHT, 1_000]])
  assert.equal(side.build.state.cursor.x, 0 + 5 + 5 + 1)
  assert.deepEqual(side.build.lastMove, { kind: "jump", tiles: 1 })
  const list = buildSide()
  for (let step = 0; step < 4; step += 1) list.build.dispatch({ kind: "setting-adjust", field: "tapStep", step: 1 })
  const first = list.build.state.menuHighlight
  timed(list, [[DOWN, 0], [DOWN, 500], [DOWN, 1_000]])
  assert.equal(list.build.state.menuHighlight, first + 3, "a list moved by the map's step")
})

test("a held arrow's pace can be taken off: every repeat the keyboard sends then moves; Shift's pace is its own setting", () => {
  const unpaced = { ...TUNED, holdMoveMs: 0 }
  const got = moves(EAST, presses(held(0, 10, 180, 25)), unpaced)
  assert.deepEqual(got, [tap(1), ...Array.from({ length: 10 }, () => hold(1))])
  // The same keyboard on the default pace drops some.
  assert.ok(moves(EAST, presses(held(0, 10, 180, 25)), TUNED).includes(hold(0)))
  // Shift's pace: a held Shift-arrow, repeating every 30 ms, moves again at most that often.
  const slow = { ...TUNED, jumpRepeatMs: 300 }
  const repeats = presses(held(0, 10, 400, 30))
  const jumps = (tuning: MoveTuning): number => moves(JUMP_EAST, repeats, tuning).filter((move) => move !== "jump 0").length
  assert.ok(jumps(slow) < jumps(TUNED), "a slower Shift pace did not move less often")
  const side = exploring(starterContext(), { x: 0, y: 13 })
  for (let step = 0; step < 2; step += 1) side.build.dispatch({ kind: "setting-adjust", field: "jumpRepeatMs", step: 1 })
  assert.ok(moveTuning(side.build.state).jumpRepeatMs > TUNED.jumpRepeatMs, "the session did not read the Shift pace")
})

/**
 * One intent — taps, a hold, taps to adjust — as a classic terminal sends it (timed presses, the
 * repeats inside the hold window) and as a terminal reporting key events sends it (the same moments,
 * marked, with a release), through the session's raw-bytes path.
 */
function parityIntent(key: string): Readonly<{ timed: (readonly [string, number])[]; marked: (readonly [string, number])[] }> {
  const quick = 250
  const double = 350
  const repeat = encodeKeyEvent(key, "repeat")
  const release = encodeKeyEvent(key, "release")
  const timedKeys: [string, number][] = []
  const markedKeys: [string, number][] = []
  const both = (at: number, marked: string = key): void => {
    timedKeys.push([key, at])
    markedKeys.push([marked, at])
  }
  // Taps: a double, a quick one (2), three more, the last quick (4), then a slow one (1 again).
  for (const at of [0, double, double + quick, double + 2 * quick, double + 3 * quick, double + 4 * quick, 3_000]) both(at)
  // A hold of a second and a half, the keyboard repeating every 33 ms after a 180 ms delay.
  const holdAt = 5_000
  both(holdAt)
  let last = holdAt
  for (let at = holdAt + 180; at <= holdAt + 1_500; at += 33) {
    both(at, repeat)
    last = at
  }
  markedKeys.push([release, last + 20])
  // Taps to adjust: slow, then two quick after one.
  for (const at of [last + 600, last + 1_200, last + 1_200 + quick]) both(at)
  return { timed: timedKeys, marked: markedKeys }
}

test("the same intent as timed presses and as press, repeat and release events lands on the same tile, and the same row", () => {
  // The design's parity rule: only how a repeat is told from a tap differs, never where the cursor goes.
  const intent = parityIntent(RIGHT)
  const byTiming = exploring(starterContext(), { x: 0, y: 13 })
  const byEvents = exploring(starterContext(), { x: 0, y: 13 })
  byEvents.build.setKeyReleases(true)
  const positions = (side: Side, sequence: readonly (readonly [string, number])[]): number[] =>
    sequence.map(([key, at]) => {
      side.build.handleData(key, side.layout, { now: at })
      return side.build.state.cursor.x
    })
  const timedPositions = positions(byTiming, intent.timed)
  // The release moves nothing, so the marked sequence's positions are the timed one's with it repeated.
  const markedPositions = positions(byEvents, intent.marked).filter((_, index) => intent.marked[index]?.[0] !== encodeKeyEvent(RIGHT, "release"))
  assert.deepEqual(markedPositions, timedPositions)
  assert.ok((timedPositions.at(-1) ?? 0) > 25, "the intent hardly moved")
  // A list moves by the same rule: the Controls page's lines, walked with Down both ways.
  const rows = (reported: boolean): number[] => {
    const list = buildSide()
    list.build.setKeyReleases(reported)
    list.build.handleData("?", list.layout)
    const down = parityIntent(DOWN)
    const sequence = reported ? down.marked : down.timed
    return sequence
      .filter(([key]) => key !== encodeKeyEvent(DOWN, "release"))
      .map(([key, at]) => {
        list.build.handleData(key, list.layout, { now: 10_000 + at })
        return list.build.state.popupHighlight
      })
  }
  assert.deepEqual(rows(true), rows(false))
})

test("a release sends nothing, and a letter's release is not a second press; Ctrl+C in the protocol's form still quits", () => {
  const side = exploring()
  side.build.setKeyReleases(true)
  const before = side.build.state
  side.build.handleData(encodeKeyEvent(RIGHT, "release"), side.layout, { now: 100 })
  assert.equal(side.build.state, before, "a release changed the state")
  // `u`'s release after planning nothing: no undo answer, no command at all.
  side.build.handleData(encodeKeyEvent("u", "release"), side.layout, { now: 200 })
  assert.equal(side.build.state, before, "a letter's release was read as a press")
  // A repeat of a letter is a press again, as a classic terminal's auto-repeat always was.
  side.build.handleData(encodeKeyEvent("n", "repeat"), side.layout, { now: 300 })
  assert.equal(side.build.state.popup, "nexus-powers")
  const quitting = buildSide()
  quitting.build.handleData(`${ESC}[99;5u`, quitting.layout, { now: 0 })
  assert.equal(quitting.quits(), 1, "Ctrl+C in the protocol's form did not quit")
})

test("Shift+Arrow jumps; held, it jumps again at most once per jump repeat, and a fresh press always jumps", () => {
  const side = exploring(starterContext(), { x: 0, y: 13 })
  timed(side, [[SHIFT_RIGHT, 0]])
  assert.equal(side.build.state.cursor.x, TUNED.jumpStep)
  assert.deepEqual(side.build.lastMove, { kind: "jump", tiles: TUNED.jumpStep })
  // Held: the first press, the repeat delay, then repeats 30 ms apart. Only those at least the jump
  // repeat after the last jump move.
  const times = held(0, 11, 400)
  const got = moves(JUMP_EAST, presses(times))
  let last = -Infinity
  const jumps = times.filter((at) => {
    if (at - last < TUNED.jumpRepeatMs) return false
    last = at
    return true
  })
  assert.ok(jumps.length > 1 && jumps.length < times.length, "the repeat limit dropped nothing, or everything")
  assert.deepEqual(got.filter((step) => step !== "jump 0"), jumps.map(() => `jump ${TUNED.jumpStep}`))
  const heldSide = exploring(starterContext(), { x: 0, y: 13 })
  timed(heldSide, times.map((at) => [SHIFT_RIGHT, at] as const))
  assert.equal(heldSide.build.state.cursor.x, jumps.length * TUNED.jumpStep)
  // With key events, repeats are limited the same way, and two quick presses are two jumps.
  assert.deepEqual(moves(JUMP_EAST, [[0, "press"], [30, "repeat"], [60, "press"]]), [`jump ${TUNED.jumpStep}`, "jump 0", `jump ${TUNED.jumpStep}`])
  // A plain arrow straight after a jump is a tap of its own.
  const memory = moveStep(null, JUMP_EAST, 0, null, TUNED).memory
  assert.deepEqual(moves(EAST, presses([500]), TUNED, memory), [tap(1)])
})

test("without a clock every arrow is a tap and every Shift+Arrow one jump: driver scripts and scripted playtests are unchanged", () => {
  const side = exploring()
  for (let step = 0; step < 10; step += 1) side.build.handleData(RIGHT, side.layout)
  assert.equal(side.build.state.cursor.x, OPEN_GROUND.x + 10)
  const jumps = exploring(starterContext(), { x: 0, y: 13 })
  for (let step = 0; step < 3; step += 1) jumps.build.handleData(SHIFT_RIGHT, jumps.layout)
  assert.equal(jumps.build.state.cursor.x, 3 * TUNED.jumpStep)
  // A playtest's untimed steps are a second apart: taps that start over.
  const untimed = runBuildPlaytest({ scenes: false, steps: parseKeyScript("e Right*10") })
  // Where Explore Map put the cursor: clear ground beside the Nexus.
  const start = untimed.frames[1]?.state.cursor.x ?? 0
  assert.equal(untimed.frames.at(-1)?.state.cursor.x, start + 10)
  assert.deepEqual(untimed.frames.slice(2).map((frame) => frame.moveKind), Array.from({ length: 10 }, () => "tap 1"))
  // `~ms` times them: taps stay one tile however quick, and a hold runs on the cadence (the summary says which).
  const steady = runBuildPlaytest({ scenes: false, steps: parseKeyScript("e Right Right~350 Right~250") })
  assert.deepEqual(steady.frames.slice(2).map((frame) => frame.moveKind), ["tap 1", "tap 1", "tap 1"])
  const holding = runBuildPlaytest({ scenes: false, steps: parseKeyScript("e Right Right~180 Right~30*10") })
  const kinds = holding.frames.slice(3).map((frame) => frame.moveKind)
  assert.ok(kinds.includes("hold 1") && kinds.includes("hold 0"), `a held key in a script: ${kinds.join(", ")}`)
  // `Right/repeat` and `Right/release` play a terminal reporting key events.
  const marked = runBuildPlaytest({ scenes: false, steps: parseKeyScript("e Right Right/repeat~180 Right/repeat~30*4 Right/release~30 Right~100") })
  assert.equal(marked.frames.at(-2)?.moveKind, "release 0")
  assert.equal(marked.frames.at(-1)?.moveKind, "tap 1", "a press 100 ms after a release is a tap when the terminal says so")
})


// --- The scroll margin, as a share of the view -----------------------------------------------------

test("the margin is a share of the view's own width and height, never so wide the two sides meet", () => {
  assert.deepEqual(marginForView(20, { width: 48, height: 16 }), { x: 10, y: 3 })
  assert.deepEqual(marginForView(20, { width: 72, height: 24 }), { x: 14, y: 5 })
  assert.deepEqual(marginForView(30, { width: 49, height: 18 }), { x: 15, y: 5 })
  assert.equal(shareOfSpan(0, 48), 0)
  assert.equal(shareOfSpan(90, 16), 7, "a margin past the middle is capped")
  // The camera follows at the tuned margin: walking east, it first moves with the cursor that far from
  // the view's east edge.
  const side = exploring(starterContext(), { x: 0, y: 0 })
  const margin = marginForView(TUNING.scrollMargin, side.layout.viewport).x
  while (side.build.state.camera.x === 0) side.build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.equal(side.layout.viewport.width - 1 - (side.build.state.cursor.x - side.build.state.camera.x), margin)
})

// --- Clicks and the view ---------------------------------------------------------------------------

test("exploring, a click near an edge scrolls further the nearer the edge it lands", () => {
  const moveFor = (column: number): number => {
    const side = exploring(starterContext(), { x: 40, y: 20 })
    const camera = side.build.state.camera
    clickTile(side, { x: camera.x + column, y: camera.y + 8 })
    return side.build.state.camera.x - camera.x
  }
  const width = exploring().layout.viewport.width
  assert.equal(width, 49)
  // Two columns from the east edge scrolls much further than five; the middle does not scroll.
  const nearEdge = moveFor(width - 1 - 2)
  const fiveIn = moveFor(width - 1 - 5)
  assert.ok(nearEdge > fiveIn && fiveIn > 0, `near ${nearEdge}, five in ${fiveIn}`)
  assert.equal(moveFor(24), 0)
  // The very edge brings the clicked tile to the middle of the view.
  const side = exploring(starterContext(), { x: 40, y: 20 })
  const camera = side.build.state.camera
  const tile = { x: camera.x + width - 1, y: camera.y + 8 }
  clickTile(side, tile)
  assert.equal(tile.x - side.build.state.camera.x, Math.floor((width - 1) / 2))
  // Pure: west and north work the same way, and the zone is a share of the view.
  const view = { width: 48, height: 16 }
  const grid = starterContext().grid
  assert.ok(edgeClickCamera({ x: 30, y: 10 }, { x: 30, y: 10 }, view, grid, 33).x < 30)
  assert.ok(edgeClickCamera({ x: 30, y: 10 }, { x: 40, y: 10 }, view, grid, 33).y < 10)
})

/** A spot for a Barracks inside the build range, north-west of the Nexus and a tile clear of it — and, with the
 *  view where arming from 40,20 leaves it, inside the click's north-west edge zones, so a click there scrolls. */
const SCROLLING_SPOT = { x: 15, y: 8 } as const

test("armed, a click scrolls like an exploring one, and a quick double click places where the first pointed", () => {
  const side = exploring(starterContext(), { x: 40, y: 20 })
  side.build.handleData("1", side.layout)
  const camera = side.build.state.camera
  const tile = SCROLLING_SPOT
  const cell = cellForTile(side.layout, camera, tile)
  const click = formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
  side.build.handleData(click, side.layout, { now: 1000 })
  assert.deepEqual(side.build.state.cursor, tile)
  assert.notDeepEqual(side.build.state.camera, camera, "a click in the edge zone did not scroll")
  // The same screen cell, 200 ms later: the view has moved, so that cell is another tile now — but a
  // double click means "here", the tile the first click chose.
  side.build.handleData(click, side.layout, { now: 1200 })
  assert.equal(side.build.state.planned.length, 1, "the double click did not place")
  // Where Enter would have placed it after the first click alone.
  const reference = exploring(starterContext(), { x: 40, y: 20 })
  reference.build.handleData("1", reference.layout)
  reference.build.handleData(click, reference.layout, { now: 1000 })
  reference.build.dispatch({ kind: "place" })
  assert.deepEqual(side.build.state.planned, reference.build.state.planned)
})

test("a double click on the ghost's own tile places once and leaves the keyboard where the arming began", () => {
  // Armed from the menu by a click on its row; the ghost sits at the cursor, so the first half of a
  // double click on it places by the second-click rule. The second half has nothing left to do: it must
  // not take the keyboard to the map, nor lapse the placement's answer.
  const side = exploring(starterContext(), { x: 40, y: 20 })
  side.build.dispatch({ kind: "focus", target: "menu" })
  const row = menuEntryRow(side.layout, side.context.catalog, { kind: "construct", index: 0 }) as number
  side.build.handleData(formatMouseEvent(MOUSE_LEFT, side.layout.panelColumn + 1, row + 1), side.layout, { now: 1000 })
  assert.equal(side.build.state.armed, 0)
  const cell = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  const click = formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
  side.build.handleData(click, side.layout, { now: 2000 })
  side.build.handleData(click, side.layout, { now: 2150 })
  assert.equal(side.build.state.planned.length, 1)
  assert.equal(side.build.state.focus, "menu", "the second half of the double click took the keyboard to the map")
  assert.match(side.build.state.status.text, /Barracks placed/)
  // Out of the window, the same cell is a fresh click on the map again.
  side.build.handleData(click, side.layout, { now: 2150 + TUNING.doubleClickMs + 1 })
  assert.equal(side.build.state.focus, "grid")
})

test("a slow second click on a scrolled spot is a fresh first click, not a place on the wrong tile", () => {
  const side = exploring(starterContext(), { x: 40, y: 20 })
  side.build.handleData("1", side.layout)
  const camera = side.build.state.camera
  const tile = SCROLLING_SPOT
  const cell = cellForTile(side.layout, camera, tile)
  const click = formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
  side.build.handleData(click, side.layout, { now: 1000 })
  side.build.handleData(click, side.layout, { now: 1000 + TUNING.doubleClickMs + 1 })
  assert.equal(side.build.state.planned.length, 0)
  assert.notDeepEqual(side.build.state.cursor, tile)
})

test("the fast move drags the view at the margin like any other move; it does not re-centre", () => {
  // The owner turned "Shift centres" off in his settings export (2026-09-30), and the Experiment went.
  const side = exploring(starterContext(), { x: 40, y: 20 })
  side.build.handleData(SHIFT_RIGHT, side.layout)
  // Only dragged along: the cursor sits on the margin's inner edge, the tuned margin from the view's east
  // side.
  const margin = marginForView(TUNING.scrollMargin, side.layout.viewport).x
  assert.equal(side.build.state.cursor.x - side.build.state.camera.x, side.layout.viewport.width - 1 - margin)
})

test("a click during a slide lands on the tile drawn under the pointer, not the one the view is heading to", () => {
  const side = exploring(starterContext(), { x: 40, y: 20 })
  const drawn = side.build.state.camera
  side.build.handleData(SHIFT_RIGHT, side.layout) // the view heads east; say it has not moved yet
  assert.notDeepEqual(side.build.state.camera, drawn)
  const cell = cellForTile(side.layout, drawn, { x: 45, y: 22 })
  side.build.handleData(formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1), side.layout, { now: 10, camera: drawn })
  assert.deepEqual(side.build.state.cursor, { x: 45, y: 22 })
})

// --- The sliding view, the gliding cursor and the frame timer ----------------------------------------------------------

test("the view slides to a new camera over the ease time, whole tiles at a time, and then stops", () => {
  const side = exploring(starterContext(), { x: 40, y: 20 })
  const animation = new BuildAnimation({ ...TUNING, cursorGlideMs: 0 }) // the camera alone
  const start = side.build.state.camera
  assert.deepEqual(animation.frame(side.build.state, 0), { camera: start, cursor: side.build.state.cursor, busyUntil: null })
  side.build.handleData(SHIFT_RIGHT, side.layout)
  const target = side.build.state.camera
  const ease = TUNING.easeMs
  const at = (now: number) => animation.frame(side.build.state, now)
  assert.deepEqual(at(1000).camera, start, "the slide starts from where the view was drawn")
  assert.equal(at(1000).busyUntil, 1000 + ease)
  const middle = at(1000 + ease / 2).camera
  assert.ok(middle.x > start.x && middle.x < target.x, `half way: ${middle.x} between ${start.x} and ${target.x}`)
  assert.ok(Number.isInteger(middle.x))
  const end = at(1000 + ease)
  assert.deepEqual(end.camera, target)
  assert.equal(end.busyUntil, null, "still busy after the slide ended")
  // A slide and a glide of no time: a jump, and nothing to animate.
  const jump = exploring(starterContext(), { x: 40, y: 20 })
  const still = new BuildAnimation({ ...TUNING, easeMs: 0, cursorGlideMs: 0 })
  still.frame(jump.build.state, 0)
  jump.build.handleData(SHIFT_RIGHT, jump.layout)
  assert.deepEqual(still.frame(jump.build.state, 1), {
    camera: jump.build.state.camera,
    cursor: jump.build.state.cursor,
    busyUntil: null,
  })
})

test("every camera move slides, the plain arrow at the margin included — only a resize snaps", () => {
  const side = exploring(starterContext(), { x: 0, y: 20 })
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  const start = side.build.state.camera
  // Walk east until the camera first follows: a one-tile arrow at the margin.
  let now = 0
  while (side.build.state.camera.x === start.x) {
    now += 1000
    side.build.handleData(RIGHT, side.layout, { now })
    animation.frame(side.build.state, now)
  }
  const slide = animation.frame(side.build.state, now)
  assert.notEqual(slide.busyUntil, null, "a keyboard scroll snapped")
  assert.deepEqual(slide.camera, start, "the keyboard scroll did not start from the drawn view")
  animation.snap(side.build.state, now)
  assert.deepEqual(animation.frame(side.build.state, now), {
    camera: side.build.state.camera,
    cursor: side.build.state.cursor,
    busyUntil: null,
  })
})

test("the cursor glides to its new tile over the glide time; the state is already there", () => {
  // Shift jump toward the Grid's west edge, where the camera has nowhere to go: the cursor alone.
  const side = exploring(starterContext(), { x: 20, y: 20 })
  const animation = new BuildAnimation()
  const from = side.build.state.cursor
  const camera = side.build.state.camera
  animation.frame(side.build.state, 0)
  side.build.handleData(SHIFT_LEFT, side.layout) // a jump west
  const to = side.build.state.cursor
  assert.equal(to.x, from.x - TUNED.jumpStep, "the state holds the destination at once")
  assert.deepEqual(side.build.state.camera, camera, "the camera moved; this test wants the cursor alone")
  const glide = TUNING.cursorGlideMs
  const at = (now: number) => animation.frame(side.build.state, now)
  assert.deepEqual(at(1000).cursor, from, "the glide starts from where the cursor was drawn")
  assert.equal(at(1000).busyUntil, 1000 + glide, "the frame timer does not cover the glide")
  const middle = at(1000 + glide / 2).cursor
  assert.ok(middle.x < from.x && middle.x > to.x && Number.isInteger(middle.x), `half way: ${middle.x}`)
  assert.equal(middle.y, from.y)
  const end = at(1000 + glide)
  assert.deepEqual(end.cursor, to)
  assert.equal(end.busyUntil, null)
  // A second move mid-glide continues from where the cursor is drawn, not from where it was going.
  side.build.handleData(SHIFT_RIGHT, side.layout)
  const back = animation.frame(side.build.state, 2000)
  assert.deepEqual(back.cursor, to)
  side.build.handleData(SHIFT_RIGHT, side.layout)
  const drawn = animation.frame(side.build.state, 2000 + glide / 2).cursor
  side.build.handleData(SHIFT_RIGHT, side.layout)
  assert.deepEqual(animation.frame(side.build.state, 2000 + glide / 2).cursor, drawn, "a retarget jumped")
})

test("when the camera moves, the cursor rides along with the slide and never leaves the view", () => {
  const side = exploring(starterContext(), { x: 40, y: 20 })
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  side.build.handleData(SHIFT_RIGHT, side.layout) // the cursor drags the view: it slides under a gliding cursor
  const view = side.layout.viewport
  for (let now = 1000; now <= 1000 + TUNING.easeMs; now += FRAME_MS) {
    const frame = animation.frame(side.build.state, now)
    const inView = { x: frame.cursor.x - frame.camera.x, y: frame.cursor.y - frame.camera.y }
    assert.ok(inView.x >= 0 && inView.x < view.width && inView.y >= 0 && inView.y < view.height, `off the view at ${now}`)
  }
  assert.deepEqual(animation.frame(side.build.state, 2000).cursor, side.build.state.cursor)
})

test("reduced motion snaps the view and the cursor alike", () => {
  const side = exploring(starterContext(), { x: 40, y: 20 })
  const animation = new BuildAnimation()
  const reduced = { reducedMotion: true }
  animation.frame(side.build.state, 0, reduced)
  side.build.handleData(SHIFT_RIGHT, side.layout)
  side.build.handleData(SHIFT_DOWN, side.layout)
  assert.deepEqual(animation.frame(side.build.state, 1, reduced), {
    camera: side.build.state.camera,
    cursor: side.build.state.cursor,
    busyUntil: null,
  })
})

test("a gliding cursor is drawn where it is, and the armed preview travels with it", () => {
  const side = exploring(starterContext(), { x: 20, y: 20 })
  side.build.handleData("1", side.layout)
  const { context, layout } = side
  const state = side.build.state
  assert.equal(state.armed, 0)
  const drawn = { x: state.cursor.x - 5, y: state.cursor.y }
  const gliding = compose(side, { cursor: drawn })
  const stillFrame = compose(side)
  const at = (frame: typeof stillFrame, tile: { x: number; y: number }) => {
    const cell = cellForTile(layout, state.camera, tile)
    return cellAt(frame, cell.x, cell.y)
  }
  // The preview's glyphs sit at the drawn cursor, shifted as one piece, and nothing is left behind.
  assert.equal(at(gliding, drawn).glyph, at(stillFrame, state.cursor).glyph)
  assert.equal(at(gliding, drawn).style.inverse, true, "the cursor is not drawn where it is gliding")
  assert.notEqual(at(gliding, state.cursor).style.inverse, true, "the cursor is drawn at its destination too")
  // What the status line says is still about the destination, where Enter acts.
  assert.equal(frameToText(gliding).split("\n").at(-2), frameToText(stillFrame).split("\n").at(-2))
})

test("the frame timer asks for a frame only while something animates", () => {
  assert.equal(nextFrameDelay(null, 0), null)
  assert.equal(nextFrameDelay(1000, 0), FRAME_MS)
  assert.equal(nextFrameDelay(1005, 1000), 5)
})

test("a refused placement flashes the footprint for its tuned time, and moving off it ends the flash", () => {
  const side = exploring()
  side.build.handleData("1", side.layout)
  side.build.dispatch({ kind: "move-cursor", dx: 8 - OPEN_GROUND.x, dy: 5 - OPEN_GROUND.y }) // rock
  side.build.handleData("\r", side.layout)
  assert.equal(side.build.state.refusedTry?.seq, 1)
  const animation = new BuildAnimation()
  const first = animation.frame(side.build.state, 0)
  assert.equal(first.refusedTry, true)
  assert.equal(first.busyUntil, TUNING.refusedCursorMs)
  assert.equal(animation.frame(side.build.state, TUNING.refusedCursorMs).refusedTry, undefined)
  // Drawn as a solid block, in monochrome too.
  const frame = compose(side, { refusedTry: true })
  const plain = compose(side)
  const cell = cellForTile(side.layout, side.build.state.camera, { x: side.build.state.cursor.x + 1, y: side.build.state.cursor.y })
  assert.equal(cellAt(frame, cell.x, cell.y).style.inverse, true)
  assert.notEqual(cellAt(plain, cell.x, cell.y).style.inverse, true)
  // A second refusal flashes again; moving away ends it at once.
  side.build.handleData("\r", side.layout)
  assert.equal(animation.frame(side.build.state, 1000).refusedTry, true)
  side.build.handleData(RIGHT, side.layout)
  assert.equal(animation.frame(side.build.state, 1001).refusedTry, undefined)
})

// --- Esc --------------------------------------------------------------------------------------------

test("a lone Esc at the end of a read waits for the rest of a key, then counts as Esc", () => {
  const reader = new KeyReader()
  assert.deepEqual(reader.feed(ESC, 0, 50), [])
  assert.equal(reader.deadline(50), 50)
  assert.deepEqual(reader.flush(), [ESC])
  // The rest of an arrow, in time: one key.
  assert.deepEqual(reader.feed(ESC, 0, 50), [])
  assert.deepEqual(reader.feed("[A", 10, 50), [UP])
  // The rest of Option+Up, split after its two ESCs: one key.
  assert.deepEqual(reader.feed(`${ESC}${ESC}`, 0, 50), [])
  assert.deepEqual(reader.feed("[A", 5, 50), [`${ESC}${ESC}[A`])
  // Too late: Esc, then what came.
  assert.deepEqual(reader.feed(ESC, 0, 50), [])
  assert.deepEqual(reader.feed("1", 80, 50), [ESC, "1"])
  // A half-arrived mouse report is held the same way.
  assert.deepEqual(reader.feed(`${DOWN}${ESC}[<0;5`, 0, 50), [DOWN])
  assert.deepEqual(reader.feed(";9M", 3, 50), [`${ESC}[<0;5;9M`])
  // Timeout off: nothing is held.
  assert.deepEqual(reader.feed(ESC, 0, 0), [ESC])
})

test("Esc and a digit or letter in one read are two keys; only the Meta keys something binds stay whole", () => {
  assert.deepEqual(keysFromChunk(`${ESC}1`), [ESC, "1"])
  assert.deepEqual(keysFromChunk(`${ESC}d`), [ESC, "d"])
  assert.deepEqual(keysFromChunk(`${ESC}b`), [`${ESC}b`])
  assert.deepEqual(keysFromChunk(`${ESC}f`), [`${ESC}f`])
  const side = exploring()
  side.build.handleData("d", side.layout)
  side.build.handleData(`${ESC}1`, side.layout)
  assert.equal(side.build.state.popup, null, "Esc did not close Settings")
  assert.equal(side.build.state.armed, 0, "the 1 after it was lost")
})

// --- The live loop ---------------------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  frames = 0
  write(text: string): boolean {
    if (text.includes("TERMINAL NEXUS")) this.frames += 1
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
  setRawMode(): this {
    return this
  }
  resume(): this {
    return this
  }
  pause(): this {
    return this
  }
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** PERIMETER's first round with nothing foreseen of its raid: no trail moves, so nothing on the screen moves
 *  unless a key moved it. */
const QUIET_ROUND: LevelDestination = { kind: "level", level: { ...DEFAULT_LEVEL, play: { ...DEFAULT_LEVEL.play, foresee: () => [] } }, round: 1 }

test("the live screen redraws on a timer while the view slides, and not at all once it is still", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    // The raid's trail never settles (the next test): here nothing is foreseen, so only the slide moves.
    at: QUIET_ROUND,
    scenes: false,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })
  await wait(40)
  // Explore Map begun on the map (Tab, then `e`): the row's flash and the card's reveal, and no focus
  // arrow or cursor blink, which only a menu row handing the keyboard to the map plays.
  stdin.emit("data", Buffer.from(TAB))
  stdin.emit("data", Buffer.from("e"))
  await wait(Math.max(TUNING.pressedFlashMs, TUNING.cardRevealMs) + 100) // both have come and gone
  const idle = stdout.frames
  await wait(120)
  assert.equal(stdout.frames, idle, "an idle screen kept redrawing")
  stdin.emit("data", Buffer.from(SHIFT_RIGHT)) // twice: the view slides east
  stdin.emit("data", Buffer.from(SHIFT_RIGHT))
  await wait(300)
  // The two key presses redraw once each; anything beyond that was drawn by the frame timer. At
  // least one such frame is the property — how many depends on how busy the machine is, since a
  // late first tick can land after the slide has already ended.
  const moving = stdout.frames - idle
  assert.ok(moving > 2, `only ${moving} frames while the view slid - the frame timer never ran`)
  const settled = stdout.frames
  await wait(120)
  assert.equal(stdout.frames, settled, "the frame timer kept running after the slide")
  stdin.emit("data", Buffer.from([3]))
  await session
})

// Several of the trail's steps in real time, so Bun's per-test limit is lifted.
test("with only the raid's trail moving, the live screen redraws at the trail's own pace — never every frame — and not at all under a popup or with the trail out of view", { timeout: 120_000 }, async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runBuildPhase({
    // Monochrome: the trail changes twice a step there (an arrow steps on, then its copy goes), and a popup's
    // border does not breathe, so under a popup nothing on the screen moves at all.
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    scenes: false,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })
  await wait(80)
  const start = stdout.frames
  const span = 4 * TUNING.trailStepMs
  await wait(span)
  // Two changes a step: at most that many frames, give or take the edges of the window — where every frame
  // would be dozens; and at least one, or the trail is not moving at all. A busy machine draws fewer, never
  // more.
  const idle = stdout.frames - start
  const changes = Math.ceil((2 * span) / TUNING.trailStepMs)
  assert.ok(idle >= 1, "the trail never moved on its own")
  assert.ok(idle <= changes + 1, `${idle} frames in ${span} ms: more than the trail's ${changes} changes`)
  // A popup holds the trail still: the Nexus powers open, and once the row's pressed flash is over the screen
  // stops drawing until a key comes.
  stdin.emit("data", Buffer.from("n"))
  await wait(TUNING.pressedFlashMs + 150)
  const held = stdout.frames
  await wait(2 * TUNING.trailStepMs)
  assert.equal(stdout.frames, held, "the trail kept the screen drawing under a popup")
  // The popup closed, it moves again; the view taken far south, away from it, nothing on screen moves.
  stdin.emit("data", Buffer.from(ESC))
  await wait(TUNING.escTimeoutMs + 100)
  const again = stdout.frames
  await wait(2 * TUNING.trailStepMs)
  assert.ok(stdout.frames > again, "the trail did not move again once the popup closed")
  stdin.emit("data", Buffer.from(TAB))
  // Three jumps, each its own press: a held jump repeats no faster than it can be seen to land.
  for (let jump = 0; jump < 3; jump += 1) {
    stdin.emit("data", Buffer.from(SHIFT_DOWN))
    await wait(TUNED.jumpRepeatMs + 100)
  }
  await wait(TUNING.easeMs + TUNING.cursorGlideMs + 200)
  const away = stdout.frames
  await wait(2 * TUNING.trailStepMs)
  assert.equal(stdout.frames, away, "the trail kept the screen drawing while out of view")
  stdin.emit("data", Buffer.from([3]))
  await session
})

test("keys and the untimed arrows the web page and scripts send still land on the same state", () => {
  const byKeys = exploring()
  for (const key of [RIGHT, RIGHT, DOWN, LEFT, UP]) byKeys.build.handleData(key, byKeys.layout)
  const byTimedTaps = exploring()
  timed(byTimedTaps, [[RIGHT, 0], [RIGHT, 1000], [DOWN, 2000], [LEFT, 3000], [UP, 4000]])
  assert.deepEqual(byTimedTaps.build.state, byKeys.build.state)
  assert.equal(screenText(byTimedTaps), screenText(byKeys))
})
