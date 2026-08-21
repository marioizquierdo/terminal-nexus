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

/**
 * Volatile munitions — the Ravel rule shape from `commander-armies.md` Section 4.1: many Ravel
 * things detonate when they die, theirs and what they kill, and chains are legal and bounded.
 *
 * It is a **fixture rule on the Playground bench**, not authored Commander Army content: it exists
 * because a Ravel army without it fails the alignment test in `terminal-nexus-lore.md` Section 8.6,
 * where a themed reskin of a generic ability fails and a rule that *is* the characterisation passes.
 * Milestone 4 confirms or discards it when it selects the real microgame.
 */
export type Detonation = Readonly<{
  /** Chebyshev tiles, measured to the nearest occupied tile, exactly as attack range is. */
  radius: number
  damage: number
}>

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
  /** Dropped as a ground item on death. Nothing consumes it yet; there is no economy. */
  salvage: number
  /** If present, this entity detonates when it dies, damaging friend and foe alike. */
  detonation?: Detonation
  /**
   * This entity is the player's Grid Nexus, and losing it loses the Pulse. A flag rather than a
   * content id: Gate 1A hardcoded `structure.citizen.nexus`, which stopped being true the moment a
   * second faction existed.
   */
  nexus?: boolean
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
