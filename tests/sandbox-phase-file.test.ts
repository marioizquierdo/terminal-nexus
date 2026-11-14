// A sandbox file says which part of a round it is in (`start.phase`, docs/system-design/sandboxes.md): read by the
// loader, played by every door the same way, refused when it names a phase there is not.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildTimeline } from "../src/cli/timeline.ts"
import { openBattle, phaseOf } from "../src/skirmish/opening/index.ts"
import { readSave } from "../src/skirmish/save.ts"
import { REGROUP_TICKS } from "../src/match/index.ts"
import { loadSandbox, playSandbox } from "./helpers.ts"

test("a sandbox file in the Build Phase reads as one, plays the regroup, and shows the same states to the watcher", async () => {
  const opening = await loadSandbox("build-phase-between-rounds")
  assert.equal(phaseOf(opening), "build-phase")
  const played = await playSandbox("build-phase-between-rounds")
  assert.equal(played.report.pulseTicks, REGROUP_TICKS)
  assert.ok(!played.run.events.some((event) => event.kind === "attack.launched" || event.kind === "entity.died"))
  const loaded = openBattle(opening)
  const timeline = buildTimeline(opening, loaded.state, loaded.registry, opening.pulseTicks, opening.seed)
  assert.equal(timeline.states.length, REGROUP_TICKS + 1, "the watcher is not shown every tick of the walk, the opening first")
  assert.equal(timeline.stateHash, played.run.stateHash, "watch and run disagree")
})

test("a file that names a phase there is not is refused, naming the ones there are", async () => {
  const { readFile } = await import("node:fs/promises")
  const text = await readFile(new URL("../sandboxes/rules/build-phase-between-rounds.save.json", import.meta.url), "utf8")
  const bad = readSave(text.replace('"phase": "build-phase"', '"phase": "planning"'))
  assert.equal(bad.save, null)
  assert.match(bad.problems.join("\n"), /start\.phase: one of battle-round, build-phase/)
  assert.equal(readSave(text.replace('"phase": "build-phase"', '"phase": "battle-round"')).problems.length, 0, "an explicit Battle Round is refused")
})
