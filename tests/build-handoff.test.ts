// Hand-offs to the map (docs/ui-patterns.md, "Hand-offs to the map"): when a menu row gives the keyboard
// to the map, something flies from where the row is on the menu to the cursor — a building sends the
// focus arrow, Explore Map the see-through cursor — and the cursor then blinks in the menu's pressed look.
// Where the cursor lands is the reducer's (Explore Map opened from the menu moves it onto clear ground);
// the reducer only records the hand-off; the timeline is the live loop's (`BuildAnimation`, driven here
// with a clock the test holds); the drawing is the view's (`composeBuildFrame`, given an instant). The
// flight's length is an Experiment and the blink's count and speed are tuned values, so every number
// here is read from them.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { SPIKE_START_CURSOR } from "../src/build/catalog.ts"
import { defaultExperiments } from "../src/build/experiments.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { CARD_HEADER_ROW, EXPLORE_ROW, buildLayout, cellForTile, menuEntryRow, tileAtCell } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { EXPLORE_ENTRY, ONE_TILE, armingSpot, entryOfConstruct, structureAtTile } from "../src/build/state.ts"
import type { MenuEntry } from "../src/build/types.ts"
import { TUNING } from "../src/build/tuning.ts"
import { runSpike, spikeContext } from "../src/cli/spike.ts"
import type { TerrainId } from "../src/grid/types.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { BuildCompositionInput } from "../src/view/build.ts"
import { SEE_THROUGH_TRAIL } from "../src/view/build.ts"
import { BuildAnimation, handoffAt, handoffSchedule } from "../src/view/build-live.ts"
import type { HandoffTiming } from "../src/view/build-live.ts"
import { cellAt } from "../src/view/frame.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import {
  DOWN,
  ENTER,
  ESC,
  MINIMUM,
  ROOMY,
  SPACE,
  TAB,
  buildSide,
  changedCells,
  clickCell,
  clickPanelRow,
  compose,
  keys,
  panelRow,
  screenText,
} from "./build-helpers.ts"
import type { ChangedCell, Side } from "./build-helpers.ts"

/** The hand-off as the game times it: the focus arrow's default, the tuned pressed flash and blinks. */
const TIMING: HandoffTiming = {
  focusArrowMs: defaultExperiments().focusArrowMs,
  pressedFlashMs: TUNING.pressedFlashMs,
  cursorBlinks: TUNING.cursorBlinks,
}
/** The Turret: one tile, so arming it keeps the cursor where each test puts it. */
const TURRET = "3"
const turretRow = (layout: BuildLayout): number => menuEntryRow(layout, spikeContext().catalog, { kind: "construct", index: 2 }) as number
/** The owner's opacity for the see-through cursor's head: "about 80% 'transparency'" (feedback F64). */
const HEAD_ALPHA = 0.8

/** What a frame with the flight `progress` of the way has that the same frame without it does not. */
function flight(side: Side, progress: number, extra: Partial<BuildCompositionInput> = {}, capability: CapabilityMode = "monochrome"): ChangedCell[] {
  return changedCells(compose(side, { ...extra, handoffFlight: { progress } }, capability), compose(side, extra, capability))
}

// --- The timeline -----------------------------------------------------------------------------------

test("the flight lasts its time, then the cursor blinks on and off at the pressed flash's speed, then nothing", () => {
  const { focusArrowMs: arrow, pressedFlashMs: pulse, cursorBlinks: blinks } = TIMING
  assert.ok(arrow > 0 && pulse > 0 && blinks > 0, "nothing flies or blinks: the test proves nothing")
  const schedule = handoffSchedule(TIMING, false)
  assert.deepEqual(schedule, { flightMs: arrow, pulseMs: pulse, blinks, endMs: arrow + (2 * blinks - 1) * pulse })
  assert.deepEqual(handoffAt(schedule, 0), { flight: 0, blink: false })
  assert.deepEqual(handoffAt(schedule, arrow / 2), { flight: 0.5, blink: false })
  for (let blink = 0; blink < blinks; blink += 1) {
    const on = arrow + 2 * blink * pulse // the first as the flight lands
    assert.deepEqual(handoffAt(schedule, on), { flight: null, blink: true }, `blink ${blink + 1} does not start at ${on} ms`)
    assert.deepEqual(handoffAt(schedule, on + pulse - 1), { flight: null, blink: true })
    if (blink < blinks - 1) assert.deepEqual(handoffAt(schedule, on + pulse), { flight: null, blink: false }, `no gap after blink ${blink + 1}`)
  }
  assert.deepEqual(handoffAt(schedule, schedule.endMs - 1), { flight: null, blink: true })
  assert.deepEqual(handoffAt(schedule, schedule.endMs), { flight: null, blink: false })
  assert.deepEqual(handoffAt(schedule, -1), { flight: null, blink: false })
})

test("reduced motion, the flight off, no blinks, or a pressed flash of zero each drop their part", () => {
  const { focusArrowMs: arrow, pressedFlashMs: pulse, cursorBlinks: blinks } = TIMING
  // Reduced motion: nothing flies, and the blink plays at once.
  const reduced = handoffSchedule(TIMING, true)
  assert.equal(reduced.flightMs, 0)
  assert.deepEqual(handoffAt(reduced, 0), { flight: null, blink: true })
  // The flight off: the blink at once.
  const noFlight = handoffSchedule({ ...TIMING, focusArrowMs: 0 }, false)
  assert.deepEqual(handoffAt(noFlight, 0), { flight: null, blink: true })
  assert.equal(noFlight.endMs, (2 * blinks - 1) * pulse)
  // No blinks: the flight, then nothing.
  const noBlink = handoffSchedule({ ...TIMING, cursorBlinks: 0 }, false)
  assert.equal(noBlink.endMs, arrow)
  assert.deepEqual(handoffAt(noBlink, arrow), { flight: null, blink: false })
  // Three blinks: five phases after the flight.
  assert.equal(handoffSchedule({ ...TIMING, cursorBlinks: 3 }, false).endMs, arrow + 5 * pulse)
  // A pressed flash of zero has no speed to blink at.
  assert.equal(handoffSchedule({ ...TIMING, pressedFlashMs: 0 }, false).blinks, 0)
  // Both off: nothing at all.
  assert.equal(handoffSchedule({ ...TIMING, focusArrowMs: 0, cursorBlinks: 0 }, false).endMs, 0)
})

test("the live loop plays it from the frame that first sees the hand-off, and keeps the frame timer running until it ends", () => {
  const { focusArrowMs: arrow, pressedFlashMs: pulse } = TIMING
  const side = buildSide()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, "e") // Explore Map, from the menu
  const end = 1000 + handoffSchedule(TIMING, false).endMs
  const at = (now: number) => animation.frame(side.build.state, now)
  const first = at(1000)
  assert.deepEqual(first.handoffFlight, { progress: 0 })
  assert.equal(first.cursorBlink, undefined)
  assert.equal(first.busyUntil, end)
  assert.deepEqual(at(1000 + arrow / 2).handoffFlight, { progress: 0.5 })
  const landed = at(1000 + arrow)
  assert.equal(landed.handoffFlight, undefined)
  assert.equal(landed.cursorBlink, true)
  const gap = at(1000 + arrow + pulse + pulse / 2)
  assert.equal(gap.cursorBlink, undefined)
  assert.equal(gap.busyUntil, end)
  const over = at(end)
  assert.equal(over.handoffFlight, undefined)
  assert.equal(over.cursorBlink, undefined)
  assert.equal(over.busyUntil, null, "the frame timer kept running after the blink")
})

test("the keys work while it plays: the arrow keeps flying toward wherever the cursor now is", () => {
  const side = buildSide()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, DOWN, DOWN, ENTER) // the Barracks, armed from the menu
  animation.frame(side.build.state, 1000)
  side.build.dispatch({ kind: "move-cursor", dx: 3, dy: 1 })
  const moving = animation.frame(side.build.state, 1000 + TIMING.focusArrowMs / 3)
  assert.ok(moving.handoffFlight !== undefined, "moving the cursor stopped the arrow")
  // The arrow aims at the cursor as it is drawn: moved, the arrow's last cells move with it.
  const before = flight(side, 0.9, { cursor: { x: side.build.state.cursor.x - 3, y: side.build.state.cursor.y - 1 } })
  const after = flight(side, 0.9)
  assert.notDeepEqual(before.map((cell) => [cell.x, cell.y]), after.map((cell) => [cell.x, cell.y]))
})

test("it stops for good when the keyboard leaves the map, a popup opens, or the plan is committed", () => {
  for (const [name, interrupt] of [
    ["Tab to the menu", (side: Side) => keys(side, TAB)],
    ["a popup", (side: Side) => keys(side, "n")],
    ["Esc back to the menu", (side: Side) => keys(side, ESC)],
  ] as const) {
    const side = buildSide()
    const animation = new BuildAnimation()
    animation.frame(side.build.state, 0)
    keys(side, "e")
    assert.ok(animation.frame(side.build.state, 1000).handoffFlight !== undefined)
    interrupt(side)
    const stopped = animation.frame(side.build.state, 1000 + TIMING.focusArrowMs / 4)
    assert.equal(stopped.handoffFlight, undefined, `${name}: the flight went on`)
    assert.equal(stopped.cursorBlink, undefined, `${name}: the cursor blinked`)
    // Back on the map without a new hand-off (Tab, closing the popup): it does not pick up again.
    if (side.build.state.popup !== null) keys(side, ESC)
    if (side.build.state.focus === "menu") keys(side, TAB)
    const resumed = animation.frame(side.build.state, 1000 + TIMING.focusArrowMs)
    assert.equal(resumed.handoffFlight, undefined, `${name}: the flight came back`)
    assert.equal(resumed.cursorBlink, undefined, `${name}: the blink came back`)
  }
  // Committed: nothing flies over a Pulse.
  const side = buildSide()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, "n", "1", "e")
  animation.frame(side.build.state, 1000)
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.equal(side.build.state.committed, true)
  const committed = animation.frame(side.build.state, 1000 + TIMING.focusArrowMs / 4)
  assert.equal(committed.handoffFlight, undefined)
  assert.equal(committed.cursorBlink, undefined)
})

test("under reduced motion, or with the flight off, the blink plays at once; Tab alone plays nothing", () => {
  const side = buildSide()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0, { reducedMotion: true })
  keys(side, "e")
  const reduced = animation.frame(side.build.state, 1000, { reducedMotion: true })
  assert.equal(reduced.handoffFlight, undefined)
  assert.equal(reduced.cursorBlink, true)

  const off = buildSide()
  for (let step = 0; step < 10 && off.build.state.experiments.focusArrowMs > 0; step += 1) {
    off.build.dispatch({ kind: "experiment-adjust", field: "focusArrowMs", step: -1 })
  }
  assert.equal(off.build.state.experiments.focusArrowMs, 0, "the flight does not go off")
  const still = new BuildAnimation()
  still.frame(off.build.state, 0)
  keys(off, "e")
  assert.equal(still.frame(off.build.state, 1000).cursorBlink, true)

  const tab = buildSide()
  const quiet = new BuildAnimation()
  quiet.frame(tab.build.state, 0)
  keys(tab, TAB)
  const frame = quiet.frame(tab.build.state, 1000)
  assert.equal(frame.handoffFlight, undefined)
  assert.equal(frame.cursorBlink, undefined)
})

// --- Where the cursor lands ---------------------------------------------------------------------------

test("Explore Map opened from the menu moves the cursor off the Grid Nexus onto clear ground, by the arming rule for one tile, and keeps it in view", () => {
  const context = spikeContext()
  const expected = armingSpot(context, [], ONE_TILE, SPIKE_START_CURSOR)
  assert.equal(expected.found, true)
  assert.notDeepEqual(expected.tile, SPIKE_START_CURSOR)
  // Clear ground: nothing on the tile, and nothing on the ring around it.
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      assert.equal(structureAtTile(context, [], { x: expected.tile.x + dx, y: expected.tile.y + dy }), null)
    }
  }
  // Nearest by the arming rule's own ranking: a free column to the right of the Nexus.
  assert.deepEqual(expected.tile, { x: 21, y: 10 })
  for (const [name, open] of [
    ["e", (side: Side) => keys(side, "e")],
    ["Enter on its row", (side: Side) => keys(side, ENTER)],
    ["a click on its row", (side: Side) => clickPanelRow(side, panelRow(side, EXPLORE_ROW))],
    ["the driver", (side: Side) => side.build.dispatch({ kind: "explore" })],
  ] as const) {
    const side = buildSide({ context, cursor: SPIKE_START_CURSOR })
    open(side)
    assert.equal(side.build.state.exploreMap, true, name)
    assert.deepEqual(side.build.state.cursor, expected.tile, `${name} left the cursor on the Nexus`)
    assert.equal(side.build.state.handoff?.entry, EXPLORE_ENTRY, `${name}: no hand-off to fly`)
    // The camera follows as it does for arming: the cursor is in view, across and down.
    const { camera, viewport, cursor } = side.build.state
    assert.ok(cursor.x >= camera.x && cursor.x < camera.x + viewport.width, `${name}: the cursor is off the view's sides`)
    assert.ok(cursor.y >= camera.y && cursor.y < camera.y + viewport.height, `${name}: the cursor is off the view's top or bottom`)
  }
})

test("Explore Map from the menu leaves a cursor that is already on clear ground where it is", () => {
  const side = buildSide({ cursor: { x: 30, y: 14 } })
  keys(side, "e")
  assert.deepEqual(side.build.state.cursor, { x: 30, y: 14 })
})

test("Explore Map opened from the map leaves the cursor where it is — Enter reads what is under it", () => {
  for (const open of [[TAB, ENTER], [TAB, SPACE], [TAB, "e"]]) {
    const side = buildSide({ cursor: SPIKE_START_CURSOR })
    keys(side, ...open)
    assert.equal(side.build.state.exploreMap, true)
    assert.equal(side.build.state.returnTo, "grid")
    assert.deepEqual(side.build.state.cursor, SPIKE_START_CURSOR, `${JSON.stringify(open)} moved the cursor off the Nexus`)
    assert.match(screenText(side), /Nexus/)
  }
})

/** A corridor one tile high through rock, `width` long, with Turrets standing on it at `turrets`. */
function corridor(width: number, turrets: readonly number[]): BuildContext {
  const height = 3
  const tiles = new Array<TerrainId>(width * height).fill("terrain.rock")
  for (let x = 0; x < width; x += 1) tiles[width + x] = "terrain.plain"
  const standing = turrets.map((x) => ({ contentId: "structure.bench.beamturret", anchor: { x, y: 1 } }))
  return { ...spikeContext(), grid: { width, height, tiles }, standing }
}

test("where no free tile in reach has clear ground around it, Explore Map from the menu takes the nearest free tile", () => {
  // The cursor on a Turret in a corridor of Turrets; the one free tile, three to the east, touches a
  // Turret on either side.
  const context = corridor(9, [0, 1, 2, 3, 4, 5, 7, 8])
  const expected = armingSpot(context, [], ONE_TILE, { x: 3, y: 1 })
  assert.deepEqual(expected, { tile: { x: 6, y: 1 }, found: true })
  const side = buildSide({ context, cursor: { x: 3, y: 1 } })
  keys(side, "e")
  assert.equal(side.build.state.exploreMap, true)
  assert.deepEqual(side.build.state.cursor, { x: 6, y: 1 })
})

test("with no free tile in reach, Explore Map leaves the cursor where it is", () => {
  const width = 40
  const height = 30
  const rock: BuildContext = {
    ...spikeContext(),
    grid: { width, height, tiles: new Array<TerrainId>(width * height).fill("terrain.rock") },
    standing: [],
  }
  const side = buildSide({ context: rock, cursor: { x: 10, y: 10 } })
  keys(side, "e")
  assert.equal(side.build.state.exploreMap, true)
  assert.deepEqual(side.build.state.cursor, { x: 10, y: 10 })
})

// --- The record -----------------------------------------------------------------------------------

test("the hand-off is recorded when a menu row gives the keyboard to the map, and only then", () => {
  const rowOf = (side: Side, target: MenuEntry): number => menuEntryRow(side.layout, side.context.catalog, target) as number
  const handedOff: readonly [string, (side: Side) => void, number][] = [
    ["Enter on a building", (side) => keys(side, DOWN, DOWN, ENTER), entryOfConstruct(0)],
    ["a digit on the menu", (side) => keys(side, "2"), entryOfConstruct(1)],
    ["a click on a building from the menu", (side) => clickPanelRow(side, rowOf(side, { kind: "construct", index: 2 })), entryOfConstruct(2)],
    ["e on the menu", (side) => keys(side, "e"), EXPLORE_ENTRY],
    ["Enter on Explore Map", (side) => keys(side, ENTER), EXPLORE_ENTRY],
    ["a click on Explore Map", (side) => clickPanelRow(side, rowOf(side, { kind: "explore" })), EXPLORE_ENTRY],
    // Plain navigation keeps the menu beside the map, and a click on a building there is the menu's.
    ["a click on a building from the map", (side) => { keys(side, TAB); clickPanelRow(side, rowOf(side, { kind: "construct", index: 0 })) }, entryOfConstruct(0)],
  ]
  for (const [name, drive, entry] of handedOff) {
    const side = buildSide()
    drive(side)
    assert.equal(side.build.state.focus, "grid", `${name}: the map does not have the keyboard`)
    assert.deepEqual(side.build.state.handoff, { seq: 1, entry }, `${name}: no hand-off`)
  }
  const notHandedOff: readonly [string, (side: Side) => void][] = [
    ["Tab", (side) => keys(side, TAB)],
    ["a click on the map", (side) => clickCell(side, side.layout.origin.column + 4, side.layout.origin.row + 4)],
    ["a digit on the map", (side) => keys(side, TAB, "1")],
    ["e on the map", (side) => keys(side, TAB, "e")],
    ["Enter on the map", (side) => keys(side, TAB, ENTER)],
    ["Nexus", (side) => keys(side, "n")],
  ]
  for (const [name, drive] of notHandedOff) {
    const side = buildSide()
    const before = side.build.state.handoff
    drive(side)
    assert.deepEqual(side.build.state.handoff, before, `${name}: recorded a hand-off`)
  }
  // A building the player cannot afford is refused on the menu: nothing is handed to the map.
  const broke = buildSide()
  keys(broke, "1", ENTER, "1", ENTER) // two Barracks: 20 left
  const seq = broke.build.state.handoff?.seq
  keys(broke, "1")
  assert.equal(broke.build.state.armed, null)
  assert.equal(broke.build.state.focus, "menu")
  assert.equal(broke.build.state.handoff?.seq, seq, "a refused arm handed off")
})

test("the way back records no hand-off, a second one counts on, and a restart keeps the count", () => {
  const side = buildSide()
  keys(side, "1")
  assert.equal(side.build.state.handoff?.seq, 1)
  keys(side, ENTER) // placed: back on the menu
  keys(side, "e", ESC) // Explore Map from the menu, and back
  assert.deepEqual(side.build.state.handoff, { seq: 2, entry: EXPLORE_ENTRY }, "the way back was recorded")
  side.build.dispatch({ kind: "restart" })
  assert.deepEqual(side.build.state.handoff, { seq: 2, entry: EXPLORE_ENTRY }, "a restart lost the count")
  assert.equal(side.build.state.planned.length, 0)
  keys(side, "2")
  assert.equal(side.build.state.handoff?.seq, 3)
})

// --- The drawing ------------------------------------------------------------------------------------

test("a hand-off leaves from the cell right of its row on the menu, not from the card's header: a building's focus arrow, Explore Map's see-through cursor", () => {
  const travellers: readonly (readonly [string, string, MenuEntry])[] = [
    ["the Barracks' focus arrow", "1", { kind: "construct", index: 0 }],
    ["the Hatchery's focus arrow", "2", { kind: "construct", index: 1 }],
    ["the Turret's focus arrow", "3", { kind: "construct", index: 2 }],
    ["Explore Map's see-through cursor", "e", { kind: "explore" }],
  ]
  for (const [name, key, target] of travellers) {
    const side = buildSide()
    keys(side, key)
    const home = menuEntryRow(side.layout, side.context.catalog, target) as number
    // At the start only its head is drawn, on the divider beside the row's own place on the menu.
    const start = flight(side, 0)
    assert.deepEqual(start.map((cell) => [cell.x, cell.y]), [[side.layout.dividerColumn, home]], `${name} does not leave from its row`)
    if (key === "e") continue
    assert.notEqual(home, panelRow(side, CARD_HEADER_ROW))
    assert.ok([">", "v", "^"].includes(start[0]?.cell.glyph as string), `${name}: no arrow head at the start`)
  }
})

test("the focus arrow is glyphs: its head crosses the divider and stops one cell short of the cursor, over a dimmer trail", () => {
  const side = buildSide()
  keys(side, TURRET)
  const { layout } = side
  const start = { x: layout.dividerColumn, y: turretRow(layout) }
  const launch = flight(side, 0)
  assert.ok([">", "v"].includes(launch[0]?.cell.glyph as string), `a head pointing right or down, not ${launch[0]?.cell.glyph}`)
  assert.equal(launch[0]?.cell.style.bold, true)
  // Mid-flight: arrow glyphs, and no see-through cell.
  const mid = flight(side, 0.5)
  assert.ok(mid.some((cell) => cell.cell.glyph !== cell.was.glyph), "no arrow glyphs")
  assert.ok(!mid.some((cell) => cell.cell.style.seeThrough !== undefined), "a building's hand-off drew the see-through cursor")
  const cursor = cellForTile(layout, side.build.state.camera, side.build.state.cursor)
  const landing = flight(side, 0.999)
  const head = landing.find((cell) => cell.cell.style.bold === true && [">", "<", "v", "^"].includes(cell.cell.glyph))
  assert.ok(head !== undefined, "no head near the end")
  assert.ok(Math.max(Math.abs(head.x - cursor.x), Math.abs(head.y - cursor.y)) === 1, `the head at ${head.x},${head.y} is not beside the cursor at ${cursor.x},${cursor.y}`)
  assert.ok(!landing.some((cell) => cell.x === cursor.x && cell.y === cursor.y), "the arrow drew on the cursor's cell")
  // A trail behind the head, the older cells dim.
  assert.ok(landing.length >= 4, `a trail of ${landing.length - 1}`)
  assert.ok(landing.some((cell) => cell.cell.style.dim === true), "no older, dimmer trail cells")
  // Every cell lies between the start and the cursor.
  for (const cell of landing) {
    assert.ok(cell.x >= start.x && cell.x <= cursor.x, `column ${cell.x} is outside the flight`)
    assert.ok(cell.y >= Math.min(start.y, cursor.y) && cell.y <= Math.max(start.y, cursor.y), `row ${cell.y} is outside the flight`)
  }
})

test("the focus arrow's glyphs follow the glyph pack and the way it flies", () => {
  // Mostly across and a little down from its row: a level trail, the head pointing right.
  const level = buildSide({ cursor: { x: 40, y: 3 } })
  keys(level, TURRET)
  const glyphs = new Set(flight(level, 0.6).map((cell) => cell.cell.glyph))
  assert.ok(glyphs.has(">") && glyphs.has("-"), `level flight drew ${[...glyphs].join(" ")}`)
  const unicode = new Set(flight(level, 0.6, { glyphPack: "unicode" }).map((cell) => cell.cell.glyph))
  assert.ok(unicode.has("▶") && unicode.has("━"), `the Unicode pack drew ${[...unicode].join(" ")}`)
  // Steeply down, near the divider: an upright trail, the head pointing down.
  const steep = buildSide({ cursor: { x: 1, y: 14 } })
  keys(steep, TURRET)
  const down = new Set(flight(steep, 0.6).map((cell) => cell.cell.glyph))
  assert.ok(down.has("v") && down.has("|"), `steep flight drew ${[...down].join(" ")}`)
  // In between: a diagonal trail.
  const diagonal = buildSide({ cursor: { x: 12, y: 14 } })
  keys(diagonal, TURRET)
  const slant = new Set(flight(diagonal, 0.7).map((cell) => cell.cell.glyph))
  assert.ok(slant.has("\\"), `a diagonal flight drew ${[...slant].join(" ")}`)
})

test("over a building or the ghost being placed the focus arrow changes only the style, never the glyph", () => {
  let restyled = 0
  // Cursors below and right of the Grid Nexus, so the flight crosses it for some of them.
  for (const y of [12, 13, 14, 15]) {
    for (let x = 19; x <= 40; x += 3) {
      const side = buildSide({ cursor: { x, y } })
      keys(side, TURRET)
      for (const progress of [0.3, 0.6, 0.95]) {
        for (const cell of flight(side, progress)) {
          const tile = tileAtCell(side.layout, side.build.state.camera, cell.x, cell.y)
          if (tile === null || structureAtTile(side.context, side.build.state.planned, tile) === null) continue
          assert.equal(cell.cell.glyph, cell.was.glyph, `the arrow replaced a building's glyph at ${tile.x},${tile.y}`)
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
    const armed = buildSide({ cursor })
    keys(armed, DOWN, DOWN, ENTER)
    for (const cell of flight(armed, 0.95)) {
      if (cell.was.style.fgRole !== "chrome.hotkey" || tileAtCell(armed.layout, armed.build.state.camera, cell.x, cell.y) === null) continue
      assert.equal(cell.cell.glyph, cell.was.glyph, "the arrow replaced a glyph of the ghost")
      ghost += 1
    }
  }
  assert.ok(ghost > 0, "the arrow never crossed the ghost")
})

test("Explore Map's see-through cursor is glyphless see-through writes in the cursor's role, a head at the owner's 80% over a fainter trail, never on the cursor's own cells", () => {
  const alphas = new Set(SEE_THROUGH_TRAIL.map((copy) => copy.alpha))
  for (const terminal of [MINIMUM, ROOMY]) {
    const side = buildSide({ terminal })
    keys(side, "e")
    const { layout } = side
    const cursor = cellForTile(layout, side.build.state.camera, side.build.state.cursor)
    for (const progress of [0, 0.1, 0.3, 0.6, 0.9]) {
      const cells = flight(side, progress, {}, "truecolor")
      assert.ok(cells.length > 0, `nothing drawn at ${progress}`)
      for (const { x, y, cell, was } of cells) {
        assert.equal(cell.glyph, was.glyph, `a glyph changed at ${x},${y}: the see-through cursor must keep what is beneath`)
        const { seeThrough, ...rest } = cell.style
        assert.deepEqual(rest, was.style, `the style beneath changed at ${x},${y}`)
        assert.equal(seeThrough?.role, "chrome.title")
        assert.ok(alphas.has(seeThrough?.alpha as number), `alpha ${seeThrough?.alpha}`)
        assert.ok(!(y === cursor.y && x >= cursor.x && x < cursor.x + layout.tileWidth), `drawn on the cursor at ${x},${y}`)
      }
    }
    // The head leaves at full strength; later a fainter trail follows it.
    assert.ok(flight(side, 0, {}, "truecolor").every((cell) => cell.cell.style.seeThrough?.alpha === HEAD_ALPHA))
    const mid = flight(side, 0.3, {}, "truecolor").map((cell) => cell.cell.style.seeThrough?.alpha as number)
    assert.ok(mid.includes(HEAD_ALPHA) && mid.some((alpha) => alpha < HEAD_ALPHA), `no trail at 0.3: ${mid.join(" ")}`)
  }
})

test("nothing flies over a popup, from the menu, or once the plan is committed, and a still frame carries no flight", () => {
  for (const [name, key] of [["the focus arrow", TURRET], ["the see-through cursor", "e"]] as const) {
    const side = buildSide()
    keys(side, key)
    assert.ok(flight(side, 0.5).length > 0, `${name} never flies`)
    keys(side, "n") // a popup over the map
    assert.equal(flight(side, 0.5).length, 0, `${name} flew over a popup`)
  }
  assert.equal(flight(buildSide(), 0.5).length, 0, "something flew with the keyboard on the menu")
  // Committed from Explore Map, the one the plan can be committed from while it is on the map.
  const committed = buildSide()
  keys(committed, "n", "1", "e")
  committed.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.equal(committed.build.state.committed, true)
  assert.equal(flight(committed, 0.5).length, 0, "something flew over a committed plan")
  // A still frame: the Turret armed from its row draws exactly what it does armed on the map, where
  // nothing is handed off; Explore Map's frame has no see-through cell.
  const fromRow = buildSide()
  keys(fromRow, TURRET)
  const onMap = buildSide()
  keys(onMap, TAB, TURRET)
  assert.notDeepEqual(fromRow.build.state.handoff, onMap.build.state.handoff)
  assert.deepEqual(compose(fromRow), compose(onMap))
  const exploring = buildSide()
  keys(exploring, "e")
  assert.ok(!compose(exploring).cells.some((cell) => cell.style.seeThrough !== undefined), "a still frame carries a see-through cell")
})

test("the cursor blinks in the menu row's pressed look, and is the plain cursor between blinks", () => {
  const side = buildSide()
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
  t = 1000 + handoffSchedule(TIMING, false).endMs // long after it landed and the cursor blinked
  await wait(60)
  assert.equal(rowsOf(stdout.lastWrite)[start.y]?.[start.x], divider, "the arrow is still drawn after it landed")
  stdin.emit("data", Buffer.from([3]))
  await session
})
