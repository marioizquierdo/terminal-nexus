// **The rally point** — the rules layer's half of it (the owner, 2026-11-26: "instead of defensive, the script places the
// banner at the home nexus. Instead of offensive, they place the banner on the enemy nexus"): where a side's troops head
// for a Battle Round, and hold. The battle engine already sends a side's fighting units to a target area and has them
// stand there (`src/engine/pulse/target.ts`), so a rally point needs no engine change: its area is the side's target
// for the whole round. Nothing releases it mid-round (the owner settled the Rally point Experiment on hold).
//
// One area, one refusal and one route, read by everyone who needs them: the round (`src/battle/round.ts`) and a
// mission's banner (`mission.ts`) on the battlefield as it opens; the Build Phase's preview (`src/build/banner.ts`) on
// its own map; and the Battle Round's arrows (`src/view/rally-arrows.ts`). Each hands in the ground as it sees it —
// the terrain and the structures standing on it — so the same spot reads the same everywhere.

import type { ContentRegistry } from "../content/index.ts"
import { footprintBox, inBounds, tileDistance, tilesOf } from "../engine/geometry/coords.ts"
import type { Coord, Direction, Footprint, MapTerrain } from "../engine/geometry/types.ts"
import { TERRAIN } from "../engine/geometry/types.ts"
import { DistanceField, UNREACHABLE, goalsInside, goalsNear, groundFor, rankSteps, wallsOf, weightsFor } from "../engine/routing/index.ts"
import type { RankedStep } from "../engine/routing/index.ts"
import type { MatchState, PlayerId, TargetArea } from "../engine/state/types.ts"

/**
 * **Where a plan sends its troops**: a tile of the battlefield, or a place named for the side that plans it — its own
 * Nexus (`HOME_NEXUS`) or the enemy's (`ENEMY_NEXUS`). A named place reads the same on every map and from either side,
 * which is what a script needs; more places can join the list (a map's hotspot, a player's base) without changing a
 * tile's meaning.
 */
export type RallySpot = RallyTile | RallyPlace
export type RallyTile = Readonly<{ x: number; y: number }>
export const RALLY_PLACES = ["HOME_NEXUS", "ENEMY_NEXUS"] as const
export type RallyPlace = (typeof RALLY_PLACES)[number]

/** Whether a rally spot is a named place rather than a tile. */
export const isRallyPlace = (spot: RallySpot): spot is RallyPlace => typeof spot === "string"

/** A rally spot in a line of text: `25,3`, `HOME_NEXUS`. */
export const rallyWords = (spot: RallySpot): string => (isRallyPlace(spot) ? spot : `${spot.x},${spot.y}`)

/** A structure on the ground, as a rally point reads it: where it stands and the tiles it covers. */
export type RallyStructure = Readonly<{ anchor: Coord; footprint: Footprint }>

/** The ground a rally point is read on: the terrain and every structure standing on it, either side's. */
export type RallyGround = Readonly<{ terrain: MapTerrain; structures: readonly RallyStructure[] }>

/** The ground of a battlefield: its terrain and its structures (the obstacles layer), each on its own side's content. */
export function rallyGroundOf(state: MatchState, registryOf: (player: PlayerId) => ContentRegistry): RallyGround {
  const structures: RallyStructure[] = []
  for (const entity of state.entities) {
    const definition = registryOf(entity.player).get(entity.contentId)
    if (definition.layer === "obstacles") structures.push({ anchor: entity.anchor, footprint: definition.footprint })
  }
  return { terrain: state.terrain, structures }
}

const covers = (structure: RallyStructure, tile: Coord): boolean => tilesOf(structure.anchor, structure.footprint).some((each) => each.x === tile.x && each.y === tile.y)

/** The structure standing on `tile`, if any. */
export const structureOn = (ground: RallyGround, tile: Coord): RallyStructure | undefined => ground.structures.find((structure) => covers(structure, tile))

/** A structure's footprint and a ring of one round it, clipped to the battlefield. */
export function ringedArea(terrain: Pick<MapTerrain, "width" | "height">, structure: RallyStructure): TargetArea {
  return ringed(terrain, footprintBox(structure.anchor, structure.footprint))
}

function ringed(terrain: Pick<MapTerrain, "width" | "height">, box: Readonly<{ left: number; right: number; top: number; bottom: number }>): TargetArea {
  const left = Math.max(0, box.left - 1)
  const top = Math.max(0, box.top - 1)
  const right = Math.min(terrain.width - 1, box.right + 1)
  const bottom = Math.min(terrain.height - 1, box.bottom + 1)
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * **The area a rally point on a tile sends its troops to**: the footprint of the structure standing on the tile
 * (either side's) and a ring of one tile round it, so they gather at its walls; or the 3 × 3 round the tile; clipped to
 * the battlefield.
 */
export function rallyArea(ground: RallyGround, tile: Coord): TargetArea {
  const structure = structureOn(ground, tile)
  return structure === undefined ? ringed(ground.terrain, { left: tile.x, right: tile.x, top: tile.y, bottom: tile.y }) : ringedArea(ground.terrain, structure)
}

/** Why a rally point on a tile cannot be kept, as a code each reader words its own way: off the battlefield; rock
 *  with nothing built on it; no open ground in its area; no way to it from the side's Nexus. */
export type RallyRefusal = "off" | "rock" | "crowded" | "unreachable"

/**
 * **Whether troops could rally on `tile`**: `null` when they could, else why not. On the battlefield; not rock unless
 * something is built there (troops gather round a building's walls); with at least one tile of its area open ground,
 * neither rock nor built on; and — given the side's Nexus (`home`) — a route to the area from it (`rallyRoute`).
 */
export function rallyRefusal(ground: RallyGround, tile: Coord, home?: RallyStructure): RallyRefusal | null {
  const { terrain } = ground
  if (!inBounds(terrain, tile)) return "off"
  const built = structureOn(ground, tile) !== undefined
  if (!built && impassableAt(terrain, tile)) return "rock"
  const area = rallyArea(ground, tile)
  let open = false
  for (let y = area.y; y < area.y + area.height && !open; y += 1) {
    for (let x = area.x; x < area.x + area.width && !open; x += 1) {
      if (!impassableAt(terrain, { x, y }) && structureOn(ground, { x, y }) === undefined) open = true
    }
  }
  if (!open) return "crowded"
  if (home !== undefined && rallyRoute(terrain, home, area).length === 0) return "unreachable"
  return null
}

const impassableAt = (terrain: MapTerrain, tile: Coord): boolean => {
  const id = terrain.tiles[tile.y * terrain.width + tile.x]
  return id === undefined || TERRAIN[id].impassable
}

const ONE_TILE: readonly Coord[] = [{ x: 0, y: 0 }]

/**
 * **The route from a Nexus to a rally point's area**, as the march line and the Battle Round's arrows draw it: a
 * distance field toward the area over the terrain alone — rock is the only wall, every building of either side passed
 * straight through (the owner, 2026-11-25: "the line just needs to go skip buildings ... They're going to destroy the
 * building") — walked downhill a tile a step from the tile beside `from` nearest the area (of two as near, the
 * northernmost, then the westernmost), the best step first and, of two as good, the one that turns least. Not the
 * battle engine's march: that is walked by every unit at once, round each other and the buildings. Empty when there is
 * no way there.
 */
export function rallyRoute(terrain: MapTerrain, from: RallyStructure, area: TargetArea): Coord[] {
  const ground = groundFor(wallsOf(terrain, "impassable", []), ONE_TILE)
  const field = new DistanceField(ground, goalsInside(ground, ONE_TILE, area), weightsFor(terrain, ONE_TILE, "impassable") ?? undefined)
  const start = goalsNear(ground, ONE_TILE, from.anchor, from.footprint, { kind: "touch", steps: 1 })
    .filter((tile) => field.distanceAt(tile) !== UNREACHABLE)
    .sort((a, b) => field.distanceAt(a) - field.distanceAt(b) || a.y - b.y || a.x - b.x)[0]
  if (start === undefined) return []
  const path: Coord[] = [start]
  let at = start
  let facing: Direction = "e"
  const limit = terrain.width * terrain.height
  while (field.distanceAt(at) > 0 && path.length < limit) {
    const next: RankedStep | undefined = rankSteps(field, at, facing).flat().find((choice) => choice.downhill)
    if (next === undefined) break
    at = next.to
    facing = next.direction
    path.push(at)
  }
  return path
}

/** How far along a route each of its tiles is, by the battlefield's own distance (a row counts two columns). */
export function alongRoute(path: readonly Coord[]): number[] {
  const along: number[] = path.length === 0 ? [] : [0]
  for (let index = 1; index < path.length; index += 1) along.push((along[index - 1] as number) + tileDistance(path[index - 1] as Coord, path[index] as Coord))
  return along
}

/** A rally point as the round hands it to a mission: the side, its area, and what the screen calls it. Its troops head
 *  there from tick 0 and hold it. */
export type RallyOrder = Readonly<{ side: PlayerId; area: TargetArea; name: string }>

/** The sides' targets with the rally point's side sent to its area. `targets` as it is with no rally point. */
export function withRallyTarget(targets: MatchState["targets"], rally: RallyOrder | undefined): MatchState["targets"] {
  if (rally === undefined) return targets
  return { ...(targets ?? {}), [rally.side]: rally.area }
}
