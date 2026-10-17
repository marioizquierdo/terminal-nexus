// Abilities (src/abilities/, the kernel's half in src/pulse/abilities.ts): what a unit does on its own besides fighting,
// written once as a kind with hooks and named by data. Here: the hooks run where they say, a bounty pays for what falls
// in its reach and nothing else, loaded dice throw from the battle's own stream, a Nexus power changes an ability's
// numbers, and the kernel takes a table of kinds as an argument — a kind the game does not ship runs the same way.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { AbilityKind, AbilityTable } from "../src/abilities/index.ts"
import { ABILITIES, abilityLines, abilityProblems, abilityReach } from "../src/abilities/index.ts"
import { applyEffect } from "../src/armies/index.ts"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY, rectFootprint } from "../src/content/index.ts"
import { literal, positiveWholeNumber, record } from "../src/content/shape.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { creditsEarned } from "../src/match/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { PlayerId } from "../src/state/types.ts"

/** A unit that stands where it is put and has `abilities` — nothing else, so a test sees the ability alone. */
const stander = (id: string, abilities: ContentDef["abilities"], extra: Partial<ContentDef> = {}): ContentDef => ({
  id,
  short: id.split(".").at(-1) ?? id,
  layer: "units",
  footprint: rectFootprint(1, 1),
  maxHp: 50,
  speedTier: 2,
  collidesWith: ["obstacles", "units"],
  behavior: "static",
  salvage: 0,
  ...(abilities === undefined ? {} : { abilities }),
  ...extra,
})

/** A unit that stands and hits what is beside it, every second, for `damage`. */
const striker = (id: string, damage: number, abilities?: ContentDef["abilities"]): ContentDef =>
  stander(id, abilities, { maxHp: 200, attack: { kind: "melee", range: 1, damage, cooldownTicks: 12 } })

const REGISTRY = createRegistry([
  ...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)),
  stander("unit.test.hunter", [{ kind: "bounty", name: "Bounty", radius: 6, credits: 3, structureCredits: 10 }]),
  striker("unit.test.gambler", 10, [{ kind: "loadedDice", name: "Dice", chanceIn: 2, times: 3 }]),
  striker("unit.test.killer", 50),
  stander("unit.test.prey", undefined, { maxHp: 10 }),
  stander("structure.test.shed", undefined, { layer: "obstacles", maxHp: 10, collidesWith: ["obstacles", "workers", "units"] }),
])

type Placed = readonly [x: number, y: number, content: string]

/** One side's placement block: each content at its tile. */
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

/** A small Grid with each side placed as given, resolved tick by tick: every event, in order. */
function run(sides: Readonly<Record<PlayerId, readonly Placed[]>>, ticks: number, registry = REGISTRY, abilities?: AbilityTable, seed = 1): DomainEvent[] {
  const scenario: ScenarioDefinition = {
    id: "abilities",
    name: "abilities",
    grid: { width: 24, height: 8 },
    seed,
    pulseTicks: ticks,
    terrain: Array.from({ length: 8 }, () => ".".repeat(24)),
    terrainLegend: { ".": "terrain.plain" },
    placements: { A: block(sides.A), B: block(sides.B) },
  }
  const loaded = loadScenario(scenario, { registry })
  const context = { ...contextFor(loaded.state, registry, ticks), ...(abilities === undefined ? {} : { abilities }) }
  const events: DomainEvent[] = []
  let state = loaded.state
  while (state.outcome === null && state.tick < ticks) {
    const result = stepTick(state, context)
    state = result.state
    events.push(...result.events)
  }
  return events
}

type Triggered = Extract<DomainEvent, { kind: "ability.triggered" }>
const triggered = (events: readonly DomainEvent[]): Triggered[] => events.filter((event): event is Triggered => event.kind === "ability.triggered")

test("a bounty pays for each enemy that falls within its reach while its bearer stands, a building its own price, and nothing else", () => {
  // Side A: the hunter, and a killer beside each of three enemies: one in reach, one out of it, a shed in reach.
  // A prey far off nobody reaches keeps side B on the Grid, so the battle runs until the shed falls too.
  const events = run(
    {
      A: [[2, 2, "unit.test.hunter"], [4, 2, "unit.test.killer"], [16, 2, "unit.test.killer"], [3, 5, "unit.test.killer"]],
      B: [[5, 2, "unit.test.prey"], [17, 2, "unit.test.prey"], [3, 4, "structure.test.shed"], [23, 7, "unit.test.prey"]],
    },
    30,
  )
  const paid = triggered(events).filter((event) => event.ability === "bounty")
  assert.deepEqual(
    paid.map((event) => [event.target?.split("#")[0], event.credits]),
    [["B:prey", 3], ["B:shed", 10]],
  )
  assert.equal(creditsEarned(events, "A"), 13)
  assert.equal(creditsEarned(events, "B"), 0)
  // The one that fell out of reach fell all the same.
  assert.equal(events.filter((event) => event.kind === "entity.died" && event.entity.startsWith("B:prey")).length, 2)
})

test("loaded dice throw from the battle's own stream: the same seed lands the same lucky hits, and a lucky hit is that hard", () => {
  const sides = { A: [[2, 2, "unit.test.gambler"]] as const, B: [[3, 2, "unit.test.killer"]] as const }
  const once = run(sides, 120)
  assert.deepEqual(run(sides, 120), once, "two runs of one seed threw different dice")
  const lucky = triggered(once).filter((event) => event.ability === "loadedDice")
  const attacks = once.filter((event): event is Extract<DomainEvent, { kind: "attack.launched" }> => event.kind === "attack.launched" && event.attacker.startsWith("A:"))
  // One in two, three times as much: some hits come up, not all, and each says 30 where the rest say 10.
  assert.ok(lucky.length > 0 && lucky.length < attacks.length, `${lucky.length} lucky hits of ${attacks.length}`)
  assert.deepEqual([...new Set(attacks.map((event) => event.damage))].sort((a, b) => a - b), [10, 30])
  assert.equal(attacks.filter((event) => event.damage === 30).length, lucky.length)
  // Another seed throws other dice.
  const other = run(sides, 120, REGISTRY, undefined, 99)
  assert.notDeepEqual(other.filter((event) => event.kind === "ability.triggered").map((event) => event.tick), lucky.map((event) => event.tick))
})

test("a kind the game does not ship runs the same way: the kernel takes its table of kinds as an argument", () => {
  // A mod's ability, in a few lines: every unit of its side within its reach mends `amount` whenever anyone dies.
  type Wake = Readonly<{ kind: "wake"; radius: number; amount: number }>
  const wake: AbilityKind<Wake> = {
    kind: "wake",
    params: record<Wake>({ kind: literal("wake"), radius: positiveWholeNumber, amount: positiveWholeNumber }, {}),
    describe: (params) => `Wake: units within range ${params.radius} mend ${params.amount} when anyone falls.`,
    reach: (params) => params.radius,
    death: (bearer, _dying, _killer, params, world) => {
      for (const body of world.bodies()) if (body.player === bearer.player && world.within(bearer, body, params.radius)) world.heal(body, bearer, params.amount)
      world.note(bearer, params)
    },
  }
  const table: AbilityTable = { ...ABILITIES, wake: wake as unknown as AbilityKind }
  const registry = createRegistry([...REGISTRY.ids().map((id) => REGISTRY.get(id)), stander("unit.test.mourner", [{ kind: "wake", radius: 4, amount: 5 }], { maxHp: 40 })])
  const events = run({ A: [[2, 2, "unit.test.mourner"], [4, 2, "unit.test.killer"]], B: [[5, 2, "unit.test.prey"], [9, 5, "unit.test.killer"]] }, 20, registry, table)
  assert.equal(triggered(events).filter((event) => event.ability === "wake").length, 1)
  // Without the kind in the table, the kernel skips it: the loader is what refuses an unknown kind, before a battle.
  assert.equal(triggered(run({ A: [[2, 2, "unit.test.mourner"], [4, 2, "unit.test.killer"]], B: [[5, 2, "unit.test.prey"]] }, 20, registry)).length, 0)
  assert.deepEqual(abilityProblems({ kind: "wake", radius: 4, amount: 5 }, "it"), ['it is of the kind "wake", which is not an ability the game has ("aura", "bounty", "loadedDice")'])
  assert.deepEqual(abilityProblems({ kind: "wake", radius: 4, amount: 5 }, "it", table), [])
})

test("what a card says of a unit's abilities, and how far the furthest reaches, come from each kind", () => {
  const dob = FIXTURE_REGISTRY.get("unit.ravel.dob")
  assert.deepEqual(abilityLines(dob, { subject: "he", possessive: "his" }), [
    "Bounty: every enemy that falls within range 6 pays 3 credits next round.",
    "Loaded Dice: one in 4 of his hits deals 3 times as much.",
  ])
  assert.equal(abilityReach(dob), 6)
  assert.equal(abilityReach(FIXTURE_REGISTRY.get("unit.citizen.trooper")), null)
})

test("a Nexus power changes an ability's numbers for the rest of the mission: Lucky Scrap doubles Dob's price", () => {
  const loadout = { registry: FIXTURE_REGISTRY, catalog: [], callups: [], cards: [], row: () => ({ contentId: "" }) }
  const changed = applyEffect(loadout, { modifyAbility: { content: "unit.ravel.dob", kind: "bounty", add: { credits: 3 } } })
  assert.deepEqual(changed.registry.get("unit.ravel.dob").abilities?.[0], { kind: "bounty", name: "Bounty", radius: 6, credits: 6, structureCredits: 15 })
  // Nothing else changed: his dice, and every other unit.
  assert.deepEqual(changed.registry.get("unit.ravel.dob").abilities?.[1], FIXTURE_REGISTRY.get("unit.ravel.dob").abilities?.[1])
  assert.equal(changed.registry.get("unit.citizen.trooper"), FIXTURE_REGISTRY.get("unit.citizen.trooper"))
})

test("a tick hook acts every tick, after the attacks: a building that mends the units near it, written as a kind the game does not ship", () => {
  // The review's engineer: a Turret that mends instead of a gun. A kind with a `tick` hook heals each unit of its side
  // within its reach by `amount` every tick it stands.
  type Mend = Readonly<{ kind: "mend"; radius: number; amount: number }>
  const mend: AbilityKind<Mend> = {
    kind: "mend",
    params: record<Mend>({ kind: literal("mend"), radius: positiveWholeNumber, amount: positiveWholeNumber }, {}),
    describe: (params) => `Mend: units within range ${params.radius} heal ${params.amount} a tick.`,
    tick: (bearer, params, world) => {
      for (const body of world.bodies()) if (body.player === bearer.player && body.ordinal !== bearer.ordinal && body.hp < body.maxHp && world.within(bearer, body, params.radius)) world.heal(body, bearer, params.amount)
    },
  }
  const table: AbilityTable = { ...ABILITIES, mend: mend as unknown as AbilityKind }
  const mender = stander("structure.test.mender", [{ kind: "mend", radius: 4, amount: 1 }], { layer: "obstacles", collidesWith: ["obstacles", "workers", "units"] })
  const tough = stander("unit.test.tough", undefined, { maxHp: 100 })
  const registry = createRegistry([...REGISTRY.ids().map((id) => REGISTRY.get(id)), mender, tough])
  // A tough unit beside the mender, a gambler hitting it every second: the mender's heals land between the hits.
  const sides = { A: [[2, 2, "structure.test.mender"], [4, 2, "unit.test.tough"]] as const, B: [[5, 2, "unit.test.gambler"]] as const }
  const events = run(sides, 12, registry, table)
  const heals = events.filter((event) => event.kind === "heal.applied" && event.source.startsWith("A:mender"))
  assert.ok(heals.length > 0, "the mender never mended")
  assert.ok(heals.every((event) => event.kind === "heal.applied" && event.amount === 1))
  // Without its kind in the table it does nothing, and the same fight has no heal in it.
  assert.equal(run(sides, 12, registry).filter((event) => event.kind === "heal.applied").length, 0)
})
