// The regroup between a duel's (and a run's) Battle Rounds (`src/match/regroup.ts`): the survivors stay on the Grid,
// step back from a fight and form up across their march line, worked out from the round's end alone. Rules-layer code
// beside the kernel, so these are the kernel's kind of tests: exact states, exact hashes, no screen.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { gridDistance, tilesOf } from "../src/grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { BEHIND, FRONT_GAP, REGROUP_TICKS, centreTile, openingState, regroup, regroupAt, standDown } from "../src/match/index.ts"
import type { Force, RegroupResult, StructurePlacement } from "../src/match/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"
import { DUEL_PULSE_TICKS, briefOf, newDuel, playRound, scriptedPlayer } from "../src/duel/index.ts"
import type { DuelState, Side } from "../src/duel/index.ts"
import { createHash } from "node:crypto"

const NEXUS = "structure.citizen.nexus"
const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"
const VASSE = "unit.citizen.vasse"

function gridOf(rows: readonly string[]): GridTerrain {
  const ids: Record<string, TerrainId> = { ".": "terrain.plain", "#": "terrain.rock" }
  return { width: rows[0]?.length ?? 0, height: rows.length, tiles: rows.flatMap((row) => [...row].map((character) => ids[character] as TerrainId)) }
}

/** A field 60 wide and 21 tall, open, a Nexus at each end of the middle row. */
const FIELD = gridOf(Array.from({ length: 21 }, () => ".".repeat(60)))
const NEXUSES: readonly StructurePlacement[] = [
  { contentId: NEXUS, player: "A", anchor: { x: 2, y: 9 } },
  { contentId: NEXUS, player: "B", anchor: { x: 55, y: 9 } },
]

function stateOf(forces: readonly Force[], structures: readonly StructurePlacement[] = NEXUSES): MatchState {
  return openingState({ grid: FIELD, registry: FIXTURE_REGISTRY, structures, setup: { seed: 11, pulseTicks: 360, forces } })
}

const definitionOf = (entity: EntityState) => FIXTURE_REGISTRY.get(entity.contentId)
const units = (state: MatchState, player?: Side): EntityState[] =>
  state.entities.filter((entity) => definitionOf(entity).layer !== "obstacles" && (player === undefined || entity.player === player))

/** Every tile a body covers, keyed, for overlap checks. */
function assertNoOverlap(state: MatchState, definition: (entity: EntityState) => { layer: string; footprint: readonly Coord[] }, label: string): void {
  const bodies = state.entities.filter((entity) => definition(entity).layer !== "obstacles")
  const keys = bodies.flatMap((entity) => tilesOf(entity.anchor, definition(entity).footprint).map((tile) => `${tile.x},${tile.y}`))
  assert.equal(new Set(keys).size, keys.length, `${label}: two survivors on one tile`)
  // Nobody on the other side's buildings.
  const built = new Map<string, string>()
  for (const entity of state.entities) {
    if (definition(entity).layer !== "obstacles") continue
    for (const tile of tilesOf(entity.anchor, definition(entity).footprint)) built.set(`${tile.x},${tile.y}`, entity.player)
  }
  for (const entity of bodies) {
    for (const tile of tilesOf(entity.anchor, definition(entity).footprint)) {
      const owner = built.get(`${tile.x},${tile.y}`)
      assert.ok(owner === undefined || owner === entity.player, `${label}: ${entity.id} stands inside the enemy's building at ${tile.x},${tile.y}`)
    }
  }
}

const pathsHash = (result: RegroupResult): string => createHash("sha256").update(JSON.stringify(result.paths)).digest("hex").slice(0, 16)

test("the ranks follow the priority list front to back - flanker, melee, then ranged by range - and the Commander takes the place her attack gives her", () => {
  const FLANKER = "unit.bench.flanker"
  const MORTAR = "unit.citizen.mortar"
  const forces: Force[] = [{ player: "A", muster: { x: 30, y: 10 }, units: [MORTAR, MARKSMAN, VASSE, TROOPER, FLANKER, MORTAR, MARKSMAN, VASSE, TROOPER, FLANKER] }]
  const result = regroup(stateOf(forces), FIXTURE_REGISTRY)
  const after = units(result.state, "A")
  const column = (contentId: string): number[] => after.filter((entity) => entity.contentId === contentId).map((entity) => entity.anchor.x)
  // East is forward: a flanker ahead of a trooper, a trooper ahead of Vasse (range 4), Vasse ahead of a marksman (6), a
  // marksman ahead of a mortar (10) -- each of one kind wholly in front of every one of the next.
  const order = [FLANKER, TROOPER, VASSE, MARKSMAN, MORTAR]
  for (let index = 1; index < order.length; index += 1) {
    const ahead = column(order[index - 1] as string)
    const behind = column(order[index] as string)
    assert.ok(Math.min(...ahead) >= Math.max(...behind), `${order[index - 1]} at ${ahead} is not ahead of ${order[index]} at ${behind}`)
  }
})

test("the regroup lasts 10 seconds: a 2-second step back, 6 seconds forming up, 2 standing formed", () => {
  assert.equal(REGROUP_TICKS, 120)
  const result = regroup(stateOf([{ player: "A", muster: { x: 30, y: 10 }, units: [TROOPER, TROOPER, MARKSMAN] }]), FIXTURE_REGISTRY)
  assert.equal(result.ticks, 120)
  for (const path of result.paths) for (const step of path.steps) assert.ok(step.tick >= 1 && step.tick <= 120)
})

test("a side forms up across its march line: melee in front, ranged behind, the Commander in the middle of her rank", () => {
  // Out of a fight (no enemy within reach), so nobody steps back: the front is where the furthest forward stands.
  const forces: Force[] = [{ player: "A", muster: { x: 30, y: 10 }, units: [MARKSMAN, TROOPER, MARKSMAN, VASSE, TROOPER, TROOPER, MARKSMAN, TROOPER] }]
  const before = stateOf(forces)
  const result = regroup(before, FIXTURE_REGISTRY)
  const after = units(result.state, "A")
  for (const path of result.paths) assert.deepEqual(path.to, path.slot, `${path.contentId} reached its slot`)
  const x = (contentId: string): number[] => after.filter((entity) => entity.contentId === contentId).map((entity) => entity.anchor.x)
  // Every trooper further forward (east, toward B) than every marksman, the Commander between them.
  assert.ok(Math.min(...x(TROOPER)) > Math.max(...x(MARKSMAN)), `troopers ${x(TROOPER)} ahead of marksmen ${x(MARKSMAN)}`)
  // The front rank stands where a rank's worth of the army already stood: the fourth furthest forward of eight (a rank
  // of eight holds four), so one straggler ahead does not pull the rest up to it.
  const forwards = units(before, "A").map((entity) => entity.anchor.x).sort((a, b) => b - a)
  assert.equal(Math.max(...x(TROOPER)), forwards[3], "the front rank stands where the front stood")
  // Ranks across the line: a rank is one column, its units in consecutive rows.
  const ranks = new Map<number, number[]>()
  for (const entity of after) ranks.set(entity.anchor.x, [...(ranks.get(entity.anchor.x) ?? []), entity.anchor.y])
  for (const [column, rows] of ranks) {
    const sorted = [...rows].sort((a, b) => a - b)
    assert.equal(sorted[sorted.length - 1]! - sorted[0]!, sorted.length - 1, `the rank at column ${column} stands in consecutive rows`)
  }
  // The march line runs Nexus to Nexus along row 9/10 (the Nexus is two rows tall, so the line lies between them): the
  // Commander stands in the middle of her rank, on the line.
  const vasse = after.find((entity) => entity.contentId === VASSE) as EntityState
  const her = (ranks.get(vasse.anchor.x) ?? []).sort((a, b) => a - b)
  assert.equal(her[Math.floor(her.length / 2)], vasse.anchor.y, "she is in the middle of her rank")
  // Everyone faces the enemy.
  for (const entity of after) assert.equal(entity.facing, "e")
})

test("two sides in contact step back and form up with a gap between their fronts, nobody overlapping", () => {
  const forces: Force[] = [
    { player: "A", muster: { x: 28, y: 10 }, units: [TROOPER, TROOPER, TROOPER, MARKSMAN, MARKSMAN, TROOPER] },
    { player: "B", muster: { x: 31, y: 10 }, units: [TROOPER, TROOPER, TROOPER, MARKSMAN, MARKSMAN, TROOPER] },
  ]
  const result = regroup(stateOf(forces), FIXTURE_REGISTRY)
  assertNoOverlap(result.state, definitionOf, "after the regroup")
  // Everyone in the fight stepped back before forming: each walked first toward its own Nexus.
  for (const path of result.paths) {
    const first = path.steps[0]
    assert.ok(first !== undefined && first.tick <= 24, `${path.contentId} of ${path.player} moved in the step back`)
    assert.ok(path.player === "A" ? first.to.x <= path.from.x : first.to.x >= path.from.x, "its first step is toward home or across")
  }
  const ax = Math.max(...units(result.state, "A").map((entity) => entity.anchor.x))
  const bx = Math.min(...units(result.state, "B").map((entity) => entity.anchor.x))
  assert.ok(bx - ax - 1 >= FRONT_GAP, `the fronts stand ${bx - ax - 1} clear columns apart, at least ${FRONT_GAP}`)
  for (const a of units(result.state, "A")) for (const b of units(result.state, "B")) assert.ok(gridDistance(a.anchor, b.anchor) > FRONT_GAP)
})

test("survivors far behind the front form a group of their own where they stand, rather than walking up", () => {
  const forces: Force[] = [
    { player: "A", muster: { x: 40, y: 10 }, units: [TROOPER, TROOPER, TROOPER] },
    { player: "A", muster: { x: 8, y: 4 }, units: [MARKSMAN, MARKSMAN] },
  ]
  const result = regroup(stateOf(forces), FIXTURE_REGISTRY)
  const behind = result.paths.filter((path) => path.contentId === MARKSMAN)
  for (const path of behind) {
    assert.ok(path.slot !== null && path.slot.x < 40 - BEHIND, `${path.contentId} formed near home, at ${JSON.stringify(path.slot)}`)
  }
})

test("the regroup is a pure function of the round's end: the same state gives the same walks and the same state", () => {
  const forces: Force[] = [
    { player: "A", muster: { x: 26, y: 10 }, units: [TROOPER, TROOPER, MARKSMAN, VASSE, TROOPER] },
    { player: "B", muster: { x: 33, y: 10 }, units: [TROOPER, MARKSMAN, TROOPER, TROOPER] },
  ]
  const state = stateOf(forces)
  const first = regroup(state, FIXTURE_REGISTRY)
  const again = regroup(state, FIXTURE_REGISTRY)
  assert.deepEqual(again.paths, first.paths)
  assert.equal(hashState(again.state), hashState(first.state))
  // Between rounds the regroup resets the clock, the outcome, the cooling tiles, the fire, every target.
  assert.equal(first.state.tick, 0)
  assert.equal(first.state.outcome, null)
  for (const entity of first.state.entities) assert.equal(entity.targetOrdinal, null)
  // Each walk ends where the state stands it.
  for (const path of first.paths) {
    assert.deepEqual(regroupAt(path, REGROUP_TICKS), path.to)
    assert.deepEqual(first.state.entities.find((entity) => entity.ordinal === path.ordinal)?.anchor, path.to)
  }
})

/** `state` mirrored west to east, each side's things given to the other. */
function mirrored(state: MatchState, registry: ContentRegistry = FIXTURE_REGISTRY): MatchState {
  const width = state.grid.width
  return {
    ...state,
    entities: state.entities.map((entity) => {
      const span = Math.max(...registry.get(entity.contentId).footprint.map((offset) => offset.x)) + 1
      return { ...entity, player: entity.player === "A" ? "B" : "A", anchor: { x: width - entity.anchor.x - span, y: entity.anchor.y }, facing: entity.facing === "e" ? "w" : entity.facing === "w" ? "e" : entity.facing }
    }),
  }
}

test("mirror-fair: a mirrored end of round regroups into the mirrored formation", () => {
  const forces: Force[] = [
    { player: "A", muster: { x: 22, y: 8 }, units: [TROOPER, MARKSMAN, VASSE, TROOPER, MARKSMAN, TROOPER] },
    { player: "B", muster: { x: 40, y: 12 }, units: [TROOPER, TROOPER, MARKSMAN, TROOPER] },
  ]
  const state = stateOf(forces)
  const result = regroup(state, FIXTURE_REGISTRY)
  const flipped = regroup(mirrored(state), FIXTURE_REGISTRY)
  const width = state.grid.width
  for (const path of result.paths) {
    const twin = flipped.paths.find((each) => each.ordinal === path.ordinal) as (typeof flipped.paths)[number]
    assert.deepEqual(twin.to, { x: width - 1 - path.to.x, y: path.to.y }, `${path.contentId} #${path.ordinal} ends mirrored`)
  }
})

/** A duel played round by round, the regroup of each round kept. */
function duelRounds(rounds: number, commanders: Readonly<Record<Side, string>>, players: Readonly<Record<Side, string>>, seed = 2) {
  let duel: DuelState = newDuel({ map: "crossing", seed, rounds: 8, pulseTicks: DUEL_PULSE_TICKS, commanders })
  const played: Array<Readonly<{ duel: DuelState; regroup: RegroupResult | null; ticks: number; sides: Readonly<Record<Side, ContentRegistry>> | null }>> = []
  for (let round = 0; round < rounds && duel.result === null; round += 1) {
    let sides: Readonly<Record<Side, ContentRegistry>> | null = null
    const plans = { A: (scriptedPlayer(players.A) as NonNullable<ReturnType<typeof scriptedPlayer>>)(briefOf(duel, "A").data), B: (scriptedPlayer(players.B) as NonNullable<ReturnType<typeof scriptedPlayer>>)(briefOf(duel, "B").data) }
    const next = playRound(duel, plans, (_battle, _events, _registry, each) => {
      sides ??= each
    })
    played.push({ duel: next.state, regroup: next.regroup, ticks: next.report.ticks, sides })
    duel = next.state
  }
  return played
}

test("a duel keeps its front: rounds of 30 seconds, the survivors regrouped where they fought, no two on a tile", { timeout: 120_000 }, () => {
  assert.equal(DUEL_PULSE_TICKS, 360, "a Battle Round of a duel lasts 30 seconds")
  const rounds = duelRounds(3, { A: "vasse", B: "dob" }, { A: "rush", B: "rush" })
  assert.equal(rounds.length, 3)
  for (const [index, round] of rounds.entries()) {
    assert.ok(round.ticks <= 360)
    if (round.duel.result !== null) continue
    const carried = round.duel.carried as MatchState
    const sides = round.sides as Readonly<Record<Side, ContentRegistry>>
    const definition = (entity: EntityState) => sides[entity.player].get(entity.contentId)
    assertNoOverlap(carried, definition, `after round ${index + 1}`)
    assert.ok(round.regroup !== null, "the duel goes on, so its survivors regrouped")
    assert.equal(hashState(carried), hashState(round.regroup.state))
  }
  // By the end of the second round the rushing armies stand well out of their bases: the front is kept.
  const second = rounds[1]?.duel.carried as MatchState
  const sides = rounds[1]?.sides as Readonly<Record<Side, ContentRegistry>>
  const nexusOf = (player: Side): Coord => {
    const nexus = second.entities.find((entity) => entity.player === player && sides[player].get(entity.contentId).nexus === true) as EntityState
    return centreTile(nexus.anchor, sides[player].get(nexus.contentId).footprint)
  }
  const furthest = (player: Side): number =>
    Math.max(...second.entities.filter((entity) => entity.player === player && sides[player].get(entity.contentId).layer !== "obstacles").map((entity) => gridDistance(entity.anchor, nexusOf(player))))
  assert.ok(furthest("A") > 16 || furthest("B") > 16, `a front stands out on the map (A ${furthest("A")}, B ${furthest("B")} from home)`)
})

test("the regroup of a played duel round is pinned, on Node and on Bun", { timeout: 120_000 }, () => {
  const [first] = duelRounds(1, { A: "vasse", B: "averno" }, { A: "balanced", B: "rush" }, 5)
  const result = first?.regroup as RegroupResult
  // Pinned: the same end of round regroups into the same walks and the same state on every runtime; a change to the
  // regroup, the kernel, the scripts or the armies moves it, and says so. (Moved when an army came to sort itself on the
  // march by half speed, the Commander a regular troop, and the regroup's ranks went by the same priority list; and again when a unit came to keep the target it holds
  // until it falls: commitment.)
  assert.equal(pathsHash(result), "cc39d0c293e7f412")
  assert.equal(hashState(result.state), "c2f41a410b3139c574aaa86b24f1c14ba075fc8de083f8eb71c6636edd9143e6")
})

test("the round's end settled where everyone stands: the regroup's first frame, what a match that is over keeps", () => {
  const state = stateOf([{ player: "A", muster: { x: 30, y: 10 }, units: [TROOPER, MARKSMAN] }])
  const settled = standDown(state, FIXTURE_REGISTRY)
  assert.equal(settled.ticks, 0)
  for (const path of settled.paths) {
    assert.deepEqual(path.to, path.from)
    assert.deepEqual(path.steps, [])
  }
  const result = regroup(state, FIXTURE_REGISTRY)
  for (const path of result.paths) assert.deepEqual(regroupAt(path, 0), settled.state.entities.find((entity) => entity.ordinal === path.ordinal)?.anchor)
})
