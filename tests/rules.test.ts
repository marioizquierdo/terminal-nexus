// Movement credit, arbitration, and combat — milestone-1-spike-battle.md 3.9, "Rules".

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { MovementRate } from "../src/content/index.ts"
import { accrueCredit, canStep, contextFor, stepCost, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { loadScenarioFile, resolveScenario } from "./helpers.ts"

/** The cadence table of engine.md 4.1, reproduced exactly at every rate it lists. */
const CADENCE: ReadonlyArray<readonly [MovementRate, number]> = [
  [{ numerator: 1, denominator: 2 }, 24],
  [{ numerator: 2, denominator: 3 }, 18],
  [{ numerator: 3, denominator: 4 }, 16],
  [{ numerator: 1, denominator: 1 }, 12],
  [{ numerator: 6, denominator: 5 }, 10],
  [{ numerator: 4, denominator: 3 }, 9],
  [{ numerator: 3, denominator: 2 }, 8],
  [{ numerator: 2, denominator: 1 }, 6],
]

test("movement credit reproduces the cadence table at every rate", () => {
  for (const [rate, expected] of CADENCE) {
    let credit = 0
    let ticks = 0
    for (;;) {
      ticks += 1
      credit = accrueCredit(credit, rate)
      if (canStep(credit, rate)) break
      assert.ok(ticks < 100, `rate ${rate.numerator}/${rate.denominator} never stepped`)
    }
    assert.equal(
      ticks,
      expected,
      `rate ${rate.numerator}/${rate.denominator} stepped every ${ticks} ticks, not ${expected}`,
    )

    // And it keeps that cadence: the second step costs the same as the first.
    credit -= stepCost(rate)
    let more = 0
    for (;;) {
      more += 1
      credit = accrueCredit(credit, rate)
      if (canStep(credit, rate)) break
    }
    assert.equal(more, expected, "the cadence drifted after the first step")
  }
})

test("credit never exceeds one step's cost", () => {
  const rate: MovementRate = { numerator: 3, denominator: 4 }
  let credit = 0
  for (let tick = 0; tick < 500; tick += 1) {
    credit = accrueCredit(credit, rate)
    assert.ok(credit <= stepCost(rate), `credit ${credit} banked more than one step`)
  }
  assert.equal(credit, stepCost(rate), "a blocked actor should hold exactly one step of credit")
})

test("a blocked actor keeps its credit and steps the tick the tile frees", async () => {
  // The hauler in the two-tile gap is blocked for its whole run: every intent it declares is at
  // full credit, which is only true if a refused step never spends any.
  const resolved = await resolveScenario("hauler-two-tile-gap.ts")
  const intents = resolved.run.events.filter((event) => event.kind === "move.intended")
  assert.ok(intents.length > 4)
  for (const intent of intents) {
    if (intent.kind !== "move.intended") continue
    assert.equal(intent.credit, intent.cost, "a mover declared an intent without full credit")
  }

  const blocked = resolved.run.events.filter((event) => event.kind === "move.blocked")
  for (const event of blocked) {
    if (event.kind !== "move.blocked") continue
    assert.equal(event.credit, event.cost, "a blocked actor lost its credit")
  }

  // And the point of keeping it: an actor jostled out of a claim steps the moment the tile frees,
  // rather than restarting its timer. In the jammed corridor that shows up as a block on one tick
  // and a move by the same entity on the next.
  const jam = await resolveScenario("jammed-corridor.ts")
  const blocks = new Set<string>()
  const moves = new Set<string>()
  for (const event of jam.run.events) {
    if (event.kind === "move.blocked") blocks.add(`${event.ordinal}:${event.tick}`)
    if (event.kind === "entity.moved") moves.add(`${event.ordinal}:${event.tick}`)
  }
  const steppedImmediately = [...blocks].some((key) => {
    const [ordinal, tick] = key.split(":")
    return moves.has(`${ordinal}:${Number(tick) + 1}`)
  })
  assert.ok(
    steppedImmediately,
    "no blocked actor ever stepped on the next tick, so credit is being restarted",
  )
})

test("two equal-speed actors that kill each other on the same tick both die", async () => {
  const resolved = await resolveScenario("mutual-kill.ts")
  const deaths = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.equal(deaths.length, 2, "a mutual kill left a survivor")
  const [first, second] = deaths
  assert.ok(first !== undefined && second !== undefined)
  assert.equal(first.tick, second.tick, "the two deaths landed on different ticks")
  assert.equal(resolved.run.finalState.entities.length, 0)
  assert.equal(resolved.run.finalState.outcome?.winner, null)
  assert.equal(resolved.run.finalState.outcome?.reason, "annihilation")
})

test("speed tier is initiative and lower acts first", async () => {
  // The marksman is tier 1 and the trooper tier 2, so on a tick where both attack, the marksman's
  // attack is emitted — and resolved — first.
  const resolved = await resolveScenario("citizen-mirror-skirmish.ts")
  const byTick = new Map<number, string[]>()
  for (const event of resolved.run.events) {
    if (event.kind !== "attack.launched") continue
    const bucket = byTick.get(event.tick) ?? []
    bucket.push(event.attacker)
    byTick.set(event.tick, bucket)
  }
  let checked = 0
  for (const attackers of byTick.values()) {
    const tiers = attackers.map(
      (id) => FIXTURE_REGISTRY.get(id.includes("marksman") ? "unit.citizen.marksman" : "unit.citizen.trooper").speedTier,
    )
    for (let index = 1; index < tiers.length; index += 1) {
      const previous = tiers[index - 1]
      const current = tiers[index]
      if (previous === undefined || current === undefined) continue
      assert.ok(previous <= current, "a higher speed tier attacked before a lower one")
      checked += 1
    }
  }
  assert.ok(checked > 0, "no tick had two attackers, so the ordering was never exercised")
})

test("the flight window is presentation metadata that no rule reads", async () => {
  // Changing only the projectile speed changes the flight window on the event and nothing else:
  // not the damage, not the state, not the tick anything resolved on.
  const scenario = await loadScenarioFile("ranged-kill.ts")
  const definitions = FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id))
  const slowed = definitions.map((definition) =>
    definition.attack?.kind === "ranged"
      ? { ...definition, attack: { ...definition.attack, projectileTilesPerTick: 1 } }
      : definition,
  )
  const { createRegistry } = await import("../src/content/index.ts")
  const { resolvePulse } = await import("../src/pulse/index.ts")

  const baselineLoaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const baseline = resolvePulse({
    initialState: baselineLoaded.state,
    registry: baselineLoaded.registry,
    pulseTicks: scenario.pulseTicks,
    seed: scenario.seed,
  })

  const slowRegistry = createRegistry(slowed)
  const slowLoaded = loadScenario(scenario, { registry: slowRegistry, seed: scenario.seed })
  const slow = resolvePulse({
    initialState: slowLoaded.state,
    registry: slowRegistry,
    pulseTicks: scenario.pulseTicks,
    seed: scenario.seed,
  })

  assert.equal(slow.stateHash, baseline.stateHash, "the flight window changed the outcome")
  assert.notEqual(slow.eventsHash, baseline.eventsHash, "the flight window is not on the event")

  const strip = (run: typeof baseline): string =>
    JSON.stringify(
      run.events.map((event) =>
        event.kind === "attack.launched" ? { ...event, flightWindowTicks: 0 } : event,
      ),
    )
  assert.equal(strip(slow), strip(baseline), "something other than the flight window changed")
})

test("arbitration terminates under a bounded pass count with a decreasing progress measure", async () => {
  const scenario = await loadScenarioFile("jammed-corridor.ts")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const context = contextFor(loaded.state, loaded.registry, scenario.pulseTicks)

  let state = loaded.state
  let contests = 0
  while (state.outcome === null && state.tick < scenario.pulseTicks) {
    const result = stepTick(state, context)
    for (const event of result.events) {
      if (event.kind === "move.contested") contests += 1
      assert.notEqual(
        event.kind,
        "arbitration.bounded",
        `arbitration hit its pass bound at tick ${event.tick}`,
      )
    }
    state = result.state
  }
  assert.ok(contests > 5, `the jammed corridor produced only ${contests} contested claims`)
})

test("contested claims resolve by speed tier before the seeded stream is consulted", async () => {
  const resolved = await resolveScenario("jammed-corridor.ts")
  const contests = resolved.run.events.filter((event) => event.kind === "move.contested")
  assert.ok(contests.length > 0)
  for (const event of contests) {
    if (event.kind !== "move.contested") continue
    assert.ok(["speed-tier", "random"].includes(event.resolvedBy))
    assert.ok(event.losers.length > 0, "a contest was reported with no losers")
    assert.ok(!event.losers.includes(event.winner), "the winner was also reported as a loser")
  }
})
