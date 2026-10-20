// Where a side heads when its level names nowhere (docs/system-design/pulse.md, a side's target): its fighting units
// head for the enemy's Grid Nexus and fight what comes within their reach on the way (`headsForNexus`,
// `src/pulse/perception.ts`). The owner, 2026-10-20: "It's just going to be going to the enemy nexus." Before, they
// went for the nearest enemy wherever it was; with no enemy Nexus to strike they still do.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/index.ts"
import type { PlacementBlock, ScenarioDefinition } from "../src/scenario/index.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"

type Placed = readonly [x: number, y: number, content: string]

const TROOPER = "unit.citizen.trooper"
const RAIDER = "unit.ravel.runner"
const RAVEL_NEXUS = "structure.ravel.nexus"

/** One side's placement block: each content at its tile (a structure by its centre tile, as a map writes it). */
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

/** A 24 x 12 open Grid with each side placed as given and no target for either, after its first tick. */
function firstTick(sides: Readonly<Partial<Record<PlayerId, readonly Placed[]>>>): MatchState {
  const placements: Partial<Record<PlayerId, PlacementBlock>> = {}
  for (const side of ["A", "B"] as const) {
    const placed = sides[side]
    if (placed !== undefined) placements[side] = block(placed)
  }
  const scenario: ScenarioDefinition = {
    id: "heading",
    name: "heading",
    grid: { preset: "small-wide" },
    seed: 1,
    pulseTicks: 60,
    terrain: Array.from({ length: 12 }, () => ".".repeat(24)),
    terrainLegend: { ".": "terrain.plain" },
    placements,
  }
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY })
  return stepTick(loaded.state, contextFor(loaded.state, FIXTURE_REGISTRY, 60)).state
}

/** What the unit of `player` made of `contentId` chose on the first tick. */
function choiceOf(state: MatchState, player: PlayerId, contentId: string): EntityState | undefined {
  const unit = state.entities.find((entity) => entity.player === player && entity.contentId === contentId)
  assert.ok(unit !== undefined)
  return state.entities.find((entity) => entity.ordinal === unit.targetOrdinal)
}

test("with an enemy Nexus on the map, a unit passes over an enemy out of its reach and heads for the Nexus", () => {
  // The raider is ten columns off, past the trooper's reach of six; the Nexus is much further.
  const state = firstTick({ A: [[2, 10, TROOPER]], B: [[12, 10, RAIDER], [20, 2, RAVEL_NEXUS]] })
  assert.equal(choiceOf(state, "A", TROOPER)?.contentId, RAVEL_NEXUS)
})

test("an enemy within its reach is fought on the way, ahead of the Nexus", () => {
  const state = firstTick({ A: [[2, 10, TROOPER]], B: [[7, 10, RAIDER], [20, 2, RAVEL_NEXUS]] })
  assert.equal(choiceOf(state, "A", TROOPER)?.contentId, RAIDER)
})

test("with no enemy Nexus to head for, a unit still goes for the nearest enemy wherever it is", () => {
  const state = firstTick({ A: [[2, 10, TROOPER]], B: [[18, 2, RAIDER]] })
  assert.equal(choiceOf(state, "A", TROOPER)?.contentId, RAIDER)
})
