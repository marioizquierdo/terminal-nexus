// The rally point (the challenge runs, step 11G; the Battle banner Experiment; made simpler after the owner played it,
// 2026-11-25): Start Battle Round makes the cursor the rally point at once, with no panel and no stance; the words
// beside it say what Enter does; Enter places it and starts the Battle Round; Esc gives the Build Phase back as it was.
// And the Battle Round sends the troops there — holding it, or going on to the enemy once they reach it.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BuildContext } from "../src/build/state.ts"
import { bannerLines, bannerOrder, bannerSpot, currentBanner, defaultBanner, structureTilesAt } from "../src/build/banner.ts"
import type { BuildCommand } from "../src/build/types.ts"
import type { Coord } from "../src/engine/geometry/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { startPulse } from "../src/cli/pulse-run.ts"
import { PERIMETER } from "../src/armies/index.ts"
import { bannerReached, resolveMissionPulse, withBannerTargets } from "../src/match/index.ts"
import type { BannerOrder } from "../src/match/index.ts"
import { bottomLineText, buildSide, clickPanelRow, clickTile, compose, keys, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { popupSpec } from "../src/build/popup.ts"
import { startRow } from "../src/build/layout.ts"
import { cellForTile } from "../src/build/layout.ts"
import { visibleRange } from "../src/build/camera.ts"
import { frameToText, cellAt } from "../src/view/frame.ts"
import { BannerClock } from "../src/view/build-live.ts"
import { CALL_MS, labelStart } from "../src/view/banner-marks.ts"

const ENTER = "\r"
const RIGHT = "\u001b[C"
const UP = "\u001b[A"
const ESC = "\u001b"

/** PERIMETER's first round with the Experiment on, as the game opens it; `experiments` adds others. */
function bannerSide(experiments: BuildContext["experiments"] = {}, context: Partial<BuildContext> = {}): BuildSide {
  const opened: BuildContext = { ...starterContext(), ...context, experiments: { battleBanner: "on", ...experiments } }
  return buildSide({ context: opened, cursor: STARTER_START_CURSOR, startPulse })
}

/** The first rock tile of the map, in reading order. */
function rock(context: BuildContext): Coord {
  const index = context.terrain.tiles.findIndex((tile) => tile === "terrain.rock")
  return { x: index % context.terrain.width, y: Math.floor(index / context.terrain.width) }
}

test("Start Battle Round makes the cursor the rally point at once: no panel, no stance, the menu kept, its words beside it", () => {
  const side = bannerSide()
  keys(side, "s")
  const { state } = side.build
  assert.equal(state.popup, "banner-place")
  assert.equal(popupSpec(side.build.round, state), null, "a panel opened")
  const banner = currentBanner(side.build.round, state)
  assert.equal(banner.isDefault, true)
  assert.equal(banner.name, "the line")
  assert.deepEqual(state.cursor, banner.tile, "the cursor did not go to the rally point")
  const text = screenText(side)
  assert.match(text, /\[enter\] Place rally point/)
  assert.match(text, /\[s\] Start Battle Round/, "the menu is not kept")
  for (const gone of ["Change Target", "Stance", "Aggressive", "Defensive"]) assert.ok(!text.includes(gone), gone)
  assert.equal(bottomLineText(side), "Arrows move the rally point, [enter] starts the round, [esc] back.")
})

test("Enter places it and starts the Battle Round, holding it by default", () => {
  const side = bannerSide()
  keys(side, "s", RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, UP, UP)
  const tile = side.build.state.cursor
  keys(side, ENTER)
  const { state } = side.build
  assert.equal(state.committed, true, "the round did not start")
  assert.equal(state.popup, null)
  assert.deepEqual(state.banner, { tile, stance: "defensive" })
})

test("with the Rally point Experiment at push on, the rally point placed is pushed on from", () => {
  const side = bannerSide({ rallyPoint: "push-on" })
  keys(side, "s", RIGHT, RIGHT, RIGHT, ENTER)
  assert.equal(side.build.state.banner?.stance, "aggressive")
})

test("Esc goes back with nothing changed: the cursor, the camera and the keyboard as they were", () => {
  const side = bannerSide()
  const before = side.build.state
  keys(side, "s", RIGHT, RIGHT)
  assert.notDeepEqual(side.build.state.cursor, before.cursor)
  keys(side, ESC)
  const after = side.build.state
  assert.equal(after.popup, null)
  assert.equal(after.committed, false)
  assert.equal(after.banner, null, "a rally point was placed")
  assert.deepEqual(after.cursor, before.cursor)
  assert.deepEqual(after.camera, before.camera)
  assert.equal(after.focus, before.focus)
})

test("the rally point cannot go where troops cannot: rock is refused, beside it and on the bottom line, and nothing starts", () => {
  const side = bannerSide()
  const at = rock(side.build.round)
  const refusal = bannerSpot(side.build.round, side.build.state, at).refusal
  assert.ok(refusal !== null)
  keys(side, "s")
  side.build.dispatch({ kind: "click-tile", x: at.x, y: at.y })
  assert.ok(screenText(side).includes(refusal), "the words beside it do not say why")
  side.build.dispatch({ kind: "click-tile", x: at.x, y: at.y })
  assert.equal(side.build.state.popup, "banner-place", "placed on rock")
  assert.equal(side.build.state.committed, false)
  assert.equal(side.build.state.status.tone, "danger")
  assert.equal(side.build.state.status.text, `Cannot place the rally point there. ${refusal}`)
})

test("keys, clicks, the menu's Start row and a driver place the same rally point and start the round", () => {
  const byKeys = bannerSide()
  keys(byKeys, "s", RIGHT, RIGHT, RIGHT, ENTER)
  const tile = byKeys.build.state.banner?.tile as Coord
  assert.ok(tile !== undefined)

  const byClicks = bannerSide()
  keys(byClicks, "s")
  clickTile(byClicks, tile)
  clickTile(byClicks, tile)

  const byStartRow = bannerSide()
  keys(byStartRow, "s")
  clickTile(byStartRow, tile)
  clickPanelRow(byStartRow, startRow(byStartRow.layout))

  const bySecondS = bannerSide()
  keys(bySecondS, "s", RIGHT, RIGHT, RIGHT, "s")

  const byDriver = bannerSide()
  const script: BuildCommand[] = [{ kind: "open-battle-round" }, { kind: "click-tile", ...tile }, { kind: "banner-place" }]
  byDriver.build.run(script)

  for (const side of [byClicks, byStartRow, bySecondS, byDriver]) {
    assert.equal(side.build.state.committed, true)
    assert.deepEqual(side.build.state.banner, byKeys.build.state.banner)
  }
})

test("placing it back on the round's own default, whatever the stance, makes no order: the round plays as it always did", () => {
  const fallback = defaultBanner(starterContext())
  const side = bannerSide({}, { placedBanner: { tile: { x: fallback.tile.x - 3, y: fallback.tile.y }, stance: "aggressive" } })
  keys(side, "s")
  assert.deepEqual(side.build.state.cursor, { x: fallback.tile.x - 3, y: fallback.tile.y }, "Start did not go to where it stood last")
  side.build.run([{ kind: "click-tile", ...fallback.tile }, { kind: "banner-place" }])
  assert.equal(side.build.state.committed, true)
  assert.equal(side.build.state.banner, null)
  assert.equal(bannerOrder(side.build.round, side.build.state), null)
})

test("one march line, from the Nexus: none from the Commander, and the onward line only with push on", () => {
  const onward = (experiments: BuildContext["experiments"]): number => {
    const side = bannerSide(experiments)
    keys(side, "s", RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, UP, UP)
    const lines = bannerLines(side.build.round, side.build.state, side.build.state.cursor, "aggressive")
    assert.ok(lines.fromNexus.length > 1 && lines.onward.length > 1)
    assert.deepEqual(Object.keys(lines).sort(), ["fromNexus", "onward"])
    // The onward line is the fainter one.
    return compose(side, {}, "truecolor").cells.filter((cell) => cell.style.fade === 0.45).length
  }
  assert.equal(onward({}), 0, "hold draws an onward line")
  assert.ok(onward({ rallyPoint: "push-on" }) > 0, "push on draws no onward line")
})

test("a rally point on a building is seen: the building lit, its glyphs kept, and the words naming it", () => {
  const side = bannerSide()
  keys(side, "s")
  const nexus = side.build.round.standing.find((structure) => side.build.round.registry.get(structure.contentId).nexus === true)
  assert.ok(nexus !== undefined)
  side.build.dispatch({ kind: "click-tile", ...nexus.anchor })
  const tiles = structureTilesAt(side.build.round, side.build.state, nexus.anchor)
  assert.ok(tiles !== null && tiles.length > 1)
  const name = bannerSpot(side.build.round, side.build.state, nexus.anchor).name
  assert.equal(name, "your Nexus")
  const frame = compose(side, {}, "truecolor")
  assert.match(frameToText(frame), /\[enter\] Place rally point on your Nexus/)
  // The same frame with the rally point elsewhere: the building's glyphs are the same, and now unlit.
  const away = compose(side, { state: { ...side.build.state, popup: null } }, "truecolor")
  const range = visibleRange(side.build.state.camera, side.build.state.viewport)
  for (const tile of tiles) {
    if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
    const cell = cellForTile(side.layout, side.build.state.camera, tile)
    assert.equal(cellAt(frame, cell.x, cell.y).glyph, cellAt(away, cell.x, cell.y).glyph, "the rally point replaced a glyph")
    assert.equal(cellAt(frame, cell.x, cell.y).style.inverse, true, `tile ${tile.x},${tile.y} is not lit`)
  }
})

test("the call closes in on the rally point as it becomes the cursor, then settles; reduced motion has none", () => {
  const side = bannerSide()
  keys(side, "s")
  const clock = new BannerClock()
  const first = clock.at(side.build.state, 1000, false)
  assert.deepEqual(first, { pulseMs: 0, until: 1000 + CALL_MS })
  assert.deepEqual(clock.at(side.build.state, 1000 + CALL_MS, false), { pulseMs: CALL_MS, until: null })
  assert.deepEqual(new BannerClock().at(side.build.state, 1000, true), { until: null })
  const lit = (pulseMs: number): number => compose(side, { banner: { pulseMs } }).cells.filter((cell) => cell.style.inverse === true).length
  assert.ok(lit(0) > lit(CALL_MS) + 4, "no rings close in")
  assert.ok(lit(CALL_MS / 2) > lit(CALL_MS), "no rings halfway")
})

test("the words beside it go right of the flag, left of it at the view's edge, under it when neither fits, never on it", () => {
  const range = { firstX: 0, lastX: 49, firstY: 0, lastY: 19 }
  const none = new Set<string>()
  const at = (x: number, y: number) => ({ left: x, right: x, top: y, bottom: y })
  assert.deepEqual(labelStart({ x: 10, y: 5 }, at(10, 5), 27, range, none), { x: 11, y: 5 })
  assert.deepEqual(labelStart({ x: 45, y: 5 }, at(45, 5), 27, range, none), { x: 18, y: 5 })
  const under = labelStart({ x: 25, y: 5 }, at(25, 5), 46, range, none)
  assert.equal(under.y, 6)
  assert.ok(under.x >= 0 && under.x + 46 - 1 <= 49, "it runs out of the view")
  // Something standing to its right: the left, which is clear.
  assert.deepEqual(labelStart({ x: 30, y: 5 }, at(30, 5), 10, range, new Set(["33,5"])), { x: 20, y: 5 })
  // On a building, beside the whole building, and under its last row, never over it.
  const building = { left: 20, right: 23, top: 5, bottom: 6 }
  assert.deepEqual(labelStart({ x: 21, y: 5 }, building, 10, range, none), { x: 24, y: 5 })
  assert.equal(labelStart({ x: 21, y: 5 }, building, 46, range, none).y, 7)
})

test("the Battle Round with the Experiment off is the old confirmation, and moves no camera", () => {
  const context: BuildContext = { ...starterContext(), experiments: { battleBanner: "off" } }
  const side = buildSide({ context, cursor: STARTER_START_CURSOR })
  const before = side.build.state.cursor
  keys(side, "s")
  assert.deepEqual(side.build.state.cursor, before)
  assert.match(screenText(side), /\[s\] Start\b/)
  assert.doesNotMatch(screenText(side), /Place rally point/)
})

// --- The match: the banner drives the battle ----------------------------------------------------------

/** PERIMETER's first Pulse, on its own map with nothing built, with `banner` or none. */
function perimeterPulse(banner?: BannerOrder) {
  const context = starterContext()
  return resolveMissionPulse({
    mission: PERIMETER,
    terrain: context.terrain,
    registry: context.registry,
    pulse: 1,
    carried: null,
    structures: context.standing.map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor })),
    ...(banner === undefined ? {} : { banner }),
  })
}

const NORTH_EAST: BannerOrder = { side: "A", area: { x: 29, y: 4, width: 3, height: 3 }, name: "ground near the line", stance: "defensive" }

test("a defensive banner is the side's target for the whole round, in place of the level's", () => {
  const without = perimeterPulse()
  const held = perimeterPulse(NORTH_EAST)
  assert.deepEqual(held.states[0]?.targets?.A, NORTH_EAST.area)
  assert.deepEqual(held.final.targets?.A, NORTH_EAST.area)
  assert.notDeepEqual(without.states[0]?.targets?.A, NORTH_EAST.area)
  // Twice the same: deterministic.
  assert.deepEqual(perimeterPulse(NORTH_EAST).final, held.final)
})

test("an aggressive banner lets its side go on once half its fighters reach it, and not before", () => {
  const run = perimeterPulse({ ...NORTH_EAST, stance: "aggressive" })
  const context = starterContext()
  const order = { ...NORTH_EAST, stance: "aggressive" as const }
  const released = run.states.findIndex((state) => state.targets?.A === undefined)
  assert.ok(released > 0, "the side never went on")
  // The tick it went on is the first the army stood there.
  const before = run.states[released - 1]
  const at = run.states[released]
  assert.ok(before !== undefined && at !== undefined)
  assert.equal(bannerReached(at, context.registry, order), true)
  assert.ok(run.states.slice(0, released).every((state) => state.targets?.A !== undefined), "it went on before it got there")
})

test("no banner leaves the targets as the mission set them", () => {
  const targets = { A: { x: 1, y: 2, width: 3, height: 4 } }
  assert.equal(withBannerTargets(targets, undefined, false), targets)
  assert.deepEqual(withBannerTargets(targets, NORTH_EAST, true), undefined)
})
