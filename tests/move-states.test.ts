// The three movement states read back from a resolved battle, and the Activity Logs entry that records each change
// (docs/system-design/movement.md, "Three states"; src/report/move-states.ts).

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { ACTIVITY_EVENTS, ACTIVITY_FILTERS, createActivityLog } from "../src/log/index.ts"
import { matchesFilter } from "../src/log/logger.ts"
import { contextFor, spawnEvents, stepTick } from "../src/pulse/index.ts"
import { VISION, visionOf } from "../src/pulse/target.ts"
import { DEFAULT_VISION, moveStateChanges, moveStateEntry, visionReach } from "../src/report/index.ts"
import type { MoveStateChange } from "../src/report/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import type { MatchState } from "../src/state/types.ts"
import { loadScenarioFile, resolveScenario } from "./helpers.ts"

async function changesOf(name: string): Promise<Readonly<{ changes: MoveStateChange[]; states: MatchState[]; events: DomainEvent[] }>> {
  const map = await loadScenarioFile(name)
  const loaded = loadScenario(map, { registry: FIXTURE_REGISTRY, seed: map.seed })
  const context = contextFor(loaded.state, loaded.registry, map.pulseTicks)
  const states = [loaded.state]
  const events: DomainEvent[] = spawnEvents(loaded.state, loaded.registry)
  let state = loaded.state
  while (state.outcome === null && state.tick < map.pulseTicks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { changes: moveStateChanges({ states, events, registry: loaded.registry }), states, events }
}

test("the vision the record reads by is the kernel's, for every unit in the content", () => {
  assert.equal(DEFAULT_VISION, VISION)
  for (const id of FIXTURE_REGISTRY.ids()) {
    const definition = FIXTURE_REGISTRY.get(id)
    assert.equal(visionReach(definition), visionOf(definition), id)
  }
})

test("two lines meeting on open ground march, then turn to battle; nobody retreats who has no reason to", async () => {
  const { changes } = await changesOf("engage-open-melee-vs-mix.map.json")
  assert.ok(changes.length > 0, "no unit changed state")
  assert.ok(changes.some((change) => change.from === "march" && change.to === "battle"), "nobody turned to battle")
  assert.ok(changes.every((change) => change.to !== "retreat" && change.from !== "retreat"), "a soldier retreated")
  // A state follows on from the one before it: each unit's changes chain.
  const last = new Map<number, string>()
  for (const change of changes) {
    assert.equal(change.from, last.get(change.ordinal) ?? "march", `${change.entity} at tick ${change.tick}`)
    assert.notEqual(change.from, change.to)
    last.set(change.ordinal, change.to)
  }
})

test("a worker running from a threat retreats, on the tick it is said to flee", async () => {
  const { changes, events } = await changesOf("worker-flight.map.json")
  const retreat = changes.find((change) => change.to === "retreat")
  assert.ok(retreat !== undefined, "the worker never retreated")
  assert.ok(events.some((event) => event.kind === "behavior.flee" && event.tick === retreat.tick && event.ordinal === retreat.ordinal))
})

test("the record is the same every run, and reading it moves no hash", async () => {
  const first = await resolveScenario("engage-gap2-melee-vs-mix.map.json")
  const again = await changesOf("engage-gap2-melee-vs-mix.map.json")
  const second = await changesOf("engage-gap2-melee-vs-mix.map.json")
  assert.deepEqual(again.changes, second.changes)
  const resolvedAgain = await resolveScenario("engage-gap2-melee-vs-mix.map.json")
  assert.equal(resolvedAgain.run.stateHash, first.run.stateHash)
  assert.equal(resolvedAgain.run.eventsHash, first.run.eventsHash)
})

test("each change is a unit.state entry the Movement filter shows, and the Interactions filter does not", async () => {
  const { changes, states } = await changesOf("engage-open-melee-vs-mix.map.json")
  const log = createActivityLog(() => 0)
  const ticksPerSecond = states[0]?.ticksPerSecond ?? 10
  log.log("pulse.start", { round: 2, buildings: 0 })
  for (const change of changes) log.log("unit.state", moveStateEntry(change, 2, ticksPerSecond))
  const entries = log.entries()
  assert.equal(entries.length, changes.length + 1)
  const movement = ACTIVITY_FILTERS.find((filter) => filter.name === "Movement")
  const interactions = ACTIVITY_FILTERS.find((filter) => filter.name === "Interactions")
  assert.ok(movement !== undefined && interactions !== undefined)
  assert.equal(entries.filter((entry) => matchesFilter(movement, entry)).length, changes.length + 1)
  assert.equal(entries.filter((entry) => matchesFilter(interactions, entry)).length, 1, "a state change crowded the Interactions filter")
  assert.equal(ACTIVITY_EVENTS["unit.state"].defaultLevel, "debug")
  const first = changes[0]
  assert.ok(first !== undefined)
  assert.deepEqual(moveStateEntry(first, 2, ticksPerSecond), {
    round: 2,
    second: Math.round((first.tick * 10) / ticksPerSecond) / 10,
    unit: first.entity,
    from: first.from,
    to: first.to,
    x: first.at.x,
    y: first.at.y,
  })
})
