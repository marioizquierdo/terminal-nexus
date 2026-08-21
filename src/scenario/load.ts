// The scenario loader. **Validation lives here, not in a later linter** — dimension mismatch,
// unknown legend key, overlapping footprint, and unknown content id all fail loudly, naming the
// offending line and column (milestone-1-spike-battle.md 3.5).

import type { ContentRegistry } from "../content/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { tilesOf } from "../grid/coords.ts"
import type { GridTerrain, TerrainId } from "../grid/types.ts"
import { gameplayRng } from "../rng/pcg32.ts"
import type { EntityState, MatchState } from "../state/types.ts"
import { SCHEMA_VERSION } from "../state/types.ts"
import { presetDimensions } from "./presets.ts"
import type { ScenarioDefinition } from "./types.ts"

export const TICKS_PER_SECOND = 12

export class ScenarioError extends Error {}

function fail(scenario: ScenarioDefinition, message: string): never {
  throw new ScenarioError(`${scenario.id}: ${message}`)
}

function dimensionsOf(scenario: ScenarioDefinition): { width: number; height: number } {
  const grid = scenario.grid
  if ("preset" in grid) return presetDimensions(grid.preset)
  if (!Number.isInteger(grid.width) || !Number.isInteger(grid.height)) {
    fail(scenario, "grid width and height must be integers")
  }
  return { width: grid.width, height: grid.height }
}

function checkOverlay(
  scenario: ScenarioDefinition,
  rows: readonly string[],
  label: string,
  width: number,
  height: number,
): void {
  if (rows.length !== height) {
    fail(scenario, `${label} has ${rows.length} rows; the grid is ${height} tall`)
  }
  rows.forEach((row, y) => {
    if (row.length !== width) {
      fail(
        scenario,
        `${label} row ${y + 1} (y=${y}) is ${row.length} characters; the grid is ${width} wide`,
      )
    }
  })
}

export type LoadedScenario = Readonly<{
  scenario: ScenarioDefinition
  registry: ContentRegistry
  state: MatchState
}>

export function loadScenario(
  scenario: ScenarioDefinition,
  options: Readonly<{ registry?: ContentRegistry; seed?: number }> = {},
): LoadedScenario {
  const registry = options.registry ?? FIXTURE_REGISTRY
  const { width, height } = dimensionsOf(scenario)

  checkOverlay(scenario, scenario.terrain, "terrain", width, height)
  checkOverlay(scenario, scenario.placements, "placements", width, height)

  // Terrain, row-major from the north-west.
  const tiles: TerrainId[] = []
  scenario.terrain.forEach((row, y) => {
    [...row].forEach((character, x) => {
      const terrainId = scenario.terrainLegend[character]
      if (terrainId === undefined) {
        fail(
          scenario,
          `terrain row ${y + 1}, column ${x + 1} (x=${x},y=${y}) uses "${character}", ` +
            `which the terrain legend does not define`,
        )
      }
      tiles.push(terrainId)
    })
  })
  const grid: GridTerrain = { width, height, tiles }

  // Placements. A multi-tile entity is placed by its anchor character, once; its footprint comes
  // from its definition, and the loader is where an overlap or an off-Grid footprint is caught.
  const entities: EntityState[] = []
  const claimed = new Map<string, string>()
  let ordinal = 0

  scenario.placements.forEach((row, y) => {
    [...row].forEach((character, x) => {
      if (character === " ") return
      const entry = scenario.placementLegend[character]
      if (entry === undefined) {
        fail(
          scenario,
          `placements row ${y + 1}, column ${x + 1} (x=${x},y=${y}) uses "${character}", ` +
            `which the placement legend does not define`,
        )
      }
      if (!registry.has(entry.content)) {
        fail(
          scenario,
          `placements row ${y + 1}, column ${x + 1} (x=${x},y=${y}) names the unknown content id ` +
            `"${entry.content}"`,
        )
      }
      const definition = registry.get(entry.content)
      const anchor = { x, y }
      const id = `${entry.player}:${definition.short}#${ordinal + 1}`

      for (const tile of tilesOf(anchor, definition.footprint)) {
        if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) {
          fail(
            scenario,
            `placements row ${y + 1}, column ${x + 1} (x=${x},y=${y}): the footprint of ` +
              `"${entry.content}" reaches (${tile.x},${tile.y}), which is outside the ` +
              `${width}x${height} Grid`,
          )
        }
        // Two entities may legally share a tile across layers (a worker and a soldier do), so the
        // placement mask is per layer.
        const key = `${definition.layer}:${tile.x},${tile.y}`
        const occupant = claimed.get(key)
        if (occupant !== undefined) {
          fail(
            scenario,
            `placements row ${y + 1}, column ${x + 1} (x=${x},y=${y}): the footprint of ` +
              `"${entry.content}" overlaps ${occupant} at (${tile.x},${tile.y}) on the ` +
              `${definition.layer} layer`,
          )
        }
        claimed.set(key, id)
      }

      entities.push({
        ordinal,
        id,
        player: entry.player,
        contentId: definition.id,
        hp: definition.maxHp,
        anchor,
        // Sides face each other by default: it is a rendering hint, and no rule reads it.
        facing: entry.player === "A" ? "e" : "w",
        moveCredit: 0,
        cooldown: 0,
        targetOrdinal: null,
      })
      ordinal += 1
    })
  })

  if (entities.length === 0) fail(scenario, "places no entities")
  if (!Number.isInteger(scenario.pulseTicks) || scenario.pulseTicks <= 0) {
    fail(scenario, `pulseTicks must be a positive integer, received ${scenario.pulseTicks}`)
  }

  const seed = options.seed ?? scenario.seed
  if (!Number.isInteger(seed)) fail(scenario, `seed must be an integer, received ${seed}`)

  const state: MatchState = {
    schemaVersion: SCHEMA_VERSION,
    tick: 0,
    ticksPerSecond: TICKS_PER_SECOND,
    grid,
    entities,
    groundItems: [],
    vacatedTiles: [],
    outcome: null,
    rng: gameplayRng(seed).snapshot(),
    nextOrdinal: ordinal,
  }

  return { scenario, registry, state }
}
