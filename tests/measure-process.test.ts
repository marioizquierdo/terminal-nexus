// Measuring a change the same way every time (docs/system-design/measurement.md, the `remeasure` skill): a spec
// split into processes and merged back writes down what one process would have, in the same order; parts of two
// builds are never merged; the summary counts the duels over early; and a record written before Story stopped
// still reads.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Measurement, MeasureSpec, SpecResult } from "../src/measure/index.ts"
import { jobsOf, measureSave, mergeMeasurements, readMeasurement, runSpec, summaryLines } from "../src/measure/index.ts"
import { REPO_ROOT, loadSandbox, playSandbox } from "./helpers.ts"

const TINY: MeasureSpec = {
  name: "tiny",
  seeds: [1, 2],
  saves: "routes",
  duels: { map: "pocket", rounds: 2, pulseTicks: 240, commanders: ["vasse", "dob"], players: ["balanced", "rush"] },
}

const written = (result: SpecResult, build = "abc1234"): Measurement => ({
  spec: TINY.name,
  build,
  date: "2026-10-21",
  routing: "test",
  msPerTick: 1,
  saves: result.saves,
  duels: result.duels,
})

test("a spec split into jobs and merged back is what one process plays, in the same order, whatever order the parts come in", { timeout: 120_000 }, async () => {
  const saves = [await loadSandbox("route-dead-end.save.json")]
  const parts = new Set(["saves", "duels"])
  const whole = runSpec(TINY, { saves, parts })
  const jobs = jobsOf(TINY, parts)
  assert.deepEqual(
    jobs.map((job) => job.label),
    [
      ...["duels balanced vasse seed 1", "duels balanced vasse seed 2", "duels balanced dob seed 1", "duels balanced dob seed 2"],
      ...["duels rush vasse seed 1", "duels rush vasse seed 2", "duels rush dob seed 1", "duels rush dob seed 2"],
      "saves",
    ],
  )
  const played = jobs.map((job) => {
    const share: MeasureSpec = { ...TINY, seeds: job.seeds, duels: { ...TINY.duels, players: job.players, west: job.west } }
    return written(runSpec(share, { saves, parts: new Set(job.parts) }))
  })
  const merged = mergeMeasurements([...played].reverse(), TINY)
  assert.deepEqual(merged.duels, whole.duels)
  assert.deepEqual(merged.saves, whole.saves)
  assert.equal(merged.jobs, jobs.length, "parts merged by hand are taken to have played side by side")
  assert.equal(merged.msPerTick, 1, "every part's tick took 1 ms, so the merged one did")
})

test("parts measured on two builds are never merged into one result", () => {
  const empty: SpecResult = { saves: [], duels: [], ticks: 0 }
  assert.throws(() => mergeMeasurements([written(empty), written(empty, "def5678")], TINY), /build/u)
  assert.throws(() => mergeMeasurements([], TINY), /nothing to merge/u)
})

test("the summary says how many duels were over by the end of rounds 1, 2 and 3, as the Nexus's report counted them", () => {
  const file = join(REPO_ROOT, "docs/history/measurements/2026-10-21-nexus-fights-back.json")
  const measurement = readMeasurement(readFileSync(file, "utf8"))
  assert.match(summaryLines(measurement).join("\n"), /over by the end of round 1: 1, round 2: 4, round 3: 44/u)
})

