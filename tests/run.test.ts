// A Challenge run, pure (src/run/): its definition from a seed, how a battle's end moves it on — a lost battle ends
// it — and its summary. How a run's battles are played on the Build Phase screen is `tests/run-play.test.ts`.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { DuelResult } from "../src/duel/index.ts"
import { DUEL_MAPS, duelArmy } from "../src/duel/index.ts"
import type { RunState } from "../src/run/index.ts"
import {
  RUN_BATTLES,
  RUN_POLICIES,
  RUN_ROUNDS,
  awaitingDraft,
  battleEnded,
  currentBattle,
  drafted,
  newRun,
  runDefinition,
  runSummary,
  summaryLines,
} from "../src/run/index.ts"

const won = (round: number): DuelResult => ({ winner: "A", by: "nexus", round })
const lost = (round: number): DuelResult => ({ winner: "B", by: "nexus", round })

/** The run with the draft its last battle earned taken as the requisition, so the next battle may start. */
const settled = (run: RunState): RunState => drafted(run, { kind: "requisition" })

test("a run's definition comes from its seed alone: three battles against Dob Hunter on the Crossing, each its own seed", () => {
  const definition = runDefinition({ seed: 1, commander: "vasse" })
  assert.deepEqual(runDefinition({ seed: 1, commander: "vasse" }), definition, "the same seed gave another run")
  assert.equal(definition.battles.length, RUN_BATTLES)
  assert.deepEqual(definition.acts.map((act) => act.battles.length), [RUN_BATTLES], "one act, for now")
  for (const battle of definition.battles) {
    assert.equal(battle.opponent, "dob")
    assert.ok(DUEL_MAPS[battle.duel.map] !== undefined, `battle ${battle.number} is on no duel map`)
    assert.equal(battle.duel.map, "crossing")
    assert.equal(battle.duel.rounds, RUN_ROUNDS)
    assert.deepEqual(battle.duel.commanders, { A: "vasse", B: "dob" })
    duelArmy(battle.duel.commanders.B)
  }
  // Each battle a different scripted player, in an order the seed shuffles, on a seed of its own.
  assert.deepEqual([...definition.battles.map((battle) => battle.policy)].sort(), [...RUN_POLICIES].sort())
  assert.equal(new Set(definition.battles.map((battle) => battle.duel.seed)).size, RUN_BATTLES)
  // Pinned, so a run's seed names the same run on Node and Bun and in every later build: a change here is a change
  // to every shared seed, and says so.
  assert.deepEqual(
    definition.battles.map((battle) => [battle.policy, battle.duel.seed]),
    [
      ["rush", 659576],
      ["turtle", 257416],
      ["balanced", 656223],
    ],
  )
  assert.equal(definition.nextSeed, 354363)
})

test("another seed is another run, and the Commander chosen plays every battle", () => {
  const one = runDefinition({ seed: 1, commander: "vasse" })
  const other = runDefinition({ seed: 2, commander: "dob" })
  assert.notDeepEqual(
    other.battles.map((battle) => battle.duel.seed),
    one.battles.map((battle) => battle.duel.seed),
  )
  for (const battle of other.battles) assert.equal(battle.duel.commanders.A, "dob")
})

test("a run refuses a seed out of range and a Commander no army has", () => {
  assert.throws(() => runDefinition({ seed: -1, commander: "vasse" }), /seed/)
  assert.throws(() => runDefinition({ seed: 1.5, commander: "vasse" }), /seed/)
  assert.throws(() => runDefinition({ seed: 1_000_000, commander: "vasse" }), /seed/)
  assert.throws(() => runDefinition({ seed: 1, commander: "nobody" }), /no Commander "nobody"/)
})

test("a won battle moves the run on to the next, and the last one ends it", () => {
  let run: RunState = newRun({ seed: 1, commander: "vasse" })
  assert.equal(currentBattle(run)?.number, 1)
  run = battleEnded(run, won(3))
  assert.equal(run.over, false)
  assert.equal(currentBattle(run)?.number, 2)
  assert.equal(awaitingDraft(run), true, "a won battle earns a draft, which the next waits for")
  assert.throws(() => battleEnded(run, won(1)), /waiting for its draft/)
  run = settled(run)
  assert.equal(awaitingDraft(run), false)
  run = battleEnded(run, { winner: null, by: "draw", round: 6 })
  assert.equal(run.over, false, "a drawn battle is not lost: the run goes on")
  run = settled(run)
  run = battleEnded(run, won(4))
  assert.equal(run.over, true, "the last battle ends the run")
  assert.equal(awaitingDraft(run), false, "and there is no draft after it")
  assert.equal(currentBattle(run), null)
  assert.deepEqual(
    run.played.map((record) => record.outcome),
    ["won", "drawn", "won"],
  )
  assert.throws(() => battleEnded(run, won(1)), /the run is over/)
})

test("a lost battle ends the run, with the battles after it never played", () => {
  let run = newRun({ seed: 1, commander: "vasse" })
  run = settled(battleEnded(run, won(2)))
  run = battleEnded(run, lost(5))
  assert.equal(run.over, true)
  assert.equal(awaitingDraft(run), false, "a lost battle earns no draft")
  assert.equal(currentBattle(run), null)
  const summary = runSummary(run)
  assert.equal(summary.won, 1)
  assert.equal(summary.of, 3)
  assert.deepEqual(
    summary.battles.map((battle) => battle.record?.outcome ?? null),
    ["won", "lost", null],
  )
})

test("the summary says the Commander, the seed, and each battle's opponent and result", () => {
  let run = newRun({ seed: 1, commander: "vasse" })
  run = settled(battleEnded(run, won(3)))
  run = battleEnded(run, { winner: "B", by: "health", round: 6 })
  assert.deepEqual(summaryLines(run), [
    "The run is over: 1 of 3 battles won. Battle 2 was lost.",
    "Edda Vasse, seed 1.",
    "Battle 1 against Dob Hunter (rush): won in round 3. Dob Hunter's Nexus fell.",
    "Battle 2 against Dob Hunter (turtle): lost in round 6. The rounds ran out, and Dob Hunter's Nexus kept more of its health.",
    "Battle 3 against Dob Hunter (balanced): not played.",
    "After battle 1: took 15 requisition.",
    "The army: Barracks, Supply Depot, Turret, Reserve Callup, Drill Schedule. Requisition: 15.",
  ])
  let all = newRun({ seed: 1, commander: "averno" })
  for (const round of [1, 2]) all = settled(battleEnded(all, won(round)))
  all = battleEnded(all, won(3))
  assert.equal(summaryLines(all)[0], "The run is won: all 3 battles won.")
  assert.equal(summaryLines(all)[1], "Marshal Averno, seed 1.")
})
