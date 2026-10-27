// The match layer. The opening state a Pulse starts from, and the rules at the other
// end of it (the regroup, src/match/regroup.ts). Both are deterministic rules-layer code beside the kernel, so the
// tests are the kernel's kind: exact states, exact hashes, no screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { gridDistance, tilesOf } from "../src/grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { PulseSetupError, centreTile, openingState, regroup } from "../src/match/index.ts"
import type { Force, PulseSetup, StructurePlacement } from "../src/match/index.ts"
import { gameplayRng } from "../src/rng/pcg32.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"

const NEXUS = "structure.citizen.nexus"
const BARRACKS = "structure.citizen.barracks"
const HATCHERY = "structure.bench.hatchery"
const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"
const RUNNER = "unit.ravel.runner"
const RAIDER = "unit.ravel.raider"
const SPAWNLING = "unit.bench.spawnling"

/** A Grid from rows of `.` (plain), `#` (rock) and `*` (deposit), north to south. */
function gridOf(rows: readonly string[]): GridTerrain {
  const ids: Record<string, TerrainId> = { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" }
  const width = rows[0]?.length ?? 0
  return {
    width,
    height: rows.length,
    tiles: rows.flatMap((row) => [...row].map((character) => ids[character] as TerrainId)),
  }
}

const OPEN = gridOf(Array.from({ length: 24 }, () => ".".repeat(40)))

function setupOf(forces: readonly Force[], pulseTicks = 240, seed = 4242): PulseSetup {
  return { seed, pulseTicks, forces }
}

function open(
  structures: readonly StructurePlacement[],
  forces: readonly Force[],
  grid: GridTerrain = OPEN,
): MatchState {
  return openingState({ grid, registry: FIXTURE_REGISTRY, structures, setup: setupOf(forces) })
}

const definitionOf = (entity: EntityState) => FIXTURE_REGISTRY.get(entity.contentId)

/** Every tile an entity covers, keyed, for overlap checks. */
function tileKeys(state: MatchState, only?: (entity: EntityState) => boolean): string[] {
  return state.entities
    .filter((entity) => only === undefined || only(entity))
    .flatMap((entity) => tilesOf(entity.anchor, definitionOf(entity).footprint).map((tile) => `${tile.x},${tile.y}`))
}

function assertNoTileShared(state: MatchState, label: string): void {
  const keys = tileKeys(state)
  assert.equal(new Set(keys).size, keys.length, `${label}: two entities cover one tile`)
}

const centreOf = (entity: EntityState): Coord => centreTile(entity.anchor, definitionOf(entity).footprint)

const distance = gridDistance

// ---------------------------------------------------------------------------------------------
// The opening state
// ---------------------------------------------------------------------------------------------

test("the opening state follows the scenario loader's conventions: ids, reading-order ordinals, fresh fields", () => {
  const state = open(
    [
      { contentId: NEXUS, anchor: { x: 4, y: 6 } },
      { contentId: HATCHERY, anchor: { x: 12, y: 3 } },
    ],
    [
      { player: "A", muster: { x: 8, y: 8 }, units: [TROOPER, MARKSMAN] },
      { player: "B", muster: { x: 30, y: 8 }, units: [RUNNER] },
    ],
  )
  assert.equal(state.tick, 0)
  assert.equal(state.outcome, null)
  assert.equal(state.entities.length, 5)
  assert.equal(state.nextOrdinal, 5)
  assert.deepEqual(state.rng, gameplayRng(4242).snapshot())
  assert.deepEqual(
    state.entities.map((entity) => entity.ordinal),
    [0, 1, 2, 3, 4],
  )
  // Reading order of the centre tiles: north to south, then west to east.
  const centres = state.entities.map(centreOf)
  for (let index = 1; index < centres.length; index += 1) {
    const before = centres[index - 1] as Coord
    const now = centres[index] as Coord
    assert.ok(before.y < now.y || (before.y === now.y && before.x <= now.x), "ordinals are not in reading order")
  }
  for (const entity of state.entities) {
    assert.equal(entity.id, `${entity.player}:${definitionOf(entity).short}#${entity.ordinal + 1}`)
    assert.equal(entity.hp, definitionOf(entity).maxHp)
    assert.equal(entity.facing, entity.player === "A" ? "e" : "w")
    assert.equal(entity.targetOrdinal, null)
  }
  // A producer starts its cooldown at a full interval, as `freshEntityFields` says.
  const hatchery = state.entities.find((entity) => entity.contentId === HATCHERY)
  assert.equal(hatchery?.spawnCooldown, FIXTURE_REGISTRY.get(HATCHERY).spawn?.intervalTicks)
})

test("a state built here is the state the scenario loader builds from the same picture", () => {
  const grid = gridOf([
    "........................",
    "........................",
    "....##..................",
    "....##..................",
    "........................",
    "..............*.........",
    "........................",
    "........................",
    "........................",
    "........................",
  ])
  const built = open(
    [
      { contentId: NEXUS, anchor: { x: 8, y: 1 } },
      { contentId: BARRACKS, anchor: { x: 8, y: 6 } },
    ],
    [
      { player: "A", muster: { x: 13, y: 4 }, units: [TROOPER, TROOPER, MARKSMAN] },
      { player: "B", muster: { x: 20, y: 4 }, units: [RAIDER, RUNNER] },
    ],
    grid,
  )
  // Redraw exactly what was built as a scenario file's character grids, and load it.
  const symbols = new Map<string, string>()
  const letter = (contentId: string): string => {
    const known = symbols.get(contentId)
    if (known !== undefined) return known
    const next = "abcdefghij"[symbols.size] as string
    symbols.set(contentId, next)
    return next
  }
  const rowsOf = (player: "A" | "B"): string[] => {
    const rows = Array.from({ length: grid.height }, () => " ".repeat(grid.width))
    for (const entity of built.entities) {
      if (entity.player !== player) continue
      const centre = centreOf(entity)
      const row = rows[centre.y] as string
      rows[centre.y] = row.slice(0, centre.x) + letter(entity.contentId) + row.slice(centre.x + 1)
    }
    return rows
  }
  const terrainRows = Array.from({ length: grid.height }, (_, y) =>
    Array.from({ length: grid.width }, (_unused, x) => {
      const id = grid.tiles[y * grid.width + x]
      return id === "terrain.rock" ? "#" : id === "terrain.deposit" ? "*" : "."
    }).join(""),
  )
  const rowsA = rowsOf("A")
  const rowsB = rowsOf("B")
  const legend = Object.fromEntries([...symbols].map(([contentId, symbol]) => [symbol, { content: contentId }]))
  const scenario: ScenarioDefinition = {
    id: "opening-parity",
    name: "opening parity",
    grid: { width: grid.width, height: grid.height },
    seed: 4242,
    pulseTicks: 240,
    terrain: terrainRows,
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock", "*": "terrain.deposit" },
    placements: {
      A: { rows: rowsA, legend },
      B: { rows: rowsB, legend },
    },
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  assert.equal(hashState(built), hashState(loaded.state), "the opening is not the state the loader builds from the same picture")
})

test("units gather on the free tiles nearest their muster point, none on top of another", () => {
  const state = open(
    [{ contentId: NEXUS, anchor: { x: 2, y: 2 } }],
    [{ player: "A", muster: { x: 20, y: 12 }, units: [TROOPER, TROOPER, TROOPER, MARKSMAN, MARKSMAN] }],
  )
  const units = state.entities.filter((entity) => definitionOf(entity).layer === "units")
  assert.equal(units.length, 5)
  for (const unit of units) assert.ok(distance(centreOf(unit), { x: 20, y: 12 }) <= 2, "a unit is not near the muster point")
  assertNoTileShared(state, "muster")
  // The first unit takes the muster tile itself.
  assert.ok(units.some((unit) => centreOf(unit).x === 20 && centreOf(unit).y === 12))
})

test("a group comes out round on screen: thirteen troopers fill every tile within three of their muster, seven across and three rows", () => {
  const muster = { x: 20, y: 12 }
  const state = open([{ contentId: NEXUS, anchor: { x: 2, y: 2 } }], [{ player: "A", muster, units: Array.from({ length: 13 }, () => TROOPER) }])
  // Listed in reading order, as ordinals are: every tile within three of the muster by the Grid's own distance, and
  // no other — three columns either side on its row, one either side on the rows above and below.
  const tiles = state.entities.filter((entity) => definitionOf(entity).layer === "units").map(centreOf)
  assert.deepEqual(tiles, [
    { x: 19, y: 11 },
    { x: 20, y: 11 },
    { x: 21, y: 11 },
    { x: 17, y: 12 },
    { x: 18, y: 12 },
    { x: 19, y: 12 },
    { x: 20, y: 12 },
    { x: 21, y: 12 },
    { x: 22, y: 12 },
    { x: 23, y: 12 },
    { x: 19, y: 13 },
    { x: 20, y: 13 },
    { x: 21, y: 13 },
  ])
  for (const tile of tiles) assert.ok(distance(tile, muster) <= 3, `${tile.x},${tile.y} is further than three`)
})

test("a building committed on the muster point moves the units aside rather than refusing the Pulse", () => {
  const onIt = open(
    [
      { contentId: NEXUS, anchor: { x: 2, y: 2 } },
      { contentId: BARRACKS, anchor: { x: 19, y: 11 } },
    ],
    [{ player: "A", muster: { x: 20, y: 12 }, units: [TROOPER, TROOPER, MARKSMAN] }],
  )
  assertNoTileShared(onIt, "muster under a building")
  const units = onIt.entities.filter((entity) => definitionOf(entity).layer === "units")
  assert.equal(units.length, 3)
  const barracks = onIt.entities.find((entity) => entity.contentId === BARRACKS) as EntityState
  const covered = new Set(tilesOf(barracks.anchor, definitionOf(barracks).footprint).map((tile) => `${tile.x},${tile.y}`))
  for (const unit of units) {
    assert.ok(!covered.has(`${centreOf(unit).x},${centreOf(unit).y}`), "a unit was set down inside the building")
    assert.ok(distance(centreOf(unit), { x: 20, y: 12 }) <= 4)
  }
})

test("a multi-tile unit is set down only where its whole footprint fits", () => {
  const walled = gridOf([
    "##########",
    "#........#",
    "#..####..#",
    "#..####..#",
    "#........#",
    "##########",
  ])
  const state = open([], [{ player: "B", muster: { x: 4, y: 2 }, units: [RAIDER] }], walled)
  const raider = state.entities[0] as EntityState
  for (const tile of tilesOf(raider.anchor, definitionOf(raider).footprint)) {
    assert.equal(walled.tiles[tile.y * walled.width + tile.x], "terrain.plain", "the raider overlaps rock")
  }
})

test("the opening is deterministic: the same picture is the same state, hash for hash", () => {
  const args = [
    [{ contentId: NEXUS, anchor: { x: 4, y: 6 } as Coord }],
    [{ player: "A", muster: { x: 9, y: 9 }, units: [TROOPER, TROOPER] }],
  ] as const
  const hashes = new Set<string>()
  for (let run = 0; run < 10; run += 1) hashes.add(hashState(open(args[0], args[1] as readonly Force[])))
  assert.equal(hashes.size, 1)
})

test("a setup the loader would refuse is refused, by name", () => {
  const walled = gridOf(["......", "..##..", "..##..", "......"])
  const refuses = (run: () => unknown, pattern: RegExp, label: string): void => {
    assert.throws(run, (error: unknown) => error instanceof PulseSetupError && pattern.test(error.message), label)
  }
  refuses(() => open([{ contentId: "structure.nothing", anchor: { x: 0, y: 0 } }], []), /unknown content id "structure.nothing"/, "unknown id")
  refuses(() => open([{ contentId: NEXUS, anchor: { x: 38, y: 0 } }], []), /outside the 40x24 Grid/, "off the Grid")
  refuses(() => open([{ contentId: BARRACKS, anchor: { x: 1, y: 0 } }], [], walled), /impassable terrain\.rock/, "on rock")
  refuses(
    () =>
      open(
        [
          { contentId: BARRACKS, anchor: { x: 5, y: 5 } },
          { contentId: BARRACKS, anchor: { x: 6, y: 5 } },
        ],
        [],
      ),
    /occupancy conflict/,
    "two buildings on one tile",
  )
  refuses(() => open([], []), /nothing on the Grid/, "an empty battle")
  refuses(
    () => openingState({ grid: OPEN, registry: FIXTURE_REGISTRY, structures: [], setup: { seed: 1.5, pulseTicks: 10, forces: [] } }),
    /seed must be an integer/,
    "a fractional seed",
  )
  refuses(
    () =>
      openingState({
        grid: OPEN,
        registry: FIXTURE_REGISTRY,
        structures: [{ contentId: NEXUS, anchor: { x: 1, y: 1 } }],
        setup: { seed: 1, pulseTicks: 0, forces: [] },
      }),
    /pulseTicks must be a positive integer/,
    "no ticks",
  )
  const sealed = gridOf(["#####", "#...#", "#####"])
  refuses(
    () => open([], [{ player: "A", muster: { x: 2, y: 1 }, units: [TROOPER, TROOPER, TROOPER, TROOPER] }], sealed),
    /no room for "unit.citizen.trooper"/,
    "no room to stand",
  )
})

// ---------------------------------------------------------------------------------------------
// Between rounds (the regroup replaced Recall, the walk home; its own tests are in tests/regroup.test.ts)
// ---------------------------------------------------------------------------------------------

/** A Pulse's aftermath, drawn by hand: the player's Nexus at (6,10), troopers far out east, a raid
 *  survivor further still. */
function afterwards(extra: readonly StructurePlacement[] = []): MatchState {
  return open(
    [{ contentId: NEXUS, anchor: { x: 6, y: 10 } }, ...extra],
    [
      { player: "A", muster: { x: 26, y: 11 }, units: [TROOPER, TROOPER, MARKSMAN] },
      { player: "B", muster: { x: 34, y: 11 }, units: [RUNNER] },
    ],
  )
}

test("the regroup between rounds resets what a Pulse leaves running and clears the Pulse's own bookkeeping", () => {
  const before = afterwards([{ contentId: HATCHERY, anchor: { x: 20, y: 3 } }])
  const worn: MatchState = {
    ...before,
    tick: 173,
    outcome: { winner: "A", reason: "annihilation", tick: 173 },
    vacatedTiles: [{ layer: "units", x: 3, y: 3, until: 175 }],
    entities: before.entities.map((entity) => ({
      ...entity,
      hp: Math.max(1, entity.hp - 5),
      cooldown: 9,
      moveCredit: 7,
      targetOrdinal: 0,
      focusStreak: 3,
      spawnCooldown: definitionOf(entity).spawn === undefined ? 0 : 2,
    })),
  }
  const { state } = regroup(worn, FIXTURE_REGISTRY)
  assert.equal(state.tick, 0)
  assert.equal(state.outcome, null)
  assert.deepEqual(state.vacatedTiles, [])
  assert.deepEqual(state.rng, worn.rng, "the gameplay stream carries on where it stopped")
  assert.equal(state.nextOrdinal, worn.nextOrdinal)
  assert.deepEqual(
    state.entities.map((entity) => entity.ordinal),
    worn.entities.map((entity) => entity.ordinal),
    "identities are unchanged",
  )
  for (const entity of state.entities) {
    const wornEntity = worn.entities.find((candidate) => candidate.ordinal === entity.ordinal) as EntityState
    // Between rounds nothing heals but what mends, the Grid Nexus (`ContentDef.mends`), and never past full.
    const mends = definitionOf(entity).mends ?? 0
    assert.equal(entity.hp, Math.min(definitionOf(entity).maxHp, wornEntity.hp + mends), "only what mends heals")
    assert.equal(entity.cooldown, 0)
    assert.equal(entity.moveCredit, 0)
    assert.equal(entity.targetOrdinal, null)
    assert.equal(entity.focusStreak, 0)
    assert.equal(entity.spawnCooldown, definitionOf(entity).spawn?.intervalTicks ?? 0, "a producer's cooldown is a full interval")
  }
})

test("the Grid Nexus mends between rounds: what it lost, up to its mending, never past full; nothing else mends", () => {
  // The owner, 2026-10-21: "perhaps we add like a little bit of self-healing", so an early raid that hurt the Nexus
  // is not a wound it carries all match. The Citizen and the Ravel Nexus mend alike, for now.
  const nexus = FIXTURE_REGISTRY.get(NEXUS)
  assert.equal(nexus.mends, 40)
  assert.equal(FIXTURE_REGISTRY.get("structure.ravel.nexus").mends, nexus.mends)
  const before = afterwards([{ contentId: HATCHERY, anchor: { x: 20, y: 3 } }])
  const hurt = (nexusHp: number): MatchState => ({
    ...before,
    entities: before.entities.map((entity) => ({ ...entity, hp: entity.contentId === NEXUS ? nexusHp : Math.max(1, entity.hp - 5) })),
  })
  const hpAfter = (state: MatchState, contentId: string): number | undefined =>
    regroup(state, FIXTURE_REGISTRY).state.entities.find((entity) => entity.contentId === contentId)?.hp
  assert.equal(hpAfter(hurt(100), NEXUS), 140)
  assert.equal(hpAfter(hurt(390), NEXUS), nexus.maxHp, "it mended past full")
  // A wounded Hatchery and wounded troopers come home as hurt as they were.
  const hatchery = hurt(100).entities.find((entity) => entity.contentId === HATCHERY) as EntityState
  assert.equal(hpAfter(hurt(100), HATCHERY), hatchery.hp)
  const trooper = hurt(100).entities.find((entity) => entity.contentId === TROOPER) as EntityState
  assert.equal(hpAfter(hurt(100), TROOPER), trooper.hp)
})
