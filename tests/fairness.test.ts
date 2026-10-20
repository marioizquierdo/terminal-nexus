// No side wins by where it stands (pulse.md): every tie a rule breaks goes by what the deciding unit faces, then by a
// draw from the seeded stream — never by reading order, compass order or ordinal, each of which favours the side the
// map put west, north or first. Here: two equal units that trade blows both fall; a building sets its units down on
// the side facing the enemy, east or west; a unit picks among equally near enemies by holding what it holds, or a
// draw; a muster's tie goes toward the enemy; a battle with its sides' names swapped is the same battle; a mirror
// battle with nothing tied stays a mirror, tick for tick, with a unit three tiles wide among them; and mirror duels
// are won from either end about as often.

import { test } from "node:test"
import assert from "node:assert/strict"
import type { ContentDef } from "../src/content/index.ts"
import { createRegistry, FIXTURE_REGISTRY, rectFootprint } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { footprintExtent } from "../src/grid/coords.ts"
import { maskFrom, OccupancyIndex } from "../src/grid/occupancy.ts"
import { playDuel, SCRIPTED } from "../src/duel/index.ts"
import { nearestFit } from "../src/match/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { MatchState, PlayerId } from "../src/state/types.ts"

/** A unit with a melee hit and a walk, nothing else. */
const fighter = (id: string, extra: Partial<ContentDef> = {}): ContentDef => ({
  id,
  short: id.split(".").at(-1) ?? id,
  layer: "units",
  footprint: rectFootprint(1, 1),
  maxHp: 30,
  speedTier: 2,
  collidesWith: ["obstacles", "units"],
  behavior: "advance",
  salvage: 0,
  movementRate: { numerator: 10, denominator: 3 },
  attack: { kind: "melee", range: 1, damage: 10, cooldownTicks: 12 },
  ...extra,
})

/** `definition` standing still: no walk at all. */
function withoutWalk(definition: ContentDef): ContentDef {
  const { movementRate: _walk, ...standing } = definition
  return standing
}

const REGISTRY = createRegistry([
  ...FIXTURE_REGISTRY.ids().map((id) => FIXTURE_REGISTRY.get(id)),
  fighter("unit.test.fighter"),
  withoutWalk(fighter("unit.test.stander", { behavior: "static" })),
  fighter("unit.test.wide", { footprint: rectFootprint(3, 1), maxHp: 60 }),
  fighter("unit.test.slow", { maxHp: 1000, attack: { kind: "melee", range: 1, damage: 1, cooldownTicks: 600 } }),
  {
    id: "structure.test.yard",
    short: "yard",
    layer: "obstacles",
    footprint: rectFootprint(3, 3),
    maxHp: 200,
    speedTier: 9,
    collidesWith: ["obstacles", "workers", "units"],
    behavior: "static",
    salvage: 0,
    production: { output: "unit.test.fighter", perWave: 4, waves: 1, firstTicks: 1, intervalTicks: 600 },
  },
])

type Placed = readonly [x: number, y: number, content: string]

const WIDTH = 30
const HEIGHT = 9

/** One side's placement block: each content at its tile. */
function block(placed: readonly Placed[]): PlacementBlock {
  const symbols = "abcdefghijklmnopqrstuvwxyz"
  const rows: string[][] = []
  const legend: Record<string, { content: string }> = {}
  placed.forEach(([x, y, content], index) => {
    const symbol = symbols[index] as string
    while (rows.length <= y) rows.push([])
    const row = rows[y] as string[]
    while (row.length <= x) row.push(" ")
    row[x] = symbol
    legend[symbol] = { content }
  })
  return { rows: rows.map((row) => row.join("")), legend }
}

/** An open Grid with each side placed as given. */
function opening(sides: Readonly<Record<PlayerId, readonly Placed[]>>, seed = 1): MatchState {
  const scenario: ScenarioDefinition = {
    id: "fairness",
    name: "fairness",
    grid: { width: WIDTH, height: HEIGHT },
    seed,
    pulseTicks: 600,
    terrain: Array.from({ length: HEIGHT }, () => ".".repeat(WIDTH)),
    terrainLegend: { ".": "terrain.plain" },
    placements: { A: block(sides.A), B: block(sides.B) },
  }
  return loadScenario(scenario, { registry: REGISTRY }).state
}

/** Every state of a battle from `start`, `ticks` long or until it ends, and every event. */
function run(start: MatchState, ticks: number): Readonly<{ states: MatchState[]; events: DomainEvent[] }> {
  const context = contextFor(start, REGISTRY, ticks)
  const states = [start]
  const events: DomainEvent[] = []
  let state = start
  while (state.outcome === null && state.tick < ticks) {
    const result = stepTick(state, context)
    state = result.state
    states.push(state)
    events.push(...result.events)
  }
  return { states, events }
}

/** A state as a set of rows — side, content, place, health — each side's things seen from the other end of the Grid
 *  when `mirrored`: the same battle mirrored west to east, sides swapped, has the same rows. */
function rows(state: MatchState, mirrored: boolean): string[] {
  return state.entities
    .map((entity) => {
      const { width } = footprintExtent(REGISTRY.get(entity.contentId).footprint)
      const player = mirrored ? (entity.player === "A" ? "B" : "A") : entity.player
      const x = mirrored ? WIDTH - entity.anchor.x - width : entity.anchor.x
      return `${player} ${entity.contentId} ${x},${entity.anchor.y} ${entity.hp}`
    })
    .sort()
}

test("two equal units that strike each other in the same tick both fall, on that tick", () => {
  const { events } = run(opening({ A: [[10, 4, "unit.test.stander"]], B: [[11, 4, "unit.test.stander"]] }), 120)
  const deaths = events.filter((event): event is Extract<DomainEvent, { kind: "entity.died" }> => event.kind === "entity.died")
  assert.equal(deaths.length, 2)
  assert.equal(deaths[0]?.tick, deaths[1]?.tick, "one fell before the other")
})

test("a building sets its units down on its roof, on the edge facing the enemy, east or west alike", () => {
  // A yard each, with an enemy straight across: a wave comes out on its roof, along the edge toward the enemy,
  // whichever end the yard is at.
  for (const [player, yard, enemy] of [["A", 3, 26], ["B", 26, 3]] as const) {
    const sides = { A: [] as Placed[], B: [] as Placed[] }
    sides[player].push([yard, 4, "structure.test.yard"])
    sides[player === "A" ? "B" : "A"].push([enemy, 4, "unit.test.slow"])
    const start = opening(sides)
    const anchor = start.entities.find((entity) => entity.contentId === "structure.test.yard")?.anchor
    assert.ok(anchor !== undefined)
    const { events } = run(start, 2)
    const spawned = events.filter((event): event is Extract<DomainEvent, { kind: "entity.spawned" }> => event.kind === "entity.spawned")
    assert.equal(spawned.length, 4)
    // The edge toward the enemy: the yard's own east column for A, its west column for B.
    const face = player === "A" ? anchor.x + 2 : anchor.x
    // The first on that edge straight across from the enemy; the next two along the same row behind it, a row
    // counting two columns, so the wave fills the roof from the enemy's side.
    const at = spawned.map((event) => `${event.at.x},${event.at.y}`)
    assert.deepEqual(spawned[0]?.at, { x: face, y: 4 }, `${player}: ${at.join(" ")}`)
    const step = player === "A" ? -1 : 1
    assert.deepEqual(at.slice(0, 3), [0, 1, 2].map((behind) => `${face + step * behind},4`), `${player}: ${at.join(" ")}`)
  }
})

test("a unit among equally near enemies keeps the one it holds, and otherwise draws: either may be picked", () => {
  // Three that stand still: one of A, two of B the same distance away, one above it and one below.
  const picked = new Set<string>()
  for (let seed = 1; seed <= 12; seed += 1) {
    const { events } = run(opening({ A: [[10, 4, "unit.test.stander"]], B: [[12, 3, "unit.test.stander"], [12, 5, "unit.test.stander"]] }, seed), 30)
    const selected = events.filter((event): event is Extract<DomainEvent, { kind: "target.selected" }> => event.kind === "target.selected" && event.entity.startsWith("A:"))
    // Picked once, and held while the two stay as near as each other.
    assert.equal(selected.length, 1, selected.map((event) => event.target).join(" "))
    picked.add(selected[0]?.target ?? "")
  }
  assert.equal(picked.size, 2, `only ${[...picked].join(", ")} was ever picked`)
})

test("a group set down round a point takes a tied tile on the side of the enemy, whichever side that is", () => {
  const grid = { width: WIDTH, height: HEIGHT, tiles: Array.from({ length: WIDTH * HEIGHT }, () => "terrain.plain" as const) }
  const index = new OccupancyIndex(grid)
  const mask = maskFrom(index, { layers: ["units"], terrain: "impassable" })
  const one = rectFootprint(1, 1)
  // The muster's own tile is taken, so the first ring decides: one column west or one east, a tie.
  index.add("units", 0, { x: 15, y: 4 }, one)
  assert.deepEqual(nearestFit(mask, one, { x: 15, y: 4 }, 4, { x: 15, y: 4 }, { x: 28, y: 4 }), { x: 16, y: 4 })
  assert.deepEqual(nearestFit(mask, one, { x: 15, y: 4 }, 4, { x: 15, y: 4 }, { x: 1, y: 4 }), { x: 14, y: 4 })
})

test("a battle with its sides' names swapped is the same battle: nothing favours A for being A", () => {
  const sides = {
    A: [[3, 4, "unit.test.fighter"], [3, 2, "unit.test.fighter"], [4, 6, "unit.test.wide"]] as Placed[],
    B: [[24, 3, "unit.test.fighter"], [25, 5, "unit.test.fighter"], [23, 7, "unit.test.fighter"]] as Placed[],
  }
  const once = run(opening(sides), 300)
  const swapped = run(opening({ A: sides.B, B: sides.A }), 300)
  const named = (state: MatchState, swap: boolean): string[] =>
    state.entities.map((entity) => `${swap ? (entity.player === "A" ? "B" : "A") : entity.player} ${entity.contentId} ${entity.anchor.x},${entity.anchor.y} ${entity.hp}`).sort()
  assert.equal(once.states.length, swapped.states.length)
  once.states.forEach((state, tick) => assert.deepEqual(named(state, false), named(swapped.states[tick] as MatchState, true), `parted at tick ${tick}`))
})

test("a mirror battle with nothing tied stays a mirror, tick for tick, a unit three tiles wide among them", () => {
  // West against east, each side the other's reflection: a fighter and a unit three tiles wide behind it, every
  // distance between them different, so nothing ties and nothing is drawn. A placement names a thing's middle tile,
  // so the mirror of column x is column WIDTH - 1 - x.
  const west: Placed[] = [[9, 4, "unit.test.fighter"], [5, 3, "unit.test.wide"]]
  const east: Placed[] = west.map(([x, y, content]) => [WIDTH - 1 - x, y, content])
  const { states, events } = run(opening({ A: west, B: east }), 400)
  states.forEach((state, tick) => assert.deepEqual(rows(state, false), rows(state, true), `parted at tick ${tick}`))
  // And they did fight, and fell together.
  const deaths = events.filter((event) => event.kind === "entity.died")
  assert.ok(deaths.length >= 2, `${deaths.length} fell`)
})

test("a mirror duel is won from either end about as often: the same Commander and plan on both sides, over seeds", { timeout: 180_000 }, () => {
  // Before ties went by what a unit faces, the west won all sixteen of these: its new units came out of the back of
  // its buildings and its musters filled the western tiles first. On the Pocket the two bases touch, and one early
  // draw — whose building sets its units down first between them — snowballs over three rounds, so the split is read
  // over forty seeds there and eight on the Crossing: a side that won for where it stands would win nearly all of them.
  const won = { A: 0, B: 0, draw: 0 }
  for (const [map, seeds] of [["pocket", 40], ["crossing", 8]] as const) {
    for (let seed = 1; seed <= seeds; seed += 1) {
      const duel = playDuel({ map, seed, rounds: 3, pulseTicks: 400, commanders: { A: "vasse", B: "vasse" } }, { A: SCRIPTED.rush!, B: SCRIPTED.rush! })
      won[duel.result?.winner ?? "draw"] += 1
    }
  }
  // Even odds give more than 32 of 48 to one end about one time in a hundred; the seeds are fixed, so it never flickers.
  assert.ok(Math.max(won.A, won.B) <= 32, `west ${won.A}, east ${won.B}, drawn ${won.draw}`)
})
