// The battle banner (the challenge runs, step 11G; the Battle banner Experiment): Start Battle Round shows the banner
// in the side panel, the camera on it; Change Target makes the cursor the banner; planting it asks the stance; and the
// Battle Round sends the troops there — holding it, or going on to the enemy once they reach it.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BuildContext } from "../src/build/state.ts"
import { bannerLines, bannerOrder, bannerSpot, currentBanner } from "../src/build/banner.ts"
import type { BuildCommand } from "../src/build/types.ts"
import type { Coord } from "../src/grid/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { startPulse } from "../src/cli/pulse-run.ts"
import { PERIMETER } from "../src/armies/index.ts"
import { bannerReached, resolveMissionPulse, withBannerTargets } from "../src/match/index.ts"
import type { BannerOrder } from "../src/match/index.ts"
import { buildSide, clickTile, keys, placed, screenText } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"
import { popupHitAt } from "../src/build/popup.ts"
import { MOUSE_LEFT, formatMouseEvent } from "../src/build/mouse.ts"

const ENTER = "\r"
const RIGHT = "\u001b[C"
const UP = "\u001b[A"
const ESC = "\u001b"

/** PERIMETER's first round with the Experiment on, as the game opens it. */
function bannerSide(): BuildSide {
  const context: BuildContext = { ...starterContext(), experiments: { battleBanner: "on" } }
  return buildSide({ context, cursor: STARTER_START_CURSOR, startPulse })
}

/** The first rock tile of the map, in reading order. */
function rock(context: BuildContext): Coord {
  const index = context.grid.tiles.findIndex((tile) => tile === "terrain.rock")
  return { x: index % context.grid.width, y: Math.floor(index / context.grid.width) }
}

test("Start Battle Round shows the banner over the menu, the camera on it: PERIMETER's default is the line, defensive", () => {
  const side = bannerSide()
  keys(side, "s")
  const { state } = side.build
  assert.equal(state.popup, "battle-round")
  const banner = currentBanner(side.build.round, state)
  assert.equal(banner.isDefault, true)
  assert.equal(banner.name, "the line")
  assert.equal(banner.stance, "defensive")
  assert.deepEqual(state.cursor, banner.tile, "the camera did not go to the banner")
  const text = screenText(side)
  for (const line of ["Start Battle Round 1.", "Target: The line.", "Stance: Defensive.", "[t] Change Target", "[s] Start Battle"]) assert.ok(text.includes(line), line)
  // Docked over the side panel: the map beside it is left clear.
  const popup = placed(side)
  assert.ok(popup.box.right <= side.layout.dividerColumn, "the panel runs onto the map")
})

test("Change Target makes the cursor the banner; Enter plants it, a stance is chosen, and the panel says the new one", () => {
  const side = bannerSide()
  keys(side, "s", "t")
  assert.equal(side.build.state.popup, "banner-place")
  keys(side, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, RIGHT, UP, UP)
  const tile = side.build.state.cursor
  assert.match(screenText(side), /\[enter\] Place Target on /)
  keys(side, ENTER)
  assert.equal(side.build.state.popup, "banner-stance")
  assert.deepEqual(side.build.state.bannerDrop?.tile, tile, "no planting to play")
  keys(side, "a")
  const { state } = side.build
  assert.equal(state.popup, "battle-round")
  assert.deepEqual(state.banner, { tile, stance: "aggressive" })
  assert.match(screenText(side), /Stance: Aggressive\./)
  // Aggressive: a line on from the banner to the enemy, besides the two to it.
  const lines = bannerLines(side.build.round, state, tile, "aggressive")
  assert.ok(lines.fromNexus.length > 1 && lines.fromCommander.length > 0 && lines.onward.length > 1)
  assert.deepEqual(lines.fromNexus[lines.fromNexus.length - 1] !== undefined, true)
})

test("Esc walks back one step at a time: stance to moving, moving to the panel, the panel closed", () => {
  const side = bannerSide()
  keys(side, "s", "t", RIGHT, ENTER)
  assert.equal(side.build.state.popup, "banner-stance")
  keys(side, ESC)
  assert.equal(side.build.state.popup, "banner-place")
  assert.equal(side.build.state.bannerDraft, null)
  keys(side, ESC)
  assert.equal(side.build.state.popup, "battle-round")
  keys(side, ESC)
  assert.equal(side.build.state.popup, null)
  assert.equal(side.build.state.banner, null, "nothing was planted")
})

test("the banner cannot go where troops cannot: rock is refused, and says why", () => {
  const side = bannerSide()
  const at = rock(side.build.round)
  assert.notEqual(bannerSpot(side.build.round, side.build.state, at).refusal, null)
  keys(side, "s", "t")
  side.build.dispatch({ kind: "click-tile", x: at.x, y: at.y })
  side.build.dispatch({ kind: "click-tile", x: at.x, y: at.y })
  assert.equal(side.build.state.popup, "banner-place", "planted on rock")
  assert.equal(side.build.state.status.tone, "danger")
  assert.match(side.build.state.status.text, /Cannot place the banner on rock/)
})

test("keys, clicks and a driver plant the same banner", () => {
  const byKeys = bannerSide()
  keys(byKeys, "s", "t", RIGHT, RIGHT, RIGHT, ENTER, "d")
  const tile = byKeys.build.state.banner?.tile as Coord

  const byMouse = bannerSide()
  keys(byMouse, "s")
  const change = placed(byMouse).rows.find((row) => row.spec.kind === "option" && row.spec.hotkey === "t")
  assert.ok(change !== undefined)
  const hit = popupHitAt(placed(byMouse), placed(byMouse).textColumn, change.row)
  assert.deepEqual(hit, { kind: "command", command: { kind: "banner-target" } })
  byMouse.build.handleData(formatMouseEvent(MOUSE_LEFT, placed(byMouse).textColumn + 1, change.row + 1), byMouse.layout)
  assert.equal(byMouse.build.state.popup, "banner-place")
  clickTile(byMouse, tile)
  clickTile(byMouse, tile)
  assert.equal(byMouse.build.state.popup, "banner-stance")
  byMouse.build.dispatch({ kind: "banner-stance", stance: "defensive" })

  const byDriver = bannerSide()
  const script: BuildCommand[] = [{ kind: "open-battle-round" }, { kind: "banner-target" }, { kind: "click-tile", ...tile }, { kind: "banner-place" }, { kind: "banner-stance", stance: "defensive" }]
  byDriver.build.run(script)

  assert.deepEqual(byMouse.build.state.banner, byKeys.build.state.banner)
  assert.deepEqual(byDriver.build.state.banner, byKeys.build.state.banner)
})

test("planting the level's own default back makes no order: the round plays as it always did", () => {
  const side = bannerSide()
  const banner = currentBanner(side.build.round, side.build.state)
  side.build.run([{ kind: "open-battle-round" }, { kind: "banner-target" }, { kind: "banner-place" }, { kind: "banner-stance", stance: banner.stance }])
  assert.equal(side.build.state.banner, null)
  assert.equal(bannerOrder(side.build.round, side.build.state), null)
})

test("the Battle Round with the Experiment off is the old confirmation, and moves no camera", () => {
  const context: BuildContext = { ...starterContext(), experiments: { battleBanner: "off" } }
  const side = buildSide({ context, cursor: STARTER_START_CURSOR })
  const before = side.build.state.cursor
  keys(side, "s")
  assert.deepEqual(side.build.state.cursor, before)
  assert.match(screenText(side), /\[s\] Start\b/)
  assert.doesNotMatch(screenText(side), /Change Target/)
})

// --- The match: the banner drives the battle ----------------------------------------------------------

/** PERIMETER's first Pulse, on its own map with nothing built, with `banner` or none. */
function perimeterPulse(banner?: BannerOrder) {
  const context = starterContext()
  return resolveMissionPulse({
    mission: PERIMETER,
    grid: context.grid,
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
