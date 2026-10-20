// Formations (src/measure/formations.ts): the owner's test of units walking out over the roofs — four Barracks built
// three ways, their troopers coming off the roofs and marching on the enemy. Where a player builds decides how tight
// the army stands when it meets the enemy; and the "Way off the roof" Experiment changes it. The whole simulation,
// over many seeds, is `node bin/measure.ts formations` and the report in docs/history/reports/.

import { test } from "node:test"
import assert from "node:assert/strict"
import { formationRegistry, formationScenario, SHAPES } from "../src/measure/index.ts"
import type { Shape } from "../src/measure/index.ts"
import { measureScenario } from "../src/measure/index.ts"

/** How tight `shape` stands at first contact against its mirror, on one seed, leaving the roofs by `exit`. */
function spread(shape: Shape, exit: "route" | "ground"): number {
  const { battle } = measureScenario(formationScenario(shape, shape), 1, formationRegistry(exit))
  const west = battle.sides.A.spreadAtContact
  assert.ok(west !== null, `${shape} never met the enemy`)
  return west
}

test("where the Barracks stand decides how tight the army meets the enemy: a block tightest, a line next, set apart loosest", () => {
  const [block, apart, line] = SHAPES.map((shape) => spread(shape, "route"))
  assert.deepEqual(SHAPES, ["block", "apart", "line"])
  assert.ok((block as number) < (line as number) && (line as number) < (apart as number), `block ${block}, line ${line}, apart ${apart}`)
  // Set apart is more than twice as loose as a block.
  assert.ok((apart as number) > 2 * (block as number))
})

test("walking the roofs keeps a block's wave together; stepping down the nearest way spills it off every side", () => {
  assert.ok(spread("block", "ground") > 2 * spread("block", "route"), "the way off the roof did not change how a block's army stands")
})

test("a formation battle is the same battle every time, and ends with a Nexus falling", () => {
  const play = () => measureScenario(formationScenario("block", "line"), 1, formationRegistry("route")).battle
  const once = play()
  assert.deepEqual(play(), once)
  assert.equal(once.reason, "nexus-destroyed")
})
