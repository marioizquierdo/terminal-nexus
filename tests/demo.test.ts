// The demo (src/run/demo.ts, docs/game-design/demo.md): two short battles made to be shown, each one duel on the Crossing,
// played on the Build Phase screen as a run's battle is. What is pinned: the duel's two opening hooks (troops mustered,
// credits set), the showman as a pure function of the brief, the two builds as a driver plays them (a plain plan wins
// the mirror in its last round, doing nothing loses it, the battle opens as a field of dozens), that the same demo
// plays the same every time, and what the screen says as each opens.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { Player } from "../src/duel/index.ts"
import { SCRIPTED, briefOf, newDuel, playDuel, playRound, scriptedPlayer } from "../src/duel/index.ts"
import { RUN_PLAY, driveRun, playedOf, runLevel } from "../src/cli/run-play.ts"
import { DEMOS, DEMO_BUILDS, demoDefinition, demoOpening, demoSetup } from "../src/run/index.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import { buildLayout } from "../src/build/layout.ts"

const idle: Player = () => ({ build: [], stance: "attack" })
/** A person who builds what the balanced script builds and sends the army out every round, as the Build Phase does. */
const plain: Player = (brief) => ({ ...(scriptedPlayer("balanced") as Player)(brief), stance: "attack" })

const total = (counts: Readonly<Record<string, number>>): number => Object.values(counts).reduce((sum, count) => sum + count, 0)

test("a duel can open with troops mustered and credits set, and opens as it always did without them", { timeout: 60_000 }, () => {
  const base = { map: "crossing", seed: 3, rounds: 1, pulseTicks: 120, commanders: { A: "vasse", B: "dob" } } as const
  const muster = { A: [{ unit: "unit.citizen.trooper", count: 7 }] }
  const none = { build: [], stance: "attack" } as const
  const plain = playRound(newDuel(base), { A: none, B: none })
  const bigger = playRound(newDuel({ ...base, muster, credits: { A: 250 } }), { A: none, B: none })
  assert.equal((bigger.report.sides.A.fielded["Trooper"] ?? 0) - (plain.report.sides.A.fielded["Trooper"] ?? 0), 7)
  assert.equal(bigger.report.sides.B.fielded["Runner"], plain.report.sides.B.fielded["Runner"], "the other side is untouched")
  assert.equal(plain.report.sides.A.credits, 100)
  assert.equal(bigger.report.sides.A.credits, 250)
})

test("the showman is a pure function of the brief, and plays its four beats a round apart", { timeout: 60_000 }, () => {
  const showman = SCRIPTED["showman"] as Player
  const state = newDuel({ ...DEMOS.mirror.duel })
  const brief = briefOf(state, "B").data
  assert.deepEqual(showman(brief), showman(brief))
  const beat = (round: number) => showman({ ...brief, round, credits: 200 })
  assert.equal(beat(1).stance, "attack")
  assert.equal(beat(2).stance, "hold", "the build-up holds at home")
  assert.equal(beat(3).stance, "attack")
  assert.equal(beat(4).stance, "attack")
  assert.match(beat(2).note ?? "", /build-up/u)
  assert.ok(beat(1).build.length <= 2, "the probe is two cheap producers at most")
  assert.ok(beat(4).build.length >= beat(1).build.length, "the all-in spends more than the probe")
  // It never reads what the other side has.
  assert.deepEqual(showman({ ...brief, enemy: { ...brief.enemy, buildings: ["Barracks", "Barracks"], units: { Trooper: 40 } } }), showman(brief))
})

test("a demo is a run of one battle on the Crossing, against Dob Hunter, with its own seed", () => {
  for (const build of DEMO_BUILDS) {
    const definition = demoDefinition(demoSetup(build))
    assert.equal(definition.battles.length, 1)
    assert.equal(definition.battles[0]?.opponent, "dob")
    assert.equal(definition.battles[0]?.duel.map, "crossing")
    assert.deepEqual(definition.battles[0]?.duel, DEMOS[build].duel)
  }
  assert.ok(DEMOS.mirror.duel.rounds * 30 <= 5 * 60 && DEMOS.mirror.duel.rounds >= 3, "the mirror's Battle Rounds fit two to five minutes with the building between")
})

test("the mirror: a plain plan fells the enemy Nexus in the last round, doing nothing loses, and it is the same every time", { timeout: 120_000 }, () => {
  const won = driveRun(demoSetup("mirror"), plain)
  assert.deepEqual(won.run.played, [{ battle: 1, outcome: "won", by: "nexus", round: 4 }])
  assert.equal(won.rounds.length, 4)
  assert.ok(won.rounds.at(-1)!.report.ticks > 120, "it is a finish, not a walkover from the first tick")
  assert.equal(won.rounds[0]?.report.sides.B.credits, 220, "the Ravel open with a war chest")
  assert.deepEqual(driveRun(demoSetup("mirror"), plain).rounds.map((round) => round.report), won.rounds.map((round) => round.report), "the same demo plays the same")
  const lost = driveRun(demoSetup("mirror"), idle)
  assert.equal(lost.run.played[0]?.outcome, "lost")
  assert.ok(lost.rounds.some((round) => round.report.sides.A.nexus.after < round.report.sides.A.nexus.most), "a player who does nothing sees their Nexus attacked")
})

test("the battle opens as two armies in the field, dozens a side, and a plain plan wins it", { timeout: 120_000 }, () => {
  const driven = driveRun(demoSetup("battle"), plain)
  const first = driven.rounds[0]!.report
  assert.ok(total(first.sides.A.fielded) >= 30, `side A fielded ${total(first.sides.A.fielded)}`)
  assert.ok(total(first.sides.B.fielded) >= 40, `side B fielded ${total(first.sides.B.fielded)}`)
  assert.equal(driven.run.played[0]?.outcome, "won")
  assert.equal(driven.rounds.length <= 3, true)
})

test("the screen opens a demo on its words: the game, Vasse and Dob Hunter each speak, and the battle banner is not offered", { timeout: 60_000 }, () => {
  for (const build of DEMO_BUILDS) {
    const opened = runLevel(demoSetup(build)).firstRound()
    assert.deepEqual(
      opened.scene?.map((line) => [line.speaker, line.side]),
      demoOpening(build).map((line) => (line.who === "vasse" ? ["Edda Vasse", "A"] : line.who === "enemy" ? ["Dob Hunter", "B"] : [null, null])),
    )
    assert.equal(opened.round?.stage, DEMOS[build].title.toLowerCase())
    assert.equal(opened.experiments?.battleBanner, "off")
  }
  const start = runBuildPlaytest({ steps: parseKeyScript("Esc s"), at: playtestOpening({ at: "demo?build=battle" }).at })
  const text = frameToText(start.frames.at(-1)!.frame)
  assert.match(text, /the grand battle - round 1 of 3/u)
  assert.match(text, /Battle Round 1: Enter starts it/u, "the plain start, not the banner's")
})

test("a demo that ends opens the same demo again, on how it ended", { timeout: 120_000 }, () => {
  let context: BuildContext = withoutScene(runLevel(demoSetup("mirror")).firstRound())
  for (let round = 1; round <= 4; round += 1) {
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
    const state = createBuildState(context, nexusTile(context) ?? { x: 0, y: 0 }, viewport)
    const resolved = RUN_PLAY.startPulse(context, state)
    assert.ok(resolved !== null)
    const played = playedOf(resolved)
    assert.ok(played !== undefined)
    const next = RUN_PLAY.nextRound(context, state, resolved)
    assert.ok(next !== null)
    if (played.run.over) {
      // Nobody planned anything, so the Ravel fell on the Nexus before the last round.
      assert.equal(resolved.mission?.ending?.goOn, "Play again")
      assert.equal(next.round?.number, 1, "the demo starts again from its first round")
      assert.equal(next.round?.stage, "the mirror")
      assert.match(next.scene?.[0]?.text ?? "", /The Mirror: lost\./u)
      return
    }
    assert.equal(resolved.mission?.ending, undefined)
    context = withoutScene(next)
  }
  assert.fail("the idle mirror never ended")
})

test("playDuel with the showman is deterministic across seeds", { timeout: 120_000 }, () => {
  const setup = { ...DEMOS.mirror.duel, seed: 5 }
  const a = playDuel(setup, { A: plain, B: SCRIPTED["showman"] as Player })
  const b = playDuel(setup, { A: plain, B: SCRIPTED["showman"] as Player })
  assert.deepEqual(a.history, b.history)
})
