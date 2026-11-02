// The levels the game can open by id (src/cli/levels.ts): what a route's `campaign?level=<id>` names, opened at
// any of its rounds the same way every time. They are the shipped campaigns' levels, in order (src/armies):
// Vasse's PERIMETER, then the Commander's cadence, where her return can be played.

import { test } from "node:test"
import { roundCredits } from "../src/armies/curve.ts"
import assert from "node:assert/strict"
import { ARMIES, PERIMETER } from "../src/armies/index.ts"
import { DEFAULT_LEVEL, LEVELS, levelById, openRound } from "../src/cli/levels.ts"
import { starterContext } from "../src/cli/starter.ts"
import { VASSE } from "./commander-fixture.ts"
import { emptyWalk } from "./level-walk.ts"

test("a level is found by its id, and the default is Vasse's first: PERIMETER", () => {
  assert.ok(LEVELS.length > 0)
  const level = levelById("vasse-test-1")
  assert.ok(level !== undefined)
  assert.equal(level, DEFAULT_LEVEL)
  assert.equal(level.campaign, "vasse")
  assert.equal(level.title, "Perimeter")
  assert.equal(level.rounds, 3)
  assert.equal(levelById("nowhere"), undefined)
  assert.equal(new Set(LEVELS.map((entry) => entry.id)).size, LEVELS.length, "two levels share an id")
})

test("round 1 opens as the level does", () => {
  const context = openRound(DEFAULT_LEVEL, 1)
  const expected = starterContext()
  assert.equal(context.round?.number, 1)
  assert.deepEqual(context.catalog, expected.catalog)
  assert.equal(context.allotment, expected.allotment)
  assert.deepEqual(context.incoming, expected.incoming)
})

test("a later round is reached by playing the ones before it with nothing built, the same every time", () => {
  const level = DEFAULT_LEVEL
  for (const round of [2, 3]) {
    const first = openRound(level, round)
    const again = openRound(level, round)
    assert.equal(first.round?.number, round)
    assert.equal(first.round?.of, 3)
    assert.deepEqual(first.incoming, again.incoming, `round ${round}'s raid differs between two openings`)
    assert.deepEqual(first.field, again.field)
    assert.equal(first.allotment, again.allotment)
    // The walk builds nothing and keeps no power (the pick is optional), so its battles are the mission's own and
    // the credits it did not spend carry over untouched, each round adding its own from the power curve.
    let income = 0
    for (let opened = 2; opened <= round; opened += 1) income += roundCredits(opened)
    assert.equal(first.allotment, level.firstRound().allotment + income)
    assert.deepEqual(first.kept, [])
  }
})

test("on every level, a base with nothing built lives to the last round, so a route opens any round", { timeout: 120_000 }, () => {
  // What a route to a later round plays (`openRound`), and a property of each level's content: what an empty base
  // faces. The tests of a level's layout walk it with its battles undecided (tests/level-walk.ts), so a change to how
  // battles play fails here alone, and says which round tipped and how close each came. Measured: the Nexus's lowest
  // health in a round before the last is 210 of 400 at worst (Averno's curve, round 4; the curve's rounds 4 and 5
  // fall to 234 and 228); the other levels' Nexus is untouched before their last round. When this fails, shape the
  // level, not the rules.
  for (const level of LEVELS) {
    const walk = emptyWalk(level)
    const read = walk.map((round) => `round ${round.round} ${round.verdict}, Nexus down to ${round.nexusLow}/${round.nexusMax}`).join("; ")
    assert.equal(walk.length, level.rounds, `${level.id}: an empty base does not reach round ${level.rounds}: ${read}`)
    for (const round of walk.slice(0, -1)) assert.equal(round.verdict, "continue", `${level.id}: ${read}`)
  }
})

test("a round the level does not have is refused by name", () => {
  for (const round of [0, 4, 1.5]) assert.throws(() => openRound(DEFAULT_LEVEL, round), /has rounds 1 to 3/)
})

test("the levels are her campaign's, in its order: PERIMETER, the Commander's cadence, then the curve; then his", () => {
  assert.deepEqual(
    LEVELS.map((level) => [level.id, level.campaign, level.title, level.rounds]),
    [
      ["vasse-test-1", "vasse", "Perimeter", 3],
      ["vasse-test-2", "vasse", "The Commander falls", 3],
      ["vasse-test-3", "vasse", "The curve", 6],
      ["averno-test-1", "averno", "The curve, pressed", 5],
    ],
  )
  assert.deepEqual(
    LEVELS.map((level) => level.id),
    ARMIES.levels.map((level) => level.id),
  )
  // The game opened with no level and a route to its first level open one level, and it plays PERIMETER.
  assert.equal(levelById(DEFAULT_LEVEL.id), DEFAULT_LEVEL)
  assert.equal(DEFAULT_LEVEL.play.mission, PERIMETER)
})

test("the cadence level opens by id, and her return is played: she falls in round 1 and is back as round 2 opens", () => {
  const level = levelById("vasse-test-2")
  assert.ok(level !== undefined)
  // Round 1: she arrives out in front, and the level offers what the campaign has unlocked by then — all PERIMETER did.
  const first = openRound(level, 1)
  assert.deepEqual(first.catalog, starterContext().catalog)
  // Its own hand, dealt by its own seed from the same pool.
  assert.deepEqual(first.powerPool, starterContext().powerPool)
  assert.ok(first.nexusDraft.every((option) => first.powerPool?.includes(option.card)), "a power in the hand is not in the pool")
  assert.equal(first.allotment, 100)
  assert.ok(first.incoming?.some((entity) => entity.contentId === VASSE && entity.player === "A"), "round 1 does not bring her")

  // Round 2: she fell in round 1, and the Nexus has restored her, at full health beside it; the round opens on her.
  const second = openRound(level, 2)
  assert.deepEqual(second.absent, [])
  assert.deepEqual(second.restored, [{ player: "A", contentId: VASSE }])
  const back = (second.field ?? []).filter((entity) => entity.contentId === VASSE)
  assert.deepEqual(back.map((entity) => [entity.player, entity.hp]), [["A", 80]])
  assert.match(second.scene?.[0]?.text ?? "", /The Nexus Pulse restores Vasse beside the Nexus/)
  assert.match(second.openingStatus?.text ?? "", /The Nexus Pulse restores Vasse and deals/)
  // And it is the same round 2 every time.
  assert.deepEqual(openRound(level, 2).field, second.field)
})
