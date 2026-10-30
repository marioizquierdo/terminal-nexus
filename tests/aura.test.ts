// A Commander's aura in the damage step (docs/system-design/pulse.md): Vasse's By the Book, the owner's
// "Commanders ... should be like heroes on warcraft3 ... Vasse should provide boost to nearby units". The
// story is the named scenario `scenarios/rules/aura-by-the-book.map.json` (tests/scenario.test.ts); here are the
// rule's edges, each on a few units placed to show one thing. An aura is an ability (`src/abilities/aura.ts`), named by
// a unit's content as data: `{ "kind": "aura", "radius": 4, "damageTakenPercent": 75 }`.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY, rectFootprint } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { auraOf, boostedAmount, guardedAmount } from "../src/abilities/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { PlayerId } from "../src/state/types.ts"

const VASSE = "unit.citizen.vasse"

/** A unit that stands where it is put and bears an aura — nothing else, so a test sees the aura alone. */
const bearer = (id: string, damageTakenPercent: number, maxHp = 50): ContentDef => ({
  id,
  short: id.split(".").at(-1) ?? id,
  layer: "units",
  footprint: rectFootprint(1, 1),
  maxHp,
  speedTier: 2,
  collidesWith: ["obstacles", "units"],
  behavior: "static",
  abilities: [{ kind: "aura", name: "Steady", radius: 3, damageTakenPercent }],
  salvage: 0,
})

/** A unit that stands where it is put and hits the nearest enemy beside it, every second, for `damage`. */
const striker = (id: string, damage: number): ContentDef => ({
  id,
  short: id.split(".").at(-1) ?? id,
  layer: "units",
  footprint: rectFootprint(1, 1),
  maxHp: 200,
  speedTier: 2,
  attack: { kind: "melee", range: 1, damage, cooldownTicks: 12 },
  collidesWith: ["obstacles", "units"],
  behavior: "static",
  salvage: 0,
})

const REGISTRY = createRegistry([
  ...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)),
  bearer("unit.test.steady", 75),
  bearer("unit.test.stout", 50),
  bearer("unit.test.frail", 75, 1),
  striker("unit.test.striker", 11),
  striker("unit.test.pricker", 1),
  // A bearer of a boost, Averno's kind: his units within 3 deal a quarter more.
  { ...bearer("unit.test.pressing", 75), abilities: [{ kind: "aura", name: "Pressing", radius: 3, damageDealtPercent: 125 }] },
  // A trooper that stands still: guarded or not, it only takes hits.
  { ...FIXTURE_REGISTRY.get("unit.citizen.trooper"), id: "unit.test.standing", short: "standing", behavior: "static" },
])

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

/** A small Grid with each side placed as given, resolved tick by tick for `ticks`: every event, in order. */
function run(sides: Readonly<Record<PlayerId, readonly Placed[]>>, ticks: number): DomainEvent[] {
  const scenario: ScenarioDefinition = {
    id: "aura-edges",
    name: "aura edges",
    grid: { width: 12, height: 8 },
    seed: 1,
    pulseTicks: ticks,
    terrain: Array.from({ length: 8 }, () => ".".repeat(12)),
    terrainLegend: { ".": "terrain.plain" },
    placements: { A: block(sides.A), B: block(sides.B) },
  }
  const loaded = loadScenario(scenario, { registry: REGISTRY })
  const context = contextFor(loaded.state, REGISTRY, ticks)
  const events: DomainEvent[] = []
  let state = loaded.state
  while (state.outcome === null && state.tick < ticks) {
    const result = stepTick(state, context)
    state = result.state
    events.push(...result.events)
  }
  return events
}

type Hit = Extract<DomainEvent, { kind: "damage.applied" }>
const hitsOn = (events: readonly DomainEvent[], entityPrefix: string): Hit[] =>
  events.filter((event): event is Hit => event.kind === "damage.applied" && event.entity.startsWith(entityPrefix))

test("a guarded hit deals the aura's share, rounded down, and never less than 1", () => {
  assert.equal(guardedAmount(11, 75), 8)
  assert.equal(guardedAmount(10, 75), 7)
  assert.equal(guardedAmount(4, 75), 3)
  assert.equal(guardedAmount(1, 75), 1, "an aura softens a hit; it never makes a unit immune")
  assert.equal(guardedAmount(1, 50), 1)
  assert.equal(guardedAmount(11, 50), 5)
  assert.equal(guardedAmount(0, 75), 0)
  // In a battle: a one-damage hit on a guarded unit still lands for one.
  const events = run({ A: [[2, 2, "unit.test.steady"], [3, 2, "unit.test.standing"]], B: [[4, 2, "unit.test.pricker"]] }, 2)
  const [hit] = hitsOn(events, "A:standing")
  assert.deepEqual([hit?.amount, hit?.guardedBy], [1, "A:steady#1"])
})

test("auras never stack — a unit two reach takes the strongest one's share — a structure is never guarded, and the raid is not guarded by the player's bearer", () => {
  const events = run(
    {
      // A row counts two columns: a reach of 3 is three columns either side and one row up and down.
      A: [
        [1, 1, "unit.test.steady"], // lets 75% through
        [7, 1, "unit.test.stout"], // lets 50% through
        [4, 1, "unit.test.standing"], // three columns from each: both reach it
        [1, 2, "unit.test.standing"], // a row below the steady one, two away; eight from the stout one
        [9, 2, "structure.citizen.barracks"], // its nearest tile a row down and a column across from the stout one, three
      ],
      B: [
        [4, 2, "unit.test.striker"],
        [1, 3, "unit.test.striker"],
        [11, 2, "unit.test.striker"],
      ],
    },
    2,
  )
  const byEntity = new Map(hitsOn(events, "A:").map((hit) => [hit.entity, hit]))
  const both = [...byEntity.values()].find((hit) => hit.entity.startsWith("A:standing") && hit.guardedBy === "A:stout#3")
  assert.ok(both !== undefined, `the stronger aura did not guard the trooper both reach: ${JSON.stringify([...byEntity.values()])}`)
  assert.equal(both.amount, 5)
  const steady = [...byEntity.values()].find((hit) => hit.entity.startsWith("A:standing") && hit !== both)
  assert.deepEqual([steady?.amount, steady?.guardedBy], [8, "A:steady#1"])
  const barracks = [...byEntity.values()].find((hit) => hit.entity.startsWith("A:barracks"))
  assert.deepEqual([barracks?.amount, barracks?.guardedBy], [11, undefined], "a structure was guarded")
  for (const hit of hitsOn(events, "B:")) assert.equal(hit.guardedBy, undefined, "a bearer guarded the other side")
})

test("a bearer who falls guards to the end of the tick she falls in, and from the next tick on nobody", () => {
  // The frail bearer has one health and a striker beside her; the trooper beside her has a striker of its own.
  // Both strike on the first tick: her aura guards the trooper's hit although she falls in that tick; the
  // next strike, a second later, lands whole.
  const events = run({ A: [[2, 2, "unit.test.frail"], [3, 2, "unit.test.standing"]], B: [[1, 2, "unit.test.striker"], [4, 2, "unit.test.striker"]] }, 30)
  const fell = events.find((event) => event.kind === "entity.died" && event.entity.startsWith("A:frail"))
  assert.equal(fell?.tick, 1, "the frail bearer did not fall on the first tick")
  const [first, second] = hitsOn(events, "A:standing")
  assert.ok(fell?.kind === "entity.died")
  assert.deepEqual([first?.tick, first?.amount, first?.guardedBy], [1, 8, fell.entity], "the hit of the tick she fell in was not guarded")
  assert.deepEqual([second?.tick, second?.amount, second?.guardedBy], [13, 11, undefined], "a fallen bearer still guarded")
})

test("By the Book is Vasse's own, settled from the Experiment that tuned it: a quarter less from every hit, within 4", () => {
  // The Experiment "By the Book" was felt at 25 percent less and settled there (as was "Vasse's health", at 80): her
  // aura is now her data, in her army's file, and nothing tunes it on the side.
  assert.deepEqual(auraOf(FIXTURE_REGISTRY.get(VASSE)), { kind: "aura", name: "By the Book", radius: 4, damageTakenPercent: 75 })
  assert.equal(FIXTURE_REGISTRY.get(VASSE).maxHp, 80)
  // Nobody else bears a guard: Averno's is a boost, and no bench unit has one.
  const guards = FIXTURE_REGISTRY.ids().filter((id) => auraOf(FIXTURE_REGISTRY.get(id))?.damageTakenPercent !== undefined)
  assert.deepEqual(guards, [VASSE])
})

test("a boost: a unit within a boosting aura deals more with every hit, rounded down, never less than the hit; a guard on the target still takes its share", () => {
  assert.equal(boostedAmount(11, 125), 13)
  assert.equal(boostedAmount(1, 125), 1)
  assert.equal(boostedAmount(4, 125), 5)
  assert.equal(boostedAmount(0, 125), 0)
  // The striker stands beside the pressing bearer, so its 11 becomes 13 on the raid's trooper.
  const boosted = run({ A: [[2, 2, "unit.test.pressing"], [3, 2, "unit.test.striker"]], B: [[4, 2, "unit.test.standing"]] }, 13)
  assert.equal(hitsOn(boosted, "B:standing")[0]?.amount, 13)
  // Out of reach, the same striker hits for 11.
  const plain = run({ A: [[0, 0, "unit.test.pressing"], [9, 6, "unit.test.striker"]], B: [[10, 6, "unit.test.standing"]] }, 13)
  assert.equal(hitsOn(plain, "B:standing")[0]?.amount, 11)
  // A boosted hit on a guarded target: 13 through a three-quarter guard is 9.
  const both = run({ A: [[2, 2, "unit.test.pressing"], [3, 2, "unit.test.striker"]], B: [[4, 2, "unit.test.standing"], [5, 2, "unit.test.steady"]] }, 13)
  assert.equal(hitsOn(both, "B:standing")[0]?.amount, 9)
})
