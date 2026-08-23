// The Ravel fixture army, and the one rule that makes it Ravel rather than a reskin.

import { test } from "node:test"
import assert from "node:assert/strict"
import { CITIZEN_CONTENT, FIXTURE_REGISTRY, RAVEL_CONTENT } from "../src/content/index.ts"
import { stepCost } from "../src/pulse/index.ts"
import { resolveScenario } from "./helpers.ts"

/** Ticks between steps at a given rate — the cadence a viewer actually sees. */
function cadence(numerator: number, denominator: number): number {
  return Math.ceil(stepCost({ numerator, denominator }) / numerator)
}

test("no Ravel moves on a Citizen cadence", () => {
  // "Off the beat" is a rule shape, so it is a test rather than a note: `commander-armies.md` 4.1
  // asks for rates deliberately off the common cadence, and a fixture that quietly drifted onto one
  // would look like the same army in different letters.
  const citizen = new Set(
    CITIZEN_CONTENT.filter((definition) => definition.movementRate !== undefined).map((definition) =>
      cadence(definition.movementRate!.numerator, definition.movementRate!.denominator),
    ),
  )
  const ravel = RAVEL_CONTENT.filter((definition) => definition.movementRate !== undefined)
  assert.ok(ravel.length >= 4, "the Ravel fixture has too few movers to make a point")
  for (const definition of ravel) {
    const rate = definition.movementRate
    if (rate === undefined) continue
    const beat = cadence(rate.numerator, rate.denominator)
    assert.ok(
      !citizen.has(beat),
      `${definition.id} steps every ${beat} ticks, which is a Citizen cadence`,
    )
  }
})

test("Ravels claim and swing before Citizens of the same role", () => {
  const tierOf = (id: string): number => FIXTURE_REGISTRY.get(id).speedTier
  assert.ok(tierOf("unit.ravel.runner") < tierOf("unit.citizen.trooper"))
  assert.equal(tierOf("unit.ravel.slinger"), tierOf("unit.citizen.marksman"))
})

test("volatile munitions damage friend and foe alike", async () => {
  const resolved = await resolveScenario("citizens-versus-ravels.map.json")
  const blasts = resolved.run.events.filter((event) => event.kind === "entity.detonated")
  assert.ok(blasts.length > 3, "nothing detonated in the asymmetric fixture")

  let caughtFriendly = false
  let caughtEnemy = false
  for (const blast of blasts) {
    if (blast.kind !== "entity.detonated") continue
    for (const victim of blast.caught) {
      if (victim.startsWith(`${blast.player}:`)) caughtFriendly = true
      else caughtEnemy = true
    }
  }
  assert.ok(caughtEnemy, "no detonation ever caught an enemy")
  assert.ok(caughtFriendly, "no detonation ever caught its own side, so the rule has no teeth")
})

test("a detonation is announced after the death that caused it", async () => {
  // A reader of the event stream should see the entity die and then take its neighbours with it,
  // in that order, within the tick.
  const resolved = await resolveScenario("ravel-cascade.map.json")
  const events = resolved.run.events
  for (const [index, event] of events.entries()) {
    if (event.kind !== "entity.detonated") continue
    const death = events
      .slice(0, index)
      .find(
        (earlier) =>
          earlier.tick === event.tick &&
          (earlier.kind === "entity.died" || earlier.kind === "structure.destroyed") &&
          earlier.ordinal === event.ordinal,
      )
    assert.ok(death !== undefined, `${event.entity} detonated at ${event.tick} without dying first`)
  }
})

test("chains are bounded: nothing detonates twice, and the cascade resolves inside one tick", async () => {
  const resolved = await resolveScenario("ravel-cascade.map.json")
  const blasts = resolved.run.events.filter((event) => event.kind === "entity.detonated")
  const seen = new Set<number>()
  for (const blast of blasts) {
    if (blast.kind !== "entity.detonated") continue
    assert.ok(!seen.has(blast.ordinal), `${blast.entity} detonated twice`)
    seen.add(blast.ordinal)
  }

  const byTick = new Map<number, number>()
  for (const blast of blasts) byTick.set(blast.tick, (byTick.get(blast.tick) ?? 0) + 1)
  const cascadeTick = [...byTick.entries()].sort((a, b) => b[1] - a[1])[0]
  assert.ok(cascadeTick !== undefined)
  assert.ok(cascadeTick[1] >= 5, `the biggest cascade was only ${cascadeTick[1]} detonations`)

  // The whole chain resolves inside the tick that started it, and it finishes the fixture: no part
  // of a cascade is ever left over for the next tick.
  const ended = resolved.run.events.find((event) => event.kind === "pulse.ended")
  assert.ok(ended !== undefined)
  assert.equal(ended.tick, cascadeTick[0], "the Pulse did not end on the tick the cascade ran")
  assert.equal(resolved.run.finalState.outcome?.reason, "annihilation")
})

test("a Grid Nexus is a flag on the definition, not a content id the kernel knows by heart", async () => {
  const citizen = FIXTURE_REGISTRY.get("structure.citizen.nexus")
  const ravel = FIXTURE_REGISTRY.get("structure.ravel.nexus")
  assert.equal(citizen.nexus, true)
  assert.equal(ravel.nexus, true)
  assert.equal(FIXTURE_REGISTRY.get("structure.ravel.den").nexus, undefined)

  // Destroying either one ends a Pulse; Gate 1A only ever proved it for the Citizen id.
  const resolved = await resolveScenario("structure-destruction.map.json")
  assert.equal(resolved.run.finalState.outcome?.reason, "nexus-destroyed")
})

test("the two fixture armies are shaped differently, not just named differently", () => {
  const hpOf = (definitions: readonly { maxHp: number; layer: string }[]): number =>
    definitions.filter((d) => d.layer === "units").reduce((total, d) => total + d.maxHp, 0)
  const citizenUnits = CITIZEN_CONTENT.filter((d) => d.layer === "units")
  const ravelUnits = RAVEL_CONTENT.filter((d) => d.layer === "units")

  // Ravels field more bodies per point of health, and most of them explode.
  assert.ok(ravelUnits.length >= citizenUnits.length)
  assert.ok(
    hpOf(RAVEL_CONTENT) < hpOf(CITIZEN_CONTENT),
    "the Ravel line is not more fragile than the Citizen one",
  )
  const explosive = RAVEL_CONTENT.filter((d) => d.detonation !== undefined).length
  assert.ok(explosive >= 4, `only ${explosive} Ravel definitions are volatile`)
  assert.equal(
    CITIZEN_CONTENT.filter((d) => d.detonation !== undefined).length,
    0,
    "a Citizen definition became volatile, which is the other faction's rule",
  )
})
