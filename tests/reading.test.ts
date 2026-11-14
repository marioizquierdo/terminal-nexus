// Reading a battle (docs/system-design/battles.md, "Reading a battle"): the score, a round's reading, the picture of a
// battle, the reader script that plans by them, and `skirmish --show`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { main } from "../src/cli/skirmish.ts"
import type { BattleSetup, RoundReport } from "../src/battle/index.ts"
import { briefOf, beginBattle, playToEnd, playRound, SCRIPTED } from "../src/battle/index.ts"
import { hashOf } from "../src/state/canonical.ts"
import { readingLines, scoreOf } from "../src/battle/reading/index.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"

const setup = (extra: Partial<BattleSetup> = {}): BattleSetup => ({ map: "pocket", seed: 2, rounds: 3, pulseTicks: 240, commanders: { A: "dob", B: "vasse" }, ...extra })

test("the score is the rule a battle is judged by: Nexus health by share, then the damage over the battle", () => {
  const side = (after: number, units: number) => ({ nexus: { before: 400, after, most: 400 }, dealt: { units, buildings: 0, nexus: 0 } })
  const round = (a: ReturnType<typeof side>, b: ReturnType<typeof side>) => ({ round: 1, ticks: 1, ended: "time", sides: { A: a, B: b } }) as unknown as RoundReport
  assert.deepEqual(scoreOf([]), { dealt: { A: 0, B: 0 }, nexus: { A: 1, B: 1 }, leader: null, by: "even" })
  assert.equal(scoreOf([round(side(400, 10), side(300, 50))]).leader, "A", "the healthier Nexus leads, whatever the damage")
  const onDamage = scoreOf([round(side(400, 10), side(400, 5)), round(side(400, 1), side(400, 5))])
  assert.deepEqual([onDamage.leader, onDamage.by, onDamage.dealt.A, onDamage.dealt.B], ["A", "damage", 11, 10], "damage counts over every round")
})

test("a round is read as it plays: each army and its losses with their value, the buildings, the advance, the damage by source, the engagements", { timeout: 60_000 }, () => {
  const state = playToEnd(setup(), { A: SCRIPTED.rush!, B: SCRIPTED.turtle! })
  for (const report of state.history) {
    const reading = report.reading!
    assert.ok(reading !== undefined, "every round played carries its reading")
    for (const side of ["A", "B"] as const) {
      const own = reading.sides[side]
      // The army's and the buildings' losses are the round report's losses, counted again.
      const lost = Object.values(report.sides[side].lost).reduce((sum, count) => sum + count, 0)
      const buildingsLost = Object.values(own.buildings.lost).reduce((sum, count) => sum + count, 0)
      assert.equal(own.army.lost.count + buildingsLost, lost, `side ${side}'s losses in round ${report.round}`)
      for (const at of [own.advance.start, own.advance.end]) assert.ok(at === null || (Number.isInteger(at) && at >= 0 && at <= 100))
      // The Nexus is a building like any other: hurt, it is among the damaged.
      if (report.sides[side].nexus.after > 0 && report.sides[side].nexus.after < report.sides[side].nexus.most) {
        assert.ok(own.buildings.damaged.some((building) => building.hp === report.sides[side].nexus.after), `side ${side}'s hurt Nexus is listed`)
      }
      const taken = Object.values(own.damage.taken).reduce((sum, amount) => sum + amount, 0)
      assert.ok(own.damage.own <= taken)
    }
    for (const engagement of reading.engagements) {
      assert.ok(engagement.start <= engagement.end)
      assert.ok(engagement.sides.A.dealt + engagement.sides.B.dealt > 0, "an engagement is where someone was hit")
    }
    for (const side of ["A", "B"] as const) {
      // Every hit lands in an engagement, the killing blow included (the unit it kills is gone from the tick's state).
      const inEngagements = reading.engagements.reduce((sum, engagement) => sum + engagement.sides[side].dealt, 0)
      const dealt = report.sides[side].dealt
      assert.equal(inEngagements, dealt.units + dealt.buildings + dealt.nexus, `side ${side}'s damage in round ${report.round} is all in its engagements`)
    }
    const starts = reading.engagements.map((engagement) => engagement.start)
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), "engagements in the order they began")
  }
  // A reading is whole numbers, as everything a battle's state keeps (it is saved and hashed with it).
  assert.doesNotThrow(() => hashOf(state))
})

test("the brief carries the score and the last round's reading, as data and as words", { timeout: 60_000 }, () => {
  const battle = beginBattle(setup())
  const first = playRound(battle, { A: SCRIPTED.rush!(briefOf(battle, "A").data), B: SCRIPTED.turtle!(briefOf(battle, "B").data) })
  const brief = briefOf(first.state, "B")
  assert.deepEqual(brief.data.score, scoreOf(first.state.history))
  assert.match(brief.text, /^Score: /mu)
  for (const line of readingLines(first.report.reading!, "B")) assert.ok(brief.text.includes(line), `the brief says "${line}"`)
  assert.match(brief.text, /^Advance \(0% your Nexus, 100% theirs\): /mu)
  assert.match(brief.text, /^Public and private: /mu)
  // What is private stays out of the other side's brief, as data too.
  const theirs = brief.data.last!.sides.A as Record<string, unknown>
  for (const key of ["credits", "spent", "earned", "hand", "refused", "note"]) assert.equal(theirs[key], undefined, `the enemy's ${key} is private`)
  assert.equal(typeof brief.data.last!.sides.B.credits, "number", "its own credits it may read")
})

test("the reactive script plans from what the battle said: it holds after an attack that lost the trade, and says why", () => {
  const battle = beginBattle(setup())
  const brief = briefOf(battle, "A").data
  assert.equal(SCRIPTED.reactive!(brief).stance, "hold", "round 1: it gathers")
  const lost = { ...brief, last: { round: 1, ticks: 240, ended: "time", sides: {
    A: { stance: "attack", dealt: { units: 10, buildings: 0, nexus: 0 } },
    B: { stance: "hold", dealt: { units: 90, buildings: 0, nexus: 0 } },
  } } as unknown as RoundReport }
  const plan = SCRIPTED.reactive!({ ...lost, reports: [lost.last!] })
  assert.equal(plan.stance, "hold")
  assert.match(plan.note ?? "", /lost the trade/u)
  const won = { ...lost, last: { ...lost.last!, sides: { ...lost.last!.sides, A: { ...lost.last!.sides.A, dealt: { units: 200, buildings: 0, nexus: 0 } } } } as RoundReport }
  assert.equal(SCRIPTED.reactive!({ ...won, reports: [won.last!] }).stance, "attack", "an attack that won the trade presses on")
})

test("skirmish --show draws each Battle Round played at the ticks asked for, and as it ends", { timeout: 60_000 }, () => {
  const lines: string[] = []
  const code = main(["--map", "pocket", "--p1", "script:agro", "--p2", "script:defensive", "--seed", "2", "--play-to", "next", "--show", "60,end"], (line) => lines.push(line), readProfiles(), (line) => lines.push(line))
  assert.equal(code, 0)
  const text = lines.join("\n")
  assert.match(text, /--- ASCII screenshot at tick 60\n {3}0 {9}1 {9}2/u)
  assert.match(text, /^Legend: .*\(p1\)/mu)
  assert.match(text, /^Overlaps \(the top one is what is drawn\): /mu)
  assert.match(text, /--- ASCII screenshot at tick 360 \(the round's end\)/u)
  assert.match(text, /p1: army \d+ \(\d+\) -> /u, "the round's report carries its reading")
  const refused: string[] = []
  assert.notEqual(main(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--show", "60"], () => {}, readProfiles(), (line) => refused.push(line)), 0)
  assert.match(refused.join("\n"), /--show .*needs --play-to/u)
  assert.match(text, /^Standing: p1 Nexus (\d+\/\d+|fallen), \d+ units?; p2 Nexus /mu, "each picture says what it cannot show: Nexus health and units")
  const many: string[] = []
  assert.notEqual(main(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--seeds", "1-2", "--play-to", "end", "--show", "0"], () => {}, readProfiles(), (line) => many.push(line)), 0)
  assert.match(many.join("\n"), /--show: an ASCII screenshot is of one battle/u)
  const past: string[] = []
  main(["--map", "pocket", "--p1", "script:agro", "--p2", "script:agro", "--play-to", "next", "--show", "9999"], (line) => past.push(line), readProfiles(), () => {})
  assert.match(past.join("\n"), /not drawn: tick 9999 is past this round's end/u)
})

test("skirmish --json writes only data on stdout, a brief a line, and the round-1 brief names the starting troops", () => {
  const out: string[] = []
  const err: string[] = []
  assert.equal(main(["--map", "pocket", "--p1", "build:", "--p2", "script:reactive", "--json"], (line) => out.push(line), readProfiles(), (line) => err.push(line)), 0)
  const briefs = out.map((line) => JSON.parse(line) as { slot: string; yours: { units: Record<string, number> } })
  assert.equal(briefs.length, 1)
  assert.equal(briefs[0]?.slot, "p1")
  assert.ok(Object.keys(briefs[0]?.yours.units ?? {}).length > 0, "round 1's brief lists the Commander and its starting troops")
  assert.ok(err.length > 0, "the opening line goes to stderr")
})
