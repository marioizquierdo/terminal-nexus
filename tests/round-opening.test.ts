// How a Battle Round opens (src/battle/round-opening.ts): one function, used by `playRound` for the battle and by the
// Skirmish's Build Phase screen for what it draws arriving see-through, so the two cannot drift apart.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../src/build/state.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { BattleState, Side } from "../src/battle/index.ts"
import { SIDES, armyOf, beginBattle, loadoutOf, playRound, restoredOf, roundOpening } from "../src/battle/index.ts"
import { newSkirmishLevel, positionOf } from "../src/cli/skirmish-play.ts"
import type { MatchState } from "../src/state/types.ts"

const NONE = { build: [], stance: "attack" } as const

const contentOf = (battle: BattleState) => ({
  A: loadoutOf(armyOf(battle, "A"), battle.sides.A).registry,
  B: loadoutOf(armyOf(battle, "B"), battle.sides.B).registry,
})

type Seen = readonly [string, string, number, number]

/** What stands in a state that is not an obstacle, as comparable rows: player, content, y, x. */
function unitsOf(state: MatchState, battle: BattleState, skip: ReadonlySet<string> = new Set()): Seen[] {
  const content = contentOf(battle)
  return state.entities
    .filter((entity) => !skip.has(entity.id) && content[entity.player as Side].get(entity.contentId).layer !== "obstacles")
    .map((entity): Seen => [entity.player, entity.contentId, entity.anchor.y, entity.anchor.x])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2] || a[3] - b[3]))
}

/** What a context's incoming entities are, as the same rows. */
function incomingOf(context: BuildContext): Seen[] {
  return [...(context.incoming ?? [])]
    .map((entity): Seen => [entity.player, entity.contentId, entity.anchor.y, entity.anchor.x])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2] || a[3] - b[3]))
}

/** The first state `playRound` hands its watcher for a battle played on empty plans. */
function firstWatched(battle: BattleState): MatchState {
  let first: MatchState | null = null
  playRound(battle, { A: NONE, B: NONE }, (state) => {
    first ??= state
  })
  assert.ok(first !== null, "the round was never watched")
  return first
}

test("round 1 opens with each side's Commander and starting units beside its Nexus", { timeout: 60_000 }, () => {
  const state = beginBattle({ map: "crossing", commanders: { A: "vasse", B: "dob" }, seed: 1, rounds: 8, pulseTicks: 360 })
  const sides = contentOf(state)
  const opened = roundOpening(state, { sides, callups: { A: [], B: [] } })
  assert.equal(opened.restored, null)
  for (const side of SIDES) {
    const { commander } = armyOf(state, side)
    const starting = commander.start.reduce((total, { count }) => total + count, 0)
    const own = opened.state.entities.filter((entity) => entity.player === side && sides[side].get(entity.contentId).layer !== "obstacles")
    assert.equal(own.length, 1 + starting, `${side}: Commander and starting units`)
  }
})

test("the screen's arrivals are the battle's opening", { timeout: 60_000 }, () => {
  const context = newSkirmishLevel(1).firstRound()
  const { battle } = positionOf(context)
  assert.ok((context.incoming ?? []).length > 0, "round 1 shows something arriving")
  assert.deepEqual(incomingOf(context), unitsOf(firstWatched(battle), battle))
})

test("round 2's arrivals are the battle's opening less who was already standing", { timeout: 120_000 }, () => {
  const level = newSkirmishLevel(1)
  const one = withoutScene(level.firstRound())
  const viewport = buildLayout({ columns: 80, rows: 24 }, one.grid).viewport
  const state = createBuildState(one, nexusTile(one) ?? STARTER_START_CURSOR, viewport)
  const resolved = level.play.startPulse(one, state)
  assert.ok(resolved !== null, "round 1 did not start")
  const two = level.play.nextRound(one, state, resolved)
  assert.ok(two !== null, "the battle ended in round 1")
  const { battle } = positionOf(two)
  assert.equal(battle.round, 2)
  const standing = new Set((restoredOf(battle, contentOf(battle))?.state.entities ?? []).map((entity) => entity.id))
  assert.deepEqual(incomingOf(two), unitsOf(firstWatched(battle), battle, standing))
})
