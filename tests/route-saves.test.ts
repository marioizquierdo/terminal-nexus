// The route saves (sandboxes/route-*.save.json; docs/system-design/measurement.md): each shape a route must manage,
// played on several seeds. Every one of them failed or queued on the first routing's greedy step (the baseline in
// docs/history/measurements/); on routes each is walked, and no unit stands still for good where a way exists.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { measureSave } from "../src/measure/index.ts"
import { contextFor, resolvePulse, stepTick } from "../src/pulse/index.ts"
import { openBattle } from "../src/skirmish/opening/index.ts"
import { loadSandbox, playSandbox, sandboxFiles } from "./helpers.ts"

const SEEDS = [1, 2, 3, 4]

for (const [name, what] of [
  ["route-dead-end", "a trooper straight above its goal walks round the wall between"],
  ["route-pocket", "a trooper at the bottom of a cup of rock climbs out and round"],
  ["route-ridge-gap", "a squad files through a ridge's one gap, far off the straight line"],
  ["route-wide-gap", "a raider three wide passes by a gap two wide for one three wide"],
  ["route-crowd", "eight troopers in a file spread round one Nexus"],
] as const) {
  test(`${name}: ${what}, and the Nexus falls`, async () => {
    const opening = await loadSandbox(`${name}.save.json`)
    for (const seed of SEEDS) {
      const { battle } = measureSave(opening, seed)
      assert.equal(battle.winner, "A", `seed ${seed}: ${battle.reason} at ${battle.ticks}`)
      assert.equal(battle.reason, "nexus-destroyed")
      assert.equal(battle.sides.A.stalled, 0, `seed ${seed}: a unit stood still for good`)
    }
  })
}

test("route-crowd: the file spreads round its target, and it falls in under a third of the time the greedy queue took", async () => {
  const opening = await loadSandbox("route-crowd.save.json")
  const { battle } = measureSave(opening, 1)
  // On the greedy step the file queued and the Nexus stood until tick 785; spread round it, it falls in under a third.
  assert.ok(battle.ticks < 785 / 3, `the Nexus stood until tick ${battle.ticks}`)
})

test("route-corridor: two squads in one corridor never stand still for good, and either end wins about as often", async () => {
  const opening = await loadSandbox("route-corridor.save.json")
  const won = { A: 0, B: 0 }
  for (let seed = 1; seed <= 16; seed += 1) {
    const { battle } = measureSave(opening, seed)
    assert.equal(battle.reason, "nexus-destroyed", `seed ${seed}: the corridor ended by ${battle.reason}`)
    // The battle, not every unit: a corridor two rows tall holds two fights at its front, and those behind wait for a
    // gap — a queue, which can last as long as a fight does. What must never happen is the whole battle standing still:
    // five seconds with nobody stepping and nobody struck.
    const { run } = await playSandbox("route-corridor.save.json", { seed })
    const busy = run.events.filter((event) => event.kind === "entity.moved" || event.kind === "damage.applied").map((event) => event.tick)
    let still = 0
    for (let index = 1; index < busy.length; index += 1) still = Math.max(still, (busy[index] as number) - (busy[index - 1] as number))
    assert.ok(still < 60, `seed ${seed}: the battle stood still for ${still} ticks`)
    if (battle.winner !== null) won[battle.winner] += 1
  }
  // A mirror: even odds give more than 12 of 16 to one end about one time in fifty; the seeds are fixed.
  assert.ok(Math.max(won.A, won.B) <= 12, `west ${won.A}, east ${won.B}`)
})

test("route-falling-building: the troopers break the Barracks closing the gap and go through once it falls", async () => {
  const opening = await loadSandbox("route-falling-building.save.json")
  const { battle } = measureSave(opening, 1)
  assert.equal(battle.winner, "A")
  assert.equal(battle.sides.B.structuresLost, 2, "the Barracks and then the Nexus")
})

test("route-breach: buildings closing the only way, far from the straight line, are broken rather than stood at", async () => {
  // The owner, 2026-10-21: "if the enemy blocks the entrance with buildings, then the pathfinding should know the
  // difference between rocks and buildings and should decide to target one of the buildings." Walking as near as they
  // could get, the troopers stood at the rock straight across from the Nexus until the time ran out.
  const opening = await loadSandbox("route-breach.save.json")
  for (const seed of SEEDS) {
    const { run } = await playSandbox("route-breach.save.json", { seed })
    const fell = run.events.flatMap((event) => (event.kind === "structure.destroyed" ? [event.contentId] : []))
    assert.deepEqual(fell, ["structure.citizen.barracks", "structure.bench.nexus"], `seed ${seed}: ${run.finalState.outcome?.reason}`)
    assert.equal(run.finalState.outcome?.winner, "A")
  }
  // The same gap closed with rock instead: nothing to break, and nothing the troopers strike; they stand as near as
  // they can get, as before.
  const rock = {
    ...opening,
    terrain: opening.terrain.map((row, y) => (y === 1 || y === 2 ? `${row.slice(0, 25)}###${row.slice(28)}` : row)),
    placements: { ...opening.placements, B: { ...opening.placements.B!, at: { x: 40, y: 9 }, rows: ["n"] } },
  }
  const loaded = openBattle(rock, { registry: FIXTURE_REGISTRY, seed: 1 })
  const run = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: 600, seed: 1 })
  assert.equal(run.finalState.outcome?.reason, "tick-limit")
  assert.deepEqual(run.events.filter((event) => event.kind === "damage.applied"), [])
})

test("route-slow-ground: a route goes round a band of scrub when that is quicker, and never sets foot on it", async () => {
  const opening = await loadSandbox("route-slow-ground.save.json")
  const scrub = (tile: { x: number; y: number }): boolean => opening.terrain[tile.y]?.[tile.x] === ","
  for (const seed of SEEDS) {
    const resolved = await playSandbox("route-slow-ground.save.json", { seed })
    assert.equal(resolved.run.finalState.outcome?.winner, "A", `seed ${seed}`)
    const onScrub = resolved.run.events.filter((event) => event.kind === "entity.moved" && scrub(event.to))
    assert.deepEqual(onScrub, [], `seed ${seed}: the trooper walked the scrub`)
  }
})

test("route-scrub-crossing: a step onto scrub takes twice as long as one onto open ground", async () => {
  const opening = await loadSandbox("route-scrub-crossing.save.json")
  const scrub = (tile: { x: number; y: number }): boolean => opening.terrain[tile.y]?.[tile.x] === ","
  const resolved = await playSandbox("route-scrub-crossing.save.json")
  const steps = resolved.run.events.flatMap((event) => (event.kind === "entity.moved" ? [event] : []))
  assert.ok(steps.some((step) => scrub(step.to)), "it never crossed the scrub")
  const beat = 4 // a trooper's step across, in ticks
  steps.forEach((step, index) => {
    const previous = steps[index - 1]
    if (previous === undefined || step.from.y !== step.to.y) return
    assert.equal(step.tick - previous.tick, scrub(step.to) ? 2 * beat : beat, `the step onto ${step.to.x},${step.to.y}`)
  })
  assert.equal(resolved.run.finalState.outcome?.winner, "A")
})

test("worker-flight-between: a worker between two threats runs off their row, away from both, and lives twice as long", async () => {
  const resolved = await playSandbox("worker-flight-between.save.json")
  const moves = resolved.run.events.flatMap((event) => (event.kind === "entity.moved" && event.entity.startsWith("A:") ? [event] : []))
  assert.ok(moves.length >= 3)
  // Off the threats' row within its first two steps, and down the map away from both until the edge stops it (there it
  // dodges along the edge as they close in).
  assert.ok(moves.slice(0, 2).some((move) => move.to.y !== 6), `it stayed on the row: ${JSON.stringify(moves.slice(0, 2).map((move) => move.to))}`)
  assert.ok(moves.some((move) => move.to.y === 11), "it never reached the far edge")
  // Running straight away from the nearest threat took it toward the other, and it fell at tick 29.
  const fell = resolved.run.events.find((event) => event.kind === "entity.died" && event.player === "A")
  assert.ok(fell === undefined || fell.tick > 2 * 29, `it fell at tick ${fell?.tick}`)
})

test("a worker crosses its own side's troops and never an enemy's, and a trooper the same with workers", async () => {
  // Over every sandbox on file, at every tick: an enemy worker and trooper never share a tile.
  for (const name of sandboxFiles()) {
    const opening = await loadSandbox(name)
    const loaded = openBattle(opening, { registry: FIXTURE_REGISTRY, seed: opening.seed })
    const context = contextFor(loaded.state, loaded.registry, opening.pulseTicks)
    let state = loaded.state
    while (state.outcome === null && state.tick < opening.pulseTicks) {
      state = stepTick(state, context).state
      const ground = state.entities.filter((entity) => ["workers", "units"].includes(loaded.registry.get(entity.contentId).layer))
      const tiles = new Map<string, { player: string; layer: string }>()
      for (const entity of ground) {
        const definition = loaded.registry.get(entity.contentId)
        for (const offset of definition.footprint) {
          const key = `${entity.anchor.x + offset.x},${entity.anchor.y + offset.y}`
          const there = tiles.get(key)
          if (there !== undefined) assert.ok(there.player === entity.player, `${name}: an enemy ${there.layer} and ${definition.layer} share ${key} at tick ${state.tick}`)
          tiles.set(key, { player: entity.player, layer: definition.layer })
        }
      }
    }
  }
})
