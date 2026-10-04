// The levels the game can open by id (src/cli/levels.ts): what a route's `campaign?level=<id>` names, opened at
// any of its rounds the same way every time.

import { test } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_LEVEL_ID, LEVELS, levelById, openRound } from "../src/cli/levels.ts"
import { starterContext } from "../src/cli/starter.ts"

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
