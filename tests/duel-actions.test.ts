// A duel side's building actions (`SidePlan.actions`, `src/duel/round.ts`): a plan names a building of its own by its
// anchor and one of its card's actions — an upgrade bought, a mode switched to, an order given — taken by the Build
// Phase's own rules after its buildings are placed, from the credits they leave; the battle runs on what each building
// carries, and the regroup carries it into the next round. A run's battle hands the screen's actions to its duel the same
// way, and one scripted player (`balanced-upgrade`) spends what its plan leaves on its buildings' upgrades.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildState } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import { RUN_PLAY, playedOf, runLevel, sidePlanOf } from "../src/cli/run-play.ts"
import type { DuelSetup, DuelState, Player, SidePlan } from "../src/duel/index.ts"
import { SCRIPTED, briefOf, newDuel, placementsOf, playDuel, playRound, readPlan } from "../src/duel/index.ts"

const BARRACKS = "structure.citizen.barracks"
const setup = (extra: Partial<DuelSetup> = {}): DuelSetup => ({ map: "crossing", seed: 3, rounds: 3, pulseTicks: 240, commanders: { A: "vasse", B: "dob" }, ...extra })
const hold: SidePlan = { build: [], stance: "hold" }

/** A duel after its first round, side A having built one Barracks by its Nexus and a Supply Depot: the duel, and where
 *  the Barracks stands. */
function withBarracks(): Readonly<{ duel: DuelState; at: Readonly<{ x: number; y: number }> }> {
  // A Supply Depot beside it, so the army has room for whole waves.
  const plan: SidePlan = { build: [{ building: "barracks", at: "nexus" }, { building: "depot", at: "back" }], stance: "hold" }
  const at = placementsOf(newDuel(setup()), "A", plan)[0]?.anchor
  assert.ok(at !== undefined, "the Barracks found no spot")
  return { duel: playRound(newDuel(setup()), { A: plan, B: hold }).state, at }
}

test("a duel round with a production line: bought from what is left, the Barracks sends five a wave, and the regroup carries it", { timeout: 60_000 }, () => {
  const { duel, at } = withBarracks()
  const bought = playRound(duel, { A: { ...hold, actions: [{ ...at, action: "production-line" }] }, B: hold })
  const plain = playRound(duel, { A: hold, B: hold })
  assert.deepEqual(bought.report.sides.A.actions, [`production-line on barracks at ${at.x},${at.y}`])
  assert.equal(bought.report.sides.A.spent, 15)
  assert.equal(bought.state.sides.A.credits, plain.state.sides.A.credits - 15)
  assert.equal(bought.report.sides.A.trained["Trooper"], 5)
  assert.equal(plain.report.sides.A.trained["Trooper"], 4)
  assert.equal(plain.report.sides.A.actions, undefined)
  // The next round's Barracks carries it, offers it no more in the brief, and a plan asking again is refused.
  const standing = bought.state.carried?.entities.find((entity) => entity.anchor.x === at.x && entity.anchor.y === at.y)
  assert.equal(standing?.contentId, `${BARRACKS}+production-line`)
  const brief = briefOf(bought.state, "A").data
  assert.deepEqual(
    brief.actions.filter((action) => action.x === at.x && action.y === at.y).map((action) => [action.action, action.has === true]),
    [
      ["hold", false],
      ["production-line", true],
    ],
  )
  assert.match(briefOf(bought.state, "A").text, /production-line \(upgrade, Production line, 15 credits, has it\)/u)
  const again = playRound(bought.state, { A: { ...hold, actions: [{ ...at, action: "production-line" }] }, B: hold })
  assert.deepEqual(again.report.sides.A.refused, [`production-line at ${at.x},${at.y}: it has it already`])
  assert.equal(again.report.sides.A.trained["Trooper"], 5)
})

test("a plan's building actions are held to the rules: a building of its own, an action its card has, and the credits for it", { timeout: 60_000 }, () => {
  const { duel, at } = withBarracks()
  const poor: DuelState = { ...duel, sides: { ...duel.sides, A: { ...duel.sides.A, credits: 10 } } }
  const { report } = playRound(poor, {
    A: {
      ...hold,
      actions: [
        { x: 0, y: 0, action: "production-line" },
        { ...at, action: "heavy-rounds" },
        { ...at, action: "production-line" },
        { ...at, action: "hold" },
      ],
    },
    B: hold,
  })
  assert.deepEqual(report.sides.A.refused, [
    "production-line at 0,0: no building of yours stands there",
    `heavy-rounds at ${at.x},${at.y}: the Barracks has no such action (hold, production-line)`,
    `production-line at ${at.x},${at.y}: costs 15, 10 left`,
  ])
  // An order is taken too: Hold production, by its id, holds the Barracks's wave.
  assert.deepEqual(report.sides.A.actions, [`hold on barracks at ${at.x},${at.y}`])
  assert.equal(report.sides.A.trained["Trooper"], undefined)
})

test("a plan reads its actions leniently: each a building by x and y and an action by id, a broken one said and dropped", () => {
  const read = readPlan('{ "build": [], "stance": "attack", "actions": [ { "x": 9, "y": 5, "action": "production-line" }, { "x": "9", "action": 3 } ] }')
  assert.deepEqual(read.plan.actions, [{ x: 9, y: 5, action: "production-line" }])
  assert.deepEqual(read.problems, ['action 2 should be { "x", "y", "action" }: a building of yours by its anchor, and one of its actions by id'])
  assert.equal(readPlan('{ "build": [], "stance": "attack" }').plan.actions, undefined)
})

test("the balanced script with upgrades spends what its plan leaves on its Barracks's production line, and the duel plays it", { timeout: 120_000 }, () => {
  const player = SCRIPTED["balanced-upgrade"] as Player
  const duel = playDuel(setup({ rounds: 4 }), { A: player, B: SCRIPTED["rush"] as Player })
  const bought = duel.history.flatMap((report) => report.sides.A.actions ?? [])
  assert.ok(bought.some((action) => action.startsWith("production-line on barracks")), `it bought no production line: ${JSON.stringify(duel.history.map((report) => report.sides.A))}`)
  // The plain script buys none: the scripts that measured the curve before play as they did.
  const plain = playDuel(setup({ rounds: 4 }), { A: SCRIPTED["balanced"] as Player, B: SCRIPTED["rush"] as Player })
  assert.ok(plain.history.every((report) => report.sides.A.actions === undefined))
})

test("a run battle hands the screen's actions to its duel: a production line bought on the screen is bought in the battle", { timeout: 120_000 }, () => {
  const context = withoutScene(runLevel({ seed: 1, commander: "vasse" }).firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  const { duel } = (context.mode as { duel: DuelState })
  const spot = placementsOf(duel, "A", { build: [{ building: "barracks", at: "nexus" }], stance: "attack" })[0]
  assert.ok(spot !== undefined)
  const key = `${spot.anchor.x},${spot.anchor.y}`
  const state: BuildState = { ...opened, planned: [{ ordinal: 0, contentId: BARRACKS, anchor: spot.anchor }], nextOrdinal: 1, fitted: [{ anchor: key, action: "production-line" }] }
  const plan = sidePlanOf(context, state)
  assert.deepEqual(plan.actions, [{ x: spot.anchor.x, y: spot.anchor.y, action: "production-line" }])
  const resolved = RUN_PLAY.startPulse(context, state)
  assert.ok(resolved !== null)
  const played = playedOf(resolved)
  assert.deepEqual(played?.report.sides.A.actions, [`production-line on barracks at ${key}`])
  assert.equal(played?.report.sides.A.spent, 40 + 15)
  const barracks = played?.duel.carried?.entities.find((entity) => entity.anchor.x === spot.anchor.x && entity.anchor.y === spot.anchor.y)
  assert.equal(barracks?.contentId, `${BARRACKS}+production-line`)
  // The next round's Build Phase stands it as it is, its card's upgrade offered no more.
  const next = RUN_PLAY.nextRound(context, state, resolved)
  assert.ok(next?.standing.some((structure) => structure.contentId === `${BARRACKS}+production-line`))
})
