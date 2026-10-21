// Survivors come home to the roof of the building that made them (the owner, 2026-10-21: "survivors should return to
// their building piling on the roof as close to original position as possible (test with larger armies, they will
// spread around)"), and a wave owed onto a crowded roof comes out because the units on it make way ("We should also
// solve how to "queue" a unit that spawned but has no space yet because there are other units on top").
//
// What is held here: a trained unit remembers its building and the tile it came out on; Recall puts it back on that
// roof, as near that tile as there is room, and the rest on the ground round it, leaving the ground touching the
// building clear; two buildings side by side each take their own back; a fallen home sends its units to the nearest
// building that makes them; the Grid Nexus is never stood on; a mirrored state comes home mirrored; the next round's
// opening keeps a unit on its roof; and a wave owed onto a roof of standing allies comes out within a few ticks.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY, withProduction } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { gridDistance, tilesOf } from "../src/grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { centreTile, openingState, recall } from "../src/match/index.ts"
import type { Force, StructurePlacement } from "../src/match/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { OccupancyIndex } from "../src/grid/occupancy.ts"
import { makingWay } from "../src/pulse/make-way.ts"
import type { Actor, TickContext } from "../src/pulse/shared.ts"
import { freshEntityFields } from "../src/content/index.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"

const NEXUS = "structure.citizen.nexus"
const ENEMY_NEXUS = "structure.ravel.nexus"
const BARRACKS = "structure.citizen.barracks"
const TROOPER = "unit.citizen.trooper"
const VASSE = "unit.citizen.vasse"
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

/** The ground touching a building, corners included. */
function doorstepOf(building: EntityState): Set<string> {
  const own = roofOf(building)
  const step = new Set<string>()
  for (const tile of tilesOfEntity(building)) {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (!own.has(key({ x: tile.x + dx, y: tile.y + dy }))) step.add(key({ x: tile.x + dx, y: tile.y + dy }))
  }
  return step
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

test("a survivor comes home onto its building's roof, on the very tile it came out on when that tile is free", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }, { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 4 }, units: Array.from({ length: 6 }, () => TROOPER) }],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  const troopers = find(before, TROOPER)
  // Every roof tile, in an order unlike the order they stand in.
  const roof = tilesOfEntity(barracks).reverse()
  const state = trainedBy(before, troopers.map((unit) => unit.ordinal), barracks.ordinal, roof)
  const back = recall(state, registry)
  assertHomeIsLegal(back.state, "six home")
  for (const unit of find(back.state, TROOPER)) assert.deepEqual(unit.anchor, unit.homeAt, `${unit.id} did not come back to its own tile`)
  // The walk home goes from where each stood to its tile on the roof; a building is its home.
  for (const move of back.moves) assert.equal(move.home, "producer")
})

test("a big army piles onto its building's roof and spreads round it, leaving the ground touching it clear", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }, { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } }],
    [
      { player: "A", muster: { x: 28, y: 4 }, units: Array.from({ length: 14 }, () => TROOPER) },
      { player: "A", muster: { x: 28, y: 18 }, units: Array.from({ length: 12 }, () => TROOPER) },
    ],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  const troopers = find(before, TROOPER)
  assert.equal(troopers.length, 26)
  // Four waves' worth came out on the same six tiles: a tile remembered by four or five of them.
  const state = trainedBy(before, troopers.map((unit) => unit.ordinal), barracks.ordinal, tilesOfEntity(barracks))
  const back = recall(state, registry)
  assertHomeIsLegal(back.state, "twenty-six home")
  const home = find(back.state, TROOPER)
  const roof = roofOf(barracks)
  const onRoof = home.filter((unit) => roof.has(key(unit.anchor)))
  assert.equal(onRoof.length, 6, "the roof is not full")
  // The rest round it, near, off its doorstep: the units on the roof can always step down.
  const doorstep = doorstepOf(barracks)
  const centre = centreTile(barracks.anchor, footprintOf(barracks))
  for (const unit of home.filter((candidate) => !roof.has(key(candidate.anchor)))) {
    assert.ok(!doorstep.has(key(unit.anchor)), `${unit.id} stands on the Barracks's doorstep, at ${key(unit.anchor)}`)
    assert.ok(gridDistance(unit.anchor, centre) <= 10, `${unit.id} is far from home, at ${key(unit.anchor)}`)
  }
  // The same every run, and a second Recall leaves the roof as it is.
  const again = recall(back.state, registry)
  assert.deepEqual(find(again.state, TROOPER).filter((unit) => roof.has(key(unit.anchor))).map((unit) => unit.ordinal), onRoof.map((unit) => unit.ordinal))
  assertHomeIsLegal(again.state, "recalled twice")
})

test("two Barracks side by side each take their own back, even a unit standing beside the other", () => {
  const before = open(
    [
      { contentId: NEXUS, anchor: { x: 2, y: 10 } },
      { contentId: BARRACKS, anchor: { x: 14, y: 10 } },
      { contentId: BARRACKS, anchor: { x: 17, y: 10 } },
      { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } },
    ],
    [
      // The west Barracks's troopers wait east of the east one, the east one's west of the west one.
      { player: "A", muster: { x: 23, y: 11 }, units: [TROOPER, TROOPER, TROOPER] },
      { player: "A", muster: { x: 9, y: 11 }, units: [TROOPER, TROOPER, TROOPER] },
    ],
  )
  const [west, east] = find(before, BARRACKS).sort((a, b) => a.anchor.x - b.anchor.x) as [EntityState, EntityState]
  const troopers = find(before, TROOPER)
  const eastOfAll = troopers.filter((unit) => unit.anchor.x > 20).map((unit) => unit.ordinal)
  const westOfAll = troopers.filter((unit) => unit.anchor.x < 12).map((unit) => unit.ordinal)
  let state = trainedBy(before, eastOfAll, west.ordinal, tilesOfEntity(west))
  state = trainedBy(state, westOfAll, east.ordinal, tilesOfEntity(east))
  const back = recall(state, registry)
  assertHomeIsLegal(back.state, "two Barracks")
  for (const unit of find(back.state, TROOPER)) {
    const home = unit.home === west.ordinal ? west : east
    assert.ok(roofOf(home).has(key(unit.anchor)), `${unit.id} did not come home to its own Barracks`)
    assert.deepEqual(unit.anchor, unit.homeAt)
  }
})

test("a unit whose building fell goes to the nearest that makes it, onto its roof; with none, beside the Nexus, never on it", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }, { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 12 }, units: [TROOPER, TROOPER] }],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  // A home that is no longer on the Grid: an ordinal nothing has.
  const fallen = trainedBy(before, find(before, TROOPER).map((unit) => unit.ordinal), 999, [{ x: 30, y: 2 }])
  const back = recall(fallen, registry)
  assertHomeIsLegal(back.state, "adopted")
  for (const unit of find(back.state, TROOPER)) {
    assert.ok(roofOf(barracks).has(key(unit.anchor)), `${unit.id} was not adopted onto the standing Barracks's roof`)
  }
  // With no building that makes troopers, the Nexus takes them in — on the ground beside it.
  const orphans = recall(fallen, FIXTURE_REGISTRY)
  const nexus = find(orphans.state, NEXUS)[0] as EntityState
  for (const unit of find(orphans.state, TROOPER)) assert.ok(!roofOf(nexus).has(key(unit.anchor)), `${unit.id} stands on the Nexus`)
  for (const move of orphans.moves) assert.equal(move.home, "nexus")
})

test("a Commander goes home beside her Nexus, never onto it, whatever roofs stand", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }, { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 12 }, units: [VASSE] }],
  )
  const back = recall(before, registry)
  const vasse = find(back.state, VASSE)[0] as EntityState
  const nexus = find(back.state, NEXUS)[0] as EntityState
  assert.ok(!roofOf(nexus).has(key(vasse.anchor)))
  assert.ok(gridDistance(vasse.anchor, centreTile(nexus.anchor, footprintOf(nexus))) <= 4, "she is not beside the Nexus")
  assert.equal(back.moves[0]?.home, "nexus")
})

test("a mirrored state comes home mirrored: no side wins a roof tile by where it stands", () => {
  const westSide = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 11, y: 10 } }],
    [
      { player: "A", muster: { x: 16, y: 6 }, units: Array.from({ length: 6 }, () => TROOPER) },
      { player: "A", muster: { x: 17, y: 15 }, units: Array.from({ length: 6 }, () => TROOPER) },
    ],
  )
  const barracks = find(westSide, BARRACKS)[0] as EntityState
  const trained = trainedBy(westSide, find(westSide, TROOPER).map((unit) => unit.ordinal), barracks.ordinal, tilesOfEntity(barracks))
  // The east side is the west side seen in a mirror: every anchor and remembered tile reflected, side B, the
  // ordinals after the west's — so a tie the ordinals or reading order broke would favour one side and show here.
  const width = (entity: EntityState): number => Math.max(...footprintOf(entity).map((offset) => offset.x)) + 1
  const mirrorX = (entity: EntityState): number => WIDTH - entity.anchor.x - width(entity)
  const offset = trained.nextOrdinal
  const homeOrdinal = (ordinal: number | undefined): number | undefined => (ordinal === undefined ? undefined : ordinal + offset)
  const mirrored: EntityState[] = trained.entities.map((entity) => ({
    ...entity,
    ordinal: entity.ordinal + offset,
    id: `B:${entity.id.slice(2)}`,
    player: "B",
    contentId: entity.contentId === NEXUS ? ENEMY_NEXUS : entity.contentId,
    anchor: { x: mirrorX(entity), y: entity.anchor.y },
    facing: "w",
    ...(entity.home === undefined ? {} : { home: homeOrdinal(entity.home) as number }),
    ...(entity.homeAt === undefined ? {} : { homeAt: { x: WIDTH - 1 - entity.homeAt.x, y: entity.homeAt.y } }),
  }))
  const both: MatchState = { ...trained, entities: [...trained.entities, ...mirrored], nextOrdinal: offset * 2 }
  const back = recall(both, registry)
  assertHomeIsLegal(back.state, "both sides")
  const at = new Map(back.state.entities.map((entity) => [entity.ordinal, entity]))
  for (const entity of back.state.entities.filter((candidate) => candidate.player === "A")) {
    const twin = at.get(entity.ordinal + offset) as EntityState
    assert.deepEqual(twin.anchor, { x: mirrorX(entity), y: entity.anchor.y }, `${entity.id} and its mirror ${twin.id} did not come home mirrored`)
  }
})

test("the next round opens with a unit where Recall left it on its roof; a building planned on it moves it", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }, { contentId: ENEMY_NEXUS, player: "B", anchor: { x: 35, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 4 }, units: Array.from({ length: 9 }, () => TROOPER) }],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  const back = recall(trainedBy(before, find(before, TROOPER).map((unit) => unit.ordinal), barracks.ordinal, tilesOfEntity(barracks)), registry).state
  const next = openingState({ grid: OPEN, registry, structures: [], carried: back, setup: { seed: 7, pulseTicks: 240, forces: [] } })
  for (const unit of find(back, TROOPER)) {
    const opened = next.entities.find((entity) => entity.ordinal === unit.ordinal) as EntityState
    assert.deepEqual(opened.anchor, unit.anchor, `${unit.id} was moved off where Recall left it`)
    assert.deepEqual([opened.home, opened.homeAt], [unit.home, unit.homeAt], "a carried unit forgot its home")
  }
  assertHomeIsLegal(next, "round 2 opens")
  // A Barracks planned on a trooper standing beside home moves the trooper, as it always has.
  const clear = (unit: EntityState): boolean => tilesOf(unit.anchor, footprintOf(barracks)).every((tile) => !roofOf(barracks).has(key(tile)))
  const beside = find(back, TROOPER).find((unit) => !roofOf(barracks).has(key(unit.anchor)) && clear(unit)) as EntityState
  const planned = openingState({ grid: OPEN, registry, structures: [{ contentId: BARRACKS, anchor: beside.anchor }], carried: back, setup: { seed: 7, pulseTicks: 240, forces: [] } })
  const moved = planned.entities.find((entity) => entity.ordinal === beside.ordinal) as EntityState
  assert.notDeepEqual(moved.anchor, beside.anchor)
  assertHomeIsLegal(planned, "a Barracks planned on a survivor")
})

// --- The queue: a wave owed onto a crowded roof ----------------------------------------------------

test("a wave owed onto a roof full of standing allies comes out within a few ticks, as they make way; none is lost", () => {
  // Six survivors home on the roof, nothing to fight (the enemy's Nexus far off, out of reach and with no target to
  // head for, they stand): the wave of four comes due with no room on the roof.
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 10 } }, { contentId: BARRACKS, anchor: { x: 15, y: 10 } }],
    [{ player: "A", muster: { x: 26, y: 4 }, units: Array.from({ length: 6 }, () => TROOPER) }],
  )
  const barracks = find(before, BARRACKS)[0] as EntityState
  const carried = recall(trainedBy(before, find(before, TROOPER).map((unit) => unit.ordinal), barracks.ordinal, tilesOfEntity(barracks)), registry).state
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
  return { actors, byOrdinal: new Map(actors.map((actor) => [actor.ordinal, actor])), index, targets: {} } as unknown as TickContext
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
})

const CRAWLER_WINDUP = registry.get(CRAWLER).attack?.windupTicks ?? 0
