import type { Coord, EntityLayer, Footprint } from "../grid/types.ts"

/** A rational tiles-per-second rate. Never a float — engine.md 4.1, 4.2. */
export type MovementRate = Readonly<{ numerator: number; denominator: number }>

export type AttackKind = "melee" | "ranged"

export type AttackDef = Readonly<{
  kind: AttackKind
  /** Chebyshev tiles, measured to the nearest occupied tile of the target. */
  range: number
  damage: number
  cooldownTicks: number
  /**
   * Presentation metadata only. The flight window on a ranged attack event is
   * `ceil(distance / projectileTilesPerTick)` ticks, and **no rule reads it** — engine.md 4.3.
   */
  projectileTilesPerTick?: number
}>

export type Behavior = "advance" | "flee" | "static"

export type ContentDef = Readonly<{
  id: string
  /** The short name used in report lines: `A:trooper#1`. */
  short: string
  layer: EntityLayer
  footprint: Footprint
  maxHp: number
  movementRate?: MovementRate
  /**
   * Initiative. **Lower acts first**, for movement claims and for attacks alike (engine.md 4.3).
   * It is not a movement rate; that is `movementRate`.
   */
  speedTier: number
  attack?: AttackDef
  /** The layers this entity collides with — engine.md 3.4.1. Terrain impassability is separate. */
  collidesWith: readonly EntityLayer[]
  behavior: Behavior
  /** Dropped as a ground item on death. Nothing consumes it in Gate 1A; there is no economy. */
  salvage: number
}>

export function rectFootprint(width: number, height: number): Footprint {
  const tiles: Coord[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({ x, y })
    }
  }
  return tiles
}
