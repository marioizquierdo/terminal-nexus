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
// - **Only what stands projects** (the owner, round 5: "building range should only count for buildings already
//   placed from previous round ... Expansing territory is only done at next round"): a building planned in this
//   Build Phase gives no build range until it stands, next round. So the range is fixed for the whole phase,
//   worked out once from what stands (`territoryOf` keeps it), and removing or undoing a planned building can
//   never leave another outside it.
// - **A new building may be placed where any tile of its footprint is inside the range** (the owner, round 5:
//   "should allow to build if at least 1 building tile is within range (not the whole building). This is
//   important for large buildings otherwise they have no space to build"); rock, another building and the map's
//   edge are still refused tile by tile.
// - **A building that makes units keeps room round it** (its content's `clearance`; the owner, round 5:
//   "barraks and other spawning buildings should require minimum distance from other buildings so they leave
//   space for units spawning"): no tile of another building may stand within that many tiles of it, measured as
//   range is (`crowding`). Every building on the map counts — standing or planned, the player's or the raid's,
//   the Grid Nexus too — and it holds both ways: for a building placed near one, and for one placed near any
//   building. While the "Barracks room" Experiment is being felt, its value is every such building's room.
//
// What it is not: a path. A range passes over rock, which is refused on its own, and nothing the raid stands
// is part of the player's network, nor (yet) limits it: building inside the enemy's coverage waits for a raid
// that stands buildings at the start of a Build Phase. With no Grid Nexus of the player's standing there is no
// network, and nothing can be built.
//
// Pure: the reducer's legality and the view's drawing all read one answer (`territoryOf`, `crowding`).

import { footprintDistance, inBounds } from "../grid/coords.ts"
import type { Coord, Footprint, GridTerrain } from "../grid/types.ts"
import type { ContentDef } from "../content/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { StandingStructure } from "./types.ts"

/** One of the player's standing structures as the territory sees it. */
export type TerritoryMember = Readonly<{
  contentId: string
  anchor: Coord
  /** In the network: linked to the Grid Nexus, so it projects its build range. */
  linked: boolean
  /** How far it lets its player build from it, or `null` for a structure that projects nothing. */
  radius: number | null
}>

export type Territory = Readonly<{
  /** Whether a tile is inside the build range: within the radius of a structure in the network. */
  has: (tile: Coord) => boolean
  /** The player's standing structures, each with whether it is linked. */
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
 * The build range a Build Phase opens with, and keeps: the standing structures linked from the Grid Nexus as far
 * as their build ranges meet, and every tile within the radius of a linked one. `radius` is the "Build range"
 * Experiment's value (`constructionRadiusOf`). Nothing planned is part of it, so it is worked out once for a
 * context and a radius and kept (the context never changes while its screen is open; the radius is an
 * Experiment that may).
 */
export function territoryOf(source: TerritorySource, radius?: number): Territory {
  let kept = TERRITORIES.get(source)
  if (kept === undefined) {
    kept = new Map()
    TERRITORIES.set(source, kept)
  }
  const key = radius ?? "own"
  const known = kept.get(key)
  if (known !== undefined) return known
  const territory = workOut(source, radius)
  kept.set(key, territory)
  return territory
}

/** Every territory worked out, by its source and its radius: a context's range is asked for by every frame. */
const TERRITORIES = new WeakMap<TerritorySource, Map<number | "own", Territory>>()

function workOut(source: TerritorySource, radius?: number): Territory {
  const { grid, registry } = source
  type Draft = { contentId: string; anchor: Coord; footprint: Footprint; radius: number | null; linked: boolean }
  const members: Draft[] = source.standing.map((structure) => {
    const definition = registry.get(structure.contentId)
    return { contentId: structure.contentId, anchor: structure.anchor, footprint: definition.footprint, radius: constructionRadiusOf(definition, radius), linked: false }
  })

  // The network, from the Nexus outward: a structure joins when its range and a member's meet — or, for one
  // that projects nothing, when a member's range reaches it.
  const queue: Draft[] = []
  for (const member of members) {
    if (registry.get(member.contentId).nexus === true) {
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
    members: members.map(({ contentId, anchor, linked, radius: own }) => ({ contentId, anchor, linked, radius: own })),
    rooted,
  }
}

/** Whether any tile of a footprint anchored at `anchor` is inside the territory — the placement rule. */
export function anyInside(territory: Territory, anchor: Coord, footprint: Footprint): boolean {
  return footprint.some((offset) => territory.has({ x: anchor.x + offset.x, y: anchor.y + offset.y }))
}

// --- Room around a building that makes units ----------------------------------------------------------------

/** A building on the map, as the room rule sees it: what it is, and where. */
export type Footing = Readonly<{ contentId: string; anchor: Coord }>

/**
 * How many tiles a structure keeps free round it — `override` (the "Barracks room" Experiment's value) for every
 * structure that keeps room at all, its own `clearance` without one — or `null` for one that keeps none.
 */
export function clearanceOf(definition: ContentDef, override?: number): number | null {
  if (definition.clearance === undefined) return null
  return override ?? definition.clearance
}

/**
 * Why a building would stand too close to another: the building it is too near, and whose room it would stand
 * in — `its`, the other one's, a building that makes units; or `own`, the room of the one being placed.
 */
export type Crowding = Readonly<{ near: Footing; room: "its" | "own" }>

/**
 * **The room rule**: the building on the map (`buildings`: standing, planned, the raid's) that `contentId`
 * anchored at `anchor` would stand too close to, or `null` when there is none. Too close is within the room
 * either of the two keeps (`clearanceOf`), measured as range is. The nearest is named, the first listed on a
 * tie. A building it would overlap is the occupancy check's to refuse, which comes first.
 */
export function crowding(
  registry: ContentRegistry,
  buildings: readonly Footing[],
  contentId: string,
  anchor: Coord,
  override?: number,
): Crowding | null {
  const definition = registry.get(contentId)
  const own = clearanceOf(definition, override) ?? 0
  let found: Readonly<{ near: Footing; distance: number; room: "its" | "own" }> | null = null
  for (const other of buildings) {
    const theirs = clearanceOf(registry.get(other.contentId), override) ?? 0
    const keep = Math.max(own, theirs)
    if (keep === 0) continue
    const distance = footprintDistance(anchor, definition.footprint, other.anchor, registry.get(other.contentId).footprint)
    if (distance > keep || (found !== null && distance >= found.distance)) continue
    found = { near: other, distance, room: theirs >= distance ? "its" : "own" }
  }
  return found === null ? null : { near: found.near, room: found.room }
}
