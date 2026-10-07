// A side's target (docs/system-design/pulse.md, perception and intents): the region a campaign level names for
// the player's troops — the owner: "the campaign levels should have a target well defined so it is predictable
// where your troops are moving". Its fighting units head for it, engage what comes within their reach on the
// way, and stand there. The story is the named scenario `scenarios/target-head-engage-stand.map.json`
// (tests/scenario.test.ts); here are the rule's edges, and the state that carries a target.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { ContentDef } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { ENGAGE_RANGE, engageRange, followsTarget } from "../src/pulse/target.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import { ScenarioError } from "../src/scenario/index.ts"
import { hashState, parseState, serializeState } from "../src/state/serialize.ts"
import type { MatchState, PlayerId, TargetArea } from "../src/state/types.ts"

type Placed = readonly [x: number, y: number, content: string]

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

/** A 24 x 12 open Grid with each side placed as given and A's target, resolved tick by tick. */
function run(sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>, target: TargetArea, ticks: number): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const scenario: ScenarioDefinition = {
    id: "target-edges",
    name: "target edges",
    grid: { preset: "small-wide" },
    seed: 1,
    pulseTicks: ticks,
    terrain: Array.from({ length: 12 }, () => ".".repeat(24)),
    terrainLegend: { ".": "terrain.plain" },
    placements,
    targets: { A: target },
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  const context = contextFor(loaded.state, FIXTURE_REGISTRY, ticks)
  const states: MatchState[] = [loaded.state]
  const events: DomainEvent[] = []
  let state = loaded.state
  while (state.outcome === null && state.tick < ticks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { states, events }
}

const TROOPER = "unit.citizen.trooper"
const inside = (area: TargetArea, x: number, y: number): boolean => x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height

test("a unit turns from its side's target on what comes within its reach, and never less than its own attack's", () => {
  const trooper = FIXTURE_REGISTRY.get(TROOPER)
  assert.equal(engageRange(trooper), ENGAGE_RANGE)
  assert.equal(ENGAGE_RANGE, 6)
  const longGun: ContentDef = { ...trooper, attack: { kind: "ranged", range: 10, damage: 5, cooldownTicks: 12 } }
  assert.equal(engageRange(longGun), 10, "a unit would walk past an enemy it could have shot")
  // Only a unit that moves and fights follows a target: not a worker that flees, a healer, or a building.
  assert.ok(followsTarget(trooper))
  assert.ok(followsTarget(FIXTURE_REGISTRY.get("unit.citizen.vasse")))
  assert.ok(!followsTarget(FIXTURE_REGISTRY.get("unit.citizen.worker")))
  assert.ok(!followsTarget(FIXTURE_REGISTRY.get("unit.bench.medic")))
  assert.ok(!followsTarget(FIXTURE_REGISTRY.get("structure.citizen.barracks")))
  assert.ok(!followsTarget(FIXTURE_REGISTRY.get("structure.bench.beamturret")))
})

test("the first to arrive fill the target, the rest gather beside them, and then nobody presses: no step, no blocked claim", () => {
  // Six troopers and a target two tiles wide: two inside, four gathered round, and from then on still. The raid's
  // runner in the far corner keeps the battle going and is never within anyone's reach.
  const area = { x: 12, y: 5, width: 2, height: 1 }
  const squad: Placed[] = [[2, 3, TROOPER], [2, 4, TROOPER], [2, 5, TROOPER], [2, 6, TROOPER], [2, 7, TROOPER], [3, 5, TROOPER]]
  const { states, events } = run({ A: squad, B: [[22, 0, "structure.ravel.nexus"]] }, area, 240)
  const last = states.at(-1) as MatchState
  const troops = last.entities.filter((entity) => entity.player === "A")
  assert.equal(troops.filter((entity) => inside(area, entity.anchor.x, entity.anchor.y)).length, 2, "the target is not full")
  // Every one inside, or beside one who is gathered, step by step out from the target.
  const gathered = new Set(troops.filter((entity) => inside(area, entity.anchor.x, entity.anchor.y)).map((entity) => entity.ordinal))
  for (let grew = true; grew; ) {
    grew = false
    for (const entity of troops) {
      if (gathered.has(entity.ordinal)) continue
      if (!troops.some((other) => gathered.has(other.ordinal) && Math.abs(other.anchor.x - entity.anchor.x) + Math.abs(other.anchor.y - entity.anchor.y) === 1)) continue
      gathered.add(entity.ordinal)
      grew = true
    }
  }
  assert.equal(gathered.size, troops.length, "some stand apart from the others")
  const settled = events.filter((event) => event.kind === "entity.moved").reduce((latest, event) => Math.max(latest, event.tick), 0)
  assert.ok(settled < 120, `still moving at tick ${settled}`)
  assert.ok(!events.some((event) => event.kind === "move.blocked" && event.tick > settled), "a gathered unit kept pressing on the others")
})

test("a building of the side standing in its target is where they gather round, rather than press on it", () => {
  // A Turret on the target's only tile: the troopers come up against it and stand round it.
  const area = { x: 12, y: 5, width: 1, height: 1 }
  const { states, events } = run(
    { A: [[2, 4, TROOPER], [2, 5, TROOPER], [2, 6, TROOPER], [12, 5, "structure.bench.beamturret"]], B: [[22, 0, "structure.ravel.nexus"]] },
    area,
    240,
  )
  const troops = (states.at(-1) as MatchState).entities.filter((entity) => entity.player === "A" && entity.contentId === TROOPER)
  assert.equal(troops.length, 3)
  assert.ok(troops.some((entity) => Math.abs(entity.anchor.x - 12) + Math.abs(entity.anchor.y - 5) === 1), "nobody reached the Turret")
  const settled = events.filter((event) => event.kind === "entity.moved").reduce((latest, event) => Math.max(latest, event.tick), 0)
  assert.ok(settled < 120, `still moving at tick ${settled}`)
  assert.ok(!events.some((event) => event.kind === "move.blocked" && event.tick > settled), "a trooper kept pressing on the Turret")
})

test("a state carries a side's target only when it has one, round-trips it byte for byte, and refuses a malformed one", () => {
  const { states } = run({ A: [[2, 5, TROOPER]], B: [[22, 0, "structure.ravel.nexus"]] }, { x: 12, y: 5, width: 2, height: 1 }, 2)
  const state = states.at(-1) as MatchState
  assert.deepEqual(state.targets, { A: { x: 12, y: 5, width: 2, height: 1 } })
  const text = serializeState(state)
  assert.equal(serializeState(parseState(text)), text)
  assert.equal(hashState(parseState(text)), hashState(state))
  // With no target the field is not there at all: the state's bytes are a battle's before targets.
  const { targets: _targets, ...bare } = state
  assert.doesNotMatch(serializeState(bare), /targets/)
  const broken = (targets: unknown): string => JSON.stringify({ ...JSON.parse(text), targets })
  assert.throws(() => parseState(broken({})), /state targets is empty/)
  assert.throws(() => parseState(broken({ C: { x: 1, y: 1, width: 1, height: 1 } })), /unknown side C/)
  assert.throws(() => parseState(broken({ A: { x: 23, y: 1, width: 2, height: 1 } })), /reaches off the 24x12 Grid/)
  assert.throws(() => parseState(broken({ A: { x: 1, y: 1, width: 0, height: 1 } })), /not a rectangle of whole tiles/)
})

test("a map's target is checked when it loads: on the Grid, whole tiles, and ground its units can stand on", () => {
  const scenario = (targets: ScenarioDefinition["targets"], terrain = Array.from({ length: 12 }, () => ".".repeat(24))): ScenarioDefinition => ({
    id: "target-load",
    name: "target load",
    grid: { preset: "small-wide" },
    seed: 1,
    pulseTicks: 12,
    terrain,
    terrainLegend: { ".": "terrain.plain", "#": "terrain.rock" },
    placements: { A: block([[2, 5, TROOPER]]) },
    ...(targets === undefined ? {} : { targets }),
  })
  assert.equal(loadScenario(scenario(undefined)).state.targets, undefined)
  assert.deepEqual(loadScenario(scenario({ A: { x: 3, y: 3, width: 2, height: 2 } })).state.targets, { A: { x: 3, y: 3, width: 2, height: 2 } })
  assert.throws(() => loadScenario(scenario({ A: { x: 23, y: 3, width: 2, height: 2 } })), (error: unknown) => error instanceof ScenarioError && /reaches off the 24x12 Grid/.test(error.message))
  assert.throws(() => loadScenario(scenario({ A: { x: 3, y: 3, width: 0, height: 2 } })), /whole tiles, at least one wide and tall/)
  const rocky = Array.from({ length: 12 }, (_, y) => (y === 4 ? "....#..................." : ".".repeat(24)))
  assert.throws(() => loadScenario(scenario({ A: { x: 3, y: 3, width: 2, height: 2 } }, rocky)), /covers \(4,4\), which is impassable terrain.rock/)
})
