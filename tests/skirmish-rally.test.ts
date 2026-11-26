// The rally point in a battle (the owner, 2026-11-26, F324: the stance goes; the troops gather at the rally point and
// hold it): a plan's `rally` — a tile, `HOME_NEXUS` or `ENEMY_NEXUS` — is the side's target for the whole Battle Round,
// and with none the default in front of its base, the tile the Skirmish screen starts on. Each rule is checked by
// counting where the units stand on the battlefield as the round ends; the report's `rally` is the second count.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import { bannerSpot } from "../src/build/banner.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import type { BattleState, BuildActions, RoundReport } from "../src/battle/index.ts"
import { SCRIPTED, armyOf, beginBattle, briefOf, defaultRallyTile, loadoutOf, playRound, readBuildActions, readBuildFile } from "../src/battle/index.ts"
import { buildActionsOf, newSkirmishLevel, playedOf, positionOf, saveOfRound } from "../src/cli/skirmish-play.ts"
import type { MatchState, TargetArea } from "../src/engine/state/types.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { followsTarget } from "../src/engine/pulse/target.ts"
import { readSave, saveText, newSetup, saveOf } from "../src/skirmish/save.ts"
import { roundLines } from "../src/skirmish/lines.ts"

/** A tile far off the march line on the Crossing: the top-left, on open ground, where no unit walks by default. */
const FLANK = { x: 25, y: 3 }

type Watched = Readonly<{ report: RoundReport; start: MatchState; final: MatchState; fighters: (state: MatchState) => MatchState["entities"] }>

/** Round 1 on the Crossing, Vasse against Vasse: side A builds two Barracks forward and rallies at `rally` (none: the
 *  default), side B builds nothing and holds at its own Nexus. */
function roundWith(rally: BuildActions["rally"]): Watched {
  const state: BattleState = beginBattle({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "vasse" } })
  const A: BuildActions = { power: 0, build: [{ building: "barracks", at: "forward" }, { building: "barracks", at: "forward" }], ...(rally === undefined ? {} : { rally }) }
  const B: BuildActions = { power: 0, build: [], rally: "HOME_NEXUS" }
  let registry: ContentRegistry | null = null
  const fighters = (battle: MatchState): MatchState["entities"] =>
    battle.entities.filter((entity) => entity.player === "A" && followsTarget((registry as ContentRegistry).get(entity.contentId)))
  let start: MatchState | null = null
  let final: MatchState | null = null
  const played = playRound(state, { A, B }, (battle, _events, _registry, sides) => {
    registry = sides.A
    start ??= battle
    final = battle
  })
  return { report: played.report, start: start as unknown as MatchState, final: final as unknown as MatchState, fighters }
}

/** Whether a unit stands in `area` or within a tile of it. */
const at = (area: TargetArea, tile: Readonly<{ x: number; y: number }>): boolean =>
  tile.x >= area.x - 1 && tile.x <= area.x + area.width && tile.y >= area.y - 1 && tile.y <= area.y + area.height

/** How many of side A's fighting units stand at its rally point's area as the round ends, of how many. */
function gathered(round: Watched): Readonly<{ there: number; of: number; area: TargetArea }> {
  const area = round.start.targets?.A as TargetArea
  const own = round.fighters(round.final)
  return { there: own.filter((entity) => at(area, entity.anchor)).length, of: own.length, area }
}

test("a rally point on a tile: the troops go to its 3 x 3 and hold it to the round's end", { timeout: 60_000 }, () => {
  const round = roundWith(FLANK)
  const { there, of, area } = gathered(round)
  assert.deepEqual(area, { x: 24, y: 2, width: 3, height: 3 })
  assert.ok(of > 0 && there * 2 >= of, `only ${there} of ${of} fighting units stand at the rally point as the round ends`)
  assert.deepEqual(round.final.targets?.A, area, "the rally point was let go mid-round")
  assert.deepEqual(round.report.sides.A.rally, FLANK)
})

test("HOME_NEXUS: the troops gather round their own Nexus and hold it", { timeout: 60_000 }, () => {
  const round = roundWith("HOME_NEXUS")
  const { there, of, area } = gathered(round)
  // The Nexus's footprint and a ring of one: on the Crossing, side A's Nexus at 6,13.
  assert.deepEqual(area, { x: 5, y: 12, width: 5, height: 4 })
  assert.ok(of > 0 && there === of, `only ${there} of ${of} fighting units stand at their Nexus`)
  assert.equal(round.report.sides.A.rally, "HOME_NEXUS")
})

test("ENEMY_NEXUS: the troops march on the enemy's Nexus and stand at it", { timeout: 60_000 }, () => {
  const round = roundWith("ENEMY_NEXUS")
  const { there, of, area } = gathered(round)
  assert.deepEqual(area, { x: 62, y: 12, width: 5, height: 4 }, "not the enemy Nexus and a ring of one")
  assert.ok(of > 0 && there * 2 >= of, `only ${there} of ${of} fighting units reached the enemy Nexus`)
  assert.equal(round.report.sides.A.rally, "ENEMY_NEXUS")
  // Side B, holding at home, has the same area: its own Nexus and a ring.
  assert.deepEqual(round.start.targets?.B, area)
})

test("no rally point: the default in front of the base, the tile the Skirmish screen starts on", { timeout: 60_000 }, () => {
  const round = roundWith(undefined)
  const { there, of, area } = gathered(round)
  assert.deepEqual(round.report.sides.A.rally, { x: 24, y: 14 })
  assert.deepEqual(area, { x: 23, y: 13, width: 3, height: 3 })
  assert.ok(of > 0 && there * 2 >= of, `only ${there} of ${of} fighting units stand in front of the base`)
  const { context } = screenRound(null)
  assert.deepEqual(context.bannerDefault?.tile, round.report.sides.A.rally, "the screen's default rally point is not the battle's")
})

test("a rally point off the battlefield is refused and said, the troops at the default; one on rock goes to its nearest open ground", { timeout: 60_000 }, () => {
  const offMap = roundWith({ x: 500, y: 3 })
  assert.deepEqual(offMap.report.sides.A.rally, { x: 24, y: 14 })
  assert.ok(offMap.report.sides.A.refused.some((line) => line.startsWith("rally point at 500,3: off the battlefield")), offMap.report.sides.A.refused.join("; "))
  // The Crossing's ridge: rock down the middle column. Re-pinned for F338 (the owner, 2026-11-26: "even if we did [allow
  // the rally point on a rock], the units should still walk towards the intended location"): it was the default in
  // front of the base, it is now the nearest open ground, and the troops march there.
  const rock = roundWith({ x: 35, y: 0 })
  assert.deepEqual(rock.report.sides.A.rally, { x: 34, y: 0 })
  assert.ok(rock.report.sides.A.refused.some((line) => line.startsWith("rally point at 35,0: rock") && line.endsWith("the nearest open ground, 34,0")), rock.report.sides.A.refused.join("; "))
  assert.match(roundLines(rock.report).join("\n"), /rally point 34,0/u)
  // Its area is clipped to four open tiles by the rock and the battlefield's edge, so the troops gather round it: every
  // one within five tiles of it, none left at home.
  const area = rock.start.targets?.A as TargetArea
  const own = rock.fighters(rock.final)
  const near = (tile: Readonly<{ x: number; y: number }>): boolean => tile.x >= area.x - 5 && tile.x < area.x + area.width + 5 && tile.y >= area.y - 5 && tile.y < area.y + area.height + 5
  assert.ok(own.length > 0 && own.every((entity) => near(entity.anchor)), `not every fighting unit marched to the open ground beside the rock: ${own.map((entity) => `${entity.anchor.x},${entity.anchor.y}`).join(" ")}`)
})

test("a build file names its rally point, and says what is wrong with one it cannot read", () => {
  assert.deepEqual(readBuildActions({ build: [], rally: { x: 4, y: 5 } }).actions.rally, { x: 4, y: 5 })
  assert.equal(readBuildActions({ build: [], rally: "HOME_NEXUS" }).actions.rally, "HOME_NEXUS")
  assert.equal(readBuildActions({ build: [], rally: "ENEMY_NEXUS" }).actions.rally, "ENEMY_NEXUS")
  assert.deepEqual(readBuildActions({ build: [] }).problems, [])
  for (const rally of [{ x: 4 }, { x: -1, y: 2 }, { x: 1.5, y: 2 }, "25,3", "home", [25, 3]]) {
    const read = readBuildActions({ build: [], rally })
    assert.equal(read.actions.rally, undefined, JSON.stringify(rally))
    assert.ok(read.problems.some((problem) => problem.startsWith(`"rally" should be`)), JSON.stringify(rally))
  }
})

test("an old build file still plays: its stance and banner read as the rally point, each with a problem said", () => {
  const attack = readBuildActions({ build: [], stance: "attack" })
  assert.equal(attack.actions.rally, "ENEMY_NEXUS")
  assert.equal(attack.retired.length, 1)
  assert.deepEqual(attack.problems, attack.retired)
  assert.equal(readBuildActions({ build: [], stance: "hold" }).actions.rally, "HOME_NEXUS")
  const banner = readBuildActions({ build: [], stance: "attack", banner: { x: 4, y: 5, stance: "defensive" } })
  assert.deepEqual(banner.actions.rally, { x: 4, y: 5 }, "the banner's tile is the rally point")
  assert.equal(banner.retired.length, 2)
  // "rally" wins over the old fields.
  assert.equal(readBuildActions({ build: [], rally: "HOME_NEXUS", stance: "attack" }).actions.rally, "HOME_NEXUS")
  assert.equal("stance" in readBuildActions({ build: [], stance: "attack" }).actions, false)
  const file = readBuildFile(JSON.stringify([{ round: 1, build: [], stance: "hold" }, { round: "*", build: [], stance: "attack" }]))
  assert.deepEqual(file.entries.map((entry) => entry.actions.rally), ["HOME_NEXUS", "ENEMY_NEXUS"])
  assert.equal(file.problems.length, 2)
})

test("an old save still loads: its draft's stance and its reports' stances read as rally points, no clashes recorded", () => {
  const setup = newSetup({ map: "crossing", seed: 3 })
  const battle = playRound(beginBattle({ map: "crossing", seed: 3, rounds: 8, pulseTicks: 360, commanders: { A: "vasse", B: "dob" } }), { A: { build: [], rally: "ENEMY_NEXUS" }, B: { build: [], rally: "HOME_NEXUS" } }).state
  const fresh = JSON.parse(saveText(saveOf(setup, battle))) as Record<string, unknown>
  const state = fresh["state"] as { history: Record<string, unknown>[] }
  // Written as the game wrote saves before the rally point.
  for (const report of state.history) {
    delete report["clashes"]
    const sides = report["sides"] as Record<string, Record<string, unknown>>
    delete sides["A"]!["rally"]
    delete sides["B"]!["rally"]
    sides["A"]!["stance"] = "attack"
    sides["B"]!["stance"] = "hold"
  }
  const old = { ...fresh, draft: { p1: { build: [], stance: "hold" } } }
  const read = readSave(JSON.stringify(old))
  assert.deepEqual(read.problems, [])
  assert.equal(read.save?.draft?.p1?.rally, "HOME_NEXUS")
  const report = read.save?.state?.history[0]
  assert.equal(report?.sides.A.rally, "ENEMY_NEXUS")
  assert.equal(report?.sides.B.rally, "HOME_NEXUS")
  assert.deepEqual(report?.clashes, [])
  assert.equal("stance" in (report?.sides.A ?? {}), false)
})

test("buildings both plans put on the same ground are built by neither, recorded in the round's clashes", { timeout: 60_000 }, () => {
  // The Pocket: both build ranges reach 10,5.
  const state = beginBattle({ map: "pocket", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "vasse" } })
  const plan: BuildActions = { build: [{ building: "turret", x: 10, y: 5 }], rally: "HOME_NEXUS" }
  const { report } = playRound(state, { A: plan, B: plan })
  assert.equal(report.clashes.length, 2)
  assert.deepEqual(report.clashes.map((clash) => [clash.side, clash.anchor]), [["A", { x: 10, y: 5 }], ["B", { x: 10, y: 5 }]])
  assert.ok(report.clashes.every((clash) => clash.contentId.includes("turret")))
  // The second count: the refusal words in both reports, and nothing built.
  for (const side of ["A", "B"] as const) {
    assert.deepEqual(report.sides[side].built, [])
    assert.ok(report.sides[side].refused.some((line) => /at 10,5: the enemy built there at the same moment/u.test(line)), report.sides[side].refused.join("; "))
  }
  assert.deepEqual(playRound(state, { A: plan, B: { build: [], rally: "HOME_NEXUS" } }).report.clashes, [])
})

test("the scripts place a rally point: holding at their own Nexus, attacking at the enemy's", () => {
  const state = beginBattle({ map: "crossing", seed: 1, rounds: 8, pulseTicks: 360, commanders: { A: "vasse", B: "dob" } })
  const brief = briefOf(state, "A").data
  assert.equal(SCRIPTED.balanced!(brief).rally, "HOME_NEXUS", "balanced holds its first two rounds")
  assert.equal(SCRIPTED.balanced!({ ...brief, round: 3 }).rally, "ENEMY_NEXUS")
  assert.equal(SCRIPTED.rush!(brief).rally, "ENEMY_NEXUS")
  assert.equal(SCRIPTED.turtle!(brief).rally, "HOME_NEXUS")
  assert.equal(SCRIPTED.turtle!({ ...brief, round: 7 }).rally, "ENEMY_NEXUS")
  for (const [name, player] of Object.entries(SCRIPTED)) assert.ok(player(brief).rally !== undefined, `${name} names no rally point`)
})

// --- The Skirmish screen ---------------------------------------------------------------------------------------------

/** The first round's Build Phase of a Skirmish, with `banner` placed. */
function screenRound(banner: BuildState["banner"]): Readonly<{ play: ReturnType<typeof newSkirmishLevel>["play"]; context: BuildContext; state: BuildState }> {
  const level = newSkirmishLevel(1, { newSeed: () => 4242 })
  const context = withoutScene(level.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.terrain).viewport
  const state = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  return { play: level.play, context, state: { ...state, banner } }
}

test("the Skirmish screen hands its rally point to the round, and it stays placed for the next", { timeout: 60_000 }, () => {
  const { play, context, state } = screenRound({ tile: FLANK, stance: "defensive" })
  const plan = buildActionsOf(context, state)
  assert.deepEqual(plan.rally, FLANK)
  assert.equal("stance" in plan, false)
  const resolved = play.startPulse(context, state)
  assert.ok(resolved !== null)
  const played = playedOf(resolved)
  assert.ok(played !== undefined)
  assert.deepEqual(played.report.sides.A.rally, FLANK)
  const next = play.nextRound(context, state, resolved)
  assert.ok(next !== null)
  assert.deepEqual(next.placedBanner, { tile: FLANK, stance: "defensive" }, "the rally point did not carry to the next round")
})

test("the rally point unmoved is the battle's own default: the screen's plan names none", () => {
  const defaulted = screenRound(null)
  assert.deepEqual(defaulted.context.bannerDefault?.tile, { x: 24, y: 14 })
  assert.equal(buildActionsOf(defaulted.context, defaulted.state).rally, undefined)
  // Rally point start at 100: no default on screen, the enemy Nexus named.
  const far = { ...defaulted.context }
  delete (far as { bannerDefault?: unknown }).bannerDefault
  assert.equal(buildActionsOf(far, defaulted.state).rally, "ENEMY_NEXUS")
})

test("Rally point start: each share is that far along the way, on open ground; 100 is the enemy Nexus; side B's mirrors A's", () => {
  const { context } = screenRound(null)
  const { battle } = positionOf(context)
  const content = { A: loadoutOf(armyOf(battle, "A"), battle.sides.A).registry, B: loadoutOf(armyOf(battle, "B"), battle.sides.B).registry }
  const xs = [10, 20, 30].map((share) => defaultRallyTile(battle, content, "A", share)?.x)
  assert.deepEqual(xs, [13, 18, 24], "the shares are not in order along the way")
  assert.equal(defaultRallyTile(battle, content, "A", 100), null)
  const b = defaultRallyTile(battle, content, "B")
  assert.ok(b !== null && b.x > 36, `side B's default ${JSON.stringify(b)} is not in front of its own base`)
})

test("a saved round keeps its rally point, and loading it reads it back", () => {
  const { context, state } = screenRound({ tile: FLANK, stance: "defensive" })
  const save = saveOfRound(context, state)
  assert.deepEqual(save.draft?.p1?.rally, FLANK)
  const read = readSave(saveText(save))
  assert.deepEqual(read.problems, [])
  assert.deepEqual(read.save?.draft?.p1?.rally, FLANK)
})

// --- F338: the troops always march to the rally point --------------------------------------------------------------

// The owner, 2026-11-26: "if the UX shows that I can place the banner, then the units should march towards the new
// location". The Build Phase sees the battlefield as the last round left it; the enemy builds in secret and reveals with
// the player. A rally point on the enemy's Nexus whose ring the enemy builds shut that same round was refused by the
// round ("no ground to stand on there"), and the troops went to the default in front of their own base: they stayed
// home (found on the Crossing, seed 1, turtle against Dob, round 7: 24 spots the screen took, every one refused).

/** On Dob's Nexus on the Crossing (63,13, three wide and two tall): the Build Phase takes it on round 1. */
const ON_THEIR_NEXUS = { x: 64, y: 13 }

test("a rally point the enemy builds shut that round is still marched to: half the troops end at it", { timeout: 60_000 }, () => {
  const { context, state: opened } = screenRound(null)
  assert.equal(bannerSpot(context, opened, ON_THEIR_NEXUS).refusal, null, "the screen refuses the spot")
  // The enemy, given the credits, builds Stashes (3 x 1) round its Nexus the same round: its ring has no open tile.
  const begun: BattleState = beginBattle({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "dob" } })
  const battle: BattleState = { ...begun, sides: { ...begun.sides, B: { ...begun.sides.B, credits: 400 } } }
  const ring = [[62, 12], [65, 12], [62, 15], [65, 15], [60, 13], [60, 14], [66, 13], [66, 14]] as const
  const A: BuildActions = { power: 0, build: [{ building: "barracks", at: "forward" }, { building: "barracks", at: "forward" }], rally: ON_THEIR_NEXUS }
  const B: BuildActions = { power: 0, build: ring.map(([x, y]) => ({ building: "stash", x, y })), rally: "HOME_NEXUS" }
  let registry: ContentRegistry | null = null
  let start: MatchState | null = null
  let final: MatchState | null = null
  const { report } = playRound(battle, { A, B }, (each, _events, _registry, sides) => {
    registry = sides.A
    start ??= each
    final = each
  })
  assert.equal(report.sides.B.built.length, ring.length, `the enemy did not build its ring shut: ${report.sides.B.refused.join("; ")}`)
  assert.deepEqual(report.sides.A.rally, ON_THEIR_NEXUS, `the round refused the spot: ${report.sides.A.refused.join("; ")}`)
  const area = (start as unknown as MatchState).targets?.A as TargetArea
  assert.deepEqual(area, { x: 62, y: 12, width: 5, height: 4 }, "not the Nexus and a ring of one")
  const fighters = (final as unknown as MatchState).entities.filter((entity) => entity.player === "A" && followsTarget((registry as ContentRegistry).get(entity.contentId)))
  const there = fighters.filter((entity) => at(area, entity.anchor)).length
  assert.ok(fighters.length > 0 && there * 2 >= fighters.length, `only ${there} of ${fighters.length} fighting units reached the rally point`)
})
