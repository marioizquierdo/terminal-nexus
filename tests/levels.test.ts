// The levels the game can open by id (src/cli/levels.ts): what a route's `campaign?level=<id>` names, opened at
// any of its rounds the same way every time. They are the shipped campaigns' levels, in order (src/bundles):
// Vasse's PERIMETER, then the Commander's cadence, where her return can be played.

import { test } from "node:test"
import assert from "node:assert/strict"
import { BUNDLES } from "../src/bundles/index.ts"
import { DEFAULT_LEVEL_ID, LEVELS, levelById, openRound } from "../src/cli/levels.ts"
import { STARTER_MISSION } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { VASSE } from "./commander-fixture.ts"

test("a level is found by its id, and the default is Vasse's first: PERIMETER", () => {
  assert.ok(LEVELS.length > 0)
  const level = levelById(DEFAULT_LEVEL_ID)
  assert.ok(level !== undefined)
  assert.equal(level.campaign, "vasse")
  assert.equal(level.title, "Perimeter")
  assert.equal(level.rounds, 3)
  assert.equal(levelById("nowhere"), undefined)
  assert.equal(new Set(LEVELS.map((entry) => entry.id)).size, LEVELS.length, "two levels share an id")
})

test("round 1 opens as the level does", () => {
  const level = levelById(DEFAULT_LEVEL_ID)!
  const context = openRound(level, 1)
  const expected = starterContext()
  assert.equal(context.round?.number, 1)
  assert.deepEqual(context.catalog, expected.catalog)
  assert.equal(context.allotment, expected.allotment)
  assert.deepEqual(context.incoming, expected.incoming)
})

test("a later round is reached by playing the ones before it with nothing built, the same every time", () => {
  const level = levelById(DEFAULT_LEVEL_ID)!
  for (const round of [2, 3]) {
    const first = openRound(level, round)
    const again = openRound(level, round)
    assert.equal(first.round?.number, round)
    assert.equal(first.round?.of, 3)
    assert.deepEqual(first.incoming, again.incoming, `round ${round}'s raid differs between two openings`)
    assert.deepEqual(first.field, again.field)
    assert.equal(first.allotment, again.allotment)
    // The credits the walk did not spend carry over, the first Nexus power's included.
    assert.ok(first.allotment > level.firstRound().allotment)
  }
})

test("a round the level does not have is refused by name", () => {
  const level = levelById(DEFAULT_LEVEL_ID)!
  for (const round of [0, 4, 1.5]) assert.throws(() => openRound(level, round), /has rounds 1 to 3/)
})

test("the levels are her campaign's, in its order: PERIMETER, then the Commander's cadence", () => {
  assert.deepEqual(
    LEVELS.map((level) => [level.id, level.campaign, level.title, level.rounds]),
    [
      ["vasse-test-1", "vasse", "Perimeter", 3],
      ["vasse-test-2", "vasse", "The Commander falls", 3],
    ],
  )
  assert.deepEqual(
    LEVELS.map((level) => level.id),
    BUNDLES.levels.map((level) => level.id),
  )
  // The game opened bare and a route to its first level play one connection.
  assert.equal(levelById(DEFAULT_LEVEL_ID)?.play, STARTER_MISSION)
})

test("the cadence level opens by id, and her return is played: she falls in round 1, sits round 2 out, and is back for round 3", () => {
  const level = levelById("vasse-test-2")
  assert.ok(level !== undefined)
  // Round 1: she arrives out in front, and the level offers what the campaign has unlocked by then — all PERIMETER did.
  const first = openRound(level, 1)
  assert.deepEqual(first.catalog, starterContext().catalog)
  assert.deepEqual(first.nexusDraft, starterContext().nexusDraft)
  assert.equal(first.allotment, 100)
  assert.ok(first.incoming?.some((entity) => entity.contentId === VASSE && entity.player === "A"), "round 1 does not bring her")

  // Round 2: she fell in round 1, so she is out, and the round says when she is back.
  const second = openRound(level, 2)
  assert.deepEqual(second.absent, [{ player: "A", contentId: VASSE, fellInRound: 1, returnsInRound: 3 }])
  assert.ok(!(second.field ?? []).some((entity) => entity.contentId === VASSE), "she is on the map in the round she is out")
  assert.match(second.openingStatus?.text ?? "", /Vasse is out this round, back for round 3/)

  // Round 3: the Nexus has restored her, at full health beside it, and the round opens on her.
  const third = openRound(level, 3)
  assert.deepEqual(third.absent, [])
  const back = (third.field ?? []).filter((entity) => entity.contentId === VASSE)
  assert.deepEqual(back.map((entity) => [entity.player, entity.hp]), [["A", 80]])
  assert.match(third.scene?.[0]?.text ?? "", /Vasse is back beside the Nexus/)
  // And it is the same round 3 every time.
  assert.deepEqual(openRound(level, 3).field, third.field)
})
