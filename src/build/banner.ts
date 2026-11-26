// **The rally point** on the Build Phase (the challenge runs, step 11G; the owner's idea, 2026-10-31, named on
// 2026-11-25): where the player's troops head when the Battle Round starts, and hold; the banner is the flag drawn
// there. (The code keeps the word banner for both.)
//
// Everything here is read from the context and the plan, never from the match: the spot under a tile in a player's
// words ("the enemy Nexus", "ground near resources"), whether troops could get there, the march line drawn to it, and
// the order the Battle Round is handed (`bannerOrder`). The area, the refusal and the route are the rules layer's own
// (`src/match/rally.ts`), read here on the Build Phase's map — the structures standing, the plan's and the field's —
// so the preview and the round agree: it cannot see only what the round refuses of the plan, or what the enemy
// builds that round.

import { footprintCentre, tileDistance, tilesOf } from "../engine/geometry/coords.ts"
import type { Coord } from "../engine/geometry/types.ts"
import { rallyArea, rallyRefusal, rallyRoute } from "../match/rally.ts"
import type { RallyGround, RallyRefusal, RallyStructure } from "../match/rally.ts"
import { cardTextFor } from "../content/cards.ts"
import type { BuildContext, BuildState } from "./state.ts"
import type { BannerStance } from "./types.ts"

/** An area of the battlefield, as the match layer's target is: its north-west tile, width and height. */
export type BannerArea = Readonly<{ x: number; y: number; width: number; height: number }>

/** The banner as the screen reads it: where it stands, what it stands on in words, its stance, and whether it is the
 *  level's own (nothing to hand the Battle Round). */
export type BannerView = Readonly<{ tile: Coord; name: string; stance: BannerStance; isDefault: boolean }>

/** A spot the banner could be planted on: its words, the area its troops would head for, and — when they could not
 *  get there — why not. */
export type BannerSpot = Readonly<{ tile: Coord; name: string; area: BannerArea; refusal: string | null }>

/** What the context and plan say of the map the banner is planted on. */
type Ctx = Pick<BuildContext, "terrain" | "registry" | "standing" | "field" | "incoming" | "bannerDefault" | "landmarks" | "catalog">
type Plan = Pick<BuildState, "planned" | "banner">

/** A structure on the map — the player's, a scripted side's, or one of the plan's — with whose it is. */
type Structure = Readonly<{ contentId: string; anchor: Coord; player: "A" | "B" }>

function structuresOf(context: Ctx, plan: Pick<BuildState, "planned">): Structure[] {
  const own: Structure[] = [...context.standing, ...plan.planned].map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor, player: "A" }))
  const field: Structure[] = (context.field ?? [])
    .filter((entity) => context.registry.get(entity.contentId).layer === "obstacles")
    .map((entity) => ({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player }))
  return [...own, ...field]
}

/** The Build Phase's map as a rally point reads it: the terrain, and every structure standing or planned. */
function groundOf(context: Ctx, plan: Pick<BuildState, "planned">): RallyGround {
  return { terrain: context.terrain, structures: structuresOf(context, plan).map((structure) => footprintOf(context, structure)) }
}

const footprintOf = (context: Ctx, structure: Structure): RallyStructure => ({ anchor: structure.anchor, footprint: context.registry.get(structure.contentId).footprint })

function structureAt(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): Structure | undefined {
  return structuresOf(context, plan).find((structure) =>
    tilesOf(structure.anchor, context.registry.get(structure.contentId).footprint).some((each) => each.x === tile.x && each.y === tile.y),
  )
}

/** The tiles of the structure — standing, planned, or a scripted side's — a rally point on `tile` stands on, or `null`
 *  on open ground: what the screen lights so a rally point on a building is seen. */
export function structureTilesAt(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): readonly Coord[] | null {
  const structure = structureAt(context, plan, tile)
  return structure === undefined ? null : tilesOf(structure.anchor, context.registry.get(structure.contentId).footprint)
}

const centreOf = (context: Ctx, structure: Structure): Coord => {
  const centre = footprintCentre(context.registry.get(structure.contentId).footprint)
  return { x: structure.anchor.x + centre.x, y: structure.anchor.y + centre.y }
}

/** The enemy's Nexus on the map, when there is one. */
function enemyNexus(context: Ctx): Structure | undefined {
  return structuresOf(context, { planned: [] }).find((structure) => structure.player === "B" && context.registry.get(structure.contentId).nexus === true)
}

function ownNexus(context: Ctx): Structure | undefined {
  return structuresOf(context, { planned: [] }).find((structure) => structure.player === "A" && context.registry.get(structure.contentId).nexus === true)
}

/**
 * **The banner's default**: the level's own (`BuildContext.bannerDefault`: the enemy's Nexus, or where the level
 * sends the player's troops), else the enemy's Nexus on the map, aggressive — else the player's own Nexus, saying
 * the troops go for the nearest enemy, which is what a side with no target and no enemy Nexus does.
 */
export function defaultBanner(context: Ctx): Omit<BannerView, "isDefault"> {
  if (context.bannerDefault !== undefined) return context.bannerDefault
  const nexus = enemyNexus(context)
  if (nexus !== undefined) return { tile: centreOf(context, nexus), name: "the enemy Nexus", stance: "aggressive" }
  const home = ownNexus(context)
  return { tile: home === undefined ? { x: 0, y: 0 } : centreOf(context, home), name: "the nearest enemy", stance: "aggressive" }
}

/** The banner as it stands now: the one the player planted, or the default. */
export function currentBanner(context: Ctx, plan: Plan): BannerView {
  const fallback = defaultBanner(context)
  if (plan.banner === null) return { ...fallback, isDefault: true }
  const spot = bannerSpot(context, plan, plan.banner.tile)
  return { tile: plan.banner.tile, name: spot.name, stance: plan.banner.stance, isDefault: false }
}

/** "the enemy Nexus" as the start of a line: "The enemy Nexus". */
export function capitalised(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** A structure's name in a sentence: the menu's label, its card's title, or its short name. */
function nameOf(context: Ctx, contentId: string): string {
  return context.catalog.find((row) => row.contentId === contentId)?.label ?? cardTextFor(contentId)?.title ?? context.registry.get(contentId).short
}

const terrainAt = (context: Ctx, tile: Coord): string => context.terrain.tiles[tile.y * context.terrain.width + tile.x] ?? "terrain.rock"

/** How near, by the battlefield's own distance (a row counts two columns), a thing must be for a spot to be "near" it. */
const NEAR_RESOURCES = 6
const NEAR_ENEMY_BASE = 16
const NEAR_OWN_BASE = 12
const NEAR_LANDMARK = 10

/** Whether a tile is inside an area. */
const inside = (area: BannerArea, tile: Coord): boolean => tile.x >= area.x && tile.x < area.x + area.width && tile.y >= area.y && tile.y < area.y + area.height

/** The nearest distance from `tile` to any of `tiles`. */
function nearest(tile: Coord, tiles: readonly Coord[]): number {
  let best = Number.POSITIVE_INFINITY
  for (const each of tiles) best = Math.min(best, tileDistance(tile, each))
  return best
}

/** A spot in a player's words: the structure on it, the named place it is in, or the ground and what it is near. */
function describe(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): string {
  if (terrainAt(context, tile) === "terrain.rock") return "rock"
  const structure = structureAt(context, plan, tile)
  if (structure !== undefined) {
    const definition = context.registry.get(structure.contentId)
    if (definition.nexus === true) return structure.player === "A" ? "your Nexus" : "the enemy Nexus"
    return structure.player === "A" ? `your ${nameOf(context, structure.contentId)}` : `the enemy ${nameOf(context, structure.contentId)}`
  }
  const fallback = context.bannerDefault
  const landmarks = context.landmarks ?? []
  const named = landmarks.find((landmark) => inside(landmark, tile))
  if (named !== undefined) return named.name
  // The round's own default tile is called what the round calls it.
  if (fallback !== undefined && fallback.tile.x === tile.x && fallback.tile.y === tile.y) return fallback.name
  const structures = structuresOf(context, plan)
  const tilesOfSide = (player: "A" | "B"): Coord[] =>
    structures.filter((each) => each.player === player).flatMap((each) => tilesOf(each.anchor, context.registry.get(each.contentId).footprint))
  const deposits: Coord[] = []
  for (let y = Math.max(0, tile.y - 3); y <= Math.min(context.terrain.height - 1, tile.y + 3); y += 1) {
    for (let x = Math.max(0, tile.x - NEAR_RESOURCES); x <= Math.min(context.terrain.width - 1, tile.x + NEAR_RESOURCES); x += 1) {
      if (terrainAt(context, { x, y }) === "terrain.deposit") deposits.push({ x, y })
    }
  }
  if (nearest(tile, deposits) <= NEAR_RESOURCES) return "ground near resources"
  if (nearest(tile, tilesOfSide("B")) <= NEAR_ENEMY_BASE) return "ground near the enemy base"
  const landmark = [...landmarks].sort((a, b) => nearest(tile, areaTiles(a)) - nearest(tile, areaTiles(b)))[0]
  if (landmark !== undefined && nearest(tile, areaTiles(landmark)) <= NEAR_LANDMARK) return `ground near ${landmark.name}`
  if (nearest(tile, tilesOfSide("A")) <= NEAR_OWN_BASE) return "ground near your base"
  // A default that is itself ground ("ground in front of your base") names the ground near it too, never "ground near
  // ground in front of your base".
  if (fallback !== undefined && tileDistance(tile, fallback.tile) <= NEAR_LANDMARK) return fallback.name.startsWith("ground ") ? fallback.name : `ground near ${fallback.name}`
  return "open ground"
}

function areaTiles(area: BannerArea): Coord[] {
  const tiles: Coord[] = []
  for (let y = area.y; y < area.y + area.height; y += 1) for (let x = area.x; x < area.x + area.width; x += 1) tiles.push({ x, y })
  return tiles
}

/** What the Build Phase says when a spot is refused, by the rules layer's reason (`rallyRefusal`). */
const REFUSALS: Readonly<Record<RallyRefusal, string>> = {
  off: "Off the map.",
  rock: "Rock: no troops can stand there.",
  crowded: "No ground to stand on there.",
  unreachable: "Unreachable: no way there from your Nexus.",
}

/** Whether a spot is somewhere the troops could get to, by the round's own rule (`rallyRefusal`): on the map, not rock
 *  unless built on, with ground to stand on in its area, and — with a Nexus of the player's on the map — a way to it
 *  from the Nexus round the rock, through any building. */
export function bannerSpot(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): BannerSpot {
  const name = describe(context, plan, tile)
  const ground = groundOf(context, plan)
  const area = rallyArea(ground, tile)
  const home = ownNexus(context)
  const refusal = rallyRefusal(ground, tile, home === undefined ? undefined : footprintOf(context, home))
  return { tile, name, area, refusal: refusal === null ? null : REFUSALS[refusal] }
}

/** The march line a rally point on `tile` draws: one from the player's Nexus (the owner, 2026-11-25: "a single arrow
 *  would be better", none from the Commander), walked by the rules layer's route (`rallyRoute`): round the rock,
 *  straight through every building. A list of tiles, empty when there is no such line. */
export type BannerLines = Readonly<{ fromNexus: readonly Coord[] }>

export function bannerLines(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): BannerLines {
  const spot = bannerSpot(context, plan, tile)
  const home = ownNexus(context)
  if (spot.refusal !== null || home === undefined) return { fromNexus: [] }
  return { fromNexus: rallyRoute(context.terrain, footprintOf(context, home), spot.area) }
}

/** The order the Battle Round is handed for the rally point: its area and its words — or `null` while it is the
 *  level's own default, or a spot the troops cannot get to, so the round plays its own default. */
export function bannerOrder(context: Ctx, plan: Plan): Readonly<{ area: BannerArea; name: string }> | null {
  if (plan.banner === null) return null
  const spot = bannerSpot(context, plan, plan.banner.tile)
  if (spot.refusal !== null) return null
  return { area: spot.area, name: spot.name }
}
