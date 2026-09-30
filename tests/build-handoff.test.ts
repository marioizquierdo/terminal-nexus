// The focus arrow and the cursor's blink (owner, 2026-09-30, feedback F54): when a menu row hands the
// keyboard to the map, an arrow flies from where the row is on the menu (F63) to the cursor and the
// cursor then blinks in the menu's pressed look. The arrow is a building's; Explore Map's row sends a
// see-through cursor on the same timeline instead (F64, `tests/build-menu-round-2.test.ts`). The timeline is the live loop's (`BuildAnimation`, driven here with a clock
// the test holds); the drawing is the view's (`composeBuildFrame`, given an instant); the reducer only
// records the hand-off. The arrow's length is an Experiment and round-trips through the settings export;
// the blink count and its speed (the pressed flash's) are tuned values since the owner settled them
// (2026-09-30).

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { EXPERIMENT_FIELDS, defaultExperiments } from "../src/build/experiments.ts"
import type { Experiments } from "../src/build/experiments.ts"
import { TUNING } from "../src/build/tuning.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { buildLayout, cellForTile, menuEntryRow, tileAtCell } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext } from "../src/build/state.ts"
import { structureAtTile } from "../src/build/state.ts"
import { formatSettingsExport, parseSettingsExport } from "../src/build/settings-export.ts"
import { runSpike, spikeContext } from "../src/cli/spike.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { BuildCompositionInput } from "../src/view/build.ts"
import { BuildAnimation, handoffAt, handoffSchedule } from "../src/view/build-live.ts"
import type { HandoffTiming } from "../src/view/build-live.ts"
import { cellAt } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"

const ESC = String.fromCharCode(27)
const DOWN = `${ESC}[B`
const TAB = "\t"
const ENTER = "\r"
const MINIMUM = { columns: 80, rows: 24 }
/** The hand-off as the game times it: the focus arrow's default, the tuned pressed flash and blinks. */
const FLAGS: HandoffTiming = {
  focusArrowMs: defaultExperiments().focusArrowMs,
  pressedFlashMs: TUNING.pressedFlashMs,
  cursorBlinks: TUNING.cursorBlinks,
}
/** The Turret: one tile, so arming it keeps the cursor where each test puts it, and its row on the
 *  menu is where its arrow leaves from (F63). */
const TURRET = "3"
const turretRow = (layout: BuildLayout): number => menuEntryRow(layout, spikeContext().catalog, { kind: "construct", index: 2 }) as number

type Side = { build: BuildSession; layout: BuildLayout; context: BuildContext }

function session(context: BuildContext = spikeContext(), cursor = { x: 18, y: 13 }, terminal = MINIMUM): Side {
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor, viewport: layout.viewport })
  return { build, layout, context }
}

function keys(side: Side, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function setFlag<F extends "focusArrowMs">(side: Side, field: F, value: number): void {
  for (let guard = 0; guard < 20 && side.build.state.experiments[field] !== value; guard += 1) {
    side.build.dispatch({ kind: "experiment-adjust", field, step: side.build.state.experiments[field] > value ? -1 : 1 })
  }
  assert.equal(side.build.state.experiments[field], value)
}

function compose(side: Side, extra: Partial<BuildCompositionInput> = {}, glyphPack: "ascii" | "unicode" = "ascii"): ReadonlyCellFrame {
  return composeBuildFrame({ context: side.context, state: side.build.state, layout: side.layout, glyphPack, ...extra }, "monochrome")
}

/** The cells a frame with the arrow has that the same frame without it does not. */
function arrowCells(side: Side, progress: number, glyphPack: "ascii" | "unicode" = "ascii", cursor?: { x: number; y: number }) {
  const extra = cursor === undefined ? {} : { cursor }
  const plain = compose(side, extra, glyphPack)
  const flying = compose(side, { ...extra, handoffFlight: { progress } }, glyphPack)
  const changed: { x: number; y: number; glyph: string; plainGlyph: string; bold: boolean; dim: boolean }[] = []
  for (let y = 0; y < flying.height; y += 1) {
    for (let x = 0; x < flying.width; x += 1) {
      const a = cellAt(flying, x, y)
      const b = cellAt(plain, x, y)
      if (a.glyph !== b.glyph || JSON.stringify(a.style) !== JSON.stringify(b.style)) {
        changed.push({ x, y, glyph: a.glyph, plainGlyph: b.glyph, bold: a.style.bold === true, dim: a.style.dim === true })
      }
    }
  }
  return changed
}

// --- The timeline -----------------------------------------------------------------------------------

test("the arrow flies for its time, then the cursor blinks on and off at the pressed flash's speed, then nothing", () => {
  assert.equal(FLAGS.focusArrowMs, 180)
  assert.equal(FLAGS.cursorBlinks, 2)
  const schedule = handoffSchedule(FLAGS, false)
  const pulse = FLAGS.pressedFlashMs
  assert.deepEqual(schedule, { flightMs: 180, pulseMs: pulse, blinks: 2, endMs: 180 + 3 * pulse })
  assert.deepEqual(handoffAt(schedule, 0), { flight: 0, blink: false })
  assert.deepEqual(handoffAt(schedule, 90), { flight: 0.5, blink: false })
  assert.deepEqual(handoffAt(schedule, 180), { flight: null, blink: true }, "the first blink starts as the arrow lands")
  assert.deepEqual(handoffAt(schedule, 180 + pulse - 1), { flight: null, blink: true })
  assert.deepEqual(handoffAt(schedule, 180 + pulse), { flight: null, blink: false }, "no gap between blinks")
  assert.deepEqual(handoffAt(schedule, 180 + 2 * pulse), { flight: null, blink: true }, "no second blink")
  assert.deepEqual(handoffAt(schedule, schedule.endMs - 1), { flight: null, blink: true })
  assert.deepEqual(handoffAt(schedule, schedule.endMs), { flight: null, blink: false })
  assert.deepEqual(handoffAt(schedule, -1), { flight: null, blink: false })
})

test("reduced motion, the arrow off, no blinks, or a pressed flash of zero each drop their part", () => {
  const pulse = FLAGS.pressedFlashMs
  // Reduced motion: no arrow, and the blink plays at once.
  const reduced = handoffSchedule(FLAGS, true)
  assert.equal(reduced.flightMs, 0)
  assert.deepEqual(handoffAt(reduced, 0), { flight: null, blink: true })
  // The arrow off: the blink at once.
  const noArrow = handoffSchedule({ ...FLAGS, focusArrowMs: 0 }, false)
  assert.deepEqual(handoffAt(noArrow, 0), { flight: null, blink: true })
  assert.equal(noArrow.endMs, 3 * pulse)
  // No blinks: the arrow, then nothing.
  const noBlink = handoffSchedule({ ...FLAGS, cursorBlinks: 0 }, false)
  assert.equal(noBlink.endMs, 180)
  assert.deepEqual(handoffAt(noBlink, 180), { flight: null, blink: false })
  // Three blinks: five phases after the arrow.
  assert.equal(handoffSchedule({ ...FLAGS, cursorBlinks: 3 }, false).endMs, 180 + 5 * pulse)
  // A pressed flash of zero has no speed to blink at.
  assert.equal(handoffSchedule({ ...FLAGS, pressedFlashMs: 0 }, false).blinks, 0)
  // Both off: nothing at all.
  assert.equal(handoffSchedule({ ...FLAGS, focusArrowMs: 0, cursorBlinks: 0 }, false).endMs, 0)
})

test("the live loop plays it from the frame that first sees the hand-off, and keeps the frame timer running until it ends", () => {
  const side = session()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, "e") // Explore Map, from the menu
  const end = 1000 + handoffSchedule({ ...FLAGS, focusArrowMs: side.build.state.experiments.focusArrowMs }, false).endMs
  const at = (now: number) => animation.frame(side.build.state, now)
  const first = at(1000)
  assert.deepEqual(first.handoffFlight, { progress: 0 })
  assert.equal(first.cursorBlink, undefined)
  assert.equal(first.busyUntil, end)
  assert.deepEqual(at(1090).handoffFlight, { progress: 0.5 })
  const landed = at(1200)
  assert.equal(landed.handoffFlight, undefined)
  assert.equal(landed.cursorBlink, true)
  const gap = at(1180 + FLAGS.pressedFlashMs + 10)
  assert.equal(gap.cursorBlink, undefined)
  assert.equal(gap.busyUntil, end)
  const over = at(end)
  assert.equal(over.handoffFlight, undefined)
  assert.equal(over.cursorBlink, undefined)
  assert.equal(over.busyUntil, null, "the frame timer kept running after the blink")
})

test("the keys work while it plays: the arrow keeps flying toward wherever the cursor now is", () => {
  const side = session()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, DOWN, DOWN, ENTER) // the Barracks, armed from the menu
  animation.frame(side.build.state, 1000)
  side.build.dispatch({ kind: "move-cursor", dx: 3, dy: 1 })
  const moving = animation.frame(side.build.state, 1060)
  assert.ok(moving.handoffFlight !== undefined, "moving the cursor stopped the arrow")
  // The arrow aims at the cursor as it is drawn: moved, the arrow's last cells move with it.
  const before = arrowCells(side, 0.9, "ascii", { x: side.build.state.cursor.x - 3, y: side.build.state.cursor.y - 1 })
  const after = arrowCells(side, 0.9)
  assert.notDeepEqual(before.map((cell) => [cell.x, cell.y]), after.map((cell) => [cell.x, cell.y]))
})

test("it stops for good when the keyboard leaves the map, a popup opens, or the plan is committed", () => {
  for (const [name, interrupt] of [
    ["Tab to the menu", (side: Side) => keys(side, TAB)],
    ["a popup", (side: Side) => keys(side, "n")],
    ["Esc back to the menu", (side: Side) => keys(side, ESC)],
  ] as const) {
    const side = session()
    const animation = new BuildAnimation()
    animation.frame(side.build.state, 0)
    keys(side, "e")
    assert.ok(animation.frame(side.build.state, 1000).handoffFlight !== undefined)
    interrupt(side)
    const stopped = animation.frame(side.build.state, 1050)
    assert.equal(stopped.handoffFlight, undefined, `${name}: the arrow kept flying`)
    assert.equal(stopped.cursorBlink, undefined, `${name}: the cursor blinked`)
    // Back on the map without a new hand-off (Tab, closing the popup): it does not pick up again.
    if (side.build.state.popup !== null) keys(side, ESC)
    if (side.build.state.focus === "menu") keys(side, TAB)
    const resumed = animation.frame(side.build.state, 1200)
    assert.equal(resumed.handoffFlight, undefined, `${name}: the arrow came back`)
    assert.equal(resumed.cursorBlink, undefined, `${name}: the blink came back`)
  }
  // Committed: no arrow over a Pulse.
  const side = session()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, "n", "1", "e")
  animation.frame(side.build.state, 1000)
  side.build.dispatch({ kind: "open-battle-round" })
  side.build.dispatch({ kind: "start-pulse" })
  assert.equal(side.build.state.committed, true)
  const committed = animation.frame(side.build.state, 1050)
  assert.equal(committed.handoffFlight, undefined)
  assert.equal(committed.cursorBlink, undefined)
})

test("under reduced motion, or with the arrow off, the blink plays at once; Tab alone plays nothing", () => {
  const side = session()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0, { reducedMotion: true })
  keys(side, "e")
  const reduced = animation.frame(side.build.state, 1000, { reducedMotion: true })
  assert.equal(reduced.handoffFlight, undefined)
  assert.equal(reduced.cursorBlink, true)

  const off = session()
  setFlag(off, "focusArrowMs", 0)
  const still = new BuildAnimation()
  still.frame(off.build.state, 0)
  keys(off, "e")
  assert.equal(still.frame(off.build.state, 1000).cursorBlink, true)

  const tab = session()
  const quiet = new BuildAnimation()
  quiet.frame(tab.build.state, 0)
  keys(tab, TAB)
  const frame = quiet.frame(tab.build.state, 1000)
  assert.equal(frame.handoffFlight, undefined)
  assert.equal(frame.cursorBlink, undefined)
})

// --- The drawing ------------------------------------------------------------------------------------

test("the arrow leaves from the cell right of its row on the menu, crosses the divider and stops one cell short of the cursor", () => {
  const side = session()
  keys(side, TURRET)
  const { layout } = side
  const start = { x: layout.dividerColumn, y: turretRow(layout) }
  const launch = arrowCells(side, 0)
  assert.deepEqual(launch.map((cell) => [cell.x, cell.y]), [[start.x, start.y]], "at 0 only the head, on the divider")
  assert.ok([">", "v"].includes(launch[0]?.glyph as string), `a head pointing right or down, not ${launch[0]?.glyph}`)
  assert.equal(launch[0]?.bold, true)
  const cursor = cellForTile(layout, side.build.state.camera, side.build.state.cursor)
  const landing = arrowCells(side, 0.999)
  const head = landing.find((cell) => cell.bold && [">", "<", "v", "^"].includes(cell.glyph))
  assert.ok(head !== undefined, "no head near the end")
  assert.ok(Math.max(Math.abs(head.x - cursor.x), Math.abs(head.y - cursor.y)) === 1, `the head at ${head.x},${head.y} is not beside the cursor at ${cursor.x},${cursor.y}`)
  assert.ok(!landing.some((cell) => cell.x === cursor.x && cell.y === cursor.y), "the arrow drew on the cursor's cell")
  // A trail behind the head, the older cells dim.
  assert.ok(landing.length >= 4, `a trail of ${landing.length - 1}`)
  assert.ok(landing.some((cell) => cell.dim), "no older, dimmer trail cells")
  // Every cell lies between the start and the cursor.
  for (const cell of landing) {
    assert.ok(cell.x >= start.x && cell.x <= cursor.x, `column ${cell.x} is outside the flight`)
    assert.ok(cell.y >= Math.min(start.y, cursor.y) && cell.y <= Math.max(start.y, cursor.y), `row ${cell.y} is outside the flight`)
  }
})

test("its glyphs follow the glyph pack and the way it flies", () => {
  // Mostly across and a little down from the header: a level trail, the head pointing right.
  const level = session(spikeContext(), { x: 40, y: 3 })
  keys(level, TURRET)
  const glyphs = new Set(arrowCells(level, 0.6).map((cell) => cell.glyph))
  assert.ok(glyphs.has(">") && glyphs.has("-"), `level flight drew ${[...glyphs].join(" ")}`)
  const unicode = new Set(arrowCells(level, 0.6, "unicode").map((cell) => cell.glyph))
  assert.ok(unicode.has("▶") && unicode.has("━"), `the Unicode pack drew ${[...unicode].join(" ")}`)
  // Steeply down, near the divider: an upright trail, the head pointing down.
  const steep = session(spikeContext(), { x: 1, y: 14 })
  keys(steep, TURRET)
  const down = new Set(arrowCells(steep, 0.6).map((cell) => cell.glyph))
  assert.ok(down.has("v") && down.has("|"), `steep flight drew ${[...down].join(" ")}`)
  // In between: a diagonal trail.
  const diagonal = session(spikeContext(), { x: 12, y: 14 })
  keys(diagonal, TURRET)
  const slant = new Set(arrowCells(diagonal, 0.7).map((cell) => cell.glyph))
  assert.ok(slant.has("\\"), `a diagonal flight drew ${[...slant].join(" ")}`)
})

test("over a building or the ghost being placed it changes only the style, never the glyph", () => {
  let restyled = 0
  // Cursors below and right of the Grid Nexus, so the flight crosses it for some of them.
  for (const y of [12, 13, 14, 15]) {
    for (let x = 19; x <= 40; x += 3) {
      const side = session(spikeContext(), { x, y })
      keys(side, TURRET)
      for (const progress of [0.3, 0.6, 0.95]) {
        for (const cell of arrowCells(side, progress)) {
          const tile = tileAtCell(side.layout, side.build.state.camera, cell.x, cell.y)
          if (tile === null || structureAtTile(side.context, side.build.state.planned, tile) === null) continue
          assert.equal(cell.glyph, cell.plainGlyph, `the arrow replaced a building's glyph at ${tile.x},${tile.y}`)
          restyled += 1
        }
      }
    }
  }
  assert.ok(restyled > 0, "no flight crossed a building: the test proves nothing")
  // The ghost of the building being placed keeps its glyphs too — flown at level, the arrow's last cells
  // are on the ghost's tiles left of the cursor.
  let ghost = 0
  for (const cursor of [{ x: 6, y: 1 }, { x: 24, y: 1 }, { x: 44, y: 1 }, { x: 6, y: 8 }]) {
    const armed = session(spikeContext(), cursor)
    keys(armed, DOWN, DOWN, ENTER)
    const plain = compose(armed)
    for (const cell of arrowCells(armed, 0.95)) {
      const under = cellAt(plain, cell.x, cell.y)
      if (under.style.fgRole !== "chrome.hotkey" || tileAtCell(armed.layout, armed.build.state.camera, cell.x, cell.y) === null) continue
      assert.equal(cell.glyph, under.glyph, "the arrow replaced a glyph of the ghost")
      ghost += 1
    }
  }
  assert.ok(ghost > 0, "the arrow never crossed the ghost")
})

test("no arrow with a popup open, on the menu, or once committed; still frames carry none", () => {
  const side = session()
  keys(side, TURRET)
  assert.ok(arrowCells(side, 0.5).length > 0)
  keys(side, "n") // a popup over the map
  assert.equal(arrowCells(side, 0.5).length, 0)
  const menu = session()
  assert.equal(arrowCells(menu, 0.5).length, 0)
})

test("the cursor blinks in the menu row's pressed look, and is the plain cursor between blinks", () => {
  const side = session()
  keys(side, "e")
  const cursor = cellForTile(side.layout, side.build.state.camera, side.build.state.cursor)
  const on = cellAt(compose(side, { cursorBlink: true }), cursor.x, cursor.y).style
  assert.deepEqual(
    { inverse: on.inverse, bold: on.bold, underline: on.underline, fgRole: on.fgRole },
    { inverse: true, bold: true, underline: true, fgRole: "chrome.hotkey" },
  )
  const off = cellAt(compose(side), cursor.x, cursor.y).style
  assert.notEqual(off.underline, true)
  assert.equal(off.fgRole, "chrome.title")
  assert.deepEqual(cellAt(compose(side, { cursorBlink: false }), cursor.x, cursor.y), cellAt(compose(side), cursor.x, cursor.y))
})

// --- The Experiments --------------------------------------------------------------------------------

test("Focus arrow is the first Experiment, and round-trips through the export; the settled blink count is skipped quietly", () => {
  assert.equal(EXPERIMENT_FIELDS[0]?.field, "focusArrowMs")
  assert.match(EXPERIMENT_FIELDS[0]?.question ?? "", /an arrow flies/)
  const experiments: Experiments = { ...defaultExperiments(), focusArrowMs: 350 }
  const text = formatSettingsExport({ settings: DEFAULT_SETTINGS, experiments })
  assert.match(text, /focusArrowMs = 350 {2}# Focus arrow, default 180 ms/)
  assert.doesNotMatch(text, /cursorBlinks/)
  const back = parseSettingsExport(text, { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  assert.equal(back.snapshot.experiments.focusArrowMs, 350)
  assert.deepEqual(back.ignored, [])
  // The popup's own words read back too; an export from before the blink count was settled names it,
  // and it is skipped without a word.
  const shown = parseSettingsExport("focusArrowMs=off cursorBlinks=3", { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  assert.equal(shown.snapshot.experiments.focusArrowMs, 0)
  assert.deepEqual(shown.ignored, [])
  assert.deepEqual(shown.settled, ["cursorBlinks"])
})

// --- The live screen --------------------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  lastWrite = ""
  write(text: string): boolean {
    if (text.includes("TERMINAL NEXUS")) this.lastWrite = text
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

/** The last frame written, as rows of text. */
function rowsOf(ansi: string): string[] {
  return ansi.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "").split("\r\n")
}

test("the live screen draws the arrow on its own clock, then the plain divider once it has landed", async () => {
  let t = 0
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runSpike({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome", glyphPack: "ascii" },
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
    now: () => t,
  })
  await wait(40)
  const layout = buildLayout(MINIMUM, spikeContext().grid)
  const start = { x: layout.dividerColumn, y: turretRow(layout) }
  const divider = rowsOf(stdout.lastWrite)[start.y]?.[start.x]
  stdin.emit("data", Buffer.from(TURRET))
  await wait(40)
  assert.equal(rowsOf(stdout.lastWrite)[start.y]?.[start.x], ">", "the arrow's head is not on the divider as it leaves")
  t = 1000 // long after it landed and the cursor blinked
  await wait(60)
  assert.equal(rowsOf(stdout.lastWrite)[start.y]?.[start.x], divider, "the arrow is still drawn after it landed")
  stdin.emit("data", Buffer.from([3]))
  await session
})
