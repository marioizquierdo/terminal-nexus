// Gate 5H: movement feel, reworked after the owner's 2026-09-28 playtest and settled by his settings
// export of 2026-09-30 (the numbers are tuned values now, `src/build/tuning.ts`; only the hold window is
// still an Experiment). The held-key ramp and the Shift jump, the cursor glide, the share-of-view scroll
// margin, clicks that scroll armed or not, the sliding view, the refused-placement flash, the lone-Esc
// timeout and the frame timer. Every timing claim is made against an injected clock — a number — so
// nothing here waits, except the one lifecycle test of the frame timer itself, which has to.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { edgeClickCamera, marginForView, shareOfSpan } from "../src/build/camera.ts"
import { EXPERIMENT_FIELDS, defaultExperiments } from "../src/build/experiments.ts"
import { buildLayout, cellForTile, menuEntryRow } from "../src/build/layout.ts"
import { rampStep, rampTuning } from "../src/build/motion.ts"
import type { RampMemory, RampTuning } from "../src/build/motion.ts"
import { TUNING } from "../src/build/tuning.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { runSpike, spikeContext } from "../src/cli/spike.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { BuildAnimation, FRAME_MS, nextFrameDelay } from "../src/view/build-live.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { KeyReader } from "../src/view/key-reader.ts"
import { keysFromChunk } from "../src/view/playback.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"

const ESC = String.fromCharCode(27)
const UP = `${ESC}[A`
const DOWN = `${ESC}[B`
const RIGHT = `${ESC}[C`
const LEFT = `${ESC}[D`
const SHIFT_RIGHT = `${ESC}[1;2C`
const TAB = "\t"
const MINIMUM = { columns: 80, rows: 24 }
/** The ramp the game runs: the tuned steps and timings, and the hold window's default. */
const FLAGS: RampTuning = rampTuning(defaultExperiments().holdWindowMs)

type Side = { build: BuildSession; layout: ReturnType<typeof buildLayout>; context: BuildContext }

/** A Build Phase with the Nexus power picked and the keyboard on the map, exploring. */
function exploring(context: BuildContext = spikeContext(), cursor = { x: 18, y: 13 }, terminal = MINIMUM): Side {
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor, viewport: layout.viewport })
  build.dispatch({ kind: "pick-nexus", index: 0 })
  build.dispatch({ kind: "focus", target: "grid" })
  return { build, layout, context }
}

/** Keys arriving at the given times, as a live terminal delivers them. */
function timed(side: Side, presses: readonly (readonly [string, number])[]): void {
  for (const [key, at] of presses) side.build.handleData(key, side.layout, { now: at })
}

/** A terminal's auto-repeat: one press at `start`, a pause of `delay`, then `repeats` presses `every`
 *  ms apart. The times at which each arrives. */
function held(start: number, repeats: number, delay = 400, every = 30): number[] {
  return [start, ...Array.from({ length: repeats }, (_, index) => start + delay + index * every)]
}

function kinds(key: { dx: number; dy: number; jump: boolean }, times: readonly number[], flags = FLAGS, from: RampMemory | null = null): string[] {
  let memory = from
  return times.map((at) => {
    const step = rampStep(memory, key, at, flags)
    memory = step.memory
    return `${step.kind} ${step.tiles}`
  })
}

const EAST = { dx: 1, dy: 0, jump: false }
const WEST = { dx: -1, dy: 0, jump: false }
const JUMP_EAST = { dx: 1, dy: 0, jump: true }

// --- The held-key ramp -----------------------------------------------------------------------------

test("the ramp's numbers are the owner's — tap 1, hold 2, fast 4 after 200 ms, Shift a jump of 10 — and the hold window stays an Experiment", () => {
  const { tapStep, holdStep, fastStep, rampMs, jumpStep, jumpRepeatMs } = FLAGS
  assert.deepEqual(
    { tapStep, holdStep, fastStep, rampMs, jumpStep, jumpRepeatMs },
    { tapStep: 1, holdStep: 2, fastStep: 4, rampMs: 200, jumpStep: 10, jumpRepeatMs: 100 },
  )
  assert.equal(FLAGS.holdWindowMs, 350, "the hold window of his settings export, 2026-09-30")
  // Only the hold window is still felt (it depends on each keyboard's repeat delay); the rest are settled.
  const ramp = ["tapStep", "holdStep", "fastStep", "rampMs", "holdWindowMs", "jumpStep", "jumpRepeatMs", "cursorGlideMs"]
  assert.deepEqual(EXPERIMENT_FIELDS.map((spec) => spec.field).filter((field) => ramp.includes(field)), ["holdWindowMs"])
  // The slow tier and slow-after-a-turn are gone, not merely hidden.
  for (const gone of ["slowStep", "normalStep", "fasterStep", "slowAfterTurn", "repeatGapMs", "repeatDelayMs"]) {
    assert.ok(!(gone in FLAGS), `${gone} is still a flag`)
  }
})

test("a single press moves one tile", () => {
  assert.deepEqual(kinds(EAST, [0]), ["tap 1"])
  const side = exploring()
  timed(side, [[RIGHT, 0]])
  assert.equal(side.build.state.cursor.x, 19)
  assert.equal(side.build.moveKind, "tap")
})

test("a held arrow's first repeat already moves two, and once the run is the ramp time old each press moves four", () => {
  // The first press, the terminal's repeat delay, then repeats 30 ms apart. The owner's hold window
  // is 350 ms (his settings export, 2026-09-30), so this is a terminal whose repeat delay fits in it;
  // one with a longer delay loses only its first repeat (the next test).
  const delay = FLAGS.holdWindowMs
  const times = held(0, 12, delay)
  const got = kinds(EAST, times)
  assert.equal(got[0], "tap 1")
  assert.equal(got[1], "hold 2", "the first repeat did not go straight to the hold step")
  // The run started moving at 2 on the first repeat (t = 350); from t = 560 it moves 4.
  times.forEach((at, index) => {
    if (index === 0) return
    assert.equal(got[index], at - delay >= FLAGS.rampMs ? "fast 4" : "hold 2", `press at ${at} ms`)
  })
  // The same through the session: 1 + 2 * 7 (350..530) + 4 * 5 (560..680).
  const side = exploring(spikeContext(), { x: 0, y: 13 })
  timed(side, times.map((at) => [RIGHT, at] as const))
  assert.equal(side.build.state.cursor.x, 1 + 2 * 7 + 4 * 5)
  assert.equal(side.build.moveKind, "fast")
})

test("tapping quickly is a run too, and a terminal with a slower repeat delay only loses its first repeat", () => {
  // Taps 150 ms apart: 1, then 2s, then 4s once the run is 300 ms old.
  assert.deepEqual(kinds(EAST, [0, 150, 300, 450, 600, 750]), ["tap 1", "hold 2", "hold 2", "fast 4", "fast 4", "fast 4"])
  // Deliberate taps further apart than the hold window stay one tile each.
  const apart = FLAGS.holdWindowMs + 100
  assert.deepEqual(kinds(EAST, [0, apart, 2 * apart]), ["tap 1", "tap 1", "tap 1"])
  // A repeat delay longer than the window: the first repeat is a tap, the ones after it a run.
  const slow = held(0, 3, FLAGS.holdWindowMs + 200)
  assert.deepEqual(kinds(EAST, slow), ["tap 1", "tap 1", "hold 2", "hold 2"])
})

test("a different arrow, or anything else pressed, starts again at one tile", () => {
  let memory: RampMemory | null = null
  for (const at of held(0, 20)) memory = rampStep(memory, EAST, at, FLAGS).memory
  // Overshot: Left straight after, held. An ordinary new press, then an ordinary run.
  assert.deepEqual(kinds(WEST, held(1000, 2, FLAGS.holdWindowMs), FLAGS, memory), ["tap 1", "hold 2", "hold 2"])
  // Tab and back, fast enough that the arrow would still have been part of the run.
  const side = exploring()
  timed(side, held(0, 12).map((at) => [RIGHT, at] as const))
  assert.equal(side.build.moveKind, "fast")
  const x = side.build.state.cursor.x
  timed(side, [[TAB, 800], [TAB, 810], [RIGHT, 820]])
  assert.equal(side.build.state.cursor.x, x + 1)
  assert.equal(side.build.moveKind, "tap")
})

test("the hold window is live: retuned, the same presses are a run, or taps", () => {
  // Presses 250 ms apart, inside the 350 ms hold window: a tap, then a run from t = 250 at the hold step,
  // sped up to the fast step once it is 200 ms old.
  const presses = [[RIGHT, 0], [RIGHT, 250], [RIGHT, 500], [RIGHT, 750]] as const
  const run = exploring()
  timed(run, presses)
  assert.equal(run.build.state.cursor.x, 18 + 1 + 2 + 4 + 4)
  // The window narrowed to 150 ms — a keyboard with a quick repeat — and the same presses are four taps.
  const tuned = exploring()
  tuned.build.dispatch({ kind: "experiment-adjust", field: "holdWindowMs", step: -1 }) // 250
  tuned.build.dispatch({ kind: "experiment-adjust", field: "holdWindowMs", step: -1 }) // 150
  assert.equal(tuned.build.state.experiments.holdWindowMs, 150)
  timed(tuned, presses)
  assert.equal(tuned.build.state.cursor.x, 18 + 4)
})

test("Shift+Arrow jumps ten tiles; held, it jumps again at most once per jump repeat", () => {
  const side = exploring(spikeContext(), { x: 0, y: 13 })
  timed(side, [[SHIFT_RIGHT, 0]])
  assert.equal(side.build.state.cursor.x, 10)
  assert.equal(side.build.moveKind, "jump")
  // Held: the first press, the repeat delay, then repeats 30 ms apart. Only those at least 100 ms
  // after the last jump move: 0, 400, 520, 640.
  const times = held(0, 11)
  const got = kinds(JUMP_EAST, times)
  assert.deepEqual(
    got.filter((step) => step !== "jump 0"),
    ["jump 10", "jump 10", "jump 10", "jump 10"],
  )
  const heldSide = exploring(spikeContext(), { x: 0, y: 13 })
  timed(heldSide, times.map((at) => [SHIFT_RIGHT, at] as const))
  assert.equal(heldSide.build.state.cursor.x, 40)
  // With no repeat limit, every repeat would jump: the limit is what drops them.
  assert.ok(kinds(JUMP_EAST, times, { ...FLAGS, jumpRepeatMs: 0 }).every((step) => step === "jump 10"))
  // A plain arrow straight after a jump is a tap of its own, not part of a run.
  const memory = rampStep(null, JUMP_EAST, 0, FLAGS).memory
  assert.deepEqual(kinds(EAST, [50, 80], FLAGS, memory), ["tap 1", "hold 2"])
})

test("without a clock every arrow is a tap and every Shift+Arrow one jump: driver scripts and scripted playtests are unchanged", () => {
  const side = exploring()
  for (let step = 0; step < 10; step += 1) side.build.handleData(RIGHT, side.layout)
  assert.equal(side.build.state.cursor.x, 28)
  const jumps = exploring(spikeContext(), { x: 0, y: 13 })
  for (let step = 0; step < 3; step += 1) jumps.build.handleData(SHIFT_RIGHT, jumps.layout)
  assert.equal(jumps.build.state.cursor.x, 30)
  // A playtest's untimed steps are a second apart; `~ms` makes them a hold.
  const untimed = runBuildPlaytest({ steps: parseKeyScript("e Right*10") })
  // Where Explore Map put the cursor: clear ground beside the Nexus (feedback F66).
  const start = untimed.frames[1]?.state.cursor.x ?? 0
  assert.equal(untimed.frames.at(-1)?.state.cursor.x, start + 10)
  const holding = runBuildPlaytest({ steps: parseKeyScript("e Right Right~400 Right~30*10") })
  assert.ok((holding.frames.at(-1)?.state.cursor.x ?? 0) > start + 10 + 10, "a timed hold in a script did not speed up")
})

// --- The scroll margin, as a share of the view -----------------------------------------------------

test("the margin is a share of the view's own width and height, never so wide the two sides meet", () => {
  assert.deepEqual(marginForView(20, { width: 48, height: 16 }), { x: 10, y: 3 })
  assert.deepEqual(marginForView(20, { width: 72, height: 24 }), { x: 14, y: 5 })
  // The owner's 30% (his settings export, 2026-09-30) of the 49 x 18 view at 80 x 24.
  assert.equal(TUNING.scrollMargin, 30)
  assert.deepEqual(marginForView(30, { width: 49, height: 18 }), { x: 15, y: 5 })
  assert.equal(shareOfSpan(0, 48), 0)
  assert.equal(shareOfSpan(90, 16), 7, "a margin past the middle is capped")
  // The camera follows at that distance: walking east, it first moves with the cursor 15 tiles from
  // the view's east edge.
  const side = exploring(spikeContext(), { x: 0, y: 0 })
  assert.equal(side.layout.viewport.width, 49)
  while (side.build.state.camera.x === 0) side.build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.equal(side.layout.viewport.width - 1 - (side.build.state.cursor.x - side.build.state.camera.x), 15)
})

// --- Clicks and the view ---------------------------------------------------------------------------

function clickTile(side: Side, tile: { x: number; y: number }): void {
  const cell = cellForTile(side.layout, side.build.state.camera, tile)
  side.build.handleData(formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1), side.layout)
}

test("exploring, a click near an edge scrolls further the nearer the edge it lands (feedback F6)", () => {
  const moveFor = (column: number): number => {
    const side = exploring(spikeContext(), { x: 40, y: 20 })
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
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  const camera = side.build.state.camera
  const tile = { x: camera.x + width - 1, y: camera.y + 8 }
  clickTile(side, tile)
  assert.equal(tile.x - side.build.state.camera.x, Math.floor((width - 1) / 2))
  // Pure: west and north work the same way, and the zone is a share of the view.
  const view = { width: 48, height: 16 }
  const grid = spikeContext().grid
  assert.ok(edgeClickCamera({ x: 30, y: 10 }, { x: 30, y: 10 }, view, grid, 33).x < 30)
  assert.ok(edgeClickCamera({ x: 30, y: 10 }, { x: 40, y: 10 }, view, grid, 33).y < 10)
  // The zone the game uses: the owner's 25% of the view (his settings export, 2026-09-30).
  assert.equal(TUNING.clickZone, 25)
})

test("armed, a click scrolls like an exploring one, and a quick double click places where the first pointed (F22)", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  side.build.handleData("1", side.layout)
  const camera = side.build.state.camera
  const tile = { x: camera.x + 46, y: camera.y + 8 }
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
  const reference = exploring(spikeContext(), { x: 40, y: 20 })
  reference.build.handleData("1", reference.layout)
  reference.build.handleData(click, reference.layout, { now: 1000 })
  reference.build.dispatch({ kind: "place" })
  assert.deepEqual(side.build.state.planned, reference.build.state.planned)
})

test("a double click on the ghost's own tile places once and leaves the keyboard where the arming began", () => {
  // Armed from the menu by a click on its row; the ghost sits at the cursor, so the first half of a
  // double click on it places by the second-click rule. The second half has nothing left to do: it must
  // not take the keyboard to the map, nor lapse the placement's answer.
  const side = exploring(spikeContext(), { x: 40, y: 20 })
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

test("a slow second click on a scrolled spot is a fresh first click, not a place on the wrong tile (F22)", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  side.build.handleData("1", side.layout)
  const camera = side.build.state.camera
  const tile = { x: camera.x + 46, y: camera.y + 8 }
  const cell = cellForTile(side.layout, camera, tile)
  const click = formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1)
  side.build.handleData(click, side.layout, { now: 1000 })
  side.build.handleData(click, side.layout, { now: 1000 + TUNING.doubleClickMs + 1 })
  assert.equal(side.build.state.planned.length, 0)
  assert.notDeepEqual(side.build.state.cursor, tile)
})

test("the fast move drags the view at the margin like any other move; it does not re-centre", () => {
  // The owner turned "Shift centres" off in his settings export (2026-09-30), and the Experiment went.
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  side.build.handleData(SHIFT_RIGHT, side.layout)
  // Only dragged along: the cursor sits on the margin's inner edge, 15 tiles from the east side of the
  // 49-tile view.
  const margin = marginForView(TUNING.scrollMargin, side.layout.viewport).x
  assert.equal(margin, 15)
  assert.equal(side.build.state.cursor.x - side.build.state.camera.x, 49 - 1 - margin)
})

test("a click during a slide lands on the tile drawn under the pointer, not the one the view is heading to", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  const drawn = side.build.state.camera
  side.build.handleData(SHIFT_RIGHT, side.layout) // the view heads east; say it has not moved yet
  assert.notDeepEqual(side.build.state.camera, drawn)
  const cell = cellForTile(side.layout, drawn, { x: 45, y: 22 })
  side.build.handleData(formatMouseEvent(MOUSE_LEFT, cell.x + 1, cell.y + 1), side.layout, { now: 10, camera: drawn })
  assert.deepEqual(side.build.state.cursor, { x: 45, y: 22 })
})

// --- The sliding view, the gliding cursor and the frame timer ----------------------------------------------------------

test("the view slides to a new camera over the ease time, whole tiles at a time, and then stops", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
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
  const jump = exploring(spikeContext(), { x: 40, y: 20 })
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
  const side = exploring(spikeContext(), { x: 0, y: 20 })
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
  const side = exploring(spikeContext(), { x: 20, y: 20 })
  const animation = new BuildAnimation()
  const from = side.build.state.cursor
  const camera = side.build.state.camera
  animation.frame(side.build.state, 0)
  side.build.handleData(`${ESC}[1;2D`, side.layout) // Shift+Left: a jump west
  const to = side.build.state.cursor
  assert.equal(to.x, from.x - TUNING.jumpStep, "the state holds the destination at once")
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
  side.build.handleData(`${ESC}[1;2C`, side.layout)
  const back = animation.frame(side.build.state, 2000)
  assert.deepEqual(back.cursor, to)
  side.build.handleData(`${ESC}[1;2C`, side.layout)
  const drawn = animation.frame(side.build.state, 2000 + glide / 2).cursor
  side.build.handleData(`${ESC}[1;2C`, side.layout)
  assert.deepEqual(animation.frame(side.build.state, 2000 + glide / 2).cursor, drawn, "a retarget jumped")
})

test("when the camera moves, the cursor rides along with the slide and never leaves the view", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
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
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  const animation = new BuildAnimation()
  const reduced = { reducedMotion: true }
  animation.frame(side.build.state, 0, reduced)
  side.build.handleData(SHIFT_RIGHT, side.layout)
  side.build.handleData(`${ESC}[1;2B`, side.layout)
  assert.deepEqual(animation.frame(side.build.state, 1, reduced), {
    camera: side.build.state.camera,
    cursor: side.build.state.cursor,
    busyUntil: null,
  })
})

test("a gliding cursor is drawn where it is, and the armed preview travels with it", () => {
  const side = exploring(spikeContext(), { x: 20, y: 20 })
  side.build.handleData("1", side.layout)
  const { context, layout } = side
  const state = side.build.state
  assert.equal(state.armed, 0)
  const drawn = { x: state.cursor.x - 5, y: state.cursor.y }
  const gliding = composeBuildFrame({ context, state, layout, cursor: drawn }, "monochrome")
  const stillFrame = composeBuildFrame({ context, state, layout }, "monochrome")
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
  side.build.dispatch({ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }) // rock
  side.build.handleData("\r", side.layout)
  assert.equal(side.build.state.refusedTry?.seq, 1)
  const animation = new BuildAnimation()
  const first = animation.frame(side.build.state, 0)
  assert.equal(first.refusedFlash, true)
  assert.equal(first.busyUntil, TUNING.refusedCursorMs)
  assert.equal(animation.frame(side.build.state, TUNING.refusedCursorMs).refusedFlash, undefined)
  // Drawn as a solid block, in monochrome too.
  const frame = composeBuildFrame(
    { context: side.context, state: side.build.state, layout: side.layout, refusedFlash: true },
    "monochrome",
  )
  const plain = composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout }, "monochrome")
  const cell = cellForTile(side.layout, side.build.state.camera, { x: side.build.state.cursor.x + 1, y: side.build.state.cursor.y })
  assert.equal(cellAt(frame, cell.x, cell.y).style.inverse, true)
  assert.notEqual(cellAt(plain, cell.x, cell.y).style.inverse, true)
  // A second refusal flashes again; moving away ends it at once.
  side.build.handleData("\r", side.layout)
  assert.equal(animation.frame(side.build.state, 1000).refusedFlash, true)
  side.build.handleData(RIGHT, side.layout)
  assert.equal(animation.frame(side.build.state, 1001).refusedFlash, undefined)
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

test("the live screen redraws on a timer while the view slides, and not at all once it is still", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runSpike({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })
  await wait(40)
  // Explore Map begun on the map (Tab, then `e`): the row's flash, and no focus arrow or cursor blink,
  // which only a menu row handing the keyboard to the map plays (feedback F54).
  stdin.emit("data", Buffer.from("\t"))
  stdin.emit("data", Buffer.from("e"))
  await wait(250) // the Explore row's flash has come and gone
  const idle = stdout.frames
  await wait(120)
  assert.equal(stdout.frames, idle, "an idle screen kept redrawing")
  stdin.emit("data", Buffer.from(`${ESC}[1;2C`)) // Shift+Right twice: the view slides east
  stdin.emit("data", Buffer.from(`${ESC}[1;2C`))
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

test("keys and the untimed arrows the web page and scripts send still land on the same state", () => {
  const byKeys = exploring()
  for (const key of [RIGHT, RIGHT, DOWN, LEFT, UP]) byKeys.build.handleData(key, byKeys.layout)
  const byTimedTaps = exploring()
  timed(byTimedTaps, [[RIGHT, 0], [RIGHT, 1000], [DOWN, 2000], [LEFT, 3000], [UP, 4000]])
  assert.deepEqual(byTimedTaps.build.state, byKeys.build.state)
  assert.equal(frameToText(composeBuildFrame({ context: byKeys.context, state: byKeys.build.state, layout: byKeys.layout }, "monochrome")),
    frameToText(composeBuildFrame({ context: byTimedTaps.context, state: byTimedTaps.build.state, layout: byTimedTaps.layout }, "monochrome")))
})
