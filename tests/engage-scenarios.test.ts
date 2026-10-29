// The engage scenarios (scenarios/engage-*.map.json; docs/system-design/measurement.md): the same armies on ground that
// is open, a gap, a corridor and two lanes, each played to a result. They are not proofs that a rule works; they are the
// bench movement is measured against, and what they pin is what was measured: which army is the wrong one for which
// ground, and how many of its units ever strike. A change to how troops engage moves these, and says so here.

import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveScenario } from "./helpers.ts"

const SEEDS = [1, 2, 3, 4]

/** What one battle came to: who won, when it ended, and how many of each side's mobile units struck within the first twenty seconds. */
async function play(name: string, seed: number): Promise<Readonly<{ winner: string | null; ticks: number; A: number; B: number; fielded: Readonly<{ A: number; B: number }> }>> {
  const { run } = await resolveScenario(`${name}.map.json`, { seed })
  const struck = { A: new Set<number>(), B: new Set<number>() }
  for (const event of run.events) {
    if (event.kind === "attack.launched" && event.tick < 240 && event.attackKind !== "heal") struck[event.attacker.startsWith("A:") ? "A" : "B"].add(event.attackerOrdinal)
  }
  const fielded = { A: 0, B: 0 }
  for (const entity of run.initialState.entities) if (!entity.contentId.includes("nexus")) fielded[entity.player] += 1
  return { winner: run.finalState.outcome?.winner ?? null, ticks: run.finalState.tick, A: struck.A.size, B: struck.B.size, fielded }
}

test("engage-open-melee-vs-mix: on open ground the melee army reaches the defenders from every side and wins", async () => {
  for (const seed of SEEDS) {
    const battle = await play("engage-open-melee-vs-mix", seed)
    assert.equal(battle.winner, "A", `seed ${seed}`)
    assert.equal(battle.A, battle.fielded.A, `seed ${seed}: ${battle.A} of ${battle.fielded.A} struck`)
  }
})

test("engage-gap6-mix-mirror: through a gap six rows wide every unit of both sides strikes within twenty seconds", async () => {
  for (const seed of SEEDS) {
    const battle = await play("engage-gap6-mix-mirror", seed)
    assert.ok(battle.A === battle.fielded.A && battle.B === battle.fielded.B, `seed ${seed}: ${battle.A} and ${battle.B} of ${battle.fielded.A} struck`)
  }
})

test("engage-gap2-melee-vs-mix: the wrong army for a gap two rows wide loses, and some of it never strikes", async () => {
  for (const seed of SEEDS) {
    const battle = await play("engage-gap2-melee-vs-mix", seed)
    assert.equal(battle.winner, "B", `seed ${seed}`)
    assert.ok(battle.A < battle.fielded.A, `seed ${seed}: all ${battle.A} struck`)
  }
})

test("engage-gap2-airmix-vs-mix: flyers cross the same gap, and an army with half its number in the air wins", async () => {
  for (const seed of SEEDS) {
    const battle = await play("engage-gap2-airmix-vs-mix", seed)
    assert.equal(battle.winner, "A", `seed ${seed}`)
    assert.ok(battle.A >= battle.fielded.A - 1, `seed ${seed}: ${battle.A} of ${battle.fielded.A} struck`)
  }
})

test("engage-corridor-melee-vs-mix: a corridor twenty long costs a battle at least 40% more time than open ground", async () => {
  let open = 0
  let corridor = 0
  for (const seed of SEEDS) {
    open = Math.max(open, (await play("engage-open-melee-vs-mix", seed)).ticks)
    corridor = Math.min(corridor === 0 ? Number.POSITIVE_INFINITY : corridor, (await play("engage-corridor-melee-vs-mix", seed)).ticks)
  }
  assert.ok(corridor * 10 >= open * 14, `the shortest corridor battle took ${corridor} ticks, the longest open one ${open}`)
})

test("engage-lanes-melee-vs-mix: given two lanes the melee army reaches the defenders, and nearly all of it strikes", async () => {
  let won = 0
  for (const seed of SEEDS) {
    const battle = await play("engage-lanes-melee-vs-mix", seed)
    if (battle.winner === "A") won += 1
    assert.ok(battle.A >= battle.fielded.A - 1, `seed ${seed}: ${battle.A} of ${battle.fielded.A} struck`)
  }
  assert.ok(won >= 3, `the melee army won ${won} seeds of ${SEEDS.length}`)
})
