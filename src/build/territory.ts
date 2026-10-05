// **Construction territory** (docs/system-design/pulse.md): where the player may build. The owner, on placing
// a building: "They also can only be built within the build-range of the other buildings, so we should also
// reflect that." On screen it is the **build range**, his word for it.
//
// - **Every structure that projects** (its content has a `constructionRadius`) lets its player build within
//   that many tiles of it, measured as range is measured: Manhattan, to the nearest tile of its footprint
//   (`footprintDistance`, `src/grid/coords.ts`). While the "Build range" Experiment is being felt, its value is
//   every projecting structure's radius (it replaces the number on the content, as "Vasse's health" replaces
//   hers).
// - **The player's Grid Nexus roots a network.** Two of the player's structures are linked when their build
//   ranges meet — share a tile, so their footprints are at most the two radii apart — and the network is
//   everything linked to the Nexus, step by step. Only a structure in the network projects: one **cut off**
//   from it keeps working (it trains, it shoots) but gives no build range. A structure that projects nothing
//   joins the network only where the network's range reaches it.
// - **A new building may be placed only where all of its footprint is inside the territory** — the tiles
//   the network projects onto — so the ground drawn as the build range is exactly where its tiles may go.
// - **A planned building projects at once**, so one Build Phase can chain outward: a Turret at the edge of
//   the range extends it for the next building.
// - **Removing or undoing a planned building is refused when another planned building needs its range**: the
//   plan always stays one that could be placed, a building at a time, from what stands (`placeableOrdinals`),
//   so a building put down only to reach further and then taken away leaves nothing beyond the range. A
//   standing building may be cut off by a removal, since a standing one keeps working.
//
// What it is not: a path. A range passes over rock, which is refused on its own, and nothing the raid stands
// is part of the player's network, nor (yet) limits it: building inside the enemy's coverage waits for a raid
// that stands buildings at the start of a Build Phase. With no Grid Nexus of the player's standing there is no
// network, and nothing can be built.
//
// Pure: the reducer's legality, its removals and the view's drawing all read one answer (`territoryOf`).

import { footprintDistance, inBounds } from "../grid/coords.ts"
import type { Coord, Footprint, GridTerrain } from "../grid/types.ts"
import type { ContentDef } from "../content/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { PlannedPlacement, StandingStructure } from "./types.ts"

/** One of the player's structures as the territory sees it: standing (`ordinal: null`) or planned. */
export type TerritoryMember = Readonly<{
  contentId: string
  anchor: Coord
  /** The planned placement's ordinal, or `null` for a structure already standing. */
  ordinal: number | null
  /** In the network: linked to the Grid Nexus, so it projects its build range. */
  linked: boolean
  /** How far it lets its player build from it, or `null` for a structure that projects nothing. */
  radius: number | null
}>

export type Territory = Readonly<{
  /** Whether a tile is inside the build range: within the radius of a structure in the network. */
  has: (tile: Coord) => boolean
  /** The player's structures, standing then planned in the order planned, each with whether it is linked. */
  members: readonly TerritoryMember[]
  /** Whether the player has a Grid Nexus standing — the network's root. Without one nothing is inside. */
  rooted: boolean
}>

/** What the territory needs of a Build Phase's context. */
export type TerritorySource = Readonly<{ grid: GridTerrain; registry: ContentRegistry; standing: readonly StandingStructure[] }>

/**
 * How far a structure lets its player build from it — `override` (the "Build range" Experiment's value)
 * for every structure that projects at all, its own `constructionRadius` without one — or `null` for one
 * that projects nothing.
 */
export function constructionRadiusOf(definition: ContentDef, override?: number): number | null {
  if (definition.constructionRadius === undefined) return null
  return override ?? definition.constructionRadius
}

/**
 * The territory a plan gives its player: the standing structures and the planned ones, linked from the Grid
 * Nexus as far as their build ranges meet, and every tile within the radius of a linked one. `radius` is the
 * "Build range" Experiment's value (`constructionRadiusOf`).
 */
export function territoryOf(source: TerritorySource, planned: readonly PlannedPlacement[], radius?: number): Territory {
  const { grid, registry } = source
  type Draft = { contentId: string; anchor: Coord; ordinal: number | null; footprint: Footprint; radius: number | null; linked: boolean }
  const draft = (contentId: string, anchor: Coord, ordinal: number | null): Draft => {
    const definition = registry.get(contentId)
    return { contentId, anchor, ordinal, footprint: definition.footprint, radius: constructionRadiusOf(definition, radius), linked: false }
  }
  const members: Draft[] = [
    ...source.standing.map((structure) => draft(structure.contentId, structure.anchor, null)),
    ...planned.map((placement) => draft(placement.contentId, placement.anchor, placement.ordinal)),
  ]

  // The network, from the Nexus outward: a structure joins when its range and a member's meet — or, for one
  // that projects nothing, when a member's range reaches it.
  const queue: Draft[] = []
  for (const member of members) {
    if (member.ordinal === null && registry.get(member.contentId).nexus === true) {
      member.linked = true
      queue.push(member)
    }
  }
  const rooted = queue.length > 0
  while (queue.length > 0) {
    const from = queue.shift() as Draft
    if (from.radius === null) continue
    for (const other of members) {
      if (other.linked) continue
      const distance = footprintDistance(from.anchor, from.footprint, other.anchor, other.footprint)
      if (distance <= from.radius + (other.radius ?? 0)) {
        other.linked = true
        queue.push(other)
      }
    }
  }

  // The ground it projects onto: every tile within a linked member's radius, on the Grid. Counted in the tiles'
  // own coordinates, not as offsets from the centre: the offset `-across` is `-0` at the diamond's tips, and a
  // `-0` in a coordinate slows every frame (docs/history/lessons-learned.md, "A negative zero in a coordinate").
  const inside = new Uint8Array(grid.width * grid.height)
  for (const member of members) {
    if (!member.linked || member.radius === null) continue
    const reach = member.radius
    for (const offset of member.footprint) {
      const centre = { x: member.anchor.x + offset.x, y: member.anchor.y + offset.y }
      for (let y = centre.y - reach; y <= centre.y + reach; y += 1) {
        const across = reach - Math.abs(y - centre.y)
        for (let x = centre.x - across; x <= centre.x + across; x += 1) {
          if (inBounds(grid, { x, y })) inside[y * grid.width + x] = 1
        }
      }
    }
  }

  return {
    has: (tile) => inBounds(grid, tile) && inside[tile.y * grid.width + tile.x] === 1,
    members: members.map(({ contentId, anchor, ordinal, linked, radius: own }) => ({ contentId, anchor, ordinal, linked, radius: own })),
    rooted,
  }
}

/** Whether all of a footprint anchored at `anchor` is inside the territory — the placement rule. */
export function wholeInside(territory: Territory, anchor: Coord, footprint: Footprint): boolean {
  return footprint.every((offset) => territory.has({ x: anchor.x + offset.x, y: anchor.y + offset.y }))
}

/**
 * The planned buildings that could be placed, a building at a time, from what stands: each wholly inside the
 * territory of the standing structures and the ones placed before it, in whatever order works. Placing only ever
 * grows the territory, so taking every building that fits, again and again until none is left that does, finds
 * them all. A plan made by the reducer's own placements holds only such buildings — unless the Experiment's
 * radius changed under it.
 */
export function placeableOrdinals(source: TerritorySource, planned: readonly PlannedPlacement[], radius?: number): ReadonlySet<number> {
  const placed: PlannedPlacement[] = []
  const waiting = [...planned]
  for (let progress = true; progress && waiting.length > 0; ) {
    const territory = territoryOf(source, placed, radius)
    const fitting = waiting.filter((placement) => wholeInside(territory, placement.anchor, source.registry.get(placement.contentId).footprint))
    progress = fitting.length > 0
    for (const placement of fitting) {
      placed.push(placement)
      waiting.splice(waiting.indexOf(placement), 1)
    }
  }
  return new Set(placed.map((placement) => placement.ordinal))
}

/**
 * The planned buildings that would be stranded outside the build range if the one with ordinal `ordinal` were
 * removed — placeable now, not without it — in the order planned. Empty when nothing needs it.
 */
export function strandedByRemoving(
  source: TerritorySource,
  planned: readonly PlannedPlacement[],
  ordinal: number,
  radius?: number,
): readonly PlannedPlacement[] {
  const before = placeableOrdinals(source, planned, radius)
  const remaining = planned.filter((placement) => placement.ordinal !== ordinal)
  const after = placeableOrdinals(source, remaining, radius)
  return remaining.filter((placement) => before.has(placement.ordinal) && !after.has(placement.ordinal))
}
