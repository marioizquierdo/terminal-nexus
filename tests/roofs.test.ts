// Units walk out over the roofs (docs/system-design/pulse.md, the milestone's step 16H): a building sets the units it
// makes down on its own roof, and they walk the roofs of their own side's buildings toward where they are going
// until all of each stands on ground; from then on buildings are walls to it, its own included. The owner,
// 2026-10-20: "they will just keep walking on the rooftops on the natural direction where their destination is, this
// will help keep the troop waves together when they spawn."

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import type { ContentRegistry, ProductionRecipe } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { tilesOf } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"

type Placed = readonly [x: number, y: number, content: string]

const BARRACKS = "structure.citizen.barracks"
const DEN = "structure.ravel.den"
const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"
const RAIDER = "unit.ravel.raider"
const SLINGER = "unit.ravel.slinger"
const CITIZEN_NEXUS = "structure.citizen.nexus"
const RAVEL_NEXUS = "structure.ravel.nexus"

const WIDTH = 48
const HEIGHT = 16

/** One side's placement block: each content at its tile (a structure by its centre tile, as a map writes it). */
function block(placed: readonly Placed[]): PlacementBlock {
  const symbols = "abcdefghijklmnopqrstuvwxyz"
  const rows: string[][] = []
  const legend: Record<string, { content: string }> = {}
  placed.forEach(([x, y, content], index) => {
    const symbol = symbols[index] as string
    while (rows.length <= y) rows.push([])
    const row = rows[y] as string[]
    while (row.length <= x) row.push(" ")
    row[x] = symbol
    legend[symbol] = { content }
  })
  return { rows: rows.map((row) => row.join("")), legend }
}

type Battle = Readonly<{ registry: ContentRegistry; states: MatchState[]; events: DomainEvent[] }>

/** An open 48 x 16 Grid with each side placed as given, its buildings making units by `recipes`, played tick by
 *  tick for `ticks` (or until it ends). `between`, when given, may change the state between two ticks. */
function battle(
  sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>,
  recipes: Readonly<Record<string, ProductionRecipe>>,
  ticks: number,
  between?: (state: MatchState) => MatchState,
): Battle {
  const registry = withProduction(FIXTURE_REGISTRY, recipes)
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const scenario: ScenarioDefinition = {
    id: "roofs",
    name: "roofs",
    grid: { width: WIDTH, height: HEIGHT },
    seed: 1,
    pulseTicks: ticks,
    terrain: Array.from({ length: HEIGHT }, () => ".".repeat(WIDTH)),
    terrainLegend: { ".": "terrain.plain" },
    placements,
  }
  const loaded = loadScenario(scenario, { registry })
  const context = contextFor(loaded.state, registry, ticks)
  const states: MatchState[] = [loaded.state]
  const events: DomainEvent[] = []
  let state = loaded.state
  while (state.outcome === null && state.tick < ticks) {
    const result = stepTick(between === undefined ? state : between(state), context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { registry, states, events }
}

const recipe = (output: string, perWave: number): ProductionRecipe => ({ output, perWave, waves: 1, firstTicks: 2, intervalTicks: 600 })

const trained = (events: readonly DomainEvent[]) =>
  events.filter((event): event is Extract<DomainEvent, { kind: "entity.spawned" }> => event.kind === "entity.spawned" && event.trainedBy !== undefined)

const key = (tile: Coord): string => `${tile.x},${tile.y}`

/** The tiles of every building of `player` in `state`. */
function roofsOf(registry: ContentRegistry, state: MatchState, player: PlayerId): Set<string> {
  const roofs = new Set<string>()
  for (const entity of state.entities) {
    const definition = registry.get(entity.contentId)
    if (entity.player !== player || definition.layer !== "obstacles") continue
    for (const tile of tilesOf(entity.anchor, definition.footprint)) roofs.add(key(tile))
  }
  return roofs
}

/** How many tiles of `entity`'s body stand on its own side's roofs in `state`. */
function onRoofs(registry: ContentRegistry, state: MatchState, entity: EntityState): number {
  const roofs = roofsOf(registry, state, entity.player)
  return tilesOf(entity.anchor, registry.get(entity.contentId).footprint).filter((tile) => roofs.has(key(tile))).length
}

/** Every unit of `battle`, tick by tick: once all of it stands on ground it never sets foot on a roof again. */
function neverClimbsBack(fight: Battle): string[] {
  const out = new Set<number>()
  const wrong: string[] = []
  for (const state of fight.states) {
    for (const entity of state.entities) {
      if (fight.registry.get(entity.contentId).layer === "obstacles") continue
      const on = onRoofs(fight.registry, state, entity)
      if (on === 0) out.add(entity.ordinal)
      else if (out.has(entity.ordinal)) wrong.push(`#${entity.ordinal} climbed back at tick ${state.tick}, at ${key(entity.anchor)}`)
    }
  }
  return wrong
}

test("a building sets its wave down on its own roof, never two on one tile, and a wave bigger than its roof files out over a few ticks", () => {
  // A Barracks (six tiles) making eight at once, the enemy's Nexus far to the east.
  const fight = battle({ A: [[6, 7, BARRACKS]], B: [[42, 7, RAVEL_NEXUS]] }, { [BARRACKS]: recipe(TROOPER, 8) }, 40)
  const barracks = fight.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
  assert.ok(barracks !== undefined)
  const roof = new Set(tilesOf(barracks.anchor, fight.registry.get(BARRACKS).footprint).map(key))
  const wave = trained(fight.events)
  const first = wave.filter((event) => event.tick === 2)
  assert.equal(first.length, 6, "the roof did not fill")
  assert.ok(first.every((event) => roof.has(key(event.at))), "a unit was set down off the roof")
  assert.equal(new Set(first.map((event) => key(event.at))).size, 6, "two on one tile")
  // The other two come as the first walk off, never dropped.
  const later = wave.filter((event) => event.tick > 2)
  assert.equal(later.length, 2, "the wave lost units it owed")
  assert.ok(later.every((event) => event.tick <= 20 && roof.has(key(event.at))), `the rest came late, or off the roof: ${later.map((event) => `${event.tick}@${key(event.at)}`).join(" ")}`)
})

test("units walk the roofs toward where they are going and step down on that side, east or west alike", () => {
  for (const [nexusAt, side] of [[42, "east"], [2, "west"]] as const) {
    const fight = battle({ A: [[24, 7, BARRACKS]], B: [[nexusAt, 7, RAVEL_NEXUS]] }, { [BARRACKS]: recipe(TROOPER, 4) }, 40)
    const barracks = fight.states[0]?.entities.find((entity) => entity.contentId === BARRACKS)
    assert.ok(barracks !== undefined)
    const roof = tilesOf(barracks.anchor, fight.registry.get(BARRACKS).footprint)
    const left = Math.min(...roof.map((tile) => tile.x))
    const right = Math.max(...roof.map((tile) => tile.x))
    // Where each trooper first stands wholly on the ground: beyond the roof's edge on the enemy's side.
    for (const event of trained(fight.events)) {
      const down = fight.states.map((state) => state.entities.find((entity) => entity.ordinal === event.ordinal)).find((entity) => entity !== undefined && onRoofs(fight.registry, fight.states[0] as MatchState, entity) === 0)
      assert.ok(down !== undefined, `#${event.ordinal} never stepped down`)
      if (side === "east") assert.ok(down.anchor.x > right, `#${event.ordinal} stepped down at ${key(down.anchor)}, not east of ${right}`)
      else assert.ok(down.anchor.x < left, `#${event.ordinal} stepped down at ${key(down.anchor)}, not west of ${left}`)
    }
    assert.deepEqual(neverClimbsBack(fight), [])
  }
})

test("across a block of buildings the wave walks the roofs, and a unit out on the ground never climbs back", () => {
  // Four Barracks side by side, a block twelve tiles wide, each making four: the westmost's troopers cross three
  // roofs to reach the ground facing the enemy.
  const blockOfFour: Placed[] = [6, 9, 12, 15].map((x) => [x, 7, BARRACKS] as const)
  const fight = battle({ A: blockOfFour, B: [[42, 7, RAVEL_NEXUS]] }, { [BARRACKS]: recipe(TROOPER, 4) }, 80)
  assert.equal(trained(fight.events).length, 16)
  assert.deepEqual(neverClimbsBack(fight), [])
  // Every one of them reached the ground.
  const last = fight.states.at(-1) as MatchState
  for (const entity of last.entities.filter((candidate) => candidate.contentId === TROOPER)) {
    assert.equal(onRoofs(fight.registry, last, entity), 0, `#${entity.ordinal} is still on the roofs at ${key(entity.anchor)}`)
  }
})

test("a wide unit comes out over its building too: on the roof until all of it stands on ground", () => {
  // A Den making raiders, three tiles wide, as wide as its roof.
  const fight = battle({ B: [[30, 7, DEN]], A: [[4, 7, CITIZEN_NEXUS]] }, { [DEN]: recipe(RAIDER, 2) }, 60)
  const den = fight.states[0]?.entities.find((entity) => entity.contentId === DEN)
  assert.ok(den !== undefined)
  const roof = new Set(tilesOf(den.anchor, fight.registry.get(DEN).footprint).map(key))
  const wave = trained(fight.events)
  assert.equal(wave.length, 2)
  for (const event of wave) {
    assert.ok(tilesOf(event.at, fight.registry.get(RAIDER).footprint).every((tile) => roof.has(key(tile))), `a raider came out at ${key(event.at)}, not wholly on the roof`)
  }
  assert.deepEqual(neverClimbsBack(fight), [])
})

test("a unit on a roof fights from it, and is hit there like any unit", () => {
  // Marksmen on a Barracks's roof, slingers of the raid's within reach of it: they shoot from the roof, and are shot
  // there. The wave comes on the first tick, before anyone chooses: a unit on a roof is as near as the roof under it,
  // and among equally near ones the weaker is chosen, as anywhere.
  const fight = battle({ A: [[20, 7, BARRACKS]], B: [[25, 7, SLINGER], [25, 8, SLINGER], [44, 7, RAVEL_NEXUS]] }, { [BARRACKS]: { ...recipe(MARKSMAN, 2), firstTicks: 1 } }, 30)
  const marksmen = new Set(trained(fight.events).map((event) => event.ordinal))
  const stateAt = (tick: number) => fight.states.find((state) => state.tick === tick - 1) as MatchState
  const onARoof = (ordinal: number, tick: number): boolean => {
    const state = stateAt(tick)
    const entity = state.entities.find((candidate) => candidate.ordinal === ordinal)
    return entity !== undefined && onRoofs(fight.registry, state, entity) > 0
  }
  const shot = fight.events.filter((event): event is Extract<DomainEvent, { kind: "damage.applied" }> => event.kind === "damage.applied")
  assert.ok(shot.some((event) => marksmen.has(event.sourceOrdinal) && onARoof(event.sourceOrdinal, event.tick)), "no marksman shot from the roof")
  assert.ok(shot.some((event) => marksmen.has(event.ordinal) && onARoof(event.ordinal, event.tick)), "no marksman was hit on the roof")
})

test("a building that falls with units on its roof leaves them standing where they were, out on the ground", () => {
  // The wave comes at tick 2; between ticks 3 and 4 the Barracks is gone, as if it had fallen.
  let at: Map<number, Coord> | null = null
  const fight = battle({ A: [[20, 7, BARRACKS]], B: [[44, 7, RAVEL_NEXUS]] }, { [BARRACKS]: { ...recipe(TROOPER, 6), firstTicks: 2 } }, 12, (state) => {
    if (state.tick !== 3) return state
    at = new Map(state.entities.filter((entity) => entity.contentId === TROOPER).map((entity) => [entity.ordinal, entity.anchor]))
    return { ...state, entities: state.entities.filter((entity) => entity.contentId !== BARRACKS) }
  })
  assert.ok(at !== null, "the wave never came")
  const before = at as Map<number, Coord>
  assert.ok(before.size > 0)
  const after = fight.states.find((state) => state.tick === 4) as MatchState
  for (const [ordinal, tile] of before) {
    const trooper = after.entities.find((entity) => entity.ordinal === ordinal)
    assert.ok(trooper !== undefined, `#${ordinal} went with the building`)
    // Still where it stood, or one step on from it: nothing threw it anywhere.
    assert.ok(Math.abs(trooper.anchor.x - tile.x) + Math.abs(trooper.anchor.y - tile.y) <= 1, `#${ordinal} moved from ${key(tile)} to ${key(trooper.anchor)}`)
  }
})

test("in PERIMETER's first round with the defence plan, every unit that walks out over a roof stays out", async () => {
  const { STARTER_STANDING, starterGrid } = await import("../src/build/catalog.ts")
  const { defaultValue } = await import("../src/build/all-settings.ts")
  const { resolveMissionPulse, spawningRegistry } = await import("../src/match/index.ts")
  const { PERIMETER, PERIMETER_LEVEL } = await import("../src/armies/index.ts")
  const spawns = Object.fromEntries(PERIMETER_LEVEL.offer.buildings.flatMap((card) => (card.spawns === undefined ? [] : [[card.structure, card.spawns] as const])))
  const registry = spawningRegistry(FIXTURE_REGISTRY, spawns, defaultValue("firstWave") * 12)
  // Two Barracks of the player's side by side with the map's, which they may now touch.
  const run = resolveMissionPulse({
    mission: PERIMETER,
    grid: starterGrid(),
    registry,
    pulse: 1,
    carried: null,
    structures: [...STARTER_STANDING, { contentId: BARRACKS, anchor: { x: 22, y: 10 } }, { contentId: BARRACKS, anchor: { x: 25, y: 12 } }],
  })
  assert.ok(trained(run.events).length >= 8, "the Barracks did not all send their waves")
  assert.deepEqual(neverClimbsBack({ registry, states: [...run.states], events: [...run.events] }), [])
})

test("the way off the roof: along the route a wave crosses a block's roofs; the nearest way it steps straight down", () => {
  // A row of four Barracks twelve tiles long, the enemy's Nexus far east. Twenty ticks after the wave comes, along the
  // route the westmost Barracks's troopers are still crossing the roofs; the nearest way, every trooper is down.
  const blockOfFour: Placed[] = [6, 9, 12, 15].map((x) => [x, 7, BARRACKS] as const)
  const stillOnRoofs = (exit: "route" | "ground"): number => {
    const fight = battle({ A: blockOfFour, B: [[42, 7, RAVEL_NEXUS]] }, { [BARRACKS]: { ...recipe(TROOPER, 4), ...(exit === "ground" ? { exit } : {}) } }, 22)
    const state = fight.states.at(-1) as MatchState
    return state.entities.filter((entity) => entity.contentId === TROOPER && onRoofs(fight.registry, state, entity) > 0).length
  }
  assert.ok(stillOnRoofs("route") > 0, "along the route, no trooper crossed the roofs")
  assert.equal(stillOnRoofs("ground"), 0, "the nearest way, a trooper is still on the roofs")
})
