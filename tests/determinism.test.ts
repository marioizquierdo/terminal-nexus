// The point of the gate — milestone-1-spike-battle.md 3.9, "Determinism".

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { hashEvents, parseEvents, serializeEvents } from "../src/events/serialize.ts"
import { DOMAIN_EVENT_KINDS } from "../src/events/types.ts"
import { contextFor, resolvePulse, spawnEvents, stepTick } from "../src/pulse/index.ts"
import { buildLog } from "../src/report/index.ts"
import { cosmeticRng } from "../src/rng/pcg32.ts"
import { loadScenario } from "../src/scenario/index.ts"
import { hashState, parseState, serializeState } from "../src/state/serialize.ts"
import {
  loadScenarioFile,
  reportInputOf,
  resolveScenario,
  scenarioFiles,
} from "./helpers.ts"

const RUNS = 20

test("twenty runs of every scenario produce identical hashes and identical INFO logs", { timeout: 120_000 }, async () => {
  for (const name of scenarioFiles()) {
    const first = await resolveScenario(name)
    const firstLog = buildLog(reportInputOf(first), "INFO").join("\n")
    for (let run = 1; run < RUNS; run += 1) {
      const again = await resolveScenario(name)
      assert.equal(again.run.stateHash, first.run.stateHash, `${name}: state hash drifted`)
      assert.equal(again.run.eventsHash, first.run.eventsHash, `${name}: event hash drifted`)
      assert.equal(
        buildLog(reportInputOf(again), "INFO").join("\n"),
        firstLog,
        `${name}: INFO log drifted`,
      )
    }
  }
})

test("resolving in one call equals resolving tick by tick", async () => {
  for (const name of scenarioFiles()) {
    const scenario = await loadScenarioFile(name)
    const oneCall = await resolveScenario(name)

    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    const context = contextFor(loaded.state, loaded.registry, scenario.pulseTicks)
    const events = spawnEvents(loaded.state, loaded.registry)
    let state = loaded.state
    while (state.outcome === null && state.tick < scenario.pulseTicks) {
      const result = stepTick(state, context)
      state = result.state
      events.push(...result.events)
    }

    assert.equal(hashState(state), oneCall.run.stateHash, `${name}: state differs tick by tick`)
    assert.equal(hashEvents(events), oneCall.run.eventsHash, `${name}: events differ tick by tick`)
  }
})

test("the kernel calls no clock and no Math.random", async () => {
  const scenario = await loadScenarioFile("citizen-mirror-skirmish.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })

  const realRandom = Math.random
  const realNow = Date.now
  const realHrtime = performance.now.bind(performance)
  const forbidden = (what: string) => (): never => {
    throw new Error(`the kernel called ${what}`)
  }
  Math.random = forbidden("Math.random") as unknown as typeof Math.random
  Date.now = forbidden("Date.now") as unknown as typeof Date.now
  performance.now = forbidden("performance.now") as unknown as typeof performance.now
  try {
    const run = resolvePulse({
      initialState: loaded.state,
      registry: loaded.registry,
      pulseTicks: scenario.pulseTicks,
      seed: scenario.seed,
    })
    assert.ok(run.events.length > 0)
  } finally {
    Math.random = realRandom
    Date.now = realNow
    performance.now = realHrtime
  }
})

test("changing only the cosmetic seed changes nothing about state, events, or the log", async () => {
  const baseline = await resolveScenario("citizen-mirror-skirmish.map.json")
  const baselineLog = buildLog(reportInputOf(baseline), "DEBUG").join("\n")

  // The cosmetic stream is a separate object with its own seed. Drawing from it heavily must not
  // touch the gameplay stream, so a Pulse resolved alongside it is unchanged.
  const cosmetic = cosmeticRng(0xdecaf)
  for (let draw = 0; draw < 10_000; draw += 1) cosmetic.nextUint32()

  const again = await resolveScenario("citizen-mirror-skirmish.map.json")
  assert.equal(again.run.stateHash, baseline.run.stateHash)
  assert.equal(again.run.eventsHash, baseline.run.eventsHash)
  assert.equal(buildLog(reportInputOf(again), "DEBUG").join("\n"), baselineLog)
})

test("parse(serialize(state)) hashes identically", async () => {
  for (const name of scenarioFiles()) {
    const resolved = await resolveScenario(name)
    const text = serializeState(resolved.run.finalState)
    const parsed = parseState(text)
    assert.equal(hashState(parsed), resolved.run.stateHash, `${name}: round trip changed the hash`)
    assert.equal(serializeState(parsed), text, `${name}: round trip changed the bytes`)
  }
})

test("a different gameplay seed can change the fight, and the same one never does", async () => {
  // citizen-mirror-skirmish is a genuine mirror since the 2026-08-22 terrain fix (both sides now
  // approach from truly symmetric ground), and the only place gameplay RNG is ever consulted is a
  // tile contest between two same-speed-tier actors (`arbitration.ts` `contestWinner`) - which a
  // clean mirror simply never produces, so it stopped being a fixture that could show a seed
  // mattering. jammed-corridor is built to force exactly that contest (rules.test.ts asserts it
  // happens), which is what this test actually needs to exercise.
  const first = await resolveScenario("jammed-corridor.map.json", { seed: 1 })
  const same = await resolveScenario("jammed-corridor.map.json", { seed: 1 })
  const other = await resolveScenario("jammed-corridor.map.json", { seed: 2 })
  assert.equal(same.run.eventsHash, first.run.eventsHash)
  assert.notEqual(other.run.eventsHash, first.run.eventsHash)
})

test("the JSONL event stream round-trips, and every kind it emits is a declared kind", async () => {
  const seen = new Set<string>()
  for (const name of scenarioFiles()) {
    const resolved = await resolveScenario(name)
    const text = serializeEvents(resolved.run.events)
    const parsed = parseEvents(text)
    assert.equal(
      hashEvents(parsed),
      resolved.run.eventsHash,
      `${name}: the machine surface does not survive a round trip`,
    )
    assert.equal(serializeEvents(parsed), text, `${name}: the round trip changed the bytes`)
    for (const event of resolved.run.events) seen.add(event.kind)
  }

  for (const kind of seen) {
    assert.ok(
      (DOMAIN_EVENT_KINDS as readonly string[]).includes(kind),
      `the kernel emitted "${kind}", which the DomainEvent union does not declare`,
    )
  }
  // The fixtures between them should exercise most of the union; anything never emitted is either
  // an unexercised rule or a kind nothing produces.
  const never = DOMAIN_EVENT_KINDS.filter((kind) => !seen.has(kind))
  assert.deepEqual(
    never,
    ["arbitration.bounded"],
    `these kinds are declared but never emitted by any scenario: ${never.join(", ")}`,
  )
})
