// Gate 5H: movement feel. The held-key speed ramp, the share-of-view scroll margin, clicks that scroll
// (or, armed, do not), recentring, the sliding view, the refused-placement flash, the lone-Esc
// timeout and the frame timer. Every timing claim is made against an injected clock — a number — so
// nothing here waits, except the one lifecycle test of the frame timer itself, which has to.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { centreOn, edgeClickCamera, marginForView, shareOfSpan } from "../src/build/camera.ts"
import { DEFAULT_MOVEMENT, initialDebugFlags } from "../src/build/debug.ts"
import type { DebugFlags } from "../src/build/debug.ts"
import { buildLayout, cellForTile } from "../src/build/layout.ts"
import { rampStep } from "../src/build/motion.ts"
import type { RampMemory, SpeedTier } from "../src/build/motion.ts"
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
const FLAGS: DebugFlags = initialDebugFlags({})

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

function tiers(key: { dx: number; dy: number; fast: boolean }, times: readonly number[], flags = FLAGS, from: RampMemory | null = null): SpeedTier[] {
  let memory = from
  return times.map((at) => {
    const step = rampStep(memory, key, at, flags)
    memory = step.memory
    return step.tier
  })
}

const EAST = { dx: 1, dy: 0, fast: false }
const WEST = { dx: -1, dy: 0, fast: false }

// --- The speed ramp --------------------------------------------------------------------------------

test("a tap moves one tile; a held arrow goes normal, then fast once held for the ramp time", () => {
  assert.deepEqual(tiers(EAST, [0]), ["slow"])
  // The first press, the terminal's repeat delay, then repeats 30 ms apart: the press and the first
  // repeat are single steps, then the hold is normal until held for 300 ms, then fast.
  const times = held(0, 16)
  const got = tiers(EAST, times)
  assert.deepEqual(got.slice(0, 3), ["slow", "slow", "normal"])
  assert.ok(got.includes("fast"), "never reached the fast step")
  const firstFast = got.indexOf("fast")
  assert.ok((times[firstFast] as number) - (times[2] as number) >= FLAGS.rampMs - 30, "fast came before the ramp time")
  // Deliberate taps, a fifth of a second apart, never speed up.
  assert.deepEqual(tiers(EAST, [0, 200, 400, 600, 800]), ["slow", "slow", "slow", "slow", "slow"])
})

test("the tiers are the owner's numbers — 1, 2, 4, 8 — and every one of them is a Debug Mode flag", () => {
  assert.deepEqual(
    [DEFAULT_MOVEMENT.slowStep, DEFAULT_MOVEMENT.normalStep, DEFAULT_MOVEMENT.fastStep, DEFAULT_MOVEMENT.fasterStep],
    [1, 2, 4, 8],
  )
  const side = exploring()
  timed(side, held(0, 30).map((at) => [RIGHT, at] as const))
  // 1 + 1 + (normal 2 until 300 ms into the hold) + fast 4 after it.
  const moved = side.build.state.cursor.x - 18
  assert.ok(moved > 30 * 2, `a one-second hold moved only ${moved} tiles`)

  const tuned = exploring()
  tuned.build.dispatch({ kind: "debug-adjust", field: "normalStep", step: 1 }) // 3
  tuned.build.dispatch({ kind: "debug-adjust", field: "rampMs", step: 1 }) // 500
  timed(tuned, [[RIGHT, 0], [RIGHT, 400], [RIGHT, 430]])
  assert.equal(tuned.build.state.cursor.x, 18 + 1 + 1 + 3)
})

test("Shift is the faster step at once, and letting go of Shift mid-hold keeps the pace the hold reached", () => {
  const side = exploring()
  timed(side, [[SHIFT_RIGHT, 0]])
  assert.equal(side.build.state.cursor.x, 18 + 8)
  assert.equal(side.build.speedTier, "faster")
  const fastHold = tiers({ dx: 1, dy: 0, fast: true }, [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330])
  assert.ok(fastHold.every((tier) => tier === "faster"))
  let memory: RampMemory | null = null
  for (const at of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
    memory = rampStep(memory, { dx: 1, dy: 0, fast: true }, at, FLAGS).memory
  }
  assert.deepEqual(tiers(EAST, [360], FLAGS, memory), ["fast"])
})

test("a change of direction drops to slow for precise pointing, until the arrow is let go", () => {
  let memory: RampMemory | null = null
  for (const at of held(0, 20)) memory = rampStep(memory, EAST, at, FLAGS).memory
  // Overshot: Left, held, straight after. Every step of it is one tile, through the repeat delay too.
  const correction = held(1100, 20)
  const back = tiers(WEST, correction, FLAGS, memory)
  assert.ok(back.every((tier) => tier === "slow"), `after a turn: ${back.join(" ")}`)
  // Let go, and hold Left again: back to normal.
  let after: RampMemory | null = memory
  for (const at of correction) after = rampStep(after, WEST, at, FLAGS).memory
  const again = tiers(WEST, held(3000, 5), FLAGS, after)
  assert.deepEqual(again.slice(0, 3), ["slow", "slow", "normal"])
  // With the flag off, a turn is an ordinary hold.
  const off = { ...FLAGS, slowAfterTurn: false }
  assert.deepEqual(tiers(WEST, held(1100, 3), off, memory).slice(0, 3), ["slow", "slow", "normal"])
})

test("anything else pressed starts the next arrow from scratch", () => {
  const side = exploring()
  timed(side, held(0, 12).map((at) => [RIGHT, at] as const))
  assert.notEqual(side.build.speedTier, "slow")
  const x = side.build.state.cursor.x
  // Tab and back, fast enough that the arrow would still have been part of the hold.
  timed(side, [[TAB, 800], [TAB, 810], [RIGHT, 820]])
  assert.equal(side.build.state.cursor.x, x + 1)
  assert.equal(side.build.speedTier, "slow")
})

test("without a clock every arrow is a tap: driver scripts and scripted playtests are unchanged", () => {
  const side = exploring()
  for (let step = 0; step < 10; step += 1) side.build.handleData(RIGHT, side.layout)
  assert.equal(side.build.state.cursor.x, 28)
  // A playtest's untimed steps are a second apart; `~ms` makes them a hold.
  const untimed = runBuildPlaytest({ steps: parseKeyScript("e Right*10") })
  assert.equal(untimed.frames.at(-1)?.state.cursor.x, 28)
  const holding = runBuildPlaytest({ steps: parseKeyScript("e Right Right~400 Right~30*10") })
  assert.ok((holding.frames.at(-1)?.state.cursor.x ?? 0) > 28 + 10, "a timed hold in a script did not speed up")
})

// --- The scroll margin, as a share of the view -----------------------------------------------------

test("the margin is a share of the view's own width and height, never so wide the two sides meet", () => {
  assert.deepEqual(marginForView(20, { width: 48, height: 16 }), { x: 10, y: 3 })
  assert.deepEqual(marginForView(20, { width: 72, height: 24 }), { x: 14, y: 5 })
  assert.equal(shareOfSpan(0, 48), 0)
  assert.equal(shareOfSpan(90, 16), 7, "a margin past the middle is capped")
  // The camera follows at that distance: walking east, it first moves with the cursor 10 tiles from
  // the view's east edge.
  const side = exploring(spikeContext(), { x: 0, y: 0 })
  while (side.build.state.camera.x === 0) side.build.dispatch({ kind: "move-cursor", dx: 1, dy: 0 })
  assert.equal(side.layout.viewport.width - 1 - (side.build.state.cursor.x - side.build.state.camera.x), 10)
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
  const width = 48
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
  // Pure: west and north work the same way, and the zone is a Debug Mode share of the view.
  const view = { width: 48, height: 16 }
  const grid = spikeContext().grid
  assert.ok(edgeClickCamera({ x: 30, y: 10 }, { x: 30, y: 10 }, view, grid, 33).x < 30)
  assert.ok(edgeClickCamera({ x: 30, y: 10 }, { x: 40, y: 10 }, view, grid, 33).y < 10)
})

test("exploring, 'centres' centres every click, and 'margin' is the old follow-only behaviour", () => {
  const centres = exploring(spikeContext(), { x: 40, y: 20 })
  centres.build.dispatch({ kind: "debug-adjust", field: "clickScroll", step: 1 })
  assert.equal(centres.build.state.debug.clickScroll, "centre")
  const camera = centres.build.state.camera
  clickTile(centres, { x: camera.x + 30, y: camera.y + 5 })
  assert.deepEqual(centres.build.state.camera, centreOn(camera, centres.build.state.cursor, centres.layout.viewport, centres.context.grid))

  const margin = exploring(spikeContext(), { x: 40, y: 20 })
  margin.build.dispatch({ kind: "debug-adjust", field: "clickScroll", step: -1 })
  assert.equal(margin.build.state.debug.clickScroll, "margin")
  const before = margin.build.state.camera
  clickTile(margin, { x: before.x + 42, y: before.y + 8 })
  assert.equal(margin.build.state.camera.x - before.x, 42 - (48 - 1 - 10), "follow-only moves just enough for the margin")
})

test("armed, a click never scrolls the view, whatever the explore setting (Q58)", () => {
  for (const mode of [0, 1, 2]) {
    const side = exploring(spikeContext(), { x: 40, y: 20 })
    for (let step = 0; step < mode; step += 1) side.build.dispatch({ kind: "debug-adjust", field: "clickScroll", step: 1 })
    side.build.handleData("1", side.layout)
    const camera = side.build.state.camera
    const tile = { x: camera.x + 46, y: camera.y + 1 }
    clickTile(side, tile)
    assert.deepEqual(side.build.state.camera, camera)
    clickTile(side, tile)
    assert.equal(side.build.state.planned.length, 1, "the second click on the same spot did not place")
  }
})

test("the fast move recentres the view on the cursor along the axis it moved; off, it only follows", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  side.build.handleData(SHIFT_RIGHT, side.layout)
  const { cursor, camera } = side.build.state
  assert.equal(cursor.x - camera.x, Math.floor((48 - 1) / 2))
  const off = exploring(spikeContext(), { x: 40, y: 20 })
  off.build.dispatch({ kind: "debug-adjust", field: "fastRecentres", step: 1 })
  off.build.handleData(SHIFT_RIGHT, off.layout)
  // Only dragged along: the cursor sits on the margin's inner edge, 10 tiles from the east side.
  assert.equal(off.build.state.cursor.x - off.build.state.camera.x, 48 - 1 - 10)
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

// --- The sliding view and the frame timer ----------------------------------------------------------

test("the view slides to a new camera over the ease time, whole tiles at a time, and then stops", () => {
  const side = exploring(spikeContext(), { x: 40, y: 20 })
  const animation = new BuildAnimation()
  const start = side.build.state.camera
  assert.deepEqual(animation.frame(side.build.state, 0), { camera: start, busyUntil: null })
  side.build.handleData(SHIFT_RIGHT, side.layout)
  const target = side.build.state.camera
  const ease = side.build.state.debug.easeMs
  const at = (now: number) => animation.frame(side.build.state, now)
  assert.deepEqual(at(1000).camera, start, "the slide starts from where the view was drawn")
  assert.equal(at(1000).busyUntil, 1000 + ease)
  const middle = at(1000 + ease / 2).camera
  assert.ok(middle.x > start.x && middle.x < target.x, `half way: ${middle.x} between ${start.x} and ${target.x}`)
  assert.ok(Number.isInteger(middle.x))
  const end = at(1000 + ease)
  assert.deepEqual(end.camera, target)
  assert.equal(end.busyUntil, null, "still busy after the slide ended")
  // Off: a jump, and nothing to animate.
  const jump = exploring(spikeContext(), { x: 40, y: 20 })
  jump.build.dispatch({ kind: "debug-adjust", field: "easeMs", step: -1 })
  jump.build.dispatch({ kind: "debug-adjust", field: "easeMs", step: -1 })
  jump.build.dispatch({ kind: "debug-adjust", field: "easeMs", step: -1 })
  assert.equal(jump.build.state.debug.easeMs, 0)
  const still = new BuildAnimation()
  still.frame(jump.build.state, 0)
  jump.build.handleData(SHIFT_RIGHT, jump.layout)
  assert.deepEqual(still.frame(jump.build.state, 1), { camera: jump.build.state.camera, busyUntil: null })
})

test("the frame timer asks for a frame only while something animates", () => {
  assert.equal(nextFrameDelay(null, 0), null)
  assert.equal(nextFrameDelay(1000, 0), FRAME_MS)
  assert.equal(nextFrameDelay(1005, 1000), 5)
})

test("a refused placement flashes the footprint for the flag's time, and moving off it ends the flash", () => {
  const side = exploring()
  side.build.handleData("1", side.layout)
  side.build.dispatch({ kind: "move-cursor", dx: 8 - 18, dy: 5 - 13 }) // rock
  side.build.handleData("\r", side.layout)
  assert.equal(side.build.state.refusedTry?.seq, 1)
  const animation = new BuildAnimation()
  const first = animation.frame(side.build.state, 0)
  assert.equal(first.refusedFlash, true)
  assert.equal(first.busyUntil, DEFAULT_MOVEMENT.refusedCursorMs)
  assert.equal(animation.frame(side.build.state, DEFAULT_MOVEMENT.refusedCursorMs).refusedFlash, undefined)
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
  assert.equal(side.build.state.overlay, null, "Esc did not close Debug Mode")
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
  // late first tick can land after the 150 ms slide has already ended.
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
