// The match layer. The opening state a Pulse starts from, and Recall, the rule at the other
// end of it (docs/system-design/pulse.md, Recall). Both are deterministic rules-layer code beside the kernel, so the
// tests are the kernel's kind: exact states, exact hashes, no screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { gridDistance, tilesOf } from "../src/grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { PulseSetupError, centreTile, openingState, recall } from "../src/match/index.ts"
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
  refuses(() => open([], []), /places no entities/, "an empty Pulse")
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
// Recall
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

test("survivors with no producer regroup beside the Grid Nexus, on the side they came from", () => {
  const before = afterwards()
  const { state, moves } = recall(before, FIXTURE_REGISTRY)
  const nexus = state.entities.find((entity) => entity.contentId === NEXUS) as EntityState
  const nexusTiles = tilesOf(nexus.anchor, definitionOf(nexus).footprint)
  const mine = state.entities.filter((entity) => entity.player === "A" && definitionOf(entity).layer === "units")
  assert.equal(mine.length, 3)
  for (const unit of mine) {
    const nearest = Math.min(...nexusTiles.map((tile) => distance(centreOf(unit), tile)))
    assert.ok(nearest <= 3, `${unit.id} is ${nearest} tiles from the Nexus`)
    assert.ok(centreOf(unit).x > nexus.anchor.x, `${unit.id} came home on the wrong side of the Nexus`)
  }
  assert.deepEqual(
    moves.filter((move) => move.player === "A").map((move) => move.home),
    ["nexus", "nexus", "nexus"],
  )
  assertNoTileShared(state, "recall")
})

test("a survivor with no home stays where it stands, and the others make room for it", () => {
  const before = afterwards()
  const { state, moves } = recall(before, FIXTURE_REGISTRY)
  const runnerBefore = before.entities.find((entity) => entity.contentId === RUNNER) as EntityState
  const runnerAfter = state.entities.find((entity) => entity.ordinal === runnerBefore.ordinal) as EntityState
  assert.deepEqual(runnerAfter.anchor, runnerBefore.anchor)
  assert.equal(moves.find((move) => move.ordinal === runnerBefore.ordinal)?.home, "none")
  // Even when a returning unit's nearest tile is exactly the stranded one's.
  const crowded = open(
    [{ contentId: NEXUS, anchor: { x: 6, y: 10 } }],
    [
      { player: "A", muster: { x: 30, y: 11 }, units: [TROOPER] },
      { player: "B", muster: { x: 9, y: 11 }, units: [RUNNER, RUNNER] },
    ],
  )
  const result = recall(crowded, FIXTURE_REGISTRY)
  assertNoTileShared(result.state, "recall beside a stranded raider")
  for (const stranded of crowded.entities.filter((entity) => entity.player === "B")) {
    const after = result.state.entities.find((entity) => entity.ordinal === stranded.ordinal) as EntityState
    assert.deepEqual(after.anchor, stranded.anchor, "a survivor with no home was moved")
  }
})

test("a unit goes back to a producer that makes units like it, not to the Nexus", () => {
  const before = open(
    [
      { contentId: NEXUS, anchor: { x: 4, y: 4 } },
      { contentId: HATCHERY, anchor: { x: 30, y: 18 } },
    ],
    [{ player: "A", muster: { x: 26, y: 12 }, units: [SPAWNLING, TROOPER] }],
  )
  const { state, moves } = recall(before, FIXTURE_REGISTRY)
  const spawnling = state.entities.find((entity) => entity.contentId === SPAWNLING) as EntityState
  const hatchery = state.entities.find((entity) => entity.contentId === HATCHERY) as EntityState
  assert.ok(distance(centreOf(spawnling), centreOf(hatchery)) <= 4, "the spawnling did not go back to its hatchery")
  assert.equal(moves.find((move) => move.contentId === SPAWNLING)?.home, "producer")
  assert.equal(moves.find((move) => move.contentId === TROOPER)?.home, "nexus", "a trooper is an orphan of a hatchery")
})

test("the nearest compatible producer is the one a survivor goes to", () => {
  const before = open(
    [
      { contentId: NEXUS, anchor: { x: 1, y: 1 } },
      { contentId: HATCHERY, anchor: { x: 2, y: 18 } },
      { contentId: HATCHERY, anchor: { x: 34, y: 18 } },
    ],
    [{ player: "A", muster: { x: 30, y: 10 }, units: [SPAWNLING] }],
  )
  const { state } = recall(before, FIXTURE_REGISTRY)
  const spawnling = state.entities.find((entity) => entity.contentId === SPAWNLING) as EntityState
  assert.ok(spawnling.anchor.x > 20, "it went to the far hatchery")
})

test("Recall resets what a Pulse leaves running and clears the Pulse's own bookkeeping", () => {
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
  const { state } = recall(worn, FIXTURE_REGISTRY)
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
    assert.equal(entity.hp, wornEntity.hp, "Recall does not heal")
    assert.equal(entity.cooldown, 0)
    assert.equal(entity.moveCredit, 0)
    assert.equal(entity.targetOrdinal, null)
    assert.equal(entity.focusStreak, 0)
    assert.equal(entity.spawnCooldown, definitionOf(entity).spawn?.intervalTicks ?? 0, "a producer's cooldown is a full interval")
  }
})

test("structures never move, and a survivor's move is reported from where the Pulse left it", () => {
  const before = afterwards([{ contentId: BARRACKS, anchor: { x: 12, y: 3 } }])
  const { state, moves } = recall(before, FIXTURE_REGISTRY)
  for (const entity of before.entities.filter((candidate) => definitionOf(candidate).layer === "obstacles")) {
    const after = state.entities.find((candidate) => candidate.ordinal === entity.ordinal) as EntityState
    assert.deepEqual(after.anchor, entity.anchor)
  }
  const survivors = before.entities.filter((entity) => definitionOf(entity).layer !== "obstacles")
  assert.deepEqual(
    moves.map((move) => move.ordinal),
    survivors.map((entity) => entity.ordinal),
    "one move per survivor, in ordinal order",
  )
  for (const move of moves) {
    const old = before.entities.find((entity) => entity.ordinal === move.ordinal) as EntityState
    const now = state.entities.find((entity) => entity.ordinal === move.ordinal) as EntityState
    assert.deepEqual(move.from, old.anchor)
    assert.deepEqual(move.to, now.anchor)
  }
})

test("a big army comes home without overlapping: the search widens until everyone has a tile", () => {
  const before = open(
    [{ contentId: NEXUS, anchor: { x: 6, y: 10 } }],
    [
      { player: "A", muster: { x: 30, y: 11 }, units: Array.from({ length: 40 }, () => TROOPER) },
      { player: "A", muster: { x: 30, y: 4 }, units: [RAIDER, RAIDER] },
    ],
  )
  const { state } = recall(before, FIXTURE_REGISTRY)
  assertNoTileShared(state, "forty troopers")
  const nexus = state.entities.find((entity) => entity.contentId === NEXUS) as EntityState
  for (const entity of state.entities.filter((candidate) => definitionOf(candidate).layer === "units")) {
    assert.ok(distance(centreOf(entity), centreOf(nexus)) <= 12, `${entity.id} is too far from the Nexus`)
  }
})

test("Recall is deterministic, and running it on its own output changes nothing but the walk", () => {
  const before = afterwards([{ contentId: HATCHERY, anchor: { x: 20, y: 3 } }])
  const first = recall(before, FIXTURE_REGISTRY)
  for (let run = 0; run < 10; run += 1) {
    assert.equal(hashState(recall(before, FIXTURE_REGISTRY).state), hashState(first.state))
  }
  // Everyone is home: a second Recall moves nobody far (the search is anchored where they stand).
  const again = recall(first.state, FIXTURE_REGISTRY)
  assertNoTileShared(again.state, "recall twice")
})

test("with nowhere free within reach, Recall says so rather than stacking units", () => {
  // A walled room with eight free tiles beside the Nexus, eight troopers standing on them — and a worker
  // sharing a trooper's tile, which the kernel allows across layers but Recall never leaves behind.
  const room = gridOf(["#########", "#.......#", "#.......#", "#########"])
  const crowded = open(
    [{ contentId: NEXUS, anchor: { x: 1, y: 1 } }],
    [{ player: "A", muster: { x: 5, y: 1 }, units: Array.from({ length: 8 }, () => TROOPER) }],
    room,
  )
  assertNoTileShared(recall(crowded, FIXTURE_REGISTRY).state, "eight troopers fit")
  const trooper = crowded.entities.find((entity) => entity.contentId === TROOPER) as EntityState
  const withWorker: MatchState = {
    ...crowded,
    nextOrdinal: crowded.nextOrdinal + 1,
    entities: [
      ...crowded.entities,
      { ...trooper, ordinal: crowded.nextOrdinal, id: `A:worker#${crowded.nextOrdinal + 1}`, contentId: "unit.citizen.worker" },
    ],
  }
  assert.throws(() => recall(withWorker, FIXTURE_REGISTRY), /recall: no free tile/)
})
