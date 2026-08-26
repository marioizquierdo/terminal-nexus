// The Proving Grounds roster and the kernel rules it needed — the unit-design-architecture spike.
// content.test.ts already covers footprint/art agreement generically for every registered content id,
// this roster included; what belongs here is behavioral proof for each *new kernel rule*, the same way
// ravel.test.ts proves volatile munitions rather than just asserting the fixture loads.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY, PROVING_GROUND_CONTENT } from "../src/content/index.ts"
import { resolveScenario } from "./helpers.ts"

test("a ground unit with targetLayers set never selects, and never attacks, an entity on an excluded layer", async () => {
  const resolved = await resolveScenario("bench-sky-ground-asymmetry.map.json")
  const events = resolved.run.events

  const gruntSelections = events.filter(
    (event) => event.kind === "target.selected" && event.entity.includes(":grunt#"),
  )
  assert.equal(
    gruntSelections.length,
    0,
    "the grunt selected a target at all, even though its only enemy is a layer it cannot reach",
  )
  const gruntAttacks = events.filter(
    (event) => event.kind === "attack.launched" && event.attacker.includes(":grunt#"),
  )
  assert.equal(gruntAttacks.length, 0, "the grunt landed an attack on something it should never reach")

  // The counter: an otherwise-ordinary ranged unit, targetLayers left undefined, engages normally.
  const flakSelections = events.filter(
    (event) => event.kind === "target.selected" && event.entity.includes(":flak#"),
  )
  assert.ok(flakSelections.length > 0, "the flak trooper never engaged the flyer it has no restriction against")
})

test("contact detonation: a unit with no attack at all still dies by its own choice, not only by taking damage", async () => {
  const resolved = await resolveScenario("bench-spitter-contact.map.json")
  const events = resolved.run.events

  const spitterDeaths = events.filter(
    (event) => event.kind === "entity.died" && event.entity.includes(":spitter#"),
  )
  assert.ok(spitterDeaths.length > 0, "no spitter died in its own fixture")
  const selfTriggered = spitterDeaths.filter(
    (event) => event.kind === "entity.died" && event.killer === null,
  )
  assert.ok(
    selfTriggered.length > 0,
    "every spitter death had a killer, so none of them actually chose to detonate on contact",
  )

  // Every spitter carries no attack at all - it is not attacking, it is choosing to die.
  const spitterAttacks = events.filter(
    (event) => event.kind === "attack.launched" && event.attacker.includes(":spitter#"),
  )
  assert.equal(spitterAttacks.length, 0, "a spitter launched a normal attack; it should have none")

  const blasts = events.filter((event) => event.kind === "entity.detonated")
  assert.ok(blasts.length > 0, "nothing detonated in the contact-detonation fixture")
})

test("splash: one attack.launched can produce more than one damage.applied in the same tick, and never damages its own source", async () => {
  const resolved = await resolveScenario("bench-siegecrawler-windup.map.json")
  const events = resolved.run.events

  const shots = events.filter(
    (event) => event.kind === "attack.launched" && event.attacker.includes(":siege#"),
  )
  assert.ok(shots.length > 0, "the siege crawler never fired at all")

  let sawMultiVictimHit = false
  for (const shot of shots) {
    if (shot.kind !== "attack.launched") continue
    const sameTick = events.filter(
      (event) => event.kind === "damage.applied" && event.tick === shot.tick,
    )
    if (sameTick.length > 1) sawMultiVictimHit = true
    for (const hit of sameTick) {
      if (hit.kind !== "damage.applied") continue
      assert.notEqual(
        hit.entity,
        shot.attacker,
        "a splash attack damaged its own shooter - the self-exclusion this test guards regressed",
      )
    }
  }
  assert.ok(sawMultiVictimHit, "no single tick's splash ever caught more than one victim")
})

test("targetPreference: a giant prefers a farther structure over a much closer soldier", async () => {
  const resolved = await resolveScenario("bench-ram-preference.map.json")
  const events = resolved.run.events
  const first = events.find(
    (event) => event.kind === "target.selected" && event.entity.includes(":ram#"),
  )
  assert.ok(first !== undefined, "the ram never selected a target")
  if (first === undefined || first.kind !== "target.selected") return
  assert.ok(first.target.includes(":barracks#"), `the ram's first target was ${first.target}, not the barracks`)

  // It never fires on the trooper it is ignoring - targetPreference is a bias on *selection*, and
  // nothing here should also need to touch attacks() to hold.
  const ramAttacks = events.filter(
    (event) => event.kind === "attack.launched" && event.attacker.includes(":ram#"),
  )
  assert.equal(ramAttacks.length, 0, "the ram fought back against the trooper it should be ignoring")
})

test("support: a heal clamps at maxHp, raises hp, and reports as heal.applied, never damage.applied", async () => {
  const resolved = await resolveScenario("bench-medic-support.map.json")
  const events = resolved.run.events
  const heals = events.filter((event) => event.kind === "heal.applied")
  assert.ok(heals.length > 0, "the medic never healed anyone")
  for (const heal of heals) {
    if (heal.kind !== "heal.applied") continue
    assert.ok(heal.hpAfter > heal.hpBefore, `${heal.entity} was not actually healed`)
    const definition = FIXTURE_REGISTRY.get(
      resolved.run.finalState.entities.find((entity) => entity.id === heal.entity)?.contentId ??
        // The healed entity may already be dead by the final state; fall back to any Citizen trooper,
        // since every ally healed in this fixture is one.
        "unit.citizen.trooper",
    )
    assert.ok(heal.hpAfter <= definition.maxHp, `${heal.entity} healed past its own maxHp`)
  }
  const medicDamageDealt = events.filter(
    (event) => event.kind === "damage.applied" && event.source.includes(":medic#"),
  )
  assert.equal(medicDamageDealt.length, 0, "the medic dealt damage.applied instead of heal.applied")
})

test("spawn: a structure creates entities mid-Pulse, capped at maxAlive", async () => {
  const resolved = await resolveScenario("bench-hatchery-spawn.map.json")
  const events = resolved.run.events
  const spawnlingBirths = events.filter(
    (event) => event.kind === "entity.spawned" && event.contentId === "unit.bench.spawnling",
  )
  assert.ok(spawnlingBirths.length > 0, "the hatchery never spawned anything")
  assert.ok(
    spawnlingBirths.some((event) => event.tick > 0),
    "every spawnling appeared at tick 0 - spawning never actually happened mid-Pulse",
  )

  const hatchery = PROVING_GROUND_CONTENT.find((definition) => definition.id === "structure.bench.hatchery")
  const cap = hatchery?.spawn?.maxAlive
  assert.ok(cap !== undefined)

  // At every spawn, no more than `maxAlive` spawnlings should already be alive for that player -
  // replayed from the event stream itself, the same discipline report/replay.ts already uses.
  const alive = new Set<number>()
  for (const event of events) {
    if (event.kind === "entity.spawned" && event.contentId === "unit.bench.spawnling") {
      assert.ok(alive.size < (cap ?? 0), `a spawn happened with ${alive.size} spawnlings already alive`)
      alive.add(event.ordinal)
    }
    if (
      (event.kind === "entity.died" || event.kind === "structure.destroyed") &&
      alive.has(event.ordinal)
    ) {
      alive.delete(event.ordinal)
    }
  }
})

test("splitOnDeath: dying creates entities in the same tick, through the same spawn primitive", async () => {
  const resolved = await resolveScenario("bench-shardgiant-split.map.json")
  const events = resolved.run.events
  const death = events.find(
    (event) => event.kind === "entity.died" && event.entity.includes(":shard#"),
  )
  assert.ok(death !== undefined, "the shard-giant never died in its own fixture")
  if (death === undefined) return

  const shardgiant = PROVING_GROUND_CONTENT.find((definition) => definition.id === "unit.bench.shardgiant")
  const expectedCount = shardgiant?.splitOnDeath?.count
  assert.ok(expectedCount !== undefined)

  const births = events.filter(
    (event) =>
      event.kind === "entity.spawned" && event.tick === death.tick && event.contentId === "unit.bench.spawnling",
  )
  assert.equal(births.length, expectedCount, "the giant's death did not produce its declared split count")
})

test("focusRamp: damage against a held target escalates and is capped", async () => {
  const resolved = await resolveScenario("bench-beamturret-focus.map.json")
  const events = resolved.run.events
  const shots = events.filter(
    (event) => event.kind === "attack.launched" && event.attacker.includes(":beam#"),
  )
  assert.ok(shots.length >= 3, "not enough shots landed to prove a ramp exists at all")

  const damages = shots.map((event) => (event.kind === "attack.launched" ? event.damage : 0))
  for (let index = 1; index < damages.length; index += 1) {
    assert.ok(
      (damages[index] ?? 0) >= (damages[index - 1] ?? 0),
      `damage dropped from ${damages[index - 1]} to ${damages[index]} while locked onto the same target`,
    )
  }
  assert.ok(
    (damages[damages.length - 1] ?? 0) > (damages[0] ?? 0),
    "damage never actually increased over the engagement",
  )

  const turret = PROVING_GROUND_CONTENT.find((definition) => definition.id === "structure.bench.beamturret")
  const ramp = turret?.attack?.focusRamp
  assert.ok(ramp !== undefined)
  const capped = Math.round((turret!.attack!.damage * ramp!.maxPercent) / 100)
  assert.ok(
    (damages[damages.length - 1] ?? 0) <= capped,
    `final damage ${damages[damages.length - 1]} exceeded the declared cap of ${capped}`,
  )
})

test("a wall segment is armed but never advances, even under fire", async () => {
  const resolved = await resolveScenario("bench-wallsegment-blockade.map.json")
  const events = resolved.run.events
  const wallMoves = events.filter(
    (event) => event.kind === "entity.moved" && event.entity.includes(":wall#"),
  )
  assert.equal(wallMoves.length, 0, "a static wall segment moved")
  const wallAttacks = events.filter(
    (event) => event.kind === "attack.launched" && event.attacker.includes(":wall#"),
  )
  assert.ok(wallAttacks.length > 0, "the wall segment never fought back at all")
})

test("pure composition: the structure-only rushers needed no capability beyond targetLayers, air, and detonation", async () => {
  const resolved = await resolveScenario("bench-hog-saboteur-bomber.map.json")
  const events = resolved.run.events

  for (const short of ["hog", "saboteur", "bomber"]) {
    const attacksOrBlasts = events.filter(
      (event) =>
        (event.kind === "attack.launched" && event.attacker.includes(`:${short}#`)) ||
        (event.kind === "entity.detonated" && event.entity.includes(`:${short}#`)),
    )
    assert.ok(attacksOrBlasts.length > 0, `${short} never did anything in its own composition fixture`)
    for (const event of attacksOrBlasts) {
      if (event.kind !== "attack.launched") continue
      assert.ok(
        event.target.includes(":barracks#"),
        `${short} attacked ${event.target}, not the structure targetLayers should have restricted it to`,
      )
    }
  }
})
