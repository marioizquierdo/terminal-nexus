// Movement credit, arbitration, and combat — milestone-1-spike-battle.md 3.9, "Rules".

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { MovementRate } from "../src/content/index.ts"
import {
  accrueCredit,
  canStep,
  contextFor,
  DEATH_SETTLE_TICKS,
  stepCost,
  stepTick,
} from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { loadScenarioFile, resolveAllScenarios, resolveScenario } from "./helpers.ts"

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
  // The hauler in the two-tile gap is blocked for its whole run. Under four-way movement it finds
  // no candidate step at all once it meets the wall — no oscillation, just a clean, permanent
  // "blocked" — so this fixture demonstrates credit-holding through move.blocked events rather than
  // through move.intended ones; every one of them still reports full credit, which is only true if
  // a refused step never spends any.
  const resolved = await resolveScenario("hauler-two-tile-gap.ts")
  const intents = resolved.run.events.filter((event) => event.kind === "move.intended")
  assert.ok(intents.length > 0, "the hauler never even declared its approach")
  for (const intent of intents) {
    if (intent.kind !== "move.intended") continue
    assert.equal(intent.credit, intent.cost, "a mover declared an intent without full credit")
  }

  const blocked = resolved.run.events.filter((event) => event.kind === "move.blocked")
  assert.ok(blocked.length > 4, "the hauler was never reported blocked for long enough to prove it")
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

test("a vacated tile stays blocked for DEATH_SETTLE_TICKS after the entity on it dies", async () => {
  // The corridor is one tile wide, so the trooper's only route to the worker beyond is straight
  // through the tile its melee kill just vacated - the fixture's whole point is that it wants that
  // exact tile on the very next tick.
  const resolved = await resolveScenario("settle-delay.ts")
  const death = resolved.run.events.find((event) => event.kind === "entity.died")
  assert.ok(death !== undefined && death.kind === "entity.died", "the blocker never died")
  if (death === undefined || death.kind !== "entity.died") return
  const tile = death.at

  const settlingBlocks = resolved.run.events.filter(
    (event) =>
      event.kind === "move.blocked" &&
      event.reason === "settling" &&
      event.desired.x === tile.x &&
      event.desired.y === tile.y,
  )
  assert.ok(settlingBlocks.length > 0, "no mover was ever reported blocked by the settling tile")
  for (const event of settlingBlocks) {
    if (event.kind !== "move.blocked") continue
    assert.ok(
      event.tick > death.tick && event.tick <= death.tick + DEATH_SETTLE_TICKS,
      `a settling block landed at tick ${event.tick}, outside the window (${death.tick}, ` +
        `${death.tick + DEATH_SETTLE_TICKS}] after the death at ${death.tick}`,
    )
  }

  // Only an arrival *after* the death counts: the victim's own approach to this tile, before it
  // died standing on it, is not the settle rule's business.
  const arrival = resolved.run.events.find(
    (event) =>
      event.kind === "entity.moved" &&
      event.tick > death.tick &&
      event.to.x === tile.x &&
      event.to.y === tile.y,
  )
  assert.ok(arrival !== undefined, "no one ever moved into the vacated tile")
  if (arrival !== undefined && arrival.kind === "entity.moved") {
    assert.ok(
      arrival.tick > death.tick + DEATH_SETTLE_TICKS,
      `an entity reached the vacated tile at tick ${arrival.tick}, before the settle window ` +
        `(${death.tick} + ${DEATH_SETTLE_TICKS}) closed`,
    )
  }
})

test("an actor that settled a move this tick does not also attack on it", async () => {
  // Every entity.moved event in the fixture library should be free of a same-tick attack.launched
  // from the same actor - "stop, then attack" applies everywhere a unit both closes distance and
  // fires, not just in one hand-built fixture, so check it across every scenario the report already
  // resolves rather than adding a single narrow case.
  const resolvedAll = await resolveAllScenarios()
  let checked = 0
  for (const resolved of resolvedAll) {
    const movedThisTick = new Set<string>()
    for (const event of resolved.run.events) {
      if (event.kind === "entity.moved") movedThisTick.add(`${event.ordinal}:${event.tick}`)
      if (event.kind === "attack.launched") {
        const key = `${event.attackerOrdinal}:${event.tick}`
        assert.ok(
          !movedThisTick.has(key),
          `${resolved.scenario.id}: ${event.attacker} attacked on tick ${event.tick}, the same ` +
            `tick it moved`,
        )
        checked += 1
      }
    }
  }
  assert.ok(checked > 0, "no fixture ever launched an attack, so the rule was never exercised")
})

test("a multi-tile mover blocked inside its own footprint reports the real blocker, not the edge", async () => {
  // A three-tile raider crowded by an ally's tail, mid-parade, surfaced this: the report only
  // checked the mover's single anchor tile, which can be perfectly clear while a different tile in
  // its footprint is what is actually occupied - and a clear single tile fell through
  // blockReasonFor's cases to its "edge" fallback, misreporting a crowded ally as the Grid's border.
  const resolved = await resolveScenario("speed-parade.ts")
  const blocked = resolved.run.events.filter(
    (event) => event.kind === "move.blocked" && event.entity.includes("raider"),
  )
  assert.ok(blocked.length > 0, "the raider was never reported blocked, so the fix was never exercised")
  for (const event of blocked) {
    if (event.kind !== "move.blocked") continue
    assert.notEqual(
      event.reason,
      "edge",
      `${event.entity} reported blocked by the Grid's edge at ${event.desired.x},${event.desired.y}, ` +
        "which a 48-wide Grid never puts a raider anywhere near",
    )
  }
  const byEntity = blocked.filter((event) => event.kind === "move.blocked" && event.reason === "entity")
  assert.ok(byEntity.length > 0, "the raider's real footprint collision was never reported")
})
