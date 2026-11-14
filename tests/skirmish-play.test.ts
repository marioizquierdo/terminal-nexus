// A Skirmish played on the Build Phase screen (src/cli/skirmish-play.ts): a save's setup and its battle, p1 planned on
// the screen and p2 by its script. Its rounds open as Build Phases on the battle map with the Commander's whole army, a
// plan's buildings are placed exactly where the player put them, the next round carries where the regroup left
// everyone, and a battle's end offers the same battle again or a new seed. A round saves as a save file with the plan
// so far as its draft, and loading it returns to exactly that Build Phase, which then plays as the uninterrupted one.
//
// Re-pinned from the retired Challenge run's tests (tests/run-play.test.ts): the same screen, a battle on it, now one
// battle on the defaults rather than a run of three with a small army and drafts between them.

import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import type { Player } from "../src/battle/index.ts"
import { briefOf, battleArmy, handOf, mapOf, beginBattle, placementsOf, playRound, scriptedPlayer } from "../src/battle/index.ts"
import type { PlayableLevel } from "../src/cli/levels.ts"
import { driveSkirmish, newSkirmishLevel, playedOf, positionOf, saveOfRound, scriptedRound, buildActionsOf, skirmishLevel } from "../src/cli/skirmish-play.ts"
import { readSave, saveText } from "../src/skirmish/save.ts"
import { roundIncome } from "../src/armies/curve.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { skirmishSaver } from "../src/cli/skirmish-files.ts"

const level = (seed = 1): PlayableLevel => newSkirmishLevel(seed, { newSeed: () => 4242 })

/** A player that builds nothing and keeps no power: it loses. */
const idle: Player = () => ({ build: [], stance: "attack" })
const balanced = scriptedPlayer("balanced") as Player

const first = (seed = 1): BuildContext => withoutScene(level(seed).firstRound())

/** A Build Phase state on `context` with `planned` placed and the hand's card `pick` picked. */
function planOn(context: BuildContext, planned: BuildState["planned"], pick: number | null = null): BuildState {
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  return { ...opened, planned, nextOrdinal: planned.length + 1, nexusPick: pick, bonusAllotment: pick === null ? 0 : (context.nexusDraft[pick]?.bonusAllotment ?? 0) }
}

/** A round's Pulse, started, with what it left. */
function started(play: PlayableLevel["play"], context: BuildContext, state: BuildState): Readonly<{ resolved: ResolvedPulse; played: NonNullable<ReturnType<typeof playedOf>> }> {
  const resolved = play.startPulse(context, state)
  assert.ok(resolved !== null, "the round did not start")
  const played = playedOf(resolved)
  assert.ok(played !== undefined, "the round left nothing for the next")
  return { resolved, played }
}

/** The rounds of the battle played by `player` until it ends: the last round's plan, its Pulse and what it left. */
function toBattleEnd(player: Player): Readonly<{ play: PlayableLevel["play"]; planned: ReturnType<typeof scriptedRound>; resolved: ResolvedPulse; played: NonNullable<ReturnType<typeof playedOf>> }> {
  const { play } = level()
  let context = first()
  for (;;) {
    const planned = scriptedRound(context, player, play)
    const { resolved, played } = started(play, planned.context, planned.state)
    if (played.battle.result !== null) return { play, planned, resolved, played }
    context = withoutScene(play.nextRound(planned.context, planned.state, resolved) as BuildContext)
  }
}

test("a Skirmish opens on round 1: p1's Build Phase on the Crossing, the Commander's whole army, the battle's hand", { timeout: 60_000 }, () => {
  const opened = level().firstRound()
  const { setup, battle } = positionOf(opened)
  assert.equal(setup.seed, 1)
  assert.deepEqual(setup.slots, { p1: { commander: "vasse", controller: "player" }, p2: { commander: "dob", controller: "script:balanced" } })
  assert.equal(battle.round, 1)
  assert.deepEqual(opened.round, { number: 1, of: 8 })
  const map = mapOf(battle)
  assert.equal(opened.grid.width, map.rows[0]?.length)
  assert.equal(opened.grid.height, map.rows.length)
  // Its own Nexus stands; the enemy's is the field, whole.
  assert.deepEqual(opened.standing, [{ contentId: battleArmy("vasse").nexus, anchor: map.nexus.A }])
  assert.deepEqual(
    opened.field?.map((entity) => [entity.contentId, entity.player, entity.anchor]),
    [[battleArmy("dob").nexus, "B", map.nexus.B]],
  )
  // The whole army, not a run's small one: every building card hers is on the build menu.
  assert.deepEqual(opened.buildingCards?.map((card) => card.id), battleArmy("vasse").buildings.map((card) => card.id))
  assert.ok(opened.catalog.length >= 5, `only ${opened.catalog.length} buildings on the menu`)
  assert.equal(opened.allotment, roundIncome(1))
  assert.deepEqual(
    opened.nexusDraft.map((option) => option.card.id),
    handOf(battle, "A").map((card) => card.id),
    "the hand on screen is not the hand the battle deals",
  )
  assert.equal(opened.commander?.name, "Edda Vasse")
  assert.ok(opened.incoming?.some((entity) => entity.player === "A" && entity.contentId === battleArmy("vasse").commander.unit))
  assert.ok(opened.incoming?.some((entity) => entity.player === "B" && entity.contentId === battleArmy("dob").commander.unit))
  assert.deepEqual(
    opened.scene?.map((line) => line.text),
    [
      "A Skirmish on The Crossing, seed 1: Edda Vasse against Dob Hunter. Destroy the enemy Nexus within 8 rounds, or have the healthier Nexus when they run out.",
      "Dob Hunter's army plays the balanced script: it builds its strongest units, holds two rounds and attacks from the third.",
    ],
  )
  // Save game offers a name by the setup.
  assert.equal(opened.saveName, "vasse-dob-1-round-1")
  assert.deepEqual(level().play.foresee(opened, planOn(withoutScene(opened), [])), [])
})

test("a round played from a Build Phase places exactly the buildings the player placed, and keeps the power picked", { timeout: 60_000 }, () => {
  const { play } = level()
  const context = first()
  const { battle } = positionOf(context)
  const spots = placementsOf(battle, "A", { build: [{ building: "barracks", at: "forward" }, { building: "turret", at: "north" }], stance: "attack" })
  assert.equal(spots.length, 2)
  const kept = (play.keep as NonNullable<typeof play.keep>)(context, (context.nexusDraft[0] as BuildContext["nexusDraft"][number]).card)
  const state = planOn(kept, spots, 0)
  const { resolved, played } = started(play, kept, state)
  const opening = resolved.timeline.states[0]
  assert.ok(opening !== undefined)
  const standing = opening.entities
    .filter((entity) => entity.player === "A" && resolved.timeline.registry.get(entity.contentId).layer === "obstacles")
    .map((entity) => `${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`)
    .sort()
  const expected = [`${battleArmy("vasse").nexus} ${mapOf(battle).nexus.A.x},${mapOf(battle).nexus.A.y}`, ...spots.map((spot) => `${spot.contentId} ${spot.anchor.x},${spot.anchor.y}`)].sort()
  assert.deepEqual(standing, expected)
  assert.deepEqual(played.report.sides.A.refused, [])
  assert.equal(played.report.sides.A.kept, context.nexusDraft[0]?.name)
  assert.equal(played.report.sides.A.stance, "attack", "the troops march on the enemy's Nexus")
  assert.equal(resolved.mission?.round, 1)
  assert.equal(resolved.mission?.of, 8)
  assert.equal(resolved.enemy, "enemy")
})

test("p2's plan comes from its script: the round is the battle's own", { timeout: 60_000 }, () => {
  const { play } = level()
  const context = first()
  const { battle } = positionOf(context)
  const state = planOn(context, placementsOf(battle, "A", { build: [{ building: "barracks", at: "forward" }], stance: "attack" }))
  const { played } = started(play, context, state)
  const plans = { A: buildActionsOf(context, state), B: balanced(briefOf(battle, "B").data) }
  const duelRound = playRound(battle, plans)
  assert.deepEqual(played.report, duelRound.report)
  assert.deepEqual(played.battle, duelRound.state)
})

test("the next round carries where the regroup left everyone: the player's buildings standing, the rest as the field, the credits", { timeout: 60_000 }, () => {
  const { play } = level()
  const context = first()
  const { battle } = positionOf(context)
  const turret = placementsOf(battle, "A", { build: [{ building: "turret", at: "back" }], stance: "attack" })
  const state = planOn(context, turret)
  const { resolved, played } = started(play, context, state)
  assert.equal(played.battle.result, null, "the battle ended in its first round; this test wants a second")
  const next = play.nextRound(context, state, resolved)
  assert.ok(next !== null)
  const after = positionOf(next)
  assert.equal(after.battle, played.battle)
  assert.deepEqual(next.round, { number: 2, of: 8 })
  assert.equal(next.allotment, played.battle.sides.A.credits)
  const cost = context.catalog.find((item) => item.contentId === turret[0]?.contentId)?.cost ?? 0
  assert.equal(next.allotment, roundIncome(1) - cost + roundIncome(2) + played.report.sides.A.earned)
  assert.ok(
    next.standing.some((structure) => structure.anchor.x === turret[0]?.anchor.x && structure.anchor.y === turret[0]?.anchor.y),
    "the Turret built last round is not standing",
  )
  const carried = played.battle.carried
  assert.ok(carried !== null)
  const fieldIds = new Set(next.field?.map((entity) => `${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`))
  for (const entity of carried.entities) {
    const own = entity.player === "A" && next.registry.get(entity.contentId).layer === "obstacles"
    if (!own) assert.ok(fieldIds.has(`${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`), `${entity.contentId} is missing from the field`)
  }
  assert.deepEqual(
    next.nexusDraft.map((option) => option.card.id),
    handOf(played.battle, "A").map((card) => card.id),
  )
  assert.equal(next.saveName, "vasse-dob-1-round-2")
})

test("a battle's end offers the same battle again or a new seed, each from round 1", { timeout: 120_000 }, () => {
  const { play, planned, resolved, played } = toBattleEnd(idle)
  assert.notEqual(played.battle.result, null)
  assert.equal(resolved.mission?.verdict.kind, "lost")
  assert.equal(resolved.mission?.ending?.headline, "BATTLE LOST")
  assert.equal(resolved.mission?.ending?.goOn, "Same battle again")
  assert.equal(resolved.mission?.ending?.alternative, "New seed")
  const again = play.nextRound(planned.context, planned.state, resolved)
  assert.ok(again !== null)
  assert.equal(positionOf(again).setup.seed, 1, "the same battle is the same seed")
  assert.equal(positionOf(again).battle.round, 1)
  assert.equal(positionOf(again).battle.carried, null)
  assert.match(again.scene?.[0]?.text ?? "", /^Lost in round \d+\. .* The same battle again\.$/u)
  const fresh = play.nextRound(planned.context, planned.state, resolved, true)
  assert.ok(fresh !== null)
  assert.equal(positionOf(fresh).setup.seed, 4242, "a new seed is the one the screens chose")
  assert.match(fresh.scene?.[0]?.text ?? "", /A new battle, seed 4242\.$/u)
})

test("a building held this round trains nothing (Hold production)", { timeout: 60_000 }, () => {
  const battle = beginBattle({ map: "crossing", seed: 3, rounds: 6, pulseTicks: 600, commanders: { A: "vasse", B: "dob" } })
  const quiet = { build: [], stance: "hold" } as const
  const one = playRound(battle, { A: { build: [{ building: "barracks", at: "back" }], stance: "hold" }, B: quiet }).state
  const barracks = one.carried?.entities.find((entity) => entity.player === "A" && entity.contentId === "structure.citizen.barracks")
  assert.ok(barracks !== undefined, "the Barracks did not stand")
  const free = playRound(one, { A: quiet, B: quiet }).report.reading.sides.A.army.trained.counts
  const held = playRound(one, { A: { ...quiet, hold: [barracks.anchor] }, B: quiet }).report.reading.sides.A.army.trained.counts
  assert.ok(Object.values(free).reduce((sum, count) => sum + count, 0) > 0, "the Barracks trained nothing even unheld")
  assert.deepEqual(held, {})
})

test("a Skirmish plays on the Build Phase screen: place a building, start the Battle Round, reach the next round", { timeout: 60_000 }, () => {
  // From the route, as the game, the page and `scripts/playtest.mjs --at 'skirmish?seed=1'` open it: its words skipped,
  // the first power picked, the menu's first building armed and placed, the Battle Round started and watched to its end.
  const steps = parseKeyScript("Esc n 1 1 Enter s s wait~1000*32 Enter")
  const run = runBuildPlaytest({ steps, at: playtestOpening({ at: "skirmish?seed=1" }).at })
  const opening = frameToText(run.frames[0]!.frame)
  assert.match(opening, /build phase - round 1 of 8/u)
  assert.match(opening, /A Skirmish on The Crossing, seed 1/u)
  const placed = run.frames[5]!.state
  assert.equal(placed.planned.length, 1, "Enter did not place the building")
  const building = placed.planned[0]!
  const result = frameToText(run.frames[run.frames.length - 2]!.frame)
  assert.match(result, /\[enter\] Next round/u)
  assert.match(result, /ENEMY/u)
  assert.match(frameToText(run.frames[run.frames.length - 1]!.frame), /build phase - round 2 of 8/u)
  assert.ok(
    run.context.standing.some((structure) => structure.contentId === building.contentId && structure.anchor.x === building.anchor.x && structure.anchor.y === building.anchor.y),
    "the building placed on the screen is not standing in round 2",
  )
})

test("the driver plays a Skirmish to its end, and the same save and script give the same battle", { timeout: 120_000 }, () => {
  const once = driveSkirmish(level(), balanced)
  const again = driveSkirmish(level(), balanced)
  const shape = (driven: typeof once): string[] => driven.rounds.map((report) => `${report.round} ${report.ended}@${report.ticks}`)
  assert.deepEqual(shape(again), shape(once))
  assert.deepEqual(again.battle.result, once.battle.result)
  assert.notEqual(once.battle.result, null)
})

// --- Save game -----------------------------------------------------------------------------------------------------

/** Round 2 of seed 1 with a plan half made: the first power picked, a Turret placed, and the Barracks from round 1 held. */
function halfPlanned(): Readonly<{ play: PlayableLevel["play"]; context: BuildContext; state: BuildState }> {
  const { play } = level()
  const one = first()
  const barracks = placementsOf(positionOf(one).battle, "A", { build: [{ building: "barracks", at: "back" }], stance: "attack" })
  const state1 = planOn(one, barracks)
  const { resolved } = started(play, one, state1)
  const two = withoutScene(play.nextRound(one, state1, resolved) as BuildContext)
  const { battle } = positionOf(two)
  const kept = (play.keep as NonNullable<typeof play.keep>)(two, (two.nexusDraft[0] as BuildContext["nexusDraft"][number]).card)
  const turret = placementsOf(battle, "A", { power: 1, build: [{ building: "turret", at: "north" }], stance: "attack" })
  const anchor = barracks[0]?.anchor as NonNullable<(typeof barracks)[number]>["anchor"]
  return { play, context: kept, state: { ...planOn(kept, turret, 0), held: [`${anchor.x},${anchor.y}`] } }
}

test("a round saves as its setup, its battle and the plan so far; loading it returns to that Build Phase, which plays as the uninterrupted one", { timeout: 120_000 }, () => {
  const { play, context, state } = halfPlanned()
  const text = saveText(saveOfRound(context, state, "half planned"))
  const { save, problems } = readSave(text)
  assert.deepEqual(problems, [])
  assert.ok(save !== null)
  assert.equal(save.state?.round, 2)
  assert.deepEqual(save.draft?.p1, buildActionsOf(context, state))
  // Loaded: the same round, the same hand and credits, the power kept, the Turret placed and the Barracks held.
  const loaded = skirmishLevel(save, { file: "tmp/half.save.json" })
  const opened = loaded.firstRound()
  const viewport = buildLayout({ columns: 80, rows: 24 }, opened.grid).viewport
  const session = new BuildSession({ context: opened, cursor: nexusTile(opened) ?? { x: 0, y: 0 }, viewport, resume: loaded.play.resume as NonNullable<typeof loaded.play.resume>, keep: loaded.play.keep as NonNullable<typeof loaded.play.keep> })
  assert.deepEqual(session.state.planned, state.planned)
  assert.equal(session.state.nexusPick, 0)
  assert.deepEqual(session.state.held, state.held)
  assert.deepEqual(session.round.kept?.map((card) => card.id), context.kept?.map((card) => card.id))
  assert.deepEqual(session.round.nexusDraft.map((option) => option.card.id), context.nexusDraft.map((option) => option.card.id))
  assert.equal(session.round.allotment, context.allotment)
  assert.equal(session.round.saveName, "tmp/half.save.json", "Save game offers the file it was loaded from")
  assert.equal(session.round.openingStatus?.text, "Loaded half.save.json: round 2 of 8, the plan so far restored.")
  assert.match(opened.scene?.[0]?.text ?? "", /^Loaded tmp\/half\.save\.json: round 2 of 8, Edda Vasse against Dob Hunter on The Crossing, seed 1\. The plan so far is restored\.$/u)
  // Played on from the load, the round is the uninterrupted round: the same report and the same battle after it.
  const straight = started(play, context, state).played
  const resumed = started(loaded.play, session.round, session.state).played
  assert.deepEqual(resumed.report, straight.report)
  assert.deepEqual(resumed.battle, straight.battle)
})

test("Save game on the screen writes the file the player names, and opening it with --load returns to the same Build Phase", { timeout: 120_000 }, () => {
  const folder = mkdtempSync(join(tmpdir(), "tn-saves-"))
  try {
    // Round 1: the scene skipped, the first power picked, a building placed; then Esc, Save game, a name typed over the
    // one offered, Enter.
    const name = join(folder, "mine")
    const erase = Array.from({ length: "vasse-dob-1-round-1".length }, () => "Backspace").join(" ")
    const typed = [...name].map((char) => (char === " " ? "Space" : char)).join(" ")
    const steps = parseKeyScript(`Esc n 1 1 Enter Esc v ${erase} ${typed} Enter`)
    const run = runBuildPlaytest({ steps, at: playtestOpening({ at: "skirmish?seed=1" }).at, savesFolder: folder })
    const saved = run.frames[run.frames.length - 1]!
    assert.equal(saved.state.popup, null, "the popups stay open after saving")
    assert.match(saved.state.status.text, /^Saved to /u)
    const text = readFileSync(`${name}.save.json`, "utf8")
    const { save } = readSave(text)
    assert.ok(save !== null)
    assert.equal(save.draft?.p1?.power, 1)
    assert.equal(save.draft?.p1?.build.length, 1)
    // A fresh start on that file: the same plan on the same round.
    const reopened = runBuildPlaytest({ steps: parseKeyScript("Esc"), at: playtestOpening({}, "--keys", { load: `${name}.save.json` }).at })
    const back = reopened.frames[reopened.frames.length - 1]!.state
    assert.deepEqual(back.planned.map((placement) => [placement.contentId, placement.anchor]), saved.state.planned.map((placement) => [placement.contentId, placement.anchor]))
    assert.equal(back.nexusPick, saved.state.nexusPick)
    assert.equal(reopened.context.saveName, `${name}.save.json`)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

test("Save game is dimmed where nothing can be saved, and refused at the Battle Round", { timeout: 60_000 }, () => {
  const run = runBuildPlaytest({ steps: parseKeyScript("Esc Esc v") })
  const menu = frameToText(run.frames[2]!.frame)
  assert.match(menu, /\[v\] Save game/u)
  assert.equal(run.frames[3]!.state.popup, "game-menu", "Save game opened on a story mission")
  assert.equal(run.frames[3]!.state.status.text, "Only a Skirmish can be saved.")
  const skirmish = runBuildPlaytest({ steps: parseKeyScript("Esc s s Esc v"), at: playtestOpening({ at: "skirmish?seed=1" }).at })
  assert.equal(skirmish.frames[skirmish.frames.length - 1]!.state.status.text, "Save game waits for the next Build Phase.")
})

test("a save written by the saver is the round's file from then on, and a failed write says why", { timeout: 60_000 }, () => {
  const { context, state } = halfPlanned()
  const written: string[] = []
  const saver = skirmishSaver("/saves", (path) => written.push(path))
  const answer = saver.onSave(context, state, "tmp/again")
  assert.equal(answer.ok, true)
  assert.match(written[0] ?? "", /tmp\/again\.save\.json$/u)
  assert.equal(answer.context?.saveName, "tmp/again.save.json")
  assert.equal(positionOf(answer.context as BuildContext).file, "tmp/again.save.json")
  assert.equal(skirmishSaver("/saves", (path) => written.push(path)).onSave(context, state, "bare").ok, true)
  assert.equal(written[1], "/saves/bare.save.json")
  const failed = skirmishSaver("/saves", () => {
    throw new Error("disk full")
  }).onSave(context, state, "x")
  assert.deepEqual([failed.ok, failed.text], [false, "Not saved: disk full"])
})
