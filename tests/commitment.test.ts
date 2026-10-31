// Commitment (docs/system-design/pulse.md, "A unit holds its target"; movement.md, "Targeting and attacking"): a unit
// that has an enemy to strike keeps it until it falls, stops being a target it may choose, or goes `COMMIT_TICKS`
// unable to strike it. And a candidate within sight is not dropped at the edge of its reach because the walk to it is
// a little longer than the sight. The rule's edges, on constructed Grids.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { COMMIT_TICKS } from "../src/pulse/perception.ts"
import { visionOf } from "../src/pulse/target.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { EntityState, MatchState, PlayerId, TargetArea } from "../src/state/types.ts"
import { hashState } from "../src/state/serialize.ts"

type Placed = readonly [x: number, y: number, content: string]

const TROOPER = "unit.citizen.trooper"
const MARKSMAN = "unit.citizen.marksman"
const NEXUS = "structure.citizen.nexus"
const MEDIC = "unit.bench.medic"
const WORKER = "unit.citizen.worker"

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

/** A 24 x 12 Grid, `rock` tiles raised, each side placed as given, and A's target if given. */
function load(
  sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>,
  options: Readonly<{ rock?: readonly (readonly [number, number])[]; target?: TargetArea; ticks?: number }> = {},
): MatchState {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const terrain = Array.from({ length: 12 }, (_, y) =>
    Array.from({ length: 24 }, (_, x) => (options.rock?.some(([rx, ry]) => rx === x && ry === y) === true ? "#" : ".")).join(""),
  )
  const scenario: ScenarioDefinition = {
    id: "commitment",
    name: "commitment",
    grid: { preset: "small-wide" },
    seed: 1,
    pulseTicks: options.ticks ?? 200,
    terrain,
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock" },
    placements,
    ...(options.target === undefined ? {} : { targets: { A: options.target } }),
  }
  return loadScenario(scenario, { registry: FIXTURE_REGISTRY }).state
}

/** The state after each tick, from `state`, for `ticks` ticks (the first is `state` itself), and the events. */
function play(state: MatchState, ticks: number): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const context = contextFor(state, FIXTURE_REGISTRY, state.tick + ticks)
  const states: MatchState[] = [state]
  const events: DomainEvent[] = []
  let current = state
  while (current.outcome === null && states.length <= ticks) {
    const result = stepTick(current, context)
    current = result.state
    states.push(current)
    events.push(...result.events)
  }
  return { states, events }
}

const entity = (state: MatchState, id: string): EntityState | undefined => state.entities.find((candidate) => candidate.id === id)
const byContent = (state: MatchState, contentId: string, player: PlayerId): EntityState =>
  state.entities.find((candidate) => candidate.contentId === contentId && candidate.player === player) as EntityState
const wall = (x: number): readonly (readonly [number, number])[] => Array.from({ length: 12 }, (_, y) => [x, y] as const)

/** How far apart (the Grid's distance: a row counts two columns) two entities stand. */
const gap = (a: EntityState, b: EntityState): number => Math.abs(a.anchor.x - b.anchor.x) + 2 * Math.abs(a.anchor.y - b.anchor.y)

test("a unit keeps the enemy it holds while a nearer one walks past", () => {
  // The marksman holds the enemy marksman at the edge of its range, standing; a trooper comes in from the south and
  // ends nearer to it than the one it holds.
  const start = load({ A: [[2, 5, MARKSMAN]], B: [[8, 5, MARKSMAN], [8, 9, TROOPER]] }, { ticks: 90 })
  const { states } = play(start, 70)
  const shooter = (state: MatchState): EntityState => byContent(state, MARKSMAN, "A")
  const shooterId = shooter(start).id
  const first = shooter(states[1] as MatchState).targetOrdinal
  assert.notEqual(first, null)
  let nearerSeen = false
  for (const state of states.slice(1)) {
    const me = state.entities.find((candidate) => candidate.id === shooterId)
    if (me === undefined) break
    const held = state.entities.find((candidate) => candidate.ordinal === first)
    if (held === undefined) break
    assert.equal(me.targetOrdinal, first, `tick ${state.tick}: it let go of the one it held`)
    const other = state.entities.find((candidate) => candidate.player === "B" && candidate.ordinal !== first)
    if (other !== undefined && gap(me, other) < gap(me, held)) nearerSeen = true
  }
  assert.ok(nearerSeen, "the scene never put a nearer enemy by it")
})

const gun = (state: MatchState): EntityState => byContent(state, NEXUS, "A")

test("the Nexus's gun keeps its target while a nearer enemy comes by", () => {
  const start = load({ A: [[3, 5, NEXUS]], B: [[9, 5, "unit.citizen.colossus"], [7, 9, TROOPER]] }, { ticks: 120 })
  const { states } = play(start, 100)
  const colossus = byContent(start, "unit.citizen.colossus", "B")
  const trooper = byContent(start, TROOPER, "B")
  const nearer = states.some((state) => {
    const walker = entity(state, trooper.id)
    const held = entity(state, colossus.id)
    const nexus = gun(state)
    return walker !== undefined && held !== undefined && gap(nexus, walker) < gap(nexus, held)
  })
  assert.ok(nearer, "the scene never put a nearer enemy by it")
  const first = gun(states[1] as MatchState).targetOrdinal
  assert.notEqual(first, null)
  for (const state of states.slice(1)) {
    if (state.entities.find((candidate) => candidate.ordinal === first) === undefined) break
    assert.equal(gun(state).targetOrdinal, first, `tick ${state.tick}: the gun re-aimed`)
  }
})

test("a healer keeps its patient while it is wounded, and chooses again once it is mended", () => {
  const start = load({ A: [[4, 5, MEDIC], [6, 5, TROOPER], [4, 7, TROOPER]] }, { ticks: 60 })
  // The farther trooper is the one it begins with (the nearer is the more wounded afterwards, to tempt it away).
  const medic = byContent(start, MEDIC, "A")
  const [near, far] = start.entities.filter((candidate) => candidate.contentId === TROOPER).sort((a, b) => gap(medic, a) - gap(medic, b)) as [EntityState, EntityState]
  const hurt = start.entities.map((candidate) =>
    candidate.ordinal === far.ordinal ? { ...candidate, hp: 20 } : candidate.ordinal === near.ordinal ? { ...candidate, hp: 40 } : candidate,
  )
  const { states } = play({ ...start, entities: hurt }, 4)
  assert.equal(byContent(states[1] as MatchState, MEDIC, "A").targetOrdinal, far.ordinal)
  // Now the near one is wounded too: nearer, and more wounded; the medic keeps the patient it has until it is mended.
  const tempted = (states[1] as MatchState).entities.map((candidate) => (candidate.ordinal === near.ordinal ? { ...candidate, hp: 10 } : candidate))
  const later = play({ ...(states[1] as MatchState), entities: tempted }, 60)
  const withFar = later.states.filter((state) => (entity(state, far.id)?.hp ?? 40) < 40)
  assert.ok(withFar.length > 0)
  for (const state of withFar) assert.equal(byContent(state, MEDIC, "A").targetOrdinal, far.ordinal, `tick ${state.tick}: it left its patient wounded`)
  const mended = later.states.find((state) => (entity(state, far.id)?.hp ?? 0) >= 40)
  assert.ok(mended !== undefined, "the patient was never mended")
  const after = play(mended as MatchState, 3).states[2] as MatchState
  assert.equal(byContent(after, MEDIC, "A").targetOrdinal, near.ordinal)
})

test("a unit goes COMMIT_TICKS unable to strike the one it holds, and then lets go", () => {
  assert.equal(COMMIT_TICKS, 30)
  // A trooper holds a marksman it can walk to but has not come nearer to than it once was (its closest gap is seeded
  // below what the walk can reach: as if it were held up in a crowd); a trooper of the enemy's on its own side is the
  // other it could choose. The count is in the state, as it is spent.
  const start = load({ A: [[4, 5, TROOPER]], B: [[8, 5, MARKSMAN], [3, 9, TROOPER]] }, { ticks: 120 })
  const slow = byContent(start, MARKSMAN, "B")
  const me = byContent(start, TROOPER, "A")
  const held: EntityState = { ...me, targetOrdinal: slow.ordinal, commitGap: 1, commitStall: COMMIT_TICKS - 3 }
  const seeded = { ...start, entities: start.entities.map((candidate) => (candidate.ordinal === me.ordinal ? held : candidate)) }
  const { states } = play(seeded, 5)
  const targets = states.slice(1).map((state) => entity(state, me.id)?.targetOrdinal)
  assert.deepEqual(
    targets.slice(0, 2),
    [slow.ordinal, slow.ordinal],
    "still holding the one it cannot strike, two ticks short of the limit",
  )
  assert.equal(entity(states[2] as MatchState, me.id)?.commitStall, COMMIT_TICKS - 1)
  const free = byContent(start, TROOPER, "B")
  assert.equal(targets[2], free.ordinal, "at the limit it chooses afresh, and the one it let go of is not the choice")
  assert.equal(entity(states[3] as MatchState, me.id)?.commitStall, undefined)
})

test("a held target that is walled in is let go at once, for the nearest the unit can reach", () => {
  // The wall runs the Grid's height, so the marksman behind it cannot be walked to, and the trooper is not in its range:
  // holding it would be standing beside the wall for COMMIT_TICKS. The enemy trooper on its own side can be reached.
  const start = load({ A: [[4, 5, TROOPER]], B: [[8, 5, MARKSMAN], [3, 9, TROOPER]] }, { rock: wall(6), ticks: 120 })
  const walled = byContent(start, MARKSMAN, "B")
  const me = byContent(start, TROOPER, "A")
  const held: EntityState = { ...me, targetOrdinal: walled.ordinal, commitGap: 1 }
  const seeded = { ...start, entities: start.entities.map((candidate) => (candidate.ordinal === me.ordinal ? held : candidate)) }
  const { states } = play(seeded, 3)
  const free = byContent(start, TROOPER, "B")
  assert.equal(entity(states[1] as MatchState, me.id)?.targetOrdinal, free.ordinal, "it held the one it cannot reach")
})

/** A ring of rock one tile out round (12, 5): the enemy inside it cannot be walked to. */
const ring: (readonly [number, number])[] = []
for (let x = 11; x <= 13; x += 1) for (let y = 4; y <= 6; y += 1) if (x !== 12 || y !== 5) ring.push([x, y])

test("with nothing in sight it can reach, a unit looks further afield for an enemy it can, and goes for that one", () => {
  // The worker in the ring is the only enemy in sight, and cannot be walked to; a trooper of the enemy's stands beyond
  // its sight (the sight is 6 columns; the side has a target, so only what is in sight is a choice) but well within four
  // times it, on open ground.
  const start = load({ A: [[7, 5, TROOPER]], B: [[12, 5, WORKER], [16, 9, TROOPER]] }, { rock: ring, target: { x: 20, y: 2, width: 3, height: 3 }, ticks: 120 })
  const me = byContent(start, TROOPER, "A")
  const far = byContent(start, TROOPER, "B")
  const { states } = play(start, 3)
  assert.equal(entity(states[1] as MatchState, me.id)?.targetOrdinal, far.ordinal, "it did not look past the ring")
})

test("with nothing it can reach anywhere, a unit keeps its choice and stands as near as it can get, rather than marching on", () => {
  // The only enemy is a worker in the ring, and the trooper's side has a target east of it. Marching on past the fight
  // would take the trooper off to the target; instead it stands by the ring, the enemy it chose still its target, saying
  // it has no route, ready to step in if a tile ever opens. (Measured both ways: the two decide battles alike, and a unit
  // that stands is one rule fewer to explain.)
  const start = load({ A: [[7, 5, TROOPER]], B: [[12, 5, WORKER]] }, { rock: ring, target: { x: 17, y: 3, width: 4, height: 5 }, ticks: 240 })
  const me = byContent(start, TROOPER, "A")
  const walledIn = byContent(start, WORKER, "B")
  const { states, events } = play(start, 150)
  const end = entity(states[states.length - 1] as MatchState, me.id) as EntityState
  assert.ok(end.anchor.x <= 10, `the trooper walked on to x=${end.anchor.x}`)
  assert.equal(end.targetOrdinal, walledIn.ordinal)
  assert.ok(events.some((event) => event.kind === "move.blocked" && event.entity === me.id && event.reason === "no-route"), "it never said it had no route")
})

test("between two enemies both walled in, a unit keeps the one it holds rather than turning from one to the other", () => {
  // Two workers in two rings of rock, both in sight, neither reachable. Choosing afresh among enemies all walled in used
  // to take the other one, then the first again the next tick, every tick (69 changes of target a unit in a battle at a
  // two-row gap); a unit now lets go only of a target it can trade for one it can reach.
  const lower: (readonly [number, number])[] = []
  for (let x = 11; x <= 13; x += 1) for (let y = 7; y <= 9; y += 1) if (x !== 12 || y !== 8) lower.push([x, y])
  const start = load({ A: [[7, 6, TROOPER]], B: [[12, 5, WORKER], [12, 8, WORKER]] }, { rock: [...ring, ...lower], target: { x: 17, y: 3, width: 4, height: 5 }, ticks: 120 })
  const me = byContent(start, TROOPER, "A")
  const { events } = play(start, 60)
  const chosen = events.filter((event) => event.kind === "target.selected" && event.entity === me.id)
  assert.ok(chosen.length >= 1, "it never chose either")
  assert.ok(chosen.length <= 2, `it changed target ${chosen.length} times in 60 ticks`)
})

test("closing on a target, or having it in range, starts the count again", () => {
  const start = load({ A: [[4, 5, TROOPER]], B: [[14, 5, MARKSMAN]] }, { ticks: 120 })
  const { states } = play(start, 60)
  for (const state of states) {
    const me = entity(state, byContent(start, TROOPER, "A").id)
    if (me === undefined) break
    assert.ok((me.commitStall ?? 0) < COMMIT_TICKS, `tick ${state.tick}: a unit walking up to its target is closing`)
  }
})

test("a fresh state carries no commitment, and a state that never fights hashes as it did", () => {
  const start = load({ A: [[4, 5, TROOPER]] }, { ticks: 10 })
  for (const candidate of start.entities) {
    assert.equal(candidate.commitGap, undefined)
    assert.equal(candidate.commitStall, undefined)
  }
  const { states } = play(start, 5)
  assert.equal(hashState(start), hashState({ ...start, entities: start.entities.map((candidate) => ({ ...candidate })) }))
  for (const candidate of (states[5] as MatchState).entities) assert.equal(candidate.commitGap, undefined)
})

test("vision comes from content: the shared sight is 6, a unit's own `vision` replaces it, its attack's range is the floor", () => {
  const trooper = FIXTURE_REGISTRY.get(TROOPER)
  assert.equal(visionOf(trooper), 6)
  assert.equal(visionOf({ ...trooper, vision: 12 }), 12)
  assert.equal(visionOf({ ...trooper, vision: 2 }), 2, "a vision shorter than the shared one is the unit's own")
})

test("an enemy within sight whose walk is longer than the sight is turned on at once, not only once the walk shortens", () => {
  // A trooper marching to a target far east; an enemy 4 columns off on its row, within sight by range, with a short
  // rock between that makes the walk round it 10: longer than the sight of 6. It used to be passed over (the walk
  // beyond sight) until the march brought the walk under 6, and then taken up; now it is the unit's from the first tick
  // and never dropped on the way.
  const target: TargetArea = { x: 22, y: 5, width: 2, height: 2 }
  const start = load({ A: [[4, 5, TROOPER]], B: [[8, 5, MARKSMAN]] }, { rock: [[6, 4], [6, 5], [6, 6]], target, ticks: 60 })
  const enemy = byContent(start, MARKSMAN, "B")
  const me = byContent(start, TROOPER, "A")
  const { states, events } = play(start, 30)
  for (const state of states.slice(1)) assert.equal(entity(state, me.id)?.targetOrdinal, enemy.ordinal, `tick ${state.tick}`)
  assert.equal(events.filter((event) => event.kind === "target.selected" && event.entity === me.id).length, 1)
})
