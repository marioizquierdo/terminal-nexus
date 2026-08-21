// Occupancy and collision masks — engine.md 3.4.1.
//
// DESIGN DECISION (recorded in evidence/report.md, Section 3):
//
// engine.md 3.4.1 deliberately leaves mask caching to the spike, because arbitration mutates
// claimed tiles part-way through a tick, so a mask materialised once per tick is stale exactly
// when it matters. This implementation resolves that by never materialising one:
//
//   * a single `OccupancyIndex` holds, per entity layer, one Int32Array of `ordinal + 1` per tile.
//     It is built once when a tick begins and mutated in place when a move settles;
//   * a `CollisionMask` is a lazy *view* over that index — a layer list plus a terrain rule plus an
//     optional ignore set. Constructing one is O(1) and allocates no grid, so composing a fresh
//     mask per query is cheap enough that nothing is tempted to cache one;
//   * arbitration writes granted claims into a `ClaimOverlay` layered on the same index, so a mask
//     query made later in the same phase sees tiles claimed earlier in it. There is no window in
//     which a mask can answer from stale data, because there is no copy to go stale.
//
// The cost is one indexed lookup per layer per query instead of one per query. At Gate 1A sizes
// (24 x 12 tiles, ~14 actors) that is not measurable, and it removes a whole class of bug.

import { inBounds, tileIndex, tilesOf } from "./coords.ts"
import type { Coord, EntityLayer, Footprint, GridTerrain, VacatedEntry } from "./types.ts"
import { ENTITY_LAYERS, TERRAIN } from "./types.ts"

const EMPTY = 0

export type OccupantLookup = (ordinal: number) => boolean

export class OccupancyIndex {
  readonly grid: GridTerrain
  private readonly layers: Map<EntityLayer, Int32Array>

  constructor(grid: GridTerrain) {
    this.grid = grid
    this.layers = new Map()
    for (const layer of ENTITY_LAYERS) {
      this.layers.set(layer, new Int32Array(grid.width * grid.height))
    }
  }

  private slot(layer: EntityLayer): Int32Array {
    const slot = this.layers.get(layer)
    if (slot === undefined) throw new Error(`unknown entity layer: ${layer}`)
    return slot
  }

  /** Place an entity's whole footprint. Multi-tile is the same code path as one tile. */
  add(layer: EntityLayer, ordinal: number, anchor: Coord, footprint: Footprint): void {
    const slot = this.slot(layer)
    for (const tile of tilesOf(anchor, footprint)) {
      if (!inBounds(this.grid, tile)) {
        throw new Error(`footprint tile ${tile.x},${tile.y} is outside the Grid`)
      }
      const index = tileIndex(this.grid, tile)
      const existing = slot[index] ?? EMPTY
      if (existing !== EMPTY && existing !== ordinal + 1) {
        throw new Error(
          `occupancy conflict on ${layer} at (${tile.x},${tile.y}): ` +
            `#${existing - 1} already there, #${ordinal} cannot be added`,
        )
      }
      slot[index] = ordinal + 1
    }
  }

  remove(layer: EntityLayer, ordinal: number, anchor: Coord, footprint: Footprint): void {
    const slot = this.slot(layer)
    for (const tile of tilesOf(anchor, footprint)) {
      if (!inBounds(this.grid, tile)) continue
      const index = tileIndex(this.grid, tile)
      if (slot[index] === ordinal + 1) slot[index] = EMPTY
    }
  }

  move(
    layer: EntityLayer,
    ordinal: number,
    footprint: Footprint,
    from: Coord,
    to: Coord,
  ): void {
    this.remove(layer, ordinal, from, footprint)
    this.add(layer, ordinal, to, footprint)
  }

  /** The ordinal occupying `tile` on `layer`, or `null`. */
  occupantAt(layer: EntityLayer, tile: Coord): number | null {
    if (!inBounds(this.grid, tile)) return null
    const value = this.slot(layer)[tileIndex(this.grid, tile)] ?? EMPTY
    return value === EMPTY ? null : value - 1
  }
}

/**
 * Tiles claimed by a mover earlier in the same arbitration phase. Layered over the index rather
 * than written into it, so nothing observes a half-applied tick.
 */
export class ClaimOverlay {
  private readonly claims: Map<string, number>

  constructor() {
    this.claims = new Map()
  }

  private static key(layer: EntityLayer, tile: Coord): string {
    return `${layer}:${tile.x},${tile.y}`
  }

  claim(layer: EntityLayer, ordinal: number, anchor: Coord, footprint: Footprint): void {
    for (const tile of tilesOf(anchor, footprint)) {
      this.claims.set(ClaimOverlay.key(layer, tile), ordinal)
    }
  }

  claimantAt(layer: EntityLayer, tile: Coord): number | null {
    return this.claims.get(ClaimOverlay.key(layer, tile)) ?? null
  }

  get size(): number {
    return this.claims.size
  }
}

/**
 * A tile a dying entity just vacated, held blocked for a few ticks after — the owner's second
 * playtest finding: another unit stepping into a corpse's tile the instant it opens reads as a
 * glitch, not a tactical move. The overlay is deliberately the same shape as `ClaimOverlay`: a
 * lookup layered over the index rather than written into it, so a settling tile is never confused
 * with an occupied one and never needs its own entry in the occupancy arrays.
 */
export class VacatedOverlay {
  private readonly entries: Map<string, VacatedEntry>

  constructor(initial: readonly VacatedEntry[] = []) {
    this.entries = new Map(initial.map((entry) => [VacatedOverlay.key(entry.layer, entry), entry]))
  }

  private static key(layer: EntityLayer, tile: Coord): string {
    return `${layer}:${tile.x},${tile.y}`
  }

  /** Record every tile of a footprint as settling until (and including) `until`. */
  add(layer: EntityLayer, anchor: Coord, footprint: Footprint, until: number): void {
    for (const tile of tilesOf(anchor, footprint)) {
      this.entries.set(VacatedOverlay.key(layer, tile), { layer, x: tile.x, y: tile.y, until })
    }
  }

  blockedAt(layer: EntityLayer, tile: Coord): boolean {
    return this.entries.has(VacatedOverlay.key(layer, tile))
  }

  /** Entries still active at or after `tick` — what carries into the next tick's state. */
  activeAt(tick: number): VacatedEntry[] {
    return [...this.entries.values()]
      .filter((entry) => entry.until >= tick)
      .sort((a, b) => a.layer.localeCompare(b.layer) || a.y - b.y || a.x - b.x)
  }
}

export type MaskSpec = Readonly<{
  /** Layers whose occupants block. A unit definition declares these — engine.md 3.4.1. */
  layers: readonly EntityLayer[]
  /** Whether impassable terrain blocks. Air movement, for example, does not care. */
  terrain: "impassable" | "ignore"
  /** Ordinals that never block — a mover must not block itself. */
  ignore?: readonly number[]
  /** Optional extra predicate on the occupant, per the engine.md 3.4.1 signature. */
  predicate?: OccupantLookup
  /** Claims granted earlier in this arbitration phase. */
  overlay?: ClaimOverlay
  /** Tiles still settling after a death — treated as blocked, like terrain. */
  vacated?: VacatedOverlay
}>

/** A lazy view over an occupancy index. Never a materialised boolean grid — see the note above. */
export class CollisionMask {
  private readonly index: OccupancyIndex
  private readonly spec: MaskSpec
  private readonly ignored: ReadonlySet<number>

  constructor(index: OccupancyIndex, spec: MaskSpec) {
    this.index = index
    this.spec = spec
    this.ignored = new Set(spec.ignore ?? [])
  }

  /** Off-Grid tiles are blocked: a footprint may never leave the Grid. */
  blocked(tile: Coord): boolean {
    return this.blockerAt(tile) !== null
  }

  /**
   * What blocks `tile`: `"edge"`, `"terrain"`, `"settling"`, an occupying ordinal, or `null` for
   * clear. Returning the reason is what lets melee recognise "an enemy is in the tile I wanted".
   */
  blockerAt(tile: Coord): "edge" | "terrain" | "settling" | number | null {
    const grid = this.index.grid
    if (!inBounds(grid, tile)) return "edge"
    if (this.spec.terrain === "impassable") {
      const terrainId = grid.tiles[tileIndex(grid, tile)]
      if (terrainId !== undefined && TERRAIN[terrainId].impassable) return "terrain"
    }
    for (const layer of this.spec.layers) {
      if (this.spec.vacated?.blockedAt(layer, tile) === true) return "settling"
      const claimed = this.spec.overlay?.claimantAt(layer, tile) ?? null
      const occupant = claimed ?? this.index.occupantAt(layer, tile)
      if (occupant === null) continue
      if (this.ignored.has(occupant)) continue
      if (this.spec.predicate !== undefined && !this.spec.predicate(occupant)) continue
      return occupant
    }
    return null
  }

  /** A whole footprint is legal only if every tile it would cover is clear — engine.md 3.5. */
  footprintBlockerAt(
    anchor: Coord,
    footprint: Footprint,
  ): "edge" | "terrain" | "settling" | number | null {
    for (const tile of tilesOf(anchor, footprint)) {
      const blocker = this.blockerAt(tile)
      if (blocker !== null) return blocker
    }
    return null
  }

  footprintFits(anchor: Coord, footprint: Footprint): boolean {
    return this.footprintBlockerAt(anchor, footprint) === null
  }
}

export function maskFrom(index: OccupancyIndex, spec: MaskSpec): CollisionMask {
  return new CollisionMask(index, spec)
}
