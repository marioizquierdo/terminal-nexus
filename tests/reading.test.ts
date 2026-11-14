// Reading a battle (docs/system-design/battles.md, "Reading a battle"): the score, a round's reading, the picture of a
// battle, the reader script that plans by them, and `skirmish --show`.

import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"
import { main } from "../src/cli/skirmish.ts"
import type { BattleSetup, RoundReport } from "../src/battle/index.ts"
import { briefOf, beginBattle, playToEnd, playRound, SCRIPTED } from "../src/battle/index.ts"
import { hashOf } from "../src/state/canonical.ts"
import { dealtOf, lostCount, lostOf, nameOf, readingLines, scoreOf } from "../src/battle/reading/index.ts"
import { readProfiles } from "../src/skirmish/profile-files.ts"

const setup = (extra: Partial<BattleSetup> = {}): BattleSetup => ({ map: "pocket", seed: 2, rounds: 3, pulseTicks: 240, commanders: { A: "dob", B: "vasse" }, ...extra })

test("the score is the rule a battle is judged by: Nexus health by share, then the damage over the battle", () => {
  const side = (after: number, units: number) => ({ buildings: { nexus: { before: 400, after, most: 400 } }, damage: { dealt: { units, buildings: 0, nexus: 0 } } })
  const round = (a: ReturnType<typeof side>, b: ReturnType<typeof side>) => ({ round: 1, ticks: 1, ended: "time", sides: {}, reading: { sides: { A: a, B: b } } }) as unknown as RoundReport
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
      // Everything it lost is the units and the buildings, counted by content id.
      const lost = Object.values(lostOf(own)).reduce((sum, count) => sum + count, 0)
      assert.equal(lostCount(own), lost, `side ${side}'s losses in round ${report.round}`)
      for (const at of [own.advance.start, own.advance.end]) assert.ok(at === null || (Number.isInteger(at) && at >= 0 && at <= 100))
      // The Nexus is a building like any other: hurt, it is among the damaged.
      const { nexus } = own.buildings
      if (nexus.after > 0 && nexus.after < nexus.most) {
        assert.ok(own.buildings.damaged.some((building) => building.hp === nexus.after), `side ${side}'s hurt Nexus is listed`)
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
      assert.equal(inEngagements, dealtOf(reading.sides[side]), `side ${side}'s damage in round ${report.round} is all in its engagements`)
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
  const dealing = (units: number) => ({ advance: { closest: null }, damage: { dealt: { units, buildings: 0, nexus: 0 } } })
  const lost = { ...brief, last: { round: 1, ticks: 240, ended: "time", sides: {
    A: { stance: "attack" },
    B: { stance: "hold" },
  }, reading: { sides: { A: dealing(10), B: dealing(90) } } } as unknown as RoundReport }
  const plan = SCRIPTED.reactive!({ ...lost, reports: [lost.last!] })
  assert.equal(plan.stance, "hold")
  assert.match(plan.note ?? "", /lost the trade/u)
  const won = { ...lost, last: { ...lost.last!, reading: { sides: { ...lost.last!.reading.sides, A: dealing(200) } } } as unknown as RoundReport }
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

// The numbers a battle's rounds add up to, fixed before the one reader replaced the second: for each side of each round,
// what it fielded, trained, lost and killed, the damage it dealt, its Nexus's health, its Commander's fall and what its
// abilities did, as the round report gave them then (tests/fixtures/battle-numbers.json, seed 2, every pairing, both
// maps). The reading must give the same, counted by card name.
test("the reading's totals are what the round report's battle numbers were: the same seed, the same sums", { timeout: 120_000 }, () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/battle-numbers.json", import.meta.url), "utf8")) as Record<string, readonly Record<string, any>[]>
  const pairings: readonly (readonly [string, string, string, string])[] = [
    ["rush", "turtle", "averno", "dob"],
    ["balanced", "reactive", "dob", "vasse"],
    ["reactive", "rush", "vasse", "averno"],
    ["turtle", "balanced", "averno", "dob"],
  ]
  const byName = (counts: Readonly<Record<string, number>>): Record<string, number> => {
    const named: Record<string, number> = {}
    for (const [contentId, count] of Object.entries(counts)) named[nameOf(contentId)] = (named[nameOf(contentId)] ?? 0) + count
    return named
  }
  const sorted = (record: Readonly<Record<string, number>>): [string, number][] => Object.entries(record).sort(([a], [b]) => a.localeCompare(b))
  let sides = 0
  for (const map of ["crossing", "pocket"]) {
    for (const [a, b, commanderA, commanderB] of pairings) {
      const key = `${map}/2/${a}-${b}`
      const state = playToEnd({ map, seed: 2, rounds: 4, pulseTicks: 240, commanders: { A: commanderA, B: commanderB } } as BattleSetup, { A: SCRIPTED[a]!, B: SCRIPTED[b]! })
      const expected = fixture[key]!
      assert.equal(state.history.length, expected.length, `${key}: rounds played`)
      state.history.forEach((report, index) => {
        for (const side of ["A", "B"] as const) {
          const enemy = side === "A" ? "B" : "A"
          const read = report.reading.sides[side]
          const was = expected[index]![side]
          const where = `${key} round ${report.round} side ${side}`
          assert.deepEqual(sorted(byName(read.army.start.counts)), sorted(was.fielded), `${where}: fielded`)
          assert.deepEqual(sorted(byName(read.army.trained.counts)), sorted(was.trained), `${where}: trained`)
          assert.deepEqual(sorted(byName(lostOf(read))), sorted(was.lost), `${where}: lost`)
          assert.deepEqual(sorted(byName(lostOf(report.reading.sides[enemy]))), sorted(was.killed), `${where}: killed`)
          assert.deepEqual(read.damage.dealt, was.dealt, `${where}: dealt`)
          assert.deepEqual(read.buildings.nexus, was.nexus, `${where}: Nexus`)
          assert.equal(read.army.commanderFell, was.commanderFell, `${where}: the Commander fell`)
          assert.deepEqual(sorted(read.army.abilities), sorted(was.abilities), `${where}: abilities`)
          sides += 1
        }
      })
    }
  }
  assert.ok(sides >= 60, "a fair number of rounds were compared")
})
