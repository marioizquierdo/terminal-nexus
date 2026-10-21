// Measuring a change the same way every time (docs/system-design/measurement.md, the `remeasure` skill): a spec
// split into processes and merged back writes down what one process would have, in the same order; parts of two
// builds are never merged; the summary counts the duels over early; and what one unit did in a battle is read from
// its events, side by side.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { levelById } from "../src/cli/levels.ts"
import type { Measurement, MeasureSpec, SpecResult } from "../src/measure/index.ts"
import { jobsOf, LEVEL_PLANS, measureLevel, measureScenario, measureUnit, mergeMeasurements, runSpec, summaryLines, tallyUnit } from "../src/measure/index.ts"
import { REPO_ROOT, loadScenarioFile, resolveScenario } from "./helpers.ts"

const TINY: MeasureSpec = {
  name: "tiny",
  seeds: [1, 2],
  scenarios: "routes",
  duels: { map: "pocket", rounds: 2, pulseTicks: 240, commanders: ["vasse", "dob"], players: ["balanced", "rush"] },
  levels: [],
  plans: LEVEL_PLANS,
}

const written = (result: SpecResult, build = "abc1234"): Measurement => ({
  spec: TINY.name,
  build,
  date: "2026-10-21",
  routing: "test",
  msPerTick: 1,
  scenarios: result.scenarios,
  duels: result.duels,
  levels: result.levels,
})

test("a spec split into jobs and merged back is what one process plays, in the same order, whatever order the parts come in", { timeout: 120_000 }, async () => {
  const scenarios = [await loadScenarioFile("route-dead-end.map.json")]
  const parts = new Set(["scenarios", "duels"])
  const whole = runSpec(TINY, { scenarios, levels: [], parts })
  const jobs = jobsOf(TINY, parts)
  assert.deepEqual(
    jobs.map((job) => job.label),
    ["duels balanced seed 1", "duels balanced seed 2", "duels rush seed 1", "duels rush seed 2", "scenarios"],
  )
  const played = jobs.map((job) =>
    written(runSpec({ ...TINY, seeds: job.seeds, duels: { ...TINY.duels, players: job.players } }, { scenarios, levels: [], parts: new Set(job.parts) })),
  )
  const merged = mergeMeasurements([...played].reverse(), TINY)
  assert.deepEqual(merged.duels, whole.duels)
  assert.deepEqual(merged.scenarios, whole.scenarios)
  assert.equal(merged.jobs, jobs.length)
  assert.equal(merged.msPerTick, 1, "every part's tick took 1 ms, so the merged one did")
})

test("parts measured on two builds are never merged into one result", () => {
  const empty: SpecResult = { scenarios: [], duels: [], levels: [], ticks: 0 }
  assert.throws(() => mergeMeasurements([written(empty), written(empty, "def5678")], TINY), /build/u)
  assert.throws(() => mergeMeasurements([], TINY), /nothing to merge/u)
})

test("the summary says how many duels were over by the end of rounds 1, 2 and 3, as the Nexus's report counted them", () => {
  const file = join(REPO_ROOT, "docs/history/measurements/2026-10-21-nexus-fights-back.json")
  const measurement = JSON.parse(readFileSync(file, "utf8")) as Measurement
  assert.match(summaryLines(measurement).join("\n"), /over by the end of round 1: 1, round 2: 4, round 3: 44/u)
})

test("what one kind of unit did is read from the battle's events, for each side it stood on", async () => {
  const resolved = await resolveScenario("route-crowd.map.json")
  const states = [resolved.run.initialState, resolved.run.finalState]
  const troopers = tallyUnit(states, resolved.run.events, "unit.citizen.trooper")
  assert.equal(troopers.A?.stood, 8)
  assert.equal(troopers.B, null, "no trooper stood on the other side")
  const record = measureScenario(resolved.scenario, resolved.scenario.seed).battle
  assert.equal(troopers.A?.damage, record.sides.A.dealt, "every hit side A landed was a trooper's")
  assert.ok((troopers.A?.hits ?? 0) > 0 && (troopers.A?.firstHit ?? -1) >= (record.sides.A.firstContact ?? 0))
  // The bench Nexus does not shoot: it stood, and did nothing.
  const nexus = tallyUnit(states, resolved.run.events, "structure.bench.nexus")
  assert.deepEqual(nexus.B, { stood: 1, shots: 0, hits: 0, damage: 0, kills: 0, firstHit: null })
  assert.equal(nexus.A, null)
})

test("what a unit did in a campaign level is told round by round, every round the level played", { timeout: 120_000 }, () => {
  const level = levelById("vasse-test-2")
  const plan = LEVEL_PLANS[0]
  assert.ok(level !== undefined && plan !== undefined)
  const unit = measureUnit(level, plan, "structure.citizen.nexus")
  const played = measureLevel(level, plan)
  assert.deepEqual(unit.ended, played.ended)
  assert.equal(unit.rounds.length, played.rounds.length)
  assert.ok(unit.rounds.every((round) => round.sides.A?.stood === 1), "the player's Grid Nexus stands every round")
})
