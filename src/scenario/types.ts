import type { Coord, TerrainId } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { GridPreset } from "./presets.ts"

export type GridSpec = Readonly<{ preset: GridPreset }> | Readonly<{ width: number; height: number }>

/**
 * What one placement symbol means, for one player.
 *
 * Deliberately an object with one required field rather than a bare content-id string: everything a
 * scenario will eventually want to vary per placed entity — starting damage now, and later whatever
 * a Build Phase or a mid-match Pulse needs to carry forward — belongs here, and a bare string would
 * have to be widened into this shape the first time any of it arrived.
 */
export type PlacementEntry = Readonly<{
  content: string
  /**
   * Starting health, when this entity does not begin the Pulse intact. Defaults to the definition's
   * `maxHp`. A scenario that opens mid-match — the third Pulse of a game, say — needs some units
   * already hurt, and the alternative is a fixture that has to spend ticks damaging them first.
   *
   * The symbol is what carries the difference: `t` and `T` can both be troopers and differ only in
   * how much health they start with, so the placement grid still reads as one character per entity.
   */
  hp?: number
}>

/**
 * One player's opening deployment.
 *
 * Separate blocks rather than one interleaved grid, because a symbol then means the same thing for
 * whoever placed it — `t` is a trooper on both sides, and ownership comes from which block it is in
 * rather than from letter case. (Case still carries ownership *on screen*; that is a rendering
 * rule, and this is where it stops leaking into authoring.)
 */
export type PlacementBlock = Readonly<{
  /**
   * Where this block's north-west corner sits on the Grid. Defaults to `(0,0)`.
   *
   * The block does not have to cover the Grid — only the rectangle its own units occupy — so a
   * deployment stays legible at any map size, and a much larger Grid than today's presets would not
   * force a wall of blank rows per player. Nothing needs that yet; it is here because it costs one
   * offset to keep the door open.
   */
  at?: Coord
  /**
   * One character per tile, rows **north to south**. A space means nothing here — including a
   * missing one: a row may be shorter than the block's widest row, and everything past its last
   * character is exactly as blank as if it had been written out in full. That is deliberate, not a
   * gap in validation to eventually close: most blocks are irregular (an uneven squad, a scattered
   * escort), and requiring every row to be padded to the same length would fight the format's own
   * readability for no real safety, since `terrain`'s stricter "every row is the Grid's width"
   * check was never really about catching a truncated row either — it happened to, as a side effect
   * of terrain covering the whole Grid, which a block does not. A truncated or column-shifted edit
   * inside a block is consequently **not** caught by the loader the way an out-of-bounds or
   * overlapping footprint is; a screenshot or a watched run is still the check for that.
   */
  rows: readonly string[]
  legend: Readonly<Record<string, PlacementEntry>>
}>

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
  /**
   * One block per player. Partial on purpose: a fixture that only needs one side says so by leaving
   * the other out, rather than by writing an empty grid.
   */
  placements: Readonly<Partial<Record<PlayerId, PlacementBlock>>>
}>

/**
 * Typed, and does no work — so a scenario file is safe to import from a test
 * (milestone-1-spike-battle.md 3.5).
 */
export function defineScenario(definition: ScenarioDefinition): ScenarioDefinition {
  return definition
}
