// How a battle is measured (docs/system-design/measurement.md, src/measure/): a battle's record says who won, what
// each side lost, how long units stood blocked and how tight an army met the enemy; a duel and a campaign level are
// recorded round by round; and the same inputs measure the same every run.

import { test } from "node:test"
import assert from "node:assert/strict"
import { levelById } from "../src/cli/levels.ts"
import { SCRIPTED } from "../src/duel/index.ts"
import { LEVEL_PLANS, measureDuel, measureLevel, measureScenario, spreadOf, STALL_TICKS, summaryLines } from "../src/measure/index.ts"
import type { Measurement } from "../src/measure/index.ts"
import { loadScenarioFile } from "./helpers.ts"

test("a spread is how far, on average, points stand from their middle, a row counting two columns", () => {
  assert.equal(spreadOf([]), 0)
  assert.equal(spreadOf([{ x: 3, y: 3 }]), 0)
  // Two points four columns apart stand two columns from their middle.
  assert.equal(spreadOf([{ x: 0, y: 0 }, { x: 4, y: 0 }]), 2)
  // Two points two rows apart stand one row, two columns, from theirs.
  assert.equal(spreadOf([{ x: 0, y: 0 }, { x: 0, y: 2 }]), 2)
})

test("a trooper that stands for good above a wall is measured as stalled, and never strikes", async () => {
  const scenario = await loadScenarioFile("route-dead-end.map.json")
  const run = measureScenario(scenario, 1)
  assert.equal(run.battle.winner, null)
  assert.equal(run.battle.reason, "tick-limit")
  assert.equal(run.battle.sides.A.firstContact, null)
  assert.equal(run.battle.sides.A.stalled, 1)
  assert.ok(run.battle.sides.A.longestBlocked >= STALL_TICKS)
})

test("a squad that reaches its target is measured by when it first struck and how tight it stood", async () => {
  const scenario = await loadScenarioFile("route-crowd.map.json")
  const run = measureScenario(scenario, 1)
  assert.equal(run.battle.winner, "A")
  assert.equal(run.battle.reason, "nexus-destroyed")
  assert.equal(run.battle.sides.B.structuresLost, 1)
  assert.ok(run.battle.sides.A.firstContact !== null && run.battle.sides.A.firstContact > 0)
  assert.equal(run.battle.sides.A.unitsAtContact, 8)
  assert.ok((run.battle.sides.A.spreadAtContact ?? 0) > 0)
  assert.ok(run.battle.sides.A.dealt >= 400, "the Nexus's health is what it dealt, at least")
  assert.deepEqual(measureScenario(scenario, 1), run, "the same scenario and seed measured twice differ")
})

test("a duel is measured round by round: the hands dealt, the card kept, each battle and the Nexus left", () => {
  const balanced = SCRIPTED["balanced"]
  assert.ok(balanced !== undefined)
  const setup = { map: "pocket", seed: 3, rounds: 2, pulseTicks: 240, commanders: { A: "vasse", B: "dob" } }
  const duel = measureDuel(setup, { A: { name: "balanced", player: balanced }, B: { name: "balanced", player: balanced } })
  assert.ok(duel.rounds.length >= 1 && duel.rounds.length <= 2)
  for (const round of duel.rounds) {
    assert.ok(round.battle.ticks > 0 && round.battle.ticks <= 240)
    for (const side of ["A", "B"] as const) {
      assert.ok(round.sides[side].nexus <= round.sides[side].nexusMost)
      assert.ok(round.sides[side].kept === null || round.sides[side].hand.includes(round.sides[side].kept))
    }
  }
  assert.deepEqual(measureDuel(setup, { A: { name: "balanced", player: balanced }, B: { name: "balanced", player: balanced } }), duel)
})

test("a campaign level is played by each plan to its end, every round's battle recorded", { timeout: 120_000 }, () => {
  const level = levelById("vasse-test-2")
  assert.ok(level !== undefined)
  const plan = LEVEL_PLANS[0]
  assert.ok(plan !== undefined)
  const run = measureLevel(level, plan)
  assert.equal(run.rounds.length, run.ended.round)
  assert.ok(run.rounds.every((round) => round.bought.length === 0), "nothing built bought something")
  // Her return is this level's point: she falls in round 1.
  assert.notEqual(run.rounds[0]?.battle.sides.A.commanderFellAt ?? null, null)
})

test("a measurement says in plain words what it found", async () => {
  const scenario = await loadScenarioFile("route-dead-end.map.json")
  const measurement: Measurement = {
    spec: "test",
    build: "abc1234",
    date: "2026-10-20",
    routing: "the greedy step",
    msPerTick: 0.25,
    scenarios: [measureScenario(scenario, 1), measureScenario(scenario, 2)],
    duels: [],
    levels: [],
  }
  const text = summaryLines(measurement).join("\n")
  assert.match(text, /routes: the greedy step/u)
  assert.match(text, /route-dead-end\s+A won 0\/2/u)
  assert.match(text, /stalled units 2/u)
})
