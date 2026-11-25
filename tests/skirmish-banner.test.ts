// The battle banner in a Skirmish (docs/system-design/movement.md, "Banners — prototype"): the banner the player plants
// in the Build Phase is the side's target for the Battle Round. Defensive, its troops go there and hold it; aggressive,
// they go there and, once half the army has reached it, march on to the enemy's Nexus. Each rule is checked by reading
// where the units stand on the battlefield, not the report's words: the report line is the second count.
// A plan with no banner plays as it always did.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import type { BattleState, BuildActions, RoundReport } from "../src/battle/index.ts"
import { armyOf, beginBattle, loadoutOf, playRound, readBuildActions } from "../src/battle/index.ts"
import { buildActionsOf, newSkirmishLevel, playedOf, positionOf, rallyStartTile, saveOfRound } from "../src/cli/skirmish-play.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { followsTarget } from "../src/engine/pulse/target.ts"
import { hashState } from "../src/engine/state/serialize.ts"
import { readSave, saveText } from "../src/skirmish/save.ts"

/** A tile far off the march line on the Crossing: the top-left, on open ground, where no unit walks by default. */
const FLANK = { x: 25, y: 3 }
/** The 3 × 3 round it, and the ring of one a unit still counts as there in. */
const near = (tile: Readonly<{ x: number; y: number }>): boolean => Math.abs(tile.x - FLANK.x) <= 2 && Math.abs(tile.y - FLANK.y) <= 2

type Watched = Readonly<{ report: RoundReport; final: MatchState; released: number | null; bestShare: number; fighters: (state: MatchState) => MatchState["entities"] }>

/** Round 1 on the Crossing, Vasse against Vasse: side A builds two Barracks forward under `banner`, side B holds. */
function roundWith(banner: BuildActions["banner"]): Watched {
  const state: BattleState = beginBattle({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "vasse" } })
  const A: BuildActions = { power: 0, build: [{ building: "barracks", at: "forward" }, { building: "barracks", at: "forward" }], stance: "attack", ...(banner === undefined ? {} : { banner }) }
  const B: BuildActions = { power: 0, build: [], stance: "hold" }
  let registry: ContentRegistry | null = null
  const fighters = (battle: MatchState): MatchState["entities"] =>
    battle.entities.filter((entity) => entity.player === "A" && followsTarget((registry as ContentRegistry).get(entity.contentId)))
  let final: MatchState | null = null
  let released: number | null = null
  let bestShare = 0
  const played = playRound(state, { A, B }, (battle, _events, _registry, sides) => {
    registry = sides.A
    final = battle
    if (banner !== undefined && released === null && battle.targets?.A === undefined) released = battle.tick
    const own = fighters(battle)
    if (own.length > 0) bestShare = Math.max(bestShare, own.filter((entity) => near(entity.anchor)).length / own.length)
  })
  return { report: played.report, final: final as unknown as MatchState, released, bestShare, fighters }
}

test("a defensive banner: the troops go to it and hold it to the round's end", { timeout: 60_000 }, () => {
  const round = roundWith({ ...FLANK, stance: "defensive" })
  const own = round.fighters(round.final)
  assert.ok(own.length > 0, "side A fielded no fighting unit")
  const there = own.filter((entity) => near(entity.anchor)).length
  assert.ok(there * 2 >= own.length, `only ${there} of ${own.length} fighting units stand at the banner as the round ends`)
  assert.equal(round.released, null, "a defensive banner was released")
  // The second count: the round's report says where the banner was and how.
  assert.equal(round.report.sides.A.banner, "defensive at 25,3")
  assert.equal(round.report.sides.A.stance, "attack", "the plan's own stance is still recorded")
})

test("an aggressive banner: the troops reach it, then march on toward the enemy's Nexus", { timeout: 60_000 }, () => {
  const round = roundWith({ ...FLANK, stance: "aggressive" })
  assert.ok(round.bestShare >= 0.5, `at most ${Math.round(round.bestShare * 100)}% of the army ever stood at the banner`)
  assert.ok(round.released !== null, "the banner was never released")
  const own = round.fighters(round.final)
  const meanX = own.reduce((sum, entity) => sum + entity.anchor.x, 0) / own.length
  assert.ok(meanX > FLANK.x + 10, `after the banner the army stayed by it (mean column ${meanX.toFixed(1)})`)
  assert.equal(own.filter((entity) => near(entity.anchor)).length * 2 < own.length, true, "most of the army is still at the banner")
  assert.equal(round.report.sides.A.banner, "aggressive at 25,3")
})

test("no banner: the round plays exactly as before, and none sends a unit to the flank", { timeout: 60_000 }, () => {
  const without = roundWith(undefined)
  assert.equal(without.report.sides.A.banner, undefined)
  assert.equal(without.bestShare, 0, "a unit went to the flank with no banner")
  // A banner planted on the enemy's Nexus, aggressive, is the default the screen never hands over; the round itself
  // still plays it as a banner, so it is a different (and valid) run, not this one.
  assert.equal(hashState(roundWith(undefined).final), hashState(without.final), "the same plan played twice differs")
})

test("a banner the troops cannot stand on is refused and said; the stance decides", { timeout: 60_000 }, () => {
  const offMap = roundWith({ x: 500, y: 3, stance: "defensive" })
  assert.equal(offMap.report.sides.A.banner, undefined)
  assert.ok(offMap.report.sides.A.refused.some((line) => line.startsWith("banner at 500,3: off the battlefield")), offMap.report.sides.A.refused.join("; "))
  // The Crossing's ridge: rock down the middle column.
  const rock = roundWith({ x: 35, y: 0, stance: "defensive" })
  assert.ok(rock.report.sides.A.refused.some((line) => line.startsWith("banner at 35,0: rock")), rock.report.sides.A.refused.join("; "))
})

test("a build file plants a banner, and says what is wrong with one it cannot read", () => {
  assert.deepEqual(readBuildActions({ build: [], stance: "attack", banner: { x: 4, y: 5, stance: "defensive" } }).actions.banner, { x: 4, y: 5, stance: "defensive" })
  assert.deepEqual(readBuildActions({ build: [], banner: { x: 4, y: 5 } }).actions.banner, { x: 4, y: 5, stance: "aggressive" }, "a banner with no stance is aggressive, as the screen's default")
  for (const banner of [{ x: 4 }, { x: -1, y: 2 }, { x: 1.5, y: 2 }, "25,3", [25, 3]]) {
    const read = readBuildActions({ build: [], banner })
    assert.equal(read.actions.banner, undefined, JSON.stringify(banner))
    assert.ok(read.problems.some((problem) => problem.startsWith(`"banner" should be`)), JSON.stringify(banner))
  }
  const hold = readBuildActions({ build: [], banner: { x: 4, y: 5, stance: "hold" } })
  assert.equal(hold.actions.banner, undefined)
  assert.ok(hold.problems.some((problem) => problem.startsWith(`"banner.stance" should be "aggressive" or "defensive"`)), hold.problems.join("; "))
})

// --- The Skirmish screen ---------------------------------------------------------------------------------------------

/** The first round's Build Phase of a Skirmish, with the Battle banner Experiment as `experiment` and `banner` planted. */
function screenRound(experiment: "on" | "off", banner: BuildState["banner"]): Readonly<{ play: ReturnType<typeof newSkirmishLevel>["play"]; context: BuildContext; state: BuildState }> {
  const level = newSkirmishLevel(1, { newSeed: () => 4242 })
  const opened = withoutScene(level.firstRound())
  const context: BuildContext = { ...opened, experiments: { ...opened.experiments, battleBanner: experiment } }
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
  const state = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  return { play: level.play, context, state: { ...state, banner } }
}

test("the Skirmish screen hands its banner to the round, and the troops follow it", { timeout: 60_000 }, () => {
  const { play, context, state } = screenRound("on", { tile: FLANK, stance: "defensive" })
  const plan = buildActionsOf(context, state)
  assert.deepEqual(plan.banner, { ...FLANK, stance: "defensive" })
  assert.equal(plan.stance, "hold", "a defensive banner's stance is hold")
  const resolved = play.startPulse(context, state)
  assert.ok(resolved !== null)
  const played = playedOf(resolved)
  assert.ok(played !== undefined)
  assert.equal(played.report.sides.A.banner, "defensive at 25,3")
  // The round the screen played is the one the battle plays for the same plan: where its troops went is counted
  // tile by tile in the tests above.
  // And the banner stays planted for the next round.
  const next = play.nextRound(context, state, resolved)
  assert.ok(next !== null)
  assert.deepEqual(next.placedBanner, { tile: FLANK, stance: "defensive" }, "the banner did not carry to the next round")
})

test("the rally point starts in front of the base: the screen hands it unmoved, and none with the Experiment off", () => {
  // Rally point start at 20 (the default): a fifth of the way from your Nexus to the enemy's, on the Crossing 18,14.
  const defaulted = screenRound("on", null)
  assert.deepEqual(defaulted.context.bannerDefault?.tile, { x: 18, y: 14 })
  assert.deepEqual(buildActionsOf(defaulted.context, defaulted.state).banner, { x: 18, y: 14, stance: "defensive" })
  assert.equal(buildActionsOf(defaulted.context, defaulted.state).stance, "hold")
  const off = screenRound("off", { tile: FLANK, stance: "defensive" })
  assert.equal(buildActionsOf(off.context, off.state).banner, undefined)
  assert.equal(buildActionsOf(off.context, off.state).stance, "attack")
})

test("Rally point start: each share is that far along the way, on open ground; 100 is the enemy Nexus and no order", () => {
  const { context } = screenRound("on", null)
  const { battle } = positionOf(context)
  const content = { A: loadoutOf(armyOf(battle, "A"), battle.sides.A).registry, B: loadoutOf(armyOf(battle, "B"), battle.sides.B).registry }
  const xs = [10, 20, 30].map((share) => rallyStartTile(battle, content, share)?.x)
  assert.deepEqual(xs, [13, 18, 24], "the shares are not in order along the way")
  assert.equal(rallyStartTile(battle, content, 100), null)
})

test("a saved round keeps its rally point, and loading it plants it again", () => {
  const { context, state } = screenRound("on", { tile: FLANK, stance: "aggressive" })
  const save = saveOfRound(context, state)
  // The screen asks no stance: what the troops do there is the Rally point Experiment's, hold by default.
  assert.deepEqual(save.draft?.p1?.banner, { ...FLANK, stance: "defensive" })
  const read = readSave(saveText(save))
  assert.deepEqual(read.problems, [])
  assert.deepEqual(read.save?.draft?.p1?.banner, { ...FLANK, stance: "defensive" })
})

test("the Rally point Experiment decides what the troops do there: hold, or push on", () => {
  const { context, state } = screenRound("on", { tile: FLANK, stance: "defensive" })
  const held = buildActionsOf(context, { ...state, experiments: { ...state.experiments, rallyPoint: "hold" } })
  assert.deepEqual(held.banner, { ...FLANK, stance: "defensive" })
  assert.equal(held.stance, "hold")
  const pushed = buildActionsOf(context, { ...state, experiments: { ...state.experiments, rallyPoint: "push-on" } })
  assert.deepEqual(pushed.banner, { ...FLANK, stance: "aggressive" })
  assert.equal(pushed.stance, "attack")
})
