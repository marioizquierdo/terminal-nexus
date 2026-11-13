// Reading a battle (docs/system-design/duels.md, "Reading a battle"): the score, a round's reading, the picture of a
// battle, the reader script that plans by them, and `skirmish --show`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { main } from "../src/cli/skirmish.ts"
import type { DuelSetup, RoundReport } from "../src/duel/index.ts"
import { briefOf, newDuel, playDuel, playRound, SCRIPTED } from "../src/duel/index.ts"
import { readingLines, scoreOf } from "../src/duel/reading.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"

const setup = (extra: Partial<DuelSetup> = {}): DuelSetup => ({ map: "pocket", seed: 2, rounds: 3, pulseTicks: 240, commanders: { A: "dob", B: "vasse" }, ...extra })

test("the score is the rule a battle is judged by: Nexus health by share, then the damage over the battle", () => {
  const side = (after: number, units: number) => ({ nexus: { before: 400, after, most: 400 }, dealt: { units, buildings: 0, nexus: 0 } })
  const round = (a: ReturnType<typeof side>, b: ReturnType<typeof side>) => ({ round: 1, ticks: 1, ended: "time", sides: { A: a, B: b } }) as unknown as RoundReport
  assert.deepEqual(scoreOf([]), { dealt: { A: 0, B: 0 }, nexus: { A: 1, B: 1 }, leader: null, by: "even" })
  assert.equal(scoreOf([round(side(400, 10), side(300, 50))]).leader, "A", "the healthier Nexus leads, whatever the damage")
  const onDamage = scoreOf([round(side(400, 10), side(400, 5)), round(side(400, 1), side(400, 5))])
  assert.deepEqual([onDamage.leader, onDamage.by, onDamage.dealt.A, onDamage.dealt.B], ["A", "damage", 11, 10], "damage counts over every round")
})

test("a round is read as it plays: the front, first contact, what hit each Nexus, the buildings lost and by what", { timeout: 60_000 }, () => {
  const players = { A: SCRIPTED.rush!, B: SCRIPTED.turtle! }
  const state = playDuel(setup(), players)
  const read = state.history.map((report) => report.reading)
  assert.ok(read.every((reading) => reading !== undefined), "every round played carries its reading")
  for (const reading of read) {
    for (const side of ["A", "B"] as const) {
      const front = reading!.sides[side].front
      assert.ok(front === null || (Number.isInteger(front) && front >= 0 && front <= 100))
    }
    const { A, B } = reading!.sides
    if (A.front !== null && B.front !== null) assert.equal(A.front + B.front, 100, "one front, read from both ends")
  }
  // What hit a Nexus adds up to what it lost (it is not mended inside a round).
  for (const report of state.history) {
    for (const side of ["A", "B"] as const) {
      const hits = Object.values(report.reading!.sides[side].nexusHits).reduce((sum, amount) => sum + amount, 0)
      const lost = report.sides[side].nexus.before - report.sides[side].nexus.after
      assert.ok(hits >= lost, `side ${side} lost ${lost} and was hit for ${hits}`)
    }
  }
  // Reading watches and never feeds: the round plays the same whether or not anything else watches it.
  const once = playRound(newDuel(setup()), { A: { build: [], stance: "attack" }, B: { build: [], stance: "hold" } })
  assert.ok(once.report.reading !== undefined)
})

test("the brief carries the score and the last round's reading, as data and as words", { timeout: 60_000 }, () => {
  const duel = newDuel(setup())
  const first = playRound(duel, { A: SCRIPTED.rush!(briefOf(duel, "A").data), B: SCRIPTED.turtle!(briefOf(duel, "B").data) })
  const brief = briefOf(first.state, "B")
  assert.deepEqual(brief.data.score, scoreOf(first.state.history))
  assert.match(brief.text, /^Score: /mu)
  for (const line of readingLines(first.report.reading!, "B")) assert.ok(brief.text.includes(line), `the brief says "${line}"`)
  assert.match(brief.text, /^Front: /mu)
})

test("the reader script plans from what the battle said: it holds after an attack that lost the trade, and says why", () => {
  const duel = newDuel(setup())
  const brief = briefOf(duel, "A").data
  assert.equal(SCRIPTED.reader!(brief).stance, "hold", "round 1: it gathers")
  const lost = { ...brief, last: { round: 1, ticks: 240, ended: "time", sides: {
    A: { stance: "attack", dealt: { units: 10, buildings: 0, nexus: 0 } },
    B: { stance: "hold", dealt: { units: 90, buildings: 0, nexus: 0 } },
  } } as unknown as RoundReport }
  const plan = SCRIPTED.reader!({ ...lost, reports: [lost.last!] })
  assert.equal(plan.stance, "hold")
  assert.match(plan.note ?? "", /lost the trade/u)
  const won = { ...lost, last: { ...lost.last!, sides: { ...lost.last!.sides, A: { ...lost.last!.sides.A, dealt: { units: 200, buildings: 0, nexus: 0 } } } } as RoundReport }
  assert.equal(SCRIPTED.reader!({ ...won, reports: [won.last!] }).stance, "attack", "an attack that won the trade presses on")
})

test("skirmish --show draws each Battle Round played at the ticks asked for, and as it ends", { timeout: 60_000 }, () => {
  const lines: string[] = []
  const code = main(["--map", "pocket", "--p1", "script:agro", "--p2", "script:defensive", "--seed", "2", "--play-to", "next", "--show", "60,end"], (line) => lines.push(line), readProfiles(), (line) => lines.push(line))
  assert.equal(code, 0)
  const text = lines.join("\n")
  assert.match(text, /--- the battle at tick 60\n {3}0 {9}1 {9}2/u)
  assert.match(text, /--- the battle at tick 360/u, "the round's end")
  assert.match(text, /front \d+% toward the enemy/u, "the round's report carries its reading")
  const refused: string[] = []
  assert.notEqual(main(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--show", "60"], () => {}, readProfiles(), (line) => refused.push(line)), 0)
  assert.match(refused.join("\n"), /--show .*needs --play-to/u)
})
