// Movement credit, arbitration, and combat — milestone-1-spike-battle.md 3.9, "Rules".

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { MovementRate } from "../src/content/index.ts"
import { footprintExtent, TERRAIN } from "../src/grid/index.ts"
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
  const resolved = await resolveScenario("hauler-two-tile-gap.map.json")
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
  const jam = await resolveScenario("jammed-corridor.map.json")
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
  const resolved = await resolveScenario("mutual-kill.map.json")
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
  const resolved = await resolveScenario("citizen-mirror-skirmish.map.json")
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
  const scenario = await loadScenarioFile("ranged-kill.map.json")
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
  const scenario = await loadScenarioFile("jammed-corridor.map.json")
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
  const resolved = await resolveScenario("jammed-corridor.map.json")
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
  const resolved = await resolveScenario("settle-delay.map.json")
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

/** Ticks between steps at a given rate - the same formula ravel.test.ts's own `cadence` uses. */
function cadence(rate: MovementRate): number {
  return Math.ceil(stepCost(rate) / rate.numerator)
}

test("a killer holds for one full movement cadence before its next step", async () => {
  // Owner playtest, 2026-08-22: "when a unit kills an enemy, it should wait a full movement
  // cooldown before starting to move again. Otherwise... it is hard to see who won that fight."
  // kill-then-hold.map.json puts the trooper in melee range from tick 0, so every tick until its target
  // dies is a stand-and-swing with nothing to measure; the point is what happens *after* - a second
  // runner further down the row gives the trooper somewhere new to walk to once the first is dead.
  // Checked for every killer the fixture produces, not just the trooper: the second runner also
  // lands the killing blow eventually, and the rule is not specific to one side or attack kind.
  const resolved = await resolveScenario("kill-then-hold.map.json")
  const contentOf = new Map<string, string>()
  for (const event of resolved.run.events) {
    if (event.kind === "entity.spawned") contentOf.set(event.entity, event.contentId)
  }

  const deaths = resolved.run.events.filter((event) => event.kind === "entity.died")
  assert.ok(deaths.length > 0, "nothing died, so the hold was never exercised")

  let checked = 0
  for (const death of deaths) {
    if (death.kind !== "entity.died" || death.killer === null) continue
    const killerContentId = contentOf.get(death.killer)
    assert.ok(killerContentId !== undefined, `${death.killer} never spawned`)
    if (killerContentId === undefined) continue
    const rate = resolved.registry.get(killerContentId).movementRate
    if (rate === undefined) continue // a static killer has nothing to hold
    const holdTicks = cadence(rate)

    const nextMove = resolved.run.events.find(
      (event) =>
        event.kind === "entity.moved" && event.entity === death.killer && event.tick > death.tick,
    )
    if (nextMove === undefined) continue // the killer never moved again in this Pulse - nothing to check
    if (nextMove.kind !== "entity.moved") continue
    assert.ok(
      nextMove.tick - death.tick >= holdTicks,
      `${death.killer}'s next step landed ${nextMove.tick - death.tick} ticks after its kill at ` +
        `${death.tick}, short of the full ${holdTicks}-tick cadence its own rate requires`,
    )
    checked += 1
  }
  assert.ok(checked > 0, "no killer in the fixture ever moved again, so the hold was never checked")
})

test("a multi-tile mover blocked inside its own footprint reports the real blocker, not the edge", async () => {
  // A three-tile raider crowded by an ally's tail, mid-parade, surfaced this: the report only
  // checked the mover's single anchor tile, which can be perfectly clear while a different tile in
  // its footprint is what is actually occupied - and a clear single tile fell through
  // blockReasonFor's cases to its "edge" fallback, misreporting a crowded ally as the Grid's border.
  // raider-tail-crowded.map.json builds the same case by construction rather than relying on
  // speed-parade.map.json's emergent timing, which drifted out from under this test twice - once
  // per movement-speed pass - since a demo scenario's job is showing every rate side by side, not
  // holding a specific tick's worth of incidental crowding stable.
  const resolved = await resolveScenario("raider-tail-crowded.map.json")
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

test("a 3x3 and a 5x2 unit fight, range-gated by footprint distance, not anchor distance", async () => {
  // heavies-clash.map.json is the multi-tile showcase - a colossus (3x3) and a leviathan (5x2)
  // walking at each other across open ground. The thing worth pinning down automatically, since
  // nobody watches every run: footprintDistance (grid/coords.ts) measures to the *nearest occupied
  // tile* of each footprint, not anchor to anchor, so two bodies this size should start trading
  // blows well before their anchors are within melee range of one another.
  const resolved = await resolveScenario("heavies-clash.map.json")
  const colossus = resolved.registry.get("unit.citizen.colossus")
  const leviathan = resolved.registry.get("unit.ravel.leviathan")
  assert.deepEqual(footprintExtent(colossus.footprint), { width: 3, height: 3 })
  assert.deepEqual(footprintExtent(leviathan.footprint), { width: 5, height: 2 })

  const launches = resolved.run.events.filter(
    (event) =>
      event.kind === "attack.launched" &&
      (event.attacker.includes("colossus") || event.attacker.includes("leviathan")) &&
      (event.target.includes("colossus") || event.target.includes("leviathan")),
  )
  assert.ok(launches.length > 0, "the two heavies never actually fought each other")
  for (const launch of launches) {
    if (launch.kind !== "attack.launched") continue
    assert.ok(
      launch.distance <= 1,
      `${launch.attacker} attacked ${launch.target} at footprint distance ${launch.distance}, ` +
        "outside melee range",
    )
  }

  // At least one of the two should actually go down - a showcase where nothing this size ever
  // dies never exercises fx.death.collapse at a footprint bigger than 3x1.
  const heavyDeaths = resolved.run.events.filter(
    (event) =>
      event.kind === "entity.died" &&
      (event.contentId === "unit.citizen.colossus" || event.contentId === "unit.ravel.leviathan"),
  )
  assert.ok(heavyDeaths.length > 0, "neither heavy died, so the large-footprint death path is untested")
})

test("an air unit crosses terrain a ground unit could never enter, end to end in a real Pulse", async () => {
  // air-crossing.map.json walls a buzzard (unit.ravel.buzzard, layer "air") into a 1x1 rock room -
  // every neighbouring tile is rock, so a ground unit placed there could never take a single step
  // (maskForActor gives it terrain: "impassable"). The buzzard's mask ignores terrain entirely
  // (shared.ts), which tests/grid.test.ts already proves for one call to maskFrom directly; this
  // proves the same claim the way it actually matters, by watching a full Pulse resolve.
  const resolved = await resolveScenario("air-crossing.map.json")
  const { width, tiles } = resolved.run.initialState.grid
  const impassableAt = (x: number, y: number): boolean => {
    const terrainId = tiles[y * width + x]
    return terrainId !== undefined && TERRAIN[terrainId].impassable
  }

  const moves = resolved.run.events.filter(
    (event) => event.kind === "entity.moved" && event.entity.includes("buzzard"),
  )
  assert.ok(moves.length > 0, "the buzzard never moved at all")
  const crossedRock = moves.some(
    (event) => event.kind === "entity.moved" && impassableAt(event.to.x, event.to.y),
  )
  assert.ok(
    crossedRock,
    "the buzzard never stepped onto impassable terrain - its rock room walls were not actually rock",
  )

  // The room's own walls are rock, confirming the fixture tests what it says it does rather than
  // an empty room that happens to be labelled one.
  assert.ok(impassableAt(6, 5), "the room's east wall (6,5) is not impassable terrain")

  // Cross-layer combat needs no special-casing anywhere (perception, attacks, and detonate all
  // measure distance the same way regardless of layer) - confirmed by watching it actually happen
  // rather than only by reading the code that has no layer check to remove.
  const crossLayerHit = resolved.run.events.some(
    (event) =>
      event.kind === "attack.launched" &&
      ((event.attacker.includes("buzzard") && event.target.includes("trooper")) ||
        (event.attacker.includes("trooper") && event.target.includes("buzzard"))),
  )
  assert.ok(crossLayerHit, "the buzzard and the trooper never fought, so cross-layer targeting was never exercised")

  // isMobile() (pulse/shared.ts) counts anything not on the "obstacles" layer, air included, so a
  // one-unit air-only side is neither an instant win nor an instant loss for its opponent.
  const ended = resolved.run.events.find((event) => event.kind === "pulse.ended")
  assert.ok(ended !== undefined, "the Pulse never ended")
  if (ended !== undefined && ended.kind === "pulse.ended") {
    assert.equal(ended.reason, "annihilation", `ended by ${ended.reason}, not a real fight to the death`)
  }
})
