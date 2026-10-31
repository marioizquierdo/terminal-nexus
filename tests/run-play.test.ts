// A Challenge run played on the Build Phase screen (src/cli/run-play.ts): a run battle is a duel, side A planned on
// the screen and side B by a scripted duel player. Its rounds open as Build Phases on the duel map, a plan's buildings
// are placed exactly where the player put them, the next round carries where the regroup left everyone, a battle's end opens the
// next battle, and the run's end opens a new run on its summary. The driver plays a whole run through the same
// functions, and the same seed and script give the same run on Node and Bun.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import type { Player } from "../src/duel/index.ts"
import { briefOf, duelArmy, handOf, mapOf, newDuel, placementsOf, playRound, scriptedPlayer } from "../src/duel/index.ts"
import { RUN_PLAY, driveRun, playedOf, positionOf, runLevel, scriptedRound, sidePlanOf } from "../src/cli/run-play.ts"
import { roundIncome } from "../src/armies/curve.ts"
import { summaryLines } from "../src/run/index.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { BuildSession } from "../src/view/build-session.ts"

const SETUP = { seed: 1, commander: "vasse" } as const

/** A player that builds nothing and keeps no power: it loses the first battle. */
const idle: Player = () => ({ build: [], stance: "attack" })
const balanced = scriptedPlayer("balanced") as Player

const first = (): BuildContext => withoutScene(runLevel(SETUP).firstRound())

/** A Build Phase state on `context` with `planned` placed and the hand's card `pick` picked. */
function planOn(context: BuildContext, planned: BuildState["planned"], pick: number | null = null): BuildState {
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
  return { ...opened, planned, nextOrdinal: planned.length, nexusPick: pick, bonusAllotment: pick === null ? 0 : (context.nexusDraft[pick]?.bonusAllotment ?? 0) }
}

/** The rounds of the first battle played by `player` until it ends: the last round's plan, its Pulse and what it left. */
function toBattleEnd(player: Player): Readonly<{ planned: ReturnType<typeof scriptedRound>; resolved: ResolvedPulse; played: NonNullable<ReturnType<typeof playedOf>> }> {
  let context = first()
  for (;;) {
    const planned = scriptedRound(context, player)
    const { resolved, played } = started(planned.context, planned.state)
    if (played.duel.result !== null) return { planned, resolved, played }
    context = withoutScene(RUN_PLAY.nextRound(planned.context, planned.state, resolved) as BuildContext)
  }
}

/** A round's Pulse, started, with what it left. */
function started(context: BuildContext, state: BuildState): Readonly<{ resolved: ResolvedPulse; played: NonNullable<ReturnType<typeof playedOf>> }> {
  const resolved = RUN_PLAY.startPulse(context, state)
  assert.ok(resolved !== null, "the round did not start")
  const played = playedOf(resolved)
  assert.ok(played !== undefined, "the round left nothing for the next")
  return { resolved, played }
}

test("a run opens on its first battle's first round: side A's Build Phase on the duel map, with the duel's hand", { timeout: 60_000 }, () => {
  const opened = runLevel(SETUP).firstRound()
  const { run, duel } = positionOf(opened)
  assert.equal(run.played.length, 0)
  assert.equal(duel.round, 1)
  assert.deepEqual(opened.round, { number: 1, of: 8, stage: "battle 1 of 3" })
  const map = mapOf(duel)
  assert.equal(opened.grid.width, map.rows[0]?.length)
  assert.equal(opened.grid.height, map.rows.length)
  // Its own Nexus stands; the enemy's is the field, whole.
  assert.deepEqual(opened.standing, [{ contentId: duelArmy("vasse").nexus, anchor: map.nexus.A }])
  assert.deepEqual(
    opened.field?.map((entity) => [entity.contentId, entity.player, entity.anchor]),
    [[duelArmy("dob").nexus, "B", map.nexus.B]],
  )
  assert.equal(opened.allotment, roundIncome(1))
  assert.deepEqual(
    opened.nexusDraft.map((option) => option.card.id),
    handOf(duel, "A").map((card) => card.id),
    "the hand on screen is not the hand the duel deals",
  )
  assert.equal(opened.commander?.name, "Edda Vasse")
  // Her and her starting package, and Dob Hunter's, arrive as the round starts: drawn where they will.
  assert.ok(opened.incoming?.some((entity) => entity.player === "A" && entity.contentId === duelArmy("vasse").commander.unit))
  assert.ok(opened.incoming?.some((entity) => entity.player === "B" && entity.contentId === duelArmy("dob").commander.unit))
  // It opens on the run's words: the seed, and the battle.
  assert.deepEqual(
    opened.scene?.map((line) => line.text),
    [
      "A Challenge run: 3 battles with Edda Vasse, seed 1. A lost battle ends the run.",
      "Battle 1 of 3: against Dob Hunter on The Crossing. Destroy the enemy Nexus within 8 rounds, or have the healthier Nexus when they run out.",
      "Dob Hunter's army rushes: its cheapest units, all forward, attacking every round.",
    ],
  )
  // No raid comes: the enemy plans in secret.
  assert.deepEqual(RUN_PLAY.foresee(opened, planOn(withoutScene(opened), [])), [])
})

test("a round played from a Build Phase places exactly the buildings the player placed, and keeps the power picked", { timeout: 60_000 }, () => {
  const context = first()
  const { duel } = positionOf(context)
  // Two legal spots the player could have put a Barracks and a Turret on.
  const spots = placementsOf(duel, "A", { build: [{ building: "barracks", at: "forward" }, { building: "turret", at: "north" }], stance: "attack" })
  assert.equal(spots.length, 2)
  const kept = RUN_PLAY.keep(context, (context.nexusDraft[0] as BuildContext["nexusDraft"][number]).card)
  const state = planOn(kept, spots, 0)
  const { resolved, played } = started(kept, state)
  const opening = resolved.timeline.states[0]
  assert.ok(opening !== undefined)
  const standing = opening.entities
    .filter((entity) => entity.player === "A" && resolved.timeline.registry.get(entity.contentId).layer === "obstacles")
    .map((entity) => `${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`)
    .sort()
  const expected = [`${duelArmy("vasse").nexus} ${mapOf(duel).nexus.A.x},${mapOf(duel).nexus.A.y}`, ...spots.map((spot) => `${spot.contentId} ${spot.anchor.x},${spot.anchor.y}`)].sort()
  assert.deepEqual(standing, expected)
  assert.deepEqual(played.report.sides.A.refused, [])
  assert.equal(played.report.sides.A.kept, context.nexusDraft[0]?.name)
  assert.equal(played.report.sides.A.stance, "attack", "the troops march on the enemy's Nexus")
  assert.equal(resolved.mission?.round, 1)
  assert.equal(resolved.mission?.of, 8)
  assert.equal(resolved.enemy, "enemy")
})

test("side B's plan comes from the battle's scripted player: the round is the duel's own", { timeout: 60_000 }, () => {
  const context = first()
  const { run, duel } = positionOf(context)
  const policy = run.definition.battles[0]?.policy as string
  const state = planOn(context, placementsOf(duel, "A", { build: [{ building: "barracks", at: "forward" }], stance: "attack" }))
  const { played } = started(context, state)
  // The same round, played by the duel itself with the scripted player's plan for B.
  const plans = { A: sidePlanOf(context, state), B: (scriptedPlayer(policy) as Player)(briefOf(duel, "B").data) }
  const duelRound = playRound(duel, plans)
  assert.deepEqual(played.report, duelRound.report)
  assert.deepEqual(played.duel, duelRound.state)
})

test("the next round carries where the regroup left everyone: the player's buildings standing, the rest as the field, the credits", { timeout: 60_000 }, () => {
  const context = first()
  const { duel } = positionOf(context)
  const turret = placementsOf(duel, "A", { build: [{ building: "turret", at: "back" }], stance: "attack" })
  const state = planOn(context, turret)
  const { resolved, played } = started(context, state)
  assert.equal(played.duel.result, null, "the battle ended in its first round; this test wants a second")
  const next = RUN_PLAY.nextRound(context, state, resolved)
  assert.ok(next !== null)
  const after = positionOf(next)
  assert.equal(after.duel, played.duel)
  assert.deepEqual(next.round, { number: 2, of: 8, stage: "battle 1 of 3" })
  assert.equal(next.allotment, played.duel.sides.A.credits)
  const cost = context.catalog.find((item) => item.contentId === turret[0]?.contentId)?.cost ?? 0
  assert.equal(next.allotment, roundIncome(1) - cost + roundIncome(2) + played.report.sides.A.earned)
  assert.ok(
    next.standing.some((structure) => structure.anchor.x === turret[0]?.anchor.x && structure.anchor.y === turret[0]?.anchor.y),
    "the Turret built last round is not standing",
  )
  // Everything not the player's building is the field: the enemy's Nexus and buildings, and every survivor.
  const carried = played.duel.carried
  assert.ok(carried !== null)
  const fieldIds = new Set(next.field?.map((entity) => `${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`))
  for (const entity of carried.entities) {
    const own = entity.player === "A" && next.registry.get(entity.contentId).layer === "obstacles"
    if (!own) assert.ok(fieldIds.has(`${entity.contentId} ${entity.anchor.x},${entity.anchor.y}`), `${entity.contentId} is missing from the field`)
  }
  assert.deepEqual(
    next.nexusDraft.map((option) => option.card.id),
    handOf(played.duel, "A").map((card) => card.id),
  )
  assert.equal(next.openingStatus?.text, "Round 1: time's up. The Nexus Pulse deals a new hand: [n].")
})

test("a battle's end opens the draft it earned, and the choice opens the next battle's first round on the army it leaves", { timeout: 60_000 }, () => {
  // Battle 1 of seed 1 is against the rush; the balanced script's army, marching every round, takes his Nexus.
  const { planned, resolved, played } = toBattleEnd(balanced)
  assert.notEqual(played.duel.result, null, "battle 1 did not end")
  assert.equal(resolved.mission?.verdict.kind, "won")
  assert.deepEqual(resolved.mission?.ending, { headline: "BATTLE WON", reason: "Dob Hunter's Nexus fell.", tone: "success", goOn: "Next battle" })
  const waiting = RUN_PLAY.nextRound(planned.context, planned.state, resolved)
  assert.ok(waiting !== null)
  // The round that opens is behind a draft: three cards, the cards that could go, and the requisition.
  const draft = waiting.runDraft
  assert.ok(draft !== undefined, "a won battle opens on its draft")
  assert.equal(draft.title, "Draft after battle 1")
  assert.equal(draft.cards.length, 3)
  assert.equal(draft.requisition, 15)
  // The Barracks is the last building that trains units: it cannot go, or the army could field nothing.
  assert.deepEqual(draft.removable.map((card) => card.key), ["structure:depot", "structure:turret", "power:reserve-callup", "power:drill-schedule"])
  // Round 3 since a unit that cannot reach its target came to march on round the fight (it was round 2).
  assert.equal(draft.intro[0], "Battle 1 of 3: won in round 3. Dob Hunter's Nexus fell.")
  assert.deepEqual(draft.army.map((family) => [family.family, family.names.join(", ")]), [
    ["Structures", "Barracks, Supply Depot, Turret"],
    ["Nexus powers", "Reserve Callup, Drill Schedule"],
    ["Doctrines", ""],
  ])
  assert.deepEqual(positionOf(waiting).run.played.length, 1)
  // The card taken is in the army the next battle's first round is played on.
  const card = draft.cards[0]!
  const next = (RUN_PLAY.draft as NonNullable<typeof RUN_PLAY.draft>)(waiting, { kind: "take", key: card.key })
  assert.equal(next.runDraft, undefined, "the draft is settled")
  const { run, duel } = positionOf(next)
  assert.equal(run.drafts.length, 1)
  assert.equal(duel.carried, null, "the next battle starts from a fresh Grid")
  assert.equal(duel.setup.seed, run.definition.battles[1]?.duel.seed)
  assert.ok([...(duel.sides.A.roster?.buildings ?? []), ...(duel.sides.A.roster?.powers ?? []), ...(duel.sides.A.roster?.doctrines ?? [])].includes(card.key.split(":")[1] as string))
  assert.deepEqual(next.round, { number: 1, of: 8, stage: "battle 2 of 3" })
  assert.equal(next.allotment, roundIncome(1))
  assert.equal(next.kept?.length, card.key.startsWith("doctrine:") ? 1 : 0, "a Doctrine is kept from round one; nothing else is")
  assert.match(next.scene?.[0]?.text ?? "", /^After battle 1: took /)
  assert.match(next.scene?.[1]?.text ?? "", /^Battle 2 of 3: against Dob Hunter/)
  assert.throws(() => (RUN_PLAY.draft as NonNullable<typeof RUN_PLAY.draft>)(next, { kind: "requisition" }), /no draft/)
})

test("a lost battle ends the run, and the next round is a new run's, opening on the summary", { timeout: 60_000 }, () => {
  let context = first()
  let ended: Readonly<{ resolved: ResolvedPulse; state: BuildState; context: BuildContext }> | null = null
  for (let round = 0; round < 6 && ended === null; round += 1) {
    const planned = scriptedRound(context, idle)
    const { resolved, played } = started(planned.context, planned.state)
    if (played.run.over) ended = { resolved, state: planned.state, context: planned.context }
    else context = RUN_PLAY.nextRound(planned.context, planned.state, resolved) as BuildContext
  }
  assert.ok(ended !== null, "a player who builds nothing never lost")
  assert.equal(ended.resolved.mission?.verdict.kind, "lost")
  assert.equal(ended.resolved.mission?.ending?.headline, "BATTLE LOST")
  assert.equal(ended.resolved.mission?.ending?.goOn, "Run summary")
  const last = playedOf(ended.resolved)?.run
  assert.ok(last !== undefined)
  const next = RUN_PLAY.nextRound(ended.context, ended.state, ended.resolved)
  assert.ok(next !== null)
  const fresh = positionOf(next)
  assert.equal(fresh.run.definition.setup.seed, last.definition.nextSeed, "a new run takes the seed the last one named")
  assert.equal(fresh.run.definition.setup.commander, "vasse")
  assert.equal(fresh.run.played.length, 0)
  assert.equal(next.scene?.[0]?.text, summaryLines(last).join("\n"), "the new run does not open on the last one's summary")
  assert.equal(next.openingStatus?.text, `A new run, seed ${last.definition.nextSeed}. The last run, seed 1: 0 of 3 battles won.`)
})

test("a building held this round trains nothing (Hold production)", { timeout: 60_000 }, () => {
  // Round 1: a Barracks, nobody attacking; round 2 the same duel, the Barracks held or not.
  const duel = newDuel({ map: "crossing", seed: 3, rounds: 6, pulseTicks: 600, commanders: { A: "vasse", B: "dob" } })
  const quiet = { build: [], stance: "hold" } as const
  const one = playRound(duel, { A: { build: [{ building: "barracks", at: "back" }], stance: "hold" }, B: quiet }).state
  const barracks = one.carried?.entities.find((entity) => entity.player === "A" && entity.contentId === "structure.citizen.barracks")
  assert.ok(barracks !== undefined, "the Barracks did not stand")
  const free = playRound(one, { A: quiet, B: quiet }).report.sides.A.trained
  const held = playRound(one, { A: { ...quiet, hold: [barracks.anchor] }, B: quiet }).report.sides.A.trained
  assert.ok(Object.values(free).reduce((sum, count) => sum + count, 0) > 0, "the Barracks trained nothing even unheld")
  assert.deepEqual(held, {})
})

test("a run's battle plays on the Build Phase screen: place a building, start the Battle Round, reach the next round", { timeout: 60_000 }, () => {
  // From the route, as the game, the page and `scripts/playtest.mjs --at 'challenge?seed=1'` open it: the run's words
  // skipped, the first power picked, a Turret (the menu's first row in a run's small army) armed and placed, the Battle Round started and watched to its end.
  const steps = parseKeyScript("Esc n 1 1 Enter s s wait~1000*62 Enter")
  const run = runBuildPlaytest({ steps, at: playtestOpening({ at: "challenge?seed=1" }).at })
  const first = frameToText(run.frames[0]!.frame)
  assert.match(first, /build phase - battle 1 of 3 - round 1 of 8/u)
  assert.match(first, /A Challenge run: 3 battles with Edda/u)
  const placed = run.frames[5]!.state
  assert.equal(placed.planned.length, 1, "Enter did not place the Turret")
  const turret = placed.planned[0]!
  const result = frameToText(run.frames[run.frames.length - 2]!.frame)
  assert.match(result, /\[enter\] Next round/u)
  assert.match(result, /ENEMY/u)
  const last = run.frames[run.frames.length - 1]!
  assert.match(frameToText(last.frame), /build phase - battle 1 of 3 - round 2 of 8/u)
  assert.ok(
    run.context.standing.some((structure) => structure.contentId === turret.contentId && structure.anchor.x === turret.anchor.x && structure.anchor.y === turret.anchor.y),
    "the Turret placed on the screen is not standing in round 2",
  )
})

test("the driver plays a run end to end, and the same seed and script give the same run", { timeout: 120_000 }, () => {
  const once = driveRun(SETUP, balanced)
  const again = driveRun(SETUP, balanced)
  const shape = (driven: typeof once): string[] => driven.rounds.map(({ battle, report }) => `${battle}.${report.round} ${report.ended}@${report.ticks}`)
  assert.deepEqual(shape(again), shape(once))
  assert.deepEqual(summaryLines(again.run), summaryLines(once.run))
  assert.equal(once.run.over, true)
  // Pinned, on Node and on Bun: a change to a rule, the scripts, the armies or the dealer moves it, and says so. The
  // driver takes the first card each draft offers.
  assert.deepEqual(summaryLines(once.run), [
    "The run is over: 2 of 3 battles won. Battle 3 was lost.",
    "Edda Vasse, seed 1.",
    // Rounds 3 and 8 (they were 2 and 7) since a unit that cannot reach its target came to look further afield for one it
    // can (a first version that marched on past the fight made them 3 and 6).
    "Battle 1 against Dob Hunter (rush): won in round 3. Dob Hunter's Nexus fell.",
    "Battle 2 against Dob Hunter (turtle): won in round 8. Dob Hunter's Nexus fell.",
    "Battle 3 against Dob Hunter (balanced): lost in round 8. The rounds ran out with the Nexuses as healthy, and Dob Hunter dealt more damage.",
    "After battle 1: took Standard Heavy Rounds (Doctrine, common).",
    "After battle 2: took Hatchery (Structure, common).",
    "The army: Barracks, Supply Depot, Turret, Hatchery, Reserve Callup, Drill Schedule, Standard Heavy Rounds.",
  ])
  // Pinned again for the kept front (2026-10-26): 30-second rounds, the survivors regrouping between them, eight rounds a
  // battle. Pinned again for the troop formation (2026-10-27): an army sorts itself on the march and its Commander leads
  // nothing, so battle 1's last round ends in its Nexus falling at tick 138 (was 150) and battle 2's at 152 (was 303); the
  // same rounds are won and lost, with the same summary. Pinned again when a unit came to keep the target it holds
  // (commitment): battle 1 is won a round sooner, in round 2 at tick 359, and battle 2 in round 7 at tick 309.
  const time = (battle: number, rounds: number): string[] => Array.from({ length: rounds }, (_, index) => `${battle}.${index + 1} time@360`)
  // Pinned again when a unit that cannot reach its target came to let it go and look further afield for one it can:
  // battle 1 is won in round 3 at tick 136 (round 2 now runs out its time), and battle 2 in round 8 at tick 183; battle 3
  // is lost as before. (A first version that marched on past the fight won battle 2 in round 6, at tick 355.)
  // Pinned again when a unit whose target is walled in came to let it go only for one it can reach, rather than flip
  // between two walled-in enemies every tick: battle 2's last round ends 30 ticks sooner, at tick 153.
  assert.deepEqual(shape(once), [...time(1, 2), "1.3 nexus@136", ...time(2, 7), "2.8 nexus@153", ...time(3, 8)])
})

test("on the screen, a won battle opens on the draft, the choice settles it, and the session moves to the round it makes", { timeout: 60_000 }, () => {
  const { planned, resolved } = toBattleEnd(balanced)
  const waiting = RUN_PLAY.nextRound(planned.context, planned.state, resolved)
  assert.ok(waiting?.runDraft !== undefined)
  const viewport = buildLayout({ columns: 80, rows: 24 }, waiting.grid).viewport
  const session = new BuildSession({ context: waiting, cursor: nexusTile(waiting) ?? { x: 0, y: 0 }, viewport, draft: RUN_PLAY.draft as NonNullable<typeof RUN_PLAY.draft>, keep: RUN_PLAY.keep, scenes: true })
  assert.equal(session.state.popup, "run-draft", "the round opens on the draft")
  session.dispatch({ kind: "cancel" })
  assert.equal(session.state.popup, "run-draft", "it cannot be dismissed")
  session.dispatch({ kind: "draft-requisition" })
  assert.equal(session.round.runDraft, undefined, "the session moved on to the round the choice makes")
  assert.equal(positionOf(session.round).run.requisition, 15)
  assert.deepEqual(session.round.round, { number: 1, of: 8, stage: "battle 2 of 3" })
  assert.notEqual(session.state.popup, "run-draft")
})
