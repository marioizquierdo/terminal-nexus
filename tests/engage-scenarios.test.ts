// The engage bench (scenarios/engage/, scenarios/trials/engage-bench.trial.json; docs/system-design/testing-ground.md):
// the same armies on ground that is open, a gap, a corridor and two lanes, each played to a result from both ends over
// several seeds. They are not proofs that a rule works; they are the bench movement is measured against, and what the
// trial expects is what was measured: which army is the wrong one for which ground, how many of its units ever strike,
// what a corridor costs. A change to how troops engage moves these, and says so in the trial file.

import { test } from "node:test"
import assert from "node:assert/strict"
import { loadTrialFile, trialPath } from "../src/cli/trial.ts"
import { playTrial, trialCells, unmet } from "../src/measure/index.ts"
import { loadMapFile } from "../src/scenario/index.ts"

/** Seeds enough to hold every expectation, few enough to keep a test short; `grid engage-bench` plays all twelve. */
const SEEDS = [1, 2, 3, 4, 5, 6]

const spec = await loadTrialFile(trialPath("engage-bench") as string)

for (const map of spec.maps) {
  test(`engage bench, ${map}: ${spec.expect?.filter((each) => each.map === map).map((each) => each.measure).join(", ")} as the trial expects`, async () => {
    const one = { ...spec, maps: [map], seeds: SEEDS, expect: spec.expect?.filter((each) => each.map === map) ?? [] }
    const battles = playTrial(one, new Map([[map, await loadMapFile(map)]]))
    assert.equal(battles.length, SEEDS.length * 2)
    assert.deepEqual(unmet(one, trialCells(battles)), [])
  })
}

test("the engage bench expects something of every map it plays", () => {
  for (const map of spec.maps) assert.ok(spec.expect?.some((each) => each.map === map), `${map} has no expectation`)
})
