// A sandbox is in one part of a round (docs/system-design/sandboxes.md, "Build Phase or Battle Round"): the Battle Round,
// where the kernel runs and units march, strike and spawn, or the Build Phase, where units stand placed and idle and the
// only thing that moves them is the regroup. The same placement, played both ways, shows what the phase changes.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { REGROUP_TICKS } from "../src/match/index.ts"
import type { BattleOpening } from "../src/skirmish/opening/index.ts"
import { openBattle, phaseOf, playPhase } from "../src/skirmish/opening/index.ts"
import { playTrialBattle } from "../src/measure/trial.ts"

const ground = Array.from({ length: 16 }, () => ".".repeat(40))

/** Two troopers a few tiles apart, a hurt Nexus behind side A, and a Hatchery: all of what the phase can change. */
function opening(phase?: BattleOpening["phase"]): BattleOpening {
  return {
    id: "phase-fixture",
    name: "Phase fixture",
    grid: { width: 40, height: 16 },
    seed: 11,
    pulseTicks: 180,
    terrain: ground,
    terrainLegend: { ".": "terrain.plain" },
    placements: {
      A: {
        at: { x: 14, y: 8 },
        rows: ["t"],
        legend: { t: { content: "unit.citizen.trooper" } },
      },
      B: {
        at: { x: 17, y: 8 },
        rows: ["t"],
        legend: { t: { content: "unit.citizen.trooper" } },
      },
    },
    targets: { A: { x: 30, y: 6, width: 2, height: 2 }, B: { x: 4, y: 6, width: 2, height: 2 } },
    ...(phase === undefined ? {} : { phase }),
  }
}

function play(from: BattleOpening, ticks = from.pulseTicks) {
  const loaded = openBattle(from)
  return { loaded, run: playPhase(phaseOf(from), loaded.state, loaded.registry, ticks, from.seed) }
}

test("an opening is in the Battle Round unless it says otherwise, and the Battle Round is the kernel's own run", () => {
  assert.equal(phaseOf(opening()), "battle-round")
  assert.equal(phaseOf(opening("build-phase")), "build-phase")
  const { loaded, run } = play(opening())
  const kernel = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: 180, seed: 11 })
  assert.equal(run.stateHash, kernel.stateHash, "the Battle Round is not the kernel's run, hash for hash")
  assert.equal(run.eventsHash, kernel.eventsHash)
})

test("in the Build Phase nobody attacks, nobody dies and the Battle Round's ticks are not played", () => {
  const battle = play(opening()).run
  assert.ok(battle.events.some((event) => event.kind === "attack.launched"), "the Battle Round has no fight to compare with")
  const build = play(opening("build-phase")).run
  assert.deepEqual(
    [...new Set(build.events.map((event) => event.kind))],
    ["entity.spawned"],
    "the Build Phase has events beyond who is placed where",
  )
  assert.equal(build.pulseTicks, REGROUP_TICKS, "the Build Phase plays the regroup, whatever the sandbox's roundTicks")
  assert.equal(build.finalState.outcome, null)
  const [first, second] = build.finalState.entities
  assert.ok(first !== undefined && second !== undefined)
  assert.equal(first.hp, FIXTURE_REGISTRY.get(first.contentId).maxHp)
  assert.equal(second.hp, FIXTURE_REGISTRY.get(second.contentId).maxHp)
})

test("the Build Phase leaves every entity's transient fields fresh, as the game's Build Phase finds them", () => {
  const { loaded, run } = play(opening("build-phase"))
  for (const entity of run.finalState.entities) {
    const fresh = { moveCredit: entity.moveCredit, cooldown: entity.cooldown, targetOrdinal: entity.targetOrdinal, focusStreak: entity.focusStreak }
    assert.deepEqual(fresh, { moveCredit: fresh.moveCredit, cooldown: 0, targetOrdinal: null, focusStreak: 0 })
  }
  assert.equal(loaded.state.tick, 0)
})

test("a building mends between rounds, and in the Build Phase only: the Battle Round has no mending", () => {
  const hurt: BattleOpening = {
    ...opening(),
    placements: {
      A: { at: { x: 6, y: 8 }, rows: ["n"], legend: { n: { content: "structure.citizen.nexus", hp: 100 } } },
      B: { at: { x: 33, y: 8 }, rows: ["n"], legend: { n: { content: "structure.ravel.nexus" } } },
    },
    targets: {},
  }
  const nexusOf = (state: ReturnType<typeof play>["run"]["finalState"]) => state.entities.find((entity) => entity.player === "A")!
  const mends = FIXTURE_REGISTRY.get("structure.citizen.nexus").mends
  assert.ok(mends !== undefined && mends > 0, "the Citizen Nexus no longer mends: pick a building that does")
  assert.equal(nexusOf(play({ ...hurt, phase: "build-phase" }).run.finalState).hp, 100 + mends)
  assert.ok(nexusOf(play(hurt, 60).run.finalState).hp <= 100, "the Battle Round mended a building")
})

test("a building that spawns spawns in the Battle Round and not in the Build Phase", () => {
  const nest: BattleOpening = {
    ...opening(),
    placements: { A: { at: { x: 10, y: 8 }, rows: ["h"], legend: { h: { content: "structure.bench.hatchery" } } } },
    targets: {},
  }
  const count = (from: BattleOpening) => play(from, 240).run.finalState.entities.length
  assert.ok(count(nest) > 1, "the Hatchery spawned nothing in the Battle Round")
  assert.equal(count({ ...nest, phase: "build-phase" }), 1, "the Hatchery spawned in the Build Phase")
})

test("the Build Phase is the same on every run; a unit in a fight steps back toward its own Nexus, and with no Nexus or Commander it stands", () => {
  const withNexuses: BattleOpening = {
    ...opening("build-phase"),
    placements: {
      A: { at: { x: 4, y: 8 }, rows: ["n         t"], legend: { n: { content: "structure.citizen.nexus" }, t: { content: "unit.citizen.trooper" } } },
      B: { at: { x: 17, y: 8 }, rows: ["t                  n"], legend: { n: { content: "structure.ravel.nexus" }, t: { content: "unit.citizen.trooper" } } },
    },
    targets: {},
  }
  const a = play(withNexuses).run
  const b = play(withNexuses).run
  assert.equal(a.stateHash, b.stateHash)
  assert.equal(a.eventsHash, b.eventsHash)
  const troopers = (run: typeof a) => run.finalState.entities.filter((entity) => entity.contentId === "unit.citizen.trooper").map((entity) => entity.anchor.x)
  const was = troopers({ ...a, finalState: a.initialState })
  const now = troopers(a)
  assert.ok((now[0] ?? 99) < (was[0] ?? 0) && (now[1] ?? 0) > (was[1] ?? 99), `the troopers did not step back toward their Nexuses: ${was} -> ${now}`)
  // The graceful case: no Nexus and no Commander gives the regroup no line, so the survivors stand where they are.
  const bare = play(opening("build-phase")).run
  assert.deepEqual(bare.finalState.entities.map((entity) => entity.anchor), bare.initialState.entities.map((entity) => entity.anchor))
})

test("a trial plays battles, so it refuses a sandbox in the Build Phase", () => {
  assert.throws(() => playTrialBattle(opening("build-phase"), {}, 1), /a Build Phase has none/)
})
