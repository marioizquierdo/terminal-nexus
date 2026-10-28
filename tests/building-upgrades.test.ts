// A building's own upgrades and modes (the owner, 2026-10-22: "for the barracks would be upgrade to upgrade
// production line ... and that could be per barracks. So it's not a general upgrade where all barracks get an upgrade";
// "Buildings can also have a state change ... you can select the building to change the mode"). Selected in Explore
// Map, a building of the player's lists its card's actions under their keys; an upgrade is bought at once, kept by that
// building alone for the rest of the match, and carried by the regroup into every round after; a mode is switched between
// rounds and stays switched. The kernel sees a building that carries any as a content id of its own
// (`structure.citizen.barracks+production-line`), which its side's registry resolves.

import { test } from "node:test"
import assert from "node:assert/strict"
import { ARMIES } from "../src/armies/index.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { currentCard } from "../src/build/card.ts"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildState } from "../src/build/state.ts"
import { createBuildState, remaining, withoutScene } from "../src/build/state.ts"
import { DEFAULT_LEVEL } from "../src/cli/levels.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { FIXTURE_REGISTRY, baseContentId, fittedId } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import type { Coord, GridTerrain } from "../src/grid/types.ts"
import { opening } from "../src/match/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import type { MatchState } from "../src/state/types.ts"
import { frameToText } from "../src/view/frame.ts"
import { buildSide, clickCell, compose, keys } from "./build-helpers.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { ACTIVITY_EVENTS, entryProblems } from "../src/log/index.ts"

const BARRACKS = "structure.citizen.barracks"
const TURRET = "structure.bench.beamturret"
const RIGHT = "\x1b[C"
const ENTER = "\r"

/** Explore Map opened, the cursor then moved onto `tile`. */
function exploreAt(side: ReturnType<typeof buildSide>, tile: Coord): void {
  keys(side, "e")
  const { cursor } = side.build.state
  side.build.run([{ kind: "move-cursor", dx: tile.x - cursor.x, dy: tile.y - cursor.y }])
  assert.deepEqual(side.build.state.cursor, tile, "the cursor did not reach the tile")
}

/** PERIMETER's round 1 with Explore Map on the Barracks standing on the starter map, its credits `credits` when given. */
function onBarracks(credits?: number) {
  const context = withoutScene(DEFAULT_LEVEL.firstRound())
  const side = buildSide({ cursor: STARTER_START_CURSOR, context: credits === undefined ? context : { ...context, allotment: credits } })
  keys(side, "e", RIGHT, RIGHT, RIGHT, RIGHT)
  return side
}

/** How many units each building trained in a resolved round, by the building's id. */
function trainedBy(events: readonly DomainEvent[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const event of events) if (event.kind === "entity.spawned" && event.trainedBy !== undefined) counts.set(event.trainedBy, (counts.get(event.trainedBy) ?? 0) + 1)
  return counts
}

// --- The Build Phase: the card, buying, undoing, refusing ------------------------------------------------------

test("c on a Barracks buys its production line at once: 15 spent, its card says so and its wave is five; c again undoes it", () => {
  const side = onBarracks()
  const before = remaining(side.build.round, side.build.state)
  keys(side, "c")
  assert.deepEqual(side.build.state.fitted, [{ anchor: "25,10", action: "production-line" }])
  assert.equal(remaining(side.build.round, side.build.state), before - 15)
  assert.equal(side.build.state.status.text, "Barracks: Production line, 15 spent. It keeps it for the rest of the match.")
  const card = currentCard(side.build.round, side.build.state)
  assert.deepEqual(card?.actions, [{ hotkey: "z", label: "Hold production" }, { hotkey: "c", label: "Production line", value: "undo" }])
  assert.equal(card?.stats.find((stat) => stat.label === "WAVE")?.value, "5 troopers at 5s")
  // On screen, at 80 x 24: the row and the wave.
  const screen = frameToText(compose(side))
  assert.match(screen, /\[c\] Production line +undo/u)
  assert.match(screen, /WAVE +5 troopers at 5s/u)
  keys(side, "c")
  assert.deepEqual(side.build.state.fitted, [])
  assert.equal(remaining(side.build.round, side.build.state), before)
  assert.equal(side.build.state.status.text, "Barracks: Production line undone, 15 refunded.")
  assert.equal(currentCard(side.build.round, side.build.state)?.stats.find((stat) => stat.label === "WAVE")?.value, "4 troopers at 5s")
})

test("the Activity logs record each action taken and taken back, by building, label and kind, with what is left", () => {
  const side = onBarracks()
  keys(side, "c", "c", "z")
  const logged = side.activity.entries().filter((entry) => entry.event === "build.action")
  for (const entry of logged) assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [])
  assert.deepEqual(
    logged.map((entry) => [entry.props["action"], entry.props["kind"], entry.props["taken"], entry.props["credits"]]),
    [
      ["Production line", "upgrade", true, 85],
      ["Production line", "upgrade", false, 100],
      ["Hold production", "order", true, 100],
    ],
  )
})

test("an upgrade the credits cannot pay for is dim on the card and refused with why, as a building the menu cannot sell", () => {
  const side = onBarracks(10)
  const card = currentCard(side.build.round, side.build.state)
  assert.deepEqual(card?.actions?.[1], { hotkey: "c", label: "Production line", value: "15", dim: true })
  keys(side, "c")
  assert.deepEqual(side.build.state.fitted, [])
  assert.equal(side.build.state.status.text, "Production line costs 15, 10 left.")
})

test("a click on an action's row is its key", () => {
  const side = onBarracks()
  const lines = frameToText(compose(side)).split("\n")
  const row = lines.findIndex((line) => line.includes("[c] Production line"))
  assert.ok(row >= 0, "no production line row on screen")
  clickCell(side, side.layout.panelColumn + 1, row)
  assert.deepEqual(side.build.state.fitted, [{ anchor: "25,10", action: "production-line" }])
})

test("removing or undoing a planned building takes what was bought on it with it, refunded", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR, context: withoutScene(DEFAULT_LEVEL.firstRound()) })
  const start = remaining(side.build.round, side.build.state)
  // A Barracks placed south of the Nexus, then explored and given its production line.
  keys(side, "1", ENTER)
  const placed = side.build.state.planned[0]
  assert.ok(placed !== undefined, "the Barracks was not placed")
  exploreAt(side, placed.anchor)
  keys(side, "c")
  assert.equal(side.build.state.fitted.length, 1)
  assert.equal(remaining(side.build.round, side.build.state), start - 40 - 15)
  keys(side, "u")
  assert.deepEqual(side.build.state.fitted, [])
  assert.equal(remaining(side.build.round, side.build.state), start)
  assert.match(side.build.state.status.text, /Barracks undone, 55 refunded\./u)
})

// --- The battle: one building's own, never its neighbour's -------------------------------------------------------

test("a production line on one Barracks makes its wave five, and a Barracks beside it still sends four", { timeout: 120_000 }, () => {
  const context = withoutScene(DEFAULT_LEVEL.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(context, STARTER_START_CURSOR, viewport)
  // A second Barracks planned below the standing one, and the standing one given its production line.
  const second = { ordinal: 1, contentId: BARRACKS, anchor: { x: 25, y: 13 } }
  // And a Supply Depot, so the Nexus's 12 places do not hold the last trooper back: the battle plays differently since
  // an army sorts itself on the march, nobody dies in time to make room, and this test is about a wave's size.
  const depot = { ordinal: 2, contentId: "structure.citizen.depot", anchor: { x: 29, y: 12 } }
  const state: BuildState = { ...opened, planned: [second, depot], fitted: [{ anchor: "25,10", action: "production-line" }] }
  const resolved = DEFAULT_LEVEL.play.startPulse(context, state)
  assert.ok(resolved !== null)
  const first = resolved.timeline.states[0]
  const lined = first?.entities.find((entity) => entity.anchor.x === 25 && entity.anchor.y === 10)
  const plain = first?.entities.find((entity) => entity.anchor.x === 25 && entity.anchor.y === 13)
  assert.equal(lined?.contentId, `${BARRACKS}+production-line`)
  assert.equal(plain?.contentId, BARRACKS)
  const counts = trainedBy(resolved.timeline.events)
  assert.equal(counts.get(lined?.id ?? ""), 5)
  assert.equal(counts.get(plain?.id ?? ""), 4)
  // The regroup carries it, and the next round's Build Phase reads it on the standing Barracks: its card says it carries the
  // upgrade, offers it no more, and the Barracks sends five again.
  assert.ok(resolved.regroup.state.entities.some((entity) => entity.contentId === `${BARRACKS}+production-line`))
  const next = DEFAULT_LEVEL.play.nextRound(context, state, resolved)
  assert.ok(next !== null)
  const standing = next.standing.find((structure) => structure.anchor.x === 25 && structure.anchor.y === 10)
  assert.equal(standing?.contentId, `${BARRACKS}+production-line`)
  const round2 = createBuildState(withoutScene(next), { x: 26, y: 10 }, viewport)
  const explored: BuildState = { ...round2, exploreMap: true, focus: "grid" }
  const card = currentCard(next, explored)
  assert.ok(card?.stats.some((stat) => stat.label === "UPGRADE" && stat.value === "Production line"))
  assert.equal(card?.stats.find((stat) => stat.label === "WAVE")?.value, "5 troopers at 5s")
  assert.deepEqual(card?.actions, [{ hotkey: "z", label: "Hold production" }])
  const again = DEFAULT_LEVEL.play.startPulse(next, round2)
  assert.ok(again !== null)
  const carried = again.timeline.states[0]?.entities.find((entity) => entity.contentId === `${BARRACKS}+production-line`)
  assert.equal(trainedBy(again.timeline.events).get(carried?.id ?? ""), 5)
})

/** An open Grid, `width` by `height`, all plain ground. */
function plainGrid(width: number, height: number): GridTerrain {
  return { width, height, tiles: Array.from({ length: width * height }, () => "terrain.plain" as const) }
}

/**
 * A Turret of side A at 4,5, as `turret` (a content id, what it carries included), with the enemy's `structure` two
 * tiles east of it and an enemy trooper five east: both in its reach. Ticks until the Turret has fired `shots` times;
 * every one of its attacks, in order.
 */
function turretFires(turret: string, registry: ContentRegistry, shots: number, structure = "structure.citizen.depot"): Extract<DomainEvent, { kind: "attack.launched" }>[] {
  const grid = plainGrid(24, 11)
  const start: MatchState = opening({
    grid,
    registry,
    structures: [
      { contentId: turret, anchor: { x: 4, y: 5 }, player: "A" },
      { contentId: structure, anchor: { x: 6, y: 5 }, player: "B" },
    ],
    setup: { seed: 7, pulseTicks: 600, forces: [{ player: "B", muster: { x: 10, y: 5 }, units: ["unit.citizen.trooper"] }] },
  }).state
  const context = contextFor(start, registry, 600)
  const attacks: Extract<DomainEvent, { kind: "attack.launched" }>[] = []
  let state = start
  const own = start.entities.find((entity) => entity.player === "A")?.id
  while (attacks.length < shots && state.tick < 600 && state.outcome === null) {
    const step = stepTick(state, context)
    state = step.state
    for (const event of step.events) if (event.kind === "attack.launched" && event.attacker === own) attacks.push(event)
  }
  return attacks
}

test("a Turret's heavy rounds make its shots hit for 9 where a Turret without them hits for 6", () => {
  const registry = ARMIES.registry
  const plain = turretFires(TURRET, registry, 1)[0]
  const heavy = turretFires(fittedId(TURRET, ["heavy-rounds"]), registry, 1)[0]
  assert.equal(plain?.damage, 6)
  assert.equal(heavy?.damage, 9)
})

test("a Turret switched to Units first fires at the trooper before the nearer building; as written, at the nearest", () => {
  const registry = ARMIES.registry
  const target = (turret: string): string | undefined => turretFires(turret, registry, 1)[0]?.target
  assert.match(target(TURRET) ?? "", /depot/u, "the Turret as written fired at something other than the nearest")
  assert.match(target(fittedId(TURRET, ["units-first"])) ?? "", /trooper/u, "the Turret in Units first did not fire at the trooper")
})

test("a mode switched on the screen stays switched the round after, and switching back refunds nothing it did not spend", { timeout: 120_000 }, () => {
  const context = withoutScene(DEFAULT_LEVEL.firstRound())
  const side = buildSide({ cursor: STARTER_START_CURSOR, context })
  // A Turret placed, explored, and switched to Units first (its modes are `v` and `b`, after its upgrade's `c`).
  keys(side, "3", ENTER)
  const turret = side.build.state.planned[0]
  assert.ok(turret !== undefined, "the Turret was not placed")
  exploreAt(side, turret.anchor)
  let card = currentCard(side.build.round, side.build.state)
  assert.deepEqual(card?.actions, [
    { hotkey: "c", label: "Heavy rounds", value: "10" },
    { hotkey: "v", label: "Nearest first", value: "on" },
    { hotkey: "b", label: "Units first" },
  ])
  const before = remaining(side.build.round, side.build.state)
  keys(side, "v")
  assert.equal(side.build.state.status.text, "Turret is already set to Nearest first.")
  keys(side, "b")
  assert.equal(side.build.state.status.text, "Turret set to Units first. It stays so until switched again.")
  assert.equal(remaining(side.build.round, side.build.state), before)
  card = currentCard(side.build.round, side.build.state)
  assert.deepEqual(card?.actions?.slice(1), [{ hotkey: "v", label: "Nearest first" }, { hotkey: "b", label: "Units first", value: "on" }])
  // Back and forth again is where it began, and nothing is recorded; then Units first for the round.
  keys(side, "v")
  assert.deepEqual(side.build.state.fitted, [])
  keys(side, "b")
  const resolved = DEFAULT_LEVEL.play.startPulse(side.build.round, side.build.state)
  assert.ok(resolved !== null)
  assert.ok(resolved.timeline.states[0]?.entities.some((entity) => entity.contentId === `${TURRET}+units-first`))
  const next = DEFAULT_LEVEL.play.nextRound(side.build.round, side.build.state, resolved)
  assert.ok(next !== null)
  const standing = next.standing.find((structure) => baseContentId(structure.contentId) === TURRET)
  assert.equal(standing?.contentId, `${TURRET}+units-first`)
  // The round after, with nothing taken: still Units first.
  const viewport = buildLayout({ columns: 80, rows: 24 }, next.grid).viewport
  const round2 = createBuildState(withoutScene(next), standing?.anchor ?? STARTER_START_CURSOR, viewport)
  const later = DEFAULT_LEVEL.play.startPulse(next, round2)
  assert.ok(later?.timeline.states[0]?.entities.some((entity) => entity.contentId === `${TURRET}+units-first`))
  const explored = currentCard(next, { ...round2, exploreMap: true, focus: "grid" })
  assert.deepEqual(explored?.actions?.slice(1), [{ hotkey: "v", label: "Nearest first" }, { hotkey: "b", label: "Units first", value: "on" }])
})

test("a scripted playtest: Explore Map onto the Barracks, buy its production line, watch its wave of five, and read it on its card the round after", { timeout: 120_000 }, () => {
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript("e Right*4 c s s wait~1000*30 Enter click:26,10 Enter") })
  const texts = run.frames.map((frame) => frameToText(frame.frame))
  const bought = texts[6] ?? ""
  assert.match(bought, /\[c\] Production line +undo/u)
  assert.match(bought, /WAVE +5 troopers at 5s/u)
  assert.match(bought, /Barracks: Production line, 15 spent\./u)
  // In the Battle Round the player's count grows by the Barracks's wave: five at once.
  const yours = texts.map((text) => /(\d+) of yours/u.exec(text)?.[1]).map((count) => (count === undefined ? null : Number(count)))
  const grew = yours.flatMap((count, index) => {
    const before = yours[index - 1]
    return count !== null && before !== null && before !== undefined && count > before ? [count - before] : []
  })
  assert.deepEqual(grew, [5], `the wave did not come as five: ${JSON.stringify(yours)}`)
  // Round 2: the standing Barracks's card says what it carries.
  const last = texts[texts.length - 1] ?? ""
  assert.match(last, /round 2 of 3/u)
  assert.match(last, /UPGRADE +Production line/u)
  assert.match(last, /WAVE +5 troopers at 5s/u)
})

// --- The content: a fitted id ---------------------------------------------------------------------------------

test("a fitted id resolves from its base, in its card's order only, and a registry without a fitter knows none", () => {
  const registry = ARMIES.registry
  assert.equal(registry.get(`${BARRACKS}+production-line`).short, "barracks")
  assert.equal(registry.get(`${TURRET}+heavy-rounds+units-first`).attack?.damage, 9)
  assert.deepEqual(registry.get(`${TURRET}+heavy-rounds+units-first`).targetPreference, ["units", "air", "workers"])
  // Out of order, a set's first mode, two of a set, one it does not have, or one twice: none is a building's id.
  for (const id of [`${TURRET}+units-first+heavy-rounds`, `${TURRET}+nearest-first`, `${TURRET}+units-first+units-first`, `${BARRACKS}+heavy-rounds`, `${BARRACKS}+hold`]) {
    assert.equal(registry.has(id), false, `${id} resolved`)
  }
  assert.equal(FIXTURE_REGISTRY.has(`${BARRACKS}+production-line`), false)
  // Its ids are its bases': a fitted id is never listed.
  assert.ok(!registry.ids().some((id) => id.includes("+")))
})

test("the opening sets a carried building down as the content its Build Phase gave it, health and place its own, and leaves the units on its roof alone", () => {
  const registry = ARMIES.registry
  const grid = plainGrid(20, 10)
  const first = opening({
    grid,
    registry,
    structures: [{ contentId: BARRACKS, anchor: { x: 4, y: 4 }, player: "A" }],
    setup: { seed: 1, pulseTicks: 10, forces: [{ player: "A", muster: { x: 12, y: 4 }, units: ["unit.citizen.trooper"] }] },
  }).state
  // The Barracks hurt, and a trooper home on its roof, at its very anchor.
  const hurt: MatchState = {
    ...first,
    entities: first.entities.map((entity) => (entity.contentId === BARRACKS ? { ...entity, hp: 70 } : { ...entity, anchor: { x: 4, y: 4 } })),
  }
  const at: Coord = { x: 4, y: 4 }
  const next = opening({ grid, registry, structures: [], setup: { seed: 1, pulseTicks: 10, forces: [] }, carried: hurt, refits: [{ anchor: at, contentId: `${BARRACKS}+production-line` }] }).state
  const barracks = next.entities.find((entity) => baseContentId(entity.contentId) === BARRACKS)
  assert.equal(barracks?.contentId, `${BARRACKS}+production-line`)
  assert.equal(barracks?.hp, 70)
  assert.deepEqual(barracks?.anchor, at)
  assert.ok(next.entities.some((entity) => entity.contentId === "unit.citizen.trooper"), "the trooper on its roof was refitted")
})
