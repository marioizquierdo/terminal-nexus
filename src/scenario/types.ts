import type { TerrainId } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { GridPreset } from "./presets.ts"

export type GridSpec = Readonly<{ preset: GridPreset }> | Readonly<{ width: number; height: number }>

export type PlacementEntry = Readonly<{ player: PlayerId; content: string }>

export type ScenarioDefinition = Readonly<{
  id: string
  name: string
  notes?: string
  grid: GridSpec
  seed: number
  /** Fixed number of logical ticks — engine.md 4.1, 12 ticks per simulation second. */
  pulseTicks: number
  /** One character per tile, rows listed **north to south** so the file reads the way it draws. */
  terrain: readonly string[]
  terrainLegend: Readonly<Record<string, TerrainId>>
  /** Second overlay, same dimensions. A space means nothing here. */
  placements: readonly string[]
  placementLegend: Readonly<Record<string, PlacementEntry>>
}>

/**
 * Typed, and does no work — so a scenario file is safe to import from a test
 * (milestone-1-spike-battle.md 3.5).
 */
export function defineScenario(definition: ScenarioDefinition): ScenarioDefinition {
  return definition
}
