// The expected power curve (src/armies/curve.ts; docs/game-design/commander-armies.md, "The expected power curve",
// "What an army leans on"): the numbers every Commander Army is designed against hold the shape the design writes
// in words; the game's schedule and every shipped level deal no rarity before its act; the dealer, falling back to a
// rarer card, keeps the same rule; and every Commander names what her army leans on, checked by the loader.

import { test } from "node:test"
import assert from "node:assert/strict"
import { MAPS } from "../src/build/maps.ts"
import type { PowerCard, Rarity, Role } from "../src/armies/index.ts"
import {
  ACTS,
  ARMIES,
  ARMY_FILES,
  ArmyError,
  DEFAULT_SCHEDULE,
  EARLIEST_ROUND,
  LEANS,
  MAX_ROUNDS,
  PERIMETER_LEVEL,
  RARITIES,
  ROUND_CREDITS,
  dealHand,
  loadArmies,
  pickWorth,
  roundCredits,
} from "../src/armies/index.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)
const credits = (from: number, to: number): number => sum(ROUND_CREDITS.slice(from - 1, to))

/** The best rarity the game's default schedule deals in `round`. */
function bestDealt(round: number): Rarity {
  let slots: readonly unknown[] = []
  for (const entry of DEFAULT_SCHEDULE) if (entry.round <= round) slots = entry.deal
  const rarities = slots.filter((slot): slot is Rarity => typeof slot === "string")
  return rarities.reduce((best, rarity) => (RARITIES.indexOf(rarity) > RARITIES.indexOf(best) ? rarity : best), "common")
}

test("the credits a round brings grow by about a fifth a round to round 9, then stay flat to the long game's end", () => {
  assert.equal(ROUND_CREDITS.length, MAX_ROUNDS)
  assert.equal(roundCredits(1), 100)
  for (let round = 2; round <= 9; round += 1) {
    const growth = roundCredits(round) / roundCredits(round - 1)
    assert.ok(growth >= 1.15 && growth <= 1.25, `round ${round} grows by ${growth.toFixed(2)}`)
  }
  for (let round = 10; round <= MAX_ROUNDS; round += 1) assert.equal(roundCredits(round), roundCredits(9))
  assert.throws(() => roundCredits(0))
  assert.throws(() => roundCredits(MAX_ROUNDS + 1))
  // The acts cover every round once, in order.
  assert.deepEqual(
    ACTS.flatMap((act) => Array.from({ length: act.to - act.from + 1 }, (_, index) => act.from + index)),
    Array.from({ length: MAX_ROUNDS }, (_, index) => index + 1),
  )
})

test("over nine rounds the opening brings about a sixth, the closing about half, and the Nexus about a third", () => {
  const nine = credits(1, 9)
  assert.equal(nine, 2080)
  const opening = credits(1, 3) / nine
  const closing = credits(7, 9) / nine
  assert.ok(opening > 0.14 && opening < 0.2, `the opening brings ${opening.toFixed(2)}`)
  assert.ok(closing > 0.45 && closing < 0.55, `the closing brings ${closing.toFixed(2)}`)

  // The design's table: the best card the default schedule deals each round, at its rarity's worth.
  const picks = Array.from({ length: 9 }, (_, index) => pickWorth(bestDealt(index + 1), index + 1))
  assert.deepEqual(picks, [33, 40, 46, 85, 105, 125, 150, 180, 215])
  const nexus = sum(picks) / (sum(picks) + nine)
  assert.ok(nexus > 0.28 && nexus < 0.36, `the Nexus is ${nexus.toFixed(2)} of an army's power`)
  // A rarer card is worth more, in every round.
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const worths = RARITIES.map((rarity) => pickWorth(rarity, round))
    assert.deepEqual(worths, [...worths].sort((a, b) => a - b), `round ${round}`)
  }
})

test("no rarity is dealt before its act: the game's schedule and every shipped level keep it", () => {
  assert.deepEqual(EARLIEST_ROUND, { common: 1, uncommon: 1, rare: 4, legendary: 7 })
  const powers = new Map(ARMIES.levels.flatMap((level) => level.offer.powers.map((card) => [card.id, card.rarity] as const)))
  const schedules = [DEFAULT_SCHEDULE, ...ARMIES.levels.flatMap((level) => (level.offer.schedule === undefined ? [] : [level.offer.schedule]))]
  assert.ok(PERIMETER_LEVEL.offer.schedule !== undefined, "PERIMETER has a schedule of its own to check")
  for (const schedule of schedules) {
    for (const entry of schedule) {
      for (const slot of entry.deal) {
        if (typeof slot !== "string" && "from" in slot) continue
        const rarity = typeof slot === "string" ? slot : powers.get(slot.power)
        assert.ok(rarity !== undefined)
        assert.ok(entry.round >= EARLIEST_ROUND[rarity], `a ${rarity} from round ${entry.round}`)
      }
    }
  }
})

test("a slot with nothing left of its rarity falls back to a rarer card only once the curve deals it", () => {
  const card = (id: string, rarity: Rarity, role: Role): PowerCard => ({ id, name: id, description: `${id}.`, effect: { credits: 0 }, rarity, role })
  const pool = [card("u1", "uncommon", "support"), card("r1", "rare", "offense")]
  const hand = (round: number): string[] =>
    dealHand({ pool, kept: [card("u1", "uncommon", "support")], seed: 1, round, schedule: [{ round: 1, deal: ["common", "uncommon"] }] }).map((each) => each.id)
  // No common or uncommon left: round 3 deals nothing rather than a rare before its act; round 4 deals the rare.
  assert.deepEqual(hand(3), [])
  assert.deepEqual(hand(4), ["r1"])
  // Falling back to a lower rarity is never held back: a rare slot with no rare deals an uncommon in any round.
  assert.deepEqual(dealHand({ pool: [card("u2", "uncommon", "support")], kept: [], seed: 1, round: 4, schedule: [{ round: 1, deal: ["common"] }, { round: 4, deal: ["rare"] }] }).map((each) => each.id), ["u2"])
})

test("every Commander names what her army leans on, one or two of five, and Vasse leans on structures and on her", () => {
  const vasseCommander = ARMIES.commanders.find((commander) => commander.id === "vasse")
  assert.deepEqual(vasseCommander?.lean, ["structures", "commander"])
  assert.deepEqual(LEANS, ["units", "nexus", "structures", "commander", "economy"])

  const commanders = (lean: unknown): unknown => ({
    id: "leans",
    title: "Leans",
    requires: ["vasse"],
    commander: { id: "leaner", name: "Leaner", unit: "unit.citizen.vasse", faction: "citizen", ...(lean === undefined ? {} : { lean }) },
  })
  const problemsOf = (lean: unknown): readonly string[] => {
    try {
      loadArmies({ armies: [...ARMY_FILES, commanders(lean)] }, { registry: FIXTURE_REGISTRY, maps: MAPS })
      return []
    } catch (error) {
      assert.ok(error instanceof ArmyError, String(error))
      return error.problems
    }
  }
  assert.deepEqual(problemsOf(["units"]), [])
  assert.deepEqual(problemsOf(["nexus", "economy"]), [])
  assert.deepEqual(problemsOf(undefined), ['army "leans": commander needs "lean"'])
  assert.deepEqual(problemsOf([]), ['army "leans": the Commander "leaner" leans on nothing: name one or two of "units", "nexus", "structures", "commander", "economy"'])
  assert.deepEqual(problemsOf(["units", "nexus", "economy"]), ['army "leans": the Commander "leaner" leans on 3 things: 2 at most, or it leans on nothing'])
  assert.deepEqual(problemsOf(["units", "units"]), ['army "leans": the Commander "leaner" names a lean twice'])
  assert.deepEqual(problemsOf(["luck"]), ['army "leans": commander.lean[0] should be one of "units", "nexus", "structures", "commander", "economy", not "luck"'])
})

test("the tech tree is checked by name: tiers in range, lower tiers required, the tier below named, and every level able to reach what it offers", () => {
  const card = (id: string, extra: object = {}): object => ({ id, structure: "structure.bench.beamturret", cost: 10, ...extra })
  const tree = {
    id: "tree",
    title: "Tree",
    requires: ["vasse"],
    buildings: [
      card("high", { tier: 4, requires: ["barracks"] }),
      card("selfish", { tier: 2, requires: ["selfish"] }),
      card("lost", { tier: 2, requires: ["nowhere"] }),
      card("level", { tier: 2, requires: ["garrison"] }),
      card("floating", { tier: 2 }),
      card("leap", { tier: 3, requires: ["barracks"] }),
    ],
  }
  const treeCampaign = {
    id: "tree",
    title: "Tree",
    commander: "vasse",
    requires: ["vasse", "ravel"],
    levels: [{ id: "tree-1", map: "starter-open", credits: 10, unlocks: { buildings: ["garrison"] }, mission: PERIMETER_LEVEL.mission }],
  }
  const problems = (() => {
    try {
      loadArmies({ armies: [...ARMY_FILES, tree], campaigns: [treeCampaign] }, { registry: FIXTURE_REGISTRY, maps: MAPS })
      return []
    } catch (error) {
      assert.ok(error instanceof ArmyError, String(error))
      return error.problems
    }
  })()
  assert.deepEqual(problems, [
    'army "tree": the building "high" is of tier 4: the tree has tiers 1 to 3',
    'army "tree": the building "selfish" requires itself, so it is never unlocked',
    'army "tree": the building "lost" requires the building "nowhere", which no army has',
    'army "tree": the building "level" of tier 2 requires "garrison", of tier 2: a building requires only lower tiers',
    'army "tree": the building "floating" of tier 2 requires nothing: name the building of tier 1 that unlocks it',
    'army "tree": the building "leap" of tier 3 requires no building of tier 2',
    'campaign "tree": level "tree-1" offers the building "garrison", which requires "barracks", which the level neither offers nor has standing',
  ])
})
