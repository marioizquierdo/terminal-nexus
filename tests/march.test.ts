// The march (pulse.md, routes; movement.md, the march): an army walking for its side's goal keeps its lines — melee
// ahead, short range behind it, long range behind that — its Commander at its head, no one but a backliner ahead of
// her, and a band along the way to the goal; a unit that yields swaps with an ally behind it or steps on out of its
// way, so a narrow gap never jams; a backliner goes for what stands behind the enemy's front; and a mirrored march
// stays a mirror.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { footprintExtent, gridDistance, tilesOf } from "../src/grid/coords.ts"
import { measureScenario } from "../src/measure/index.ts"
import { lineTiles } from "../src/pulse/march.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"
import { loadScenarioFile } from "./helpers.ts"

/** Every state of a scenario's battle, and every event, on its own seed or `seed`. */
async function play(name: string, seed?: number, scenario?: ScenarioDefinition): Promise<Readonly<{ states: MatchState[]; events: DomainEvent[] }>> {
  const map = scenario ?? (await loadScenarioFile(`${name}.map.json`))
  const loaded = loadScenario(map, { registry: FIXTURE_REGISTRY, seed: seed ?? map.seed })
  const context = contextFor(loaded.state, loaded.registry, map.pulseTicks)
  const states = [loaded.state]
  const events: DomainEvent[] = []
  let state = loaded.state
  while (state.outcome === null && state.tick < map.pulseTicks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { states, events }
}

const of = (state: MatchState, player: "A" | "B", contentId: string): EntityState[] =>
  state.entities.filter((entity) => entity.player === player && entity.contentId === contentId)

const xs = (entities: readonly EntityState[]): number[] => entities.map((entity) => entity.anchor.x)

/** The first tick a unit of `player` strikes or shoots anything. */
function firstStrike(events: readonly DomainEvent[], player: "A" | "B"): number {
  const strike = events.find((event) => event.kind === "attack.launched" && event.attacker.startsWith(`${player}:`))
  assert.ok(strike !== undefined, `${player} never struck`)
  return strike.tick
}

test("march-lines: shooters that start ahead of the troopers arrive behind them, the mortar furthest back", async () => {
  const { states, events } = await play("march-lines")
  const start = states[0] as MatchState
  assert.ok(Math.min(...xs(of(start, "A", "unit.citizen.marksman"))) > Math.max(...xs(of(start, "A", "unit.citizen.trooper"))), "the marksmen start ahead")
  // A marches east; on the tick its army first strikes, every trooper stands further east than every marksman, and
  // every marksman further than the mortar.
  const arrival = states[firstStrike(events, "A")] as MatchState
  const troopers = xs(of(arrival, "A", "unit.citizen.trooper"))
  const marksmen = xs(of(arrival, "A", "unit.citizen.marksman"))
  const mortar = xs(of(arrival, "A", "unit.citizen.mortar"))
  assert.ok(Math.min(...troopers) > Math.max(...marksmen), `troopers ${troopers}, marksmen ${marksmen}`)
  assert.ok(Math.min(...marksmen) > Math.max(...mortar), `marksmen ${marksmen}, mortar ${mortar}`)
  // The troopers passed them by swapping tiles with the ones in their way, and said so.
  assert.ok(events.some((event) => event.kind === "march.made-way" && event.how === "swap"))
})

test("march-guide: while Vasse marches, no trooper or marksman goes past its place behind her, and the runner, a backliner, passes her", async () => {
  const { states, events } = await play("march-guide")
  const contact = firstStrike(events, "A")
  // On an open field a unit's walk to the tiles beside the enemy's Nexus is the Grid's distance to the nearest of them.
  const nexus = of(states[0] as MatchState, "B", "structure.bench.nexus")[0] as EntityState
  const beside = tilesOf(nexus.anchor, FIXTURE_REGISTRY.get(nexus.contentId).footprint).flatMap((tile) => [
    { x: tile.x - 1, y: tile.y },
    { x: tile.x + 1, y: tile.y },
    { x: tile.x, y: tile.y - 1 },
    { x: tile.x, y: tile.y + 1 },
  ])
  const progress = (entity: EntityState): number => Math.min(...beside.map((tile) => gridDistance(entity.anchor, tile)))
  let runnerPassed = false
  let checked = 0
  // A unit further forward than its place behind her takes no step forward: it yields. Far from the enemy only, since
  // closing on it lifts the formation.
  for (let tick = 1; tick < contact; tick += 1) {
    const before = states[tick - 1] as MatchState
    const after = states[tick] as MatchState
    const guide = progress(of(before, "A", "unit.citizen.vasse")[0] as EntityState)
    const runner = of(after, "A", "unit.ravel.runner")[0]
    if (runner !== undefined && progress(runner) < guide - 8) runnerPassed = true
    if (guide <= 12 + 8) continue
    for (const [contentId, place] of [["unit.citizen.trooper", -2], ["unit.citizen.marksman", 8]] as const) {
      for (const unit of of(before, "A", contentId)) {
        if (progress(unit) >= guide + place) continue
        checked += 1
        const later = after.entities.find((entity) => entity.ordinal === unit.ordinal) as EntityState
        assert.ok(progress(later) >= progress(unit), `tick ${tick}: ${unit.id} stepped from ${progress(unit)} to ${progress(later)}, Vasse at ${guide}`)
      }
    }
  }
  assert.ok(checked > 20, `${checked} units ahead of their place checked`)
  assert.ok(runnerPassed, "the runner never passed her")
  assert.equal(states.at(-1)?.outcome?.winner, "A")
})

test("march-guide: the marksmen that start ahead of her wait until she has passed them by their place, then march", async () => {
  const { states } = await play("march-guide")
  const start = states[0] as MatchState
  const marksmenStart = xs(of(start, "A", "unit.citizen.marksman"))
  // Until Vasse is eight columns past them, they do not step east of where they began.
  for (const state of states) {
    const vasse = (of(state, "A", "unit.citizen.vasse")[0] as EntityState).anchor.x
    if (vasse >= Math.max(...marksmenStart) + 8) break
    for (const x of xs(of(state, "A", "unit.citizen.marksman"))) assert.ok(x <= Math.max(...marksmenStart), `tick ${state.tick}: a marksman at ${x}`)
  }
})

test("march-narrow-gap: troopers swap past marksmen in a one-wide corridor, a raider releases its marksman, and nothing jams", async () => {
  const scenario = await loadScenarioFile("march-narrow-gap.map.json")
  for (const seed of [1, 2, 3, 4]) {
    const { battle } = measureScenario(scenario, seed)
    assert.equal(battle.winner, "A", `seed ${seed}: ${battle.reason} at ${battle.ticks}`)
    assert.equal(battle.reason, "nexus-destroyed")
    assert.equal(battle.sides.A.stalled, 0, `seed ${seed}: a unit stood still for good`)
    assert.ok(battle.sides.A.longestBlocked < 24, `seed ${seed}: a unit stood blocked ${battle.sides.A.longestBlocked} ticks`)
  }
  const { states, events } = await play("march-narrow-gap")
  const madeWay = events.filter((event) => event.kind === "march.made-way")
  // Three troopers past two marksmen in the north corridor: six swaps at least; and the raider, too wide to swap,
  // releases its marksman.
  assert.ok(madeWay.filter((event) => event.how === "swap" && event.ally.includes("trooper")).length >= 6)
  assert.ok(madeWay.some((event) => event.how === "release" && event.ally.includes("raider")))
  // Every trooper leaves the north corridor (it ends at column 37) before either marksman does.
  const out = (contentId: string): number[] =>
    of(states[0] as MatchState, "A", contentId)
      .filter((entity) => entity.anchor.y === 2)
      .map((entity) => states.findIndex((state) => (state.entities.find((other) => other.ordinal === entity.ordinal)?.anchor.x ?? 0) > 37))
  assert.ok(Math.max(...out("unit.citizen.trooper")) < Math.min(...out("unit.citizen.marksman")), `troopers out at ${out("unit.citizen.trooper")}, marksmen at ${out("unit.citizen.marksman")}`)
})

/** A state as rows of side, content, place and health, each side's seen from the other end when `mirrored`. */
function rows(state: MatchState, width: number, mirrored: boolean): string[] {
  return state.entities
    .map((entity) => {
      const extent = footprintExtent(FIXTURE_REGISTRY.get(entity.contentId).footprint)
      const player = mirrored ? (entity.player === "A" ? "B" : "A") : entity.player
      const x = mirrored ? width - entity.anchor.x - extent.width : entity.anchor.x
      return `${player} ${entity.contentId} ${x},${entity.anchor.y} ${entity.hp}`
    })
    .sort()
}

test("march-mirror: two mirrored armies keep their lines and march at each other, a mirror tick for tick", async () => {
  const scenario = await loadScenarioFile("march-mirror.map.json")
  const { states, events } = await play("march-mirror")
  const width = "width" in scenario.grid ? scenario.grid.width : 0
  states.forEach((state, tick) => assert.deepEqual(rows(state, width, false), rows(state, width, true), `parted at tick ${tick}`))
  // Both sides' shooters stepped back for their troopers, as many times each.
  const swaps = (player: "A" | "B"): number => events.filter((event) => event.kind === "march.made-way" && event.entity.startsWith(`${player}:`)).length
  assert.ok(swaps("A") > 0)
  assert.equal(swaps("A"), swaps("B"))
})

test("a march with its sides' names swapped is the same march: nothing favours A for being A", async () => {
  const scenario = await loadScenarioFile("march-lines.map.json")
  const swapped: ScenarioDefinition = {
    ...scenario,
    placements: { A: scenario.placements.B ?? { rows: [], legend: {} }, B: scenario.placements.A ?? { rows: [], legend: {} } },
    targets: { ...(scenario.targets?.B === undefined ? {} : { A: scenario.targets.B }), ...(scenario.targets?.A === undefined ? {} : { B: scenario.targets.A }) },
  }
  const once = await play("march-lines")
  const twice = await play("march-lines", undefined, swapped)
  const named = (state: MatchState, swap: boolean): string[] =>
    state.entities.map((entity) => `${swap ? (entity.player === "A" ? "B" : "A") : entity.player} ${entity.contentId} ${entity.anchor.x},${entity.anchor.y} ${entity.hp}`).sort()
  assert.equal(once.states.length, twice.states.length)
  once.states.forEach((state, tick) => assert.deepEqual(named(state, false), named(twice.states[tick] as MatchState, true), `parted at tick ${tick}`))
})

test("the guide line covers mirrored tiles from either end, both tiles where it falls exactly between two", () => {
  const width = 40
  const mirror = (tile: Readonly<{ x: number; y: number }>): string => `${width - 1 - tile.x},${tile.y}`
  // In half tiles: from the middle of a tile at (3,4) to between (30,9) and (31,9).
  const west = lineTiles({ x: 6, y: 8 }, { x: 61, y: 18 })
  const east = lineTiles({ x: 2 * (width - 1) - 6, y: 8 }, { x: 2 * (width - 1) - 61, y: 18 })
  assert.deepEqual(west.map(mirror).sort(), east.map((tile) => `${tile.x},${tile.y}`).sort())
  assert.ok(west.some((tile) => tile.x === 30 && tile.y === 9) && west.some((tile) => tile.x === 31 && tile.y === 9))
})

test("a backliner goes for the shooter behind the enemy's front, where any other unit fights the trooper nearest it", () => {
  // A runner above a trooper, an enemy trooper two columns ahead of the runner and a marksman three behind that.
  const scenario: ScenarioDefinition = {
    id: "backliner",
    name: "backliner",
    grid: { width: 30, height: 9 },
    seed: 1,
    pulseTicks: 60,
    terrain: Array.from({ length: 9 }, () => ".".repeat(30)),
    terrainLegend: { ".": "terrain.plain" },
    placements: {
      A: { at: { x: 8, y: 4 }, rows: ["r", "t"], legend: { r: { content: "unit.ravel.runner" }, t: { content: "unit.citizen.trooper" } } },
      B: { at: { x: 10, y: 4 }, rows: ["t  m"], legend: { t: { content: "unit.citizen.trooper" }, m: { content: "unit.citizen.marksman" } } },
    },
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: 1 })
  const context = contextFor(loaded.state, loaded.registry, 60)
  const { events } = stepTick(loaded.state, context)
  const chose = (who: string): string => {
    const chosen = events.find((event) => event.kind === "target.selected" && event.entity.startsWith(who))
    return chosen?.kind === "target.selected" ? chosen.target : ""
  }
  assert.match(chose("A:runner"), /marksman/)
  assert.match(chose("A:trooper"), /trooper/)
})
