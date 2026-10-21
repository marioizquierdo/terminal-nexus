// A formation a duel player chooses (docs/system-design/duels.md, "How tight an army fights: formations"): its buildings that
// train units set touching in a block, or set apart, so how tight its army fights is a choice a script, a model or a
// measurement can make. Here: each formation places within the Build Phase's rules on the Crossing from both ends,
// mirrored, round after round; a block's producers touch and an apart's do not; the plan, the round's record and the
// measurement name the formation; the brief explains it; and a spec that names no formation plays what it played.

import { test } from "node:test"
import assert from "node:assert/strict"
import { roundLines } from "../src/cli/duel.ts"
import type { DuelState, Formation, RoundReport, SidePlan } from "../src/duel/index.ts"
import { APART_GAP, briefOf, duelArmy, loadoutOf, newDuel, playRound, readPlan, SCRIPTED, scriptedName, scriptedPlayer } from "../src/duel/index.ts"
import { footprintDistance, footprintSteps } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import type { MeasureSpec } from "../src/measure/index.ts"
import { jobsOf, LEVEL_PLANS, measureDuel, mergeMeasurements, pairingIndex, playerPairs, QUICK_SPEC, runSpec, summaryLines } from "../src/measure/index.ts"

const WIDTH = 72

/** Where each of a side's buildings went, from its report's "card at x,y". */
const anchorsOf = (report: RoundReport, side: "A" | "B"): Coord[] =>
  report.sides[side].built.map((line) => {
    const [x, y] = (/ at (\d+),(\d+)$/u.exec(line) ?? []).slice(1).map(Number)
    return { x: x as number, y: y as number }
  })

/** Two rounds of a side building `count` then `more` of `building` forward by `formation`, both sides alike, holding
 *  through a battle too short to reach anything, so the first round's buildings stand in the second. */
function twoRounds(commander: string, building: string, formation: Formation): RoundReport[] {
  const plan = (count: number): SidePlan => ({ power: 0, build: Array.from({ length: count }, () => ({ building, at: "forward" as const })), formation, stance: "hold" })
  let state: DuelState = newDuel({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 24, commanders: { A: commander, B: commander } })
  const reports: RoundReport[] = []
  for (const count of [3, 5]) {
    const played = playRound(state, { A: plan(count), B: plan(count) })
    reports.push(played.report)
    state = played.state
  }
  return reports
}

for (const [commander, building] of [
  ["vasse", "hatchery"],
  ["dob", "den"],
] as const) {
  test(`each formation places ${commander}'s ${building}s within the rules from both ends of the Crossing, one side the other's mirror`, () => {
    const footprint = loadoutOf(duelArmy(commander), { kept: [] }).registry.get(duelArmy(commander).buildings.find((card) => card.id === building)?.structure ?? "").footprint
    const width = Math.max(...footprint.map((tile) => tile.x)) + 1
    for (const formation of ["block", "apart"] as const) {
      const reports = twoRounds(commander, building, formation)
      const standing: Coord[] = []
      for (const report of reports) {
        const a = anchorsOf(report, "A")
        const b = anchorsOf(report, "B")
        // Built by the round's own rules (it refuses what it cannot place, and says why), as many as credits allow.
        assert.ok(a.length >= 2, `${formation}, round ${report.round}: built ${report.sides.A.built.join("; ")}`)
        assert.ok(report.sides.A.refused.every((why) => /costs \d+, \d+ left/u.test(why)), report.sides.A.refused.join("; "))
        assert.deepEqual(
          b,
          a.map((anchor) => ({ x: WIDTH - anchor.x - width, y: anchor.y })),
          `${formation}, round ${report.round}: side B's buildings are not side A's mirrored`,
        )
        assert.equal(report.sides.A.formation, formation, "the round's record names the formation")
        standing.push(...a)
        const others = (anchor: Coord): Coord[] => standing.filter((other) => other !== anchor)
        if (formation === "block") {
          // Every producer touches another along a side.
          for (const anchor of standing) {
            assert.ok(
              others(anchor).some((other) => footprintSteps(anchor, footprint, other, footprint) === 1),
              `${formation}, round ${report.round}: ${anchor.x},${anchor.y} touches none of ${standing.map((tile) => `${tile.x},${tile.y}`).join(" ")}`,
            )
          }
        } else {
          // None touches another; in the first round, each stands the whole gap from the others.
          for (const anchor of standing) {
            for (const other of others(anchor)) {
              const distance = footprintDistance(anchor, footprint, other, footprint)
              assert.ok(footprintSteps(anchor, footprint, other, footprint) > 1, `${formation}: ${anchor.x},${anchor.y} touches ${other.x},${other.y}`)
              if (report.round === 1) assert.ok(distance >= APART_GAP, `round 1: ${anchor.x},${anchor.y} is ${distance} from ${other.x},${other.y}`)
            }
          }
        }
      }
    }
  })
}

test("a scripted player plays by a formation under a name that says it, and the record and the round's lines carry it", { timeout: 60_000 }, () => {
  assert.deepEqual(scriptedName("rush-block"), { script: "rush", formation: "block" })
  assert.deepEqual(scriptedName("turtle"), { script: "turtle" })
  assert.equal(scriptedName("rush-tight"), undefined)
  assert.equal(scriptedName("sprint-block"), undefined)
  assert.equal(scriptedPlayer("rush"), SCRIPTED.rush, "a bare name is the script as it was")
  const setup = { map: "crossing", seed: 2, rounds: 2, pulseTicks: 240, commanders: { A: "vasse", B: "vasse" } } as const
  const duel = measureDuel(setup, { A: { name: "rush-block", player: scriptedPlayer("rush-block")! }, B: { name: "rush-apart", player: scriptedPlayer("rush-apart")! } })
  assert.deepEqual(duel.players, { A: "rush-block", B: "rush-apart" })
  const state = newDuel(setup)
  const plans = { A: scriptedPlayer("rush-block")!(briefOf(state, "A").data), B: scriptedPlayer("rush-apart")!(briefOf(state, "B").data) }
  assert.deepEqual([plans.A.formation, plans.B.formation], ["block", "apart"])
  assert.match(plans.A.note ?? "", /built as a block$/u)
  const { report } = playRound(state, plans)
  assert.deepEqual([report.sides.A.formation, report.sides.B.formation], ["block", "apart"])
  assert.match(roundLines(report).join("\n"), /built \d+ \(block\)[\s\S]*built \d+ \(apart\)/u)
  // A plan that names none has none in its record.
  assert.equal(playRound(state, { A: SCRIPTED.rush!(briefOf(state, "A").data), B: plans.B }).report.sides.A.formation, undefined)
})

test("zones is how every plan placed before formations: the same duel, building for building and tick for tick", { timeout: 60_000 }, () => {
  const setup = { map: "crossing", seed: 1, rounds: 2, pulseTicks: 300, commanders: { A: "averno", B: "dob" } } as const
  for (const script of ["balanced", "turtle"]) {
    const bare = measureDuel(setup, { A: { name: "x", player: scriptedPlayer(script)! }, B: { name: "x", player: scriptedPlayer(script)! } })
    const zoned = measureDuel(setup, { A: { name: "x", player: scriptedPlayer(`${script}-zones`)! }, B: { name: "x", player: scriptedPlayer(`${script}-zones`)! } })
    assert.deepEqual(zoned, bare, `${script}-zones played otherwise than ${script}`)
  }
})

test("a model's plan states a formation, read like any other field, and the brief says what a formation wins and loses", () => {
  const read = readPlan('{"power": 0, "build": ["den"], "formation": "apart", "stance": "attack"}')
  assert.deepEqual(read.plan, { power: 0, build: [{ building: "den" }], formation: "apart", stance: "attack" })
  assert.deepEqual(read.problems, [])
  const wrong = readPlan('{"build": [], "formation": "tight", "stance": "hold"}')
  assert.equal(wrong.plan.formation, undefined)
  assert.deepEqual(wrong.problems, ['"formation" should be "block", "apart", "zones"; each building goes where its "at" says'])
  const brief = briefOf(newDuel({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 240, commanders: { A: "vasse", B: "dob" } }), "A")
  for (const words of ["## How tight your army fights", "come out on the roofs", "an area attack catches few", '"formation"', '"block"', '"apart"', "What their buildings can train", "bursts for"]) {
    assert.ok(brief.text.includes(words), `the brief does not say ${words}`)
  }
  assert.ok(brief.data.enemy.trains.some((line) => line.startsWith("Den:")))
})

const TINY: MeasureSpec = {
  name: "tiny",
  seeds: [1],
  scenarios: "routes",
  duels: { map: "pocket", rounds: 2, pulseTicks: 240, commanders: ["vasse", "dob"], players: ["rush"], formations: ["block", "apart"] },
  levels: [],
  plans: LEVEL_PLANS,
}

test("a measurement sets formations against each other from both ends, splits and merges them in order, and says who won by formation", { timeout: 120_000 }, () => {
  // Without formations, a spec plays each player against itself under its bare name, as it did.
  assert.deepEqual(playerPairs(QUICK_SPEC.duels, "balanced"), [{ A: "balanced", B: "balanced" }])
  assert.equal(QUICK_SPEC.duels.formations, undefined)
  assert.deepEqual(playerPairs(TINY.duels, "rush"), [
    { A: "rush-block", B: "rush-apart" },
    { A: "rush-apart", B: "rush-block" },
  ])
  assert.deepEqual(playerPairs({ ...TINY.duels, formations: ["block"] }, "rush"), [{ A: "rush-block", B: "rush-block" }])
  assert.equal(pairingIndex(TINY.duels, { A: "rush-apart", B: "rush-block" }), 1)
  const parts = new Set(["duels"])
  const whole = runSpec(TINY, { scenarios: [], levels: [], parts })
  assert.equal(whole.duels.length, 2 * 2 * 2)
  assert.deepEqual(
    whole.duels.slice(0, 4).map((duel) => duel.players),
    Array.from({ length: 4 }, () => ({ A: "rush-block", B: "rush-apart" })),
  )
  const written = (duels: typeof whole.duels) => ({ spec: "tiny", build: "abc", date: "2026-10-21", routing: "test", msPerTick: 1, scenarios: [], duels, levels: [] })
  const played = jobsOf(TINY, parts).map((job) => written(runSpec({ ...TINY, seeds: job.seeds, duels: { ...TINY.duels, players: job.players, west: job.west } }, { scenarios: [], levels: [], parts }).duels))
  assert.deepEqual(mergeMeasurements([...played].reverse(), TINY).duels, whole.duels)
  const summary = summaryLines(written(whole.duels)).join("\n")
  assert.match(summary, /players set against each other \(8 duels, from both ends\):\n {4}rush-block v rush-apart: rush-block \d, rush-apart \d, draw \d; \d by a Nexus falling/u)
  assert.match(summary, /rush-block met the enemy \d+\.\d columns from its middle/u)
  assert.match(summary, /mirrors: 0,/u, "a Commander against herself under two formations is no mirror")
})

test("a script with area damage buys its army's area building, or what opens it, first; the bare script never does", () => {
  // The scripts value a building by health times damage, which scores a unit that only bursts at nothing; `-area` makes
  // them buy the Battery (mortars) or the Fuse Shed (bombers), and before it opens what it needs standing.
  for (const [commander, area, needed] of [
    ["vasse", "battery", "barracks"],
    ["dob", "fuse-shed", "den"],
  ] as const) {
    const brief = briefOf(newDuel({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 240, commanders: { A: commander, B: commander } }), "A").data
    const building = brief.buildings.find((candidate) => candidate.id === area)
    assert.ok(building !== undefined && building.area === true, `${commander}'s ${area} is not marked as area damage`)
    const plan = scriptedPlayer("rush-area")!(brief)
    assert.equal(plan.build[0]?.building, building.open ? area : needed, `${commander}: ${JSON.stringify(plan.build)}`)
    assert.equal(scriptedPlayer("rush-area-block")!(brief).formation, "block")
    for (const script of ["rush", "balanced", "turtle"]) {
      assert.ok(!SCRIPTED[script]!(brief).build.some((placement) => placement.building === area), `bare ${script} bought the ${area}`)
    }
  }
  assert.deepEqual(scriptedName("rush-area"), { script: "rush-area" })
  assert.deepEqual(scriptedName("rush-area-apart"), { script: "rush-area", formation: "apart" })
})
