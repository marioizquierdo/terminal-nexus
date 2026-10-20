// The power curve on the Grid (src/cli/curve-measure.ts; docs/game-design/commander-armies.md, the expected power
// curve and the tech tree): the six-round curve level is played by scripted plans, the same every run; climbing the
// tree to its second tier fields a stronger last army than staying on the first; and how much of the last round's
// army the first three rounds bought is measured and held, so a change to it is a change on purpose.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { CurvePlan } from "../src/cli/curve-measure.ts"
import { measureCurve } from "../src/cli/curve-measure.ts"
import { levelById, openRound } from "../src/cli/levels.ts"
import { hint } from "../src/build/help.ts"
import { withoutScene } from "../src/build/state.ts"
import { buildSide, keys, screenText } from "./build-helpers.ts"

const LEVEL = levelById("vasse-test-3")
const NEAR = { x: 24, y: 8 }
const BARRACKS = "structure.citizen.barracks"
const GARRISON = "structure.citizen.garrison"
const DEPOT = "structure.citizen.depot"
// A Barracks and Supply Depots in round 1; then Garrisons, or more Barracks, with a depot between each.
const TREE: CurvePlan = { name: "climbs the tree", buys: [[BARRACKS, DEPOT], [GARRISON, DEPOT]], near: NEAR }
const FIRST_TIER: CurvePlan = { name: "Barracks only", buys: [[BARRACKS, DEPOT]], near: NEAR }

test("the curve level is six rounds, and a player who builds nothing reaches every one of them", () => {
  assert.ok(LEVEL !== undefined)
  assert.equal(LEVEL.rounds, 6)
  for (let round = 1; round <= LEVEL.rounds; round += 1) assert.equal(openRound(LEVEL, round).round?.number, round)
})

test("the Garrison is locked until a Barracks stands, and each round adds the curve's credits", () => {
  assert.ok(LEVEL !== undefined)
  const first = LEVEL.firstRound()
  const garrison = first.catalog.find((row) => row.contentId === "structure.citizen.garrison")
  assert.deepEqual(garrison?.needs, ["structure.citizen.barracks"])
  assert.equal(first.standing.some((structure) => structure.contentId === "structure.citizen.barracks"), false)
  assert.equal(first.allotment, 100)
})

test("climbing the tree fields a stronger last army than the first tier alone; the opening's share is measured", { timeout: 120_000 }, () => {
  assert.ok(LEVEL !== undefined)
  const tree = measureCurve(LEVEL, TREE)
  assert.deepEqual(measureCurve(LEVEL, TREE), tree, "the same plan measured twice differs")
  const first = measureCurve(LEVEL, FIRST_TIER)
  assert.deepEqual(tree.ended, { round: 6, verdict: "won" })
  assert.deepEqual(first.ended, { round: 6, verdict: "won" })
  // The Garrison is bought from round 2, once the round-1 Barracks stands, and never before.
  assert.equal(tree.bought[0]?.includes(GARRISON), false)
  assert.equal(tree.bought[1]?.includes(GARRISON), true)
  const last = (measure: typeof tree): number => measure.armies[measure.armies.length - 1]?.total ?? 0
  // Pinned: 1.17 times the first tier's since the raids head for the Nexus (more than 1.2
  // when they went for whatever was nearest). Measured again, with every level, at the end of the pathfinding milestone.
  assert.ok(last(tree) > last(first) * 1.15, `the tree's last army ${last(tree).toFixed(0)} is not well above the first tier's ${last(first).toFixed(0)}`)
  // The design expects the first three rounds to be at most about a fifth of the last army. Without supply it was
  // close to half for both plans (0.47 and 0.45). With the supply cap the army is held to what its depots give, and a
  // new unit takes a place an old one left: 0.54 for the tree (its round-2 and round-3 Garrisons count as the
  // opening) and 0.40 for Barracks alone. Still far from a fifth, because on this level the early units mostly live;
  // this pins the numbers, so a change is seen.
  assert.ok(tree.openingShare > 0.45 && tree.openingShare < 0.62, `the tree's opening share is ${tree.openingShare.toFixed(2)}`)
  assert.ok(first.openingShare > 0.33 && first.openingShare < 0.47, `the first tier's opening share is ${first.openingShare.toFixed(2)}`)
})

test("a locked building is in the build menu, refused by its digit with what it needs, and the bottom line says so on its row", () => {
  assert.ok(LEVEL !== undefined)
  const context = withoutScene(LEVEL.firstRound())
  const side = buildSide({ context })
  const garrison = context.catalog.findIndex((row) => row.contentId === "structure.citizen.garrison")
  assert.ok(garrison >= 0)
  const digit = String(garrison + 1)
  keys(side, digit)
  assert.equal(side.build.state.armed, null, "a locked building was armed")
  assert.equal(side.build.state.status.text, "Garrison is locked: it needs a Barracks standing.")
  assert.match(screenText(side), /Garrison/u)
  // With the refusal said, the row's own hint: what it is and what it needs.
  assert.equal(hint(context, side.build.state).text, "Garrison - Trains pikemen. Needs a Barracks standing: it unlocks the round after.")
})
