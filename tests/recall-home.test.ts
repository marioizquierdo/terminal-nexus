// A unit's home, and its building's roof. A unit a building trains remembers the building and the tile it came out on;
// a wave owed onto a crowded roof comes out because the units on it make way (the owner: "We should also solve how to
// "queue" a unit that spawned but has no space yet because there are other units on top"); the next round opens with a
// unit where it stood, a roof included, and a building planned on it moves it.
//
// Survivors once came home to their building's roof between rounds (Recall); since 2026-10-26 they stay on the Grid and
// regroup (src/match/regroup.ts, tests/regroup.test.ts), and the tests of the walk home went with it. The file keeps
// its name while the design documents cite it.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { openingState, standDown } from "../src/match/index.ts"
import type { Force, StructurePlacement } from "../src/match/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { OccupancyIndex } from "../src/grid/occupancy.ts"
import { makingWay } from "../src/pulse/make-way.ts"
import type { Actor, TickContext } from "../src/pulse/shared.ts"
import { freshEntityFields } from "../src/content/index.ts"
import { waitingToComeOut } from "../src/view/pulse-scene.ts"
import { currentCard } from "../src/build/card.ts"
import { cellForTile } from "../src/build/layout.ts"
import { starterContext } from "../src/cli/starter.ts"
import { cellAt } from "../src/view/frame.ts"
import type { Side } from "./build-helpers.ts"
import { buildSide, compose, keys, screenText } from "./build-helpers.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"

const NEXUS = "structure.citizen.nexus"
const ENEMY_NEXUS = "structure.ravel.nexus"
const BARRACKS = "structure.citizen.barracks"
const TROOPER = "unit.citizen.trooper"
const CRAWLER = "unit.bench.siegecrawler"

const RECIPE = { output: TROOPER, perWave: 4, waves: 1, firstTicks: 12, intervalTicks: 24 }
const registry = withProduction(FIXTURE_REGISTRY, { [BARRACKS]: RECIPE })

const WIDTH = 40
const OPEN: GridTerrain = { width: WIDTH, height: 24, tiles: Array.from({ length: WIDTH * 24 }, () => "terrain.plain" as TerrainId) }

function open(structures: readonly StructurePlacement[], forces: readonly Force[], content: ContentRegistry = registry): MatchState {
  return openingState({ grid: OPEN, registry: content, structures, setup: { seed: 7, pulseTicks: 240, forces } })
}

const key = (tile: Coord): string => `${tile.x},${tile.y}`
const footprintOf = (entity: EntityState) => registry.get(entity.contentId).footprint
const isBuilding = (entity: EntityState): boolean => registry.get(entity.contentId).layer === "obstacles"
const tilesOfEntity = (entity: EntityState): Coord[] => tilesOf(entity.anchor, footprintOf(entity))
const roofOf = (building: EntityState): Set<string> => new Set(tilesOfEntity(building).map(key))
const find = (state: MatchState, contentId: string, player: PlayerId = "A"): EntityState[] =>
  state.entities.filter((entity) => entity.contentId === contentId && entity.player === player)

/** Two units never on one tile, two buildings never; a unit on a building only on its own side's. */
function assertHomeIsLegal(state: MatchState, label: string): void {
  const buildings = new Map<string, PlayerId>()
  for (const building of state.entities.filter(isBuilding)) {
    for (const tile of tilesOfEntity(building)) {
      assert.ok(!buildings.has(key(tile)), `${label}: two buildings on ${key(tile)}`)
      buildings.set(key(tile), building.player)
    }
  }
  const units = new Set<string>()
  for (const unit of state.entities.filter((entity) => !isBuilding(entity))) {
    for (const tile of tilesOfEntity(unit)) {
      assert.ok(!units.has(key(tile)), `${label}: two units on ${key(tile)}`)
      units.add(key(tile))
      const owner = buildings.get(key(tile))
      assert.ok(owner === undefined || owner === unit.player, `${label}: ${unit.id} stands on the enemy's building`)
    }
  }
}

/** `state` with each unit of `ordinals` remembering `home` and, in turn, the tiles of `homeAts`. */
function trainedBy(state: MatchState, ordinals: readonly number[], home: number, homeAts: readonly Coord[]): MatchState {
  return {
    ...state,
    entities: state.entities.map((entity) => {
      const position = ordinals.indexOf(entity.ordinal)
      return position < 0 ? entity : { ...entity, home, homeAt: homeAts[position % homeAts.length] as Coord }
    }),
  }
}

// --- Remembering the home ---------------------------------------------------------------------------

test("a unit a building trains remembers the building and the tile it came out on; nothing else remembers a home", () => {
  const initialState = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }],
    [{ player: "A", muster: { x: 8, y: 4 }, units: [TROOPER, TROOPER] }],
  )
  const run = resolvePulse({ initialState, registry, pulseTicks: 30, seed: 7 })
  const barracks = find(run.finalState, BARRACKS)[0] as EntityState
  const trained = run.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined)
  assert.equal(trained.length, 4)
  for (const event of trained) {
    if (event.kind !== "entity.spawned") continue
    const unit = run.finalState.entities.find((entity) => entity.ordinal === event.ordinal) as EntityState
    assert.equal(unit.home, barracks.ordinal)
    assert.deepEqual(unit.homeAt, event.at, "a trained unit does not remember the tile it came out on")
    assert.ok(roofOf(barracks).has(key(event.at)))
  }
  // The squad the opening mustered was trained by nobody.
  const mustered = run.finalState.entities.filter((entity) => entity.contentId === TROOPER && !trained.some((event) => event.kind === "entity.spawned" && event.ordinal === entity.ordinal))
  assert.equal(mustered.length, 2)
  for (const unit of mustered) assert.deepEqual([unit.home, unit.homeAt], [undefined, undefined])
})

// --- Recall onto the roof ---------------------------------------------------------------------------

test("the next round opens with a unit where it stood, on its own building's roof too; a building planned on one moves it", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }, { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 4 }, units: Array.from({ length: 9 }, () => TROOPER) }],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  // Two of them on the Barracks's roof, as a wave that never walked off leaves them; the rest out on the ground.
  const roofTiles = tilesOfEntity(barracks)
  const trained = trainedBy(before, find(before, TROOPER).map((unit) => unit.ordinal), barracks.ordinal, roofTiles)
  const onRoof = new Set(find(trained, TROOPER).slice(0, 2).map((unit) => unit.ordinal))
  const back: MatchState = { ...trained, entities: trained.entities.map((entity) => (onRoof.has(entity.ordinal) ? { ...entity, anchor: entity.homeAt as Coord } : entity)) }
  const next = openingState({ grid: OPEN, registry, structures: [], carried: back, setup: { seed: 7, pulseTicks: 240, forces: [] } })
  for (const unit of find(back, TROOPER)) {
    const opened = next.entities.find((entity) => entity.ordinal === unit.ordinal) as EntityState
    assert.deepEqual(opened.anchor, unit.anchor, `${unit.id} was moved off where it stood`)
    assert.deepEqual([opened.home, opened.homeAt], [unit.home, unit.homeAt], "a carried unit forgot its home")
  }
  assertHomeIsLegal(next, "round 2 opens")
  // A Barracks planned on a trooper out on the ground moves the trooper: it walks out from under it (makeRoom).
  const beside = find(back, TROOPER).find((unit) => !onRoof.has(unit.ordinal)) as EntityState
  const planned = openingState({ grid: OPEN, registry, structures: [{ contentId: BARRACKS, anchor: beside.anchor }], carried: back, setup: { seed: 7, pulseTicks: 240, forces: [] } })
  const moved = planned.entities.find((entity) => entity.ordinal === beside.ordinal) as EntityState
  assert.notDeepEqual(moved.anchor, beside.anchor)
  assertHomeIsLegal(planned, "a Barracks planned on a survivor")
})

// --- The queue: a wave owed onto a crowded roof ----------------------------------------------------

test("a wave owed onto a roof full of standing allies comes out within a few ticks, as they make way; none is lost", () => {
  // Six allies standing on the roof, nothing to fight (the enemy's Nexus far off, out of reach and with no target to
  // head for, they stand): the wave of four comes due with no room on the roof. The six are set on it by hand: what a
  // wave that never walked off would leave.
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 4 }, units: Array.from({ length: 6 }, () => TROOPER) }],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  const roofTiles = tilesOfEntity(barracks)
  const recalled = standDown(trainedBy(before, find(before, TROOPER).map((unit) => unit.ordinal), barracks.ordinal, roofTiles), registry).state
  const carried: MatchState = {
    ...recalled,
    entities: recalled.entities.map((entity) => (entity.contentId === TROOPER ? { ...entity, anchor: entity.homeAt as Coord } : entity)),
  }
  const roof = roofOf(barracks)
  assert.equal(find(carried, TROOPER).filter((unit) => roof.has(key(unit.anchor))).length, 6, "the roof is not full")
  const initialState = openingState({ grid: OPEN, registry, structures: [], carried, setup: { seed: 7, pulseTicks: 60, forces: [] } })
  const run = resolvePulse({ initialState, registry, pulseTicks: 60, seed: 7 })
  const ticks = run.events.filter((event) => event.kind === "entity.spawned" && event.trainedBy !== undefined).map((event) => event.tick)
  assert.equal(ticks.length, 4, `the wave did not all come out: ${JSON.stringify(ticks)}`)
  assert.ok(ticks.every((tick) => tick >= RECIPE.firstTicks && tick <= RECIPE.firstTicks + 8), `the wave waited too long: ${JSON.stringify(ticks)}`)
  const after = run.finalState
  assert.equal(find(after, TROOPER).length, 10, "a unit was lost")
  assert.equal((find(after, BARRACKS)[0] as EntityState).owed, 0)
  // Those that made way stand on the ground; the wave stands on its roof.
  for (const unit of find(after, TROOPER).filter((candidate) => candidate.ordinal < initialState.nextOrdinal)) {
    assert.ok(!roof.has(key(unit.anchor)), `${unit.id} never made way`)
  }
})

/** A bare tick context round `actors`, for asking one actor its purpose: who stands where, and nothing else. */
function contextOf(actors: Actor[]): TickContext {
  const index = new OccupancyIndex(OPEN)
  for (const actor of actors) index.add(actor.definition.layer, actor.ordinal, actor.anchor, actor.definition.footprint)
  return { actors, byOrdinal: new Map(actors.map((actor) => [actor.ordinal, actor])), index, targets: {}, pulse: { registry } } as unknown as TickContext
}

function actorOf(ordinal: number, contentId: string, player: PlayerId, anchor: Coord, fields: Partial<EntityState> = {}): Actor {
  const definition = registry.get(contentId)
  return {
    ordinal,
    id: `${player}:${definition.short}#${ordinal + 1}`,
    player,
    contentId,
    hp: definition.maxHp,
    anchor,
    facing: "e",
    ...freshEntityFields(definition),
    ...fields,
    definition,
    pendingDead: false,
    killer: null,
  } as Actor
}

test("who makes way: one standing on its side's roofs while a wave is owed, unless part way through its windup", () => {
  const barracks = actorOf(0, BARRACKS, "A", { x: 15, y: 10 }, { owed: 2 })
  const enemy = actorOf(1, TROOPER, "B", { x: 20, y: 10 })
  const idle = actorOf(2, TROOPER, "A", { x: 15, y: 10 })
  const crawler = actorOf(3, CRAWLER, "A", { x: 16, y: 11 })
  const context = contextOf([barracks, enemy, idle, crawler])
  const stand = { kind: "stand" } as const
  assert.deepEqual(makingWay(context, idle, null, stand), { kind: "walk", goal: { kind: "ground", toward: idle.anchor } })
  // Already walking: off the roofs first, facing where it was going.
  assert.deepEqual(makingWay(context, idle, enemy, { kind: "walk", goal: { kind: "unit", target: enemy, reach: { kind: "touch", steps: 1 } } }), {
    kind: "walk",
    goal: { kind: "ground", toward: enemy.anchor },
  })
  // In reach and not yet aiming: it makes way. Part way through its windup: it holds until the shot.
  const full = CRAWLER_WINDUP
  crawler.windup = full
  assert.equal(makingWay(context, crawler, enemy, stand).kind, "walk")
  crawler.windup = full - 1
  assert.equal(makingWay(context, crawler, enemy, stand).kind, "stand")
  // Nothing owed: everyone stands as they would.
  barracks.owed = 0
  assert.equal(makingWay(context, idle, null, stand).kind, "stand")
  // On the ground, owed or not, it stands.
  barracks.owed = 2
  assert.equal(makingWay(context, actorOf(4, TROOPER, "A", { x: 20, y: 14 }), null, stand).kind, "stand")
  // Owed, but the army has no place for the wave under its supply: the wave waits for a place, not for the roof, and
  // nobody is moved for it. A Supply Depot's places, every one taken by troopers standing far off.
  const depot = actorOf(10, "structure.citizen.depot", "A", { x: 30, y: 2 })
  const places = registry.get("structure.citizen.depot").supplyProvided ?? 0
  const army = Array.from({ length: places }, (_, index) => actorOf(11 + index, TROOPER, "A", { x: 2 + index, y: 20 }))
  const capped = contextOf([barracks, enemy, idle, depot, ...army])
  assert.equal(makingWay(capped, idle, null, stand).kind, "stand", "a wave the army has no place for moved a unit off the roof")
  // One place free again: it makes way.
  assert.equal(makingWay(contextOf([barracks, enemy, idle, depot, ...army.slice(2)]), idle, null, stand).kind, "walk")
})

const CRAWLER_WINDUP = registry.get(CRAWLER).attack?.windupTicks ?? 0

test("the Battle Round says how many wait to come out: for room on a roof, or for a place in the army", () => {
  const nexus = { player: "A" as const, contentId: NEXUS }
  const owing = { player: "A" as const, contentId: BARRACKS, owed: 3 }
  const raid = { player: "B" as const, contentId: BARRACKS, owed: 5 }
  const trooper = { player: "A" as const, contentId: TROOPER }
  // With no structure giving supply an army has no cap: all three wait for room on the roof. Only the player's count.
  assert.deepEqual(waitingToComeOut([nexus, owing, raid], registry, "A"), { roof: 3, army: 0 })
  assert.deepEqual(waitingToComeOut([nexus, trooper], registry, "A"), { roof: 0, army: 0 })
  // A Nexus that gives two places, both taken: the three wait for a place in the army.
  const capped = {
    has: (id: string) => registry.has(id),
    get: (id: string) => (id === NEXUS ? { ...registry.get(NEXUS), supplyProvided: 2 } : registry.get(id)),
  } as unknown as ContentRegistry
  assert.deepEqual(waitingToComeOut([nexus, owing, trooper, trooper], capped, "A"), { roof: 0, army: 3 })
  assert.deepEqual(waitingToComeOut([nexus, owing, trooper], capped, "A"), { roof: 3, army: 0 })
})

// --- On screen ------------------------------------------------------------------------------------

test("the Build Phase draws survivors on their own roof, and the building's card says how many stand there", () => {
  const context = starterContext()
  // The starter Barracks at 25,10: three of yours home on its roof, one beside it.
  const field = [
    { contentId: TROOPER, anchor: { x: 25, y: 10 }, player: "A" as const, hp: 40 },
    { contentId: TROOPER, anchor: { x: 26, y: 10 }, player: "A" as const, hp: 40 },
    { contentId: TROOPER, anchor: { x: 27, y: 11 }, player: "A" as const, hp: 40 },
    { contentId: TROOPER, anchor: { x: 24, y: 12 }, player: "A" as const, hp: 40 },
  ]
  const side = buildSide({ context: { ...context, field } })
  const explore = (on: Side): void => {
    keys(on, "e")
    const { cursor } = on.build.state
    on.build.run([{ kind: "move-cursor", dx: 26 - cursor.x, dy: 11 - cursor.y }])
  }
  explore(side)
  const card = currentCard(side.context, side.build.state)
  assert.equal(card?.title, "Barracks")
  assert.deepEqual(card?.stats.find((stat) => stat.label === "ON ROOF"), { label: "ON ROOF", value: "3 of yours" })
  assert.match(screenText(side), /ON ROOF +3 of yours/u)
  // Each trooper's own glyph on its roof tile, where the Barracks's would be.
  const frame = compose(side, {}, "monochrome")
  const glyphAt = (tile: Coord): string | undefined => {
    const at = cellForTile(side.layout, side.build.state.camera, tile)
    return cellAt(frame, at.x, at.y)?.glyph
  }
  const trooperGlyph = glyphAt({ x: 24, y: 12 })
  for (const unit of field.slice(0, 3)) assert.equal(glyphAt(unit.anchor), trooperGlyph, `no trooper drawn on the roof at ${key(unit.anchor)}`)
  // A roof with nobody on it says nothing.
  const empty = buildSide({ context: { ...context, field: [] } })
  explore(empty)
  assert.equal(currentCard(empty.context, empty.build.state)?.stats.some((stat) => stat.label === "ON ROOF"), false)
})
