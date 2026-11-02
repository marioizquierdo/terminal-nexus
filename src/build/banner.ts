// **The battle banner** on the Build Phase (the challenge runs, step 11G; the owner's idea, 2026-10-31): where the
// player's troops head when the Battle Round starts, and whether they push on from there or hold it. Behind the
// Battle banner Experiment.
//
// Everything here is read from the context and the plan, never from the match: the spot under a tile in a player's
// words ("the enemy Nexus", "ground near resources"), whether troops could get there, the march lines drawn to it, and
// the order the Battle Round is handed (`bannerOrder`, which the shell turns into the match layer's `BannerOrder`).
//
// **The lines are the march route, walked on the Build Phase's own map**: a distance field toward the banner's area
// over the terrain and every structure standing or planned (`src/routing/`, the kernel's own routing), walked downhill
// from the side of the player's Nexus nearest the banner and from the Commander, a tile a step — the way a lone trooper
// with the road clear would walk it. Not the kernel's march itself: that is walked by every unit at once, round each
// other, fighting what comes in reach; this is the line it keeps to with nobody in the way.

import { footprintBox, footprintCentre, gridDistance, inBounds, tilesOf } from "../grid/coords.ts"
import type { Coord, Direction } from "../grid/types.ts"
import { DistanceField, UNREACHABLE, goalsInside, goalsNear, groundFor, rankSteps, wallsOf, weightsFor } from "../routing/index.ts"
import type { Ground, RankedStep } from "../routing/index.ts"
import { cardTextFor } from "../content/cards.ts"
import type { BuildContext, BuildState } from "./state.ts"
import type { BannerStance } from "./types.ts"

/** An area of the Grid, as the match layer's target is: its north-west tile, width and height. */
export type BannerArea = Readonly<{ x: number; y: number; width: number; height: number }>

/** The banner as the screen reads it: where it stands, what it stands on in words, its stance, and whether it is the
 *  level's own (nothing to hand the Battle Round). */
export type BannerView = Readonly<{ tile: Coord; name: string; stance: BannerStance; isDefault: boolean }>

/** A spot the banner could be planted on: its words, the area its troops would head for, and — when they could not
 *  get there — why not. */
export type BannerSpot = Readonly<{ tile: Coord; name: string; area: BannerArea; refusal: string | null }>

/** What the context and plan say of the map the banner is planted on. */
type Ctx = Pick<BuildContext, "grid" | "registry" | "standing" | "field" | "incoming" | "commander" | "bannerDefault" | "landmarks" | "catalog">
type Plan = Pick<BuildState, "planned" | "banner">

const ONE_TILE: readonly Coord[] = [{ x: 0, y: 0 }]

/** A structure on the map — the player's, a scripted side's, or one of the plan's — with whose it is. */
type Structure = Readonly<{ contentId: string; anchor: Coord; player: "A" | "B" }>

function structuresOf(context: Ctx, plan: Pick<BuildState, "planned">): Structure[] {
  const own: Structure[] = [...context.standing, ...plan.planned].map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor, player: "A" }))
  const field: Structure[] = (context.field ?? [])
    .filter((entity) => context.registry.get(entity.contentId).layer === "obstacles")
    .map((entity) => ({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player }))
  return [...own, ...field]
}

function structureAt(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): Structure | undefined {
  return structuresOf(context, plan).find((structure) =>
    tilesOf(structure.anchor, context.registry.get(structure.contentId).footprint).some((each) => each.x === tile.x && each.y === tile.y),
  )
}

const centreOf = (context: Ctx, structure: Structure): Coord => {
  const centre = footprintCentre(context.registry.get(structure.contentId).footprint)
  return { x: structure.anchor.x + centre.x, y: structure.anchor.y + centre.y }
}

/** The enemy's Grid Nexus on the map, when there is one. */
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

const terrainAt = (context: Ctx, tile: Coord): string => context.grid.tiles[tile.y * context.grid.width + tile.x] ?? "terrain.rock"

/** How near, by the Grid's own distance (a row counts two columns), a thing must be for a spot to be "near" it. */
const NEAR_RESOURCES = 6
const NEAR_ENEMY_BASE = 16
const NEAR_OWN_BASE = 12
const NEAR_LANDMARK = 10

/** Whether a tile is inside an area. */
const inside = (area: BannerArea, tile: Coord): boolean => tile.x >= area.x && tile.x < area.x + area.width && tile.y >= area.y && tile.y < area.y + area.height

/** The nearest distance from `tile` to any of `tiles`. */
function nearest(tile: Coord, tiles: readonly Coord[]): number {
  let best = Number.POSITIVE_INFINITY
  for (const each of tiles) best = Math.min(best, gridDistance(tile, each))
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
  const structures = structuresOf(context, plan)
  const tilesOfSide = (player: "A" | "B"): Coord[] =>
    structures.filter((each) => each.player === player).flatMap((each) => tilesOf(each.anchor, context.registry.get(each.contentId).footprint))
  const deposits: Coord[] = []
  for (let y = Math.max(0, tile.y - 3); y <= Math.min(context.grid.height - 1, tile.y + 3); y += 1) {
    for (let x = Math.max(0, tile.x - NEAR_RESOURCES); x <= Math.min(context.grid.width - 1, tile.x + NEAR_RESOURCES); x += 1) {
      if (terrainAt(context, { x, y }) === "terrain.deposit") deposits.push({ x, y })
    }
  }
  if (nearest(tile, deposits) <= NEAR_RESOURCES) return "ground near resources"
  if (nearest(tile, tilesOfSide("B")) <= NEAR_ENEMY_BASE) return "ground near the enemy base"
  const landmark = [...landmarks].sort((a, b) => nearest(tile, areaTiles(a)) - nearest(tile, areaTiles(b)))[0]
  if (landmark !== undefined && nearest(tile, areaTiles(landmark)) <= NEAR_LANDMARK) return `ground near ${landmark.name}`
  if (nearest(tile, tilesOfSide("A")) <= NEAR_OWN_BASE) return "ground near your base"
  if (fallback !== undefined && gridDistance(tile, fallback.tile) <= NEAR_LANDMARK) return `ground near ${fallback.name}`
  return "open ground"
}

function areaTiles(area: BannerArea): Coord[] {
  const tiles: Coord[] = []
  for (let y = area.y; y < area.y + area.height; y += 1) for (let x = area.x; x < area.x + area.width; x += 1) tiles.push({ x, y })
  return tiles
}

/** The area troops head for when the banner stands on `tile`: a structure's footprint and a tile round it, so they
 *  gather at its walls; on open ground three tiles by three round the banner. Clipped to the map. */
function areaFor(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): BannerArea {
  const structure = structureAt(context, plan, tile)
  const box = structure === undefined ? { left: tile.x, right: tile.x, top: tile.y, bottom: tile.y } : footprintBox(structure.anchor, context.registry.get(structure.contentId).footprint)
  const left = Math.max(0, box.left - 1)
  const top = Math.max(0, box.top - 1)
  const right = Math.min(context.grid.width - 1, box.right + 1)
  const bottom = Math.min(context.grid.height - 1, box.bottom + 1)
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/** The ground a lone trooper walks: the terrain, and every structure standing or planned as a wall. */
function groundOf(context: Ctx, plan: Pick<BuildState, "planned">): Ground {
  const blocked = structuresOf(context, plan).flatMap((structure) => tilesOf(structure.anchor, context.registry.get(structure.contentId).footprint))
  return groundFor(wallsOf(context.grid, "impassable", blocked), ONE_TILE)
}

/** A field toward an area over that ground, the terrain's weights counted as a route counts them. */
function fieldToward(context: Ctx, ground: Ground, area: BannerArea): DistanceField {
  return new DistanceField(ground, goalsInside(ground, ONE_TILE, area), weightsFor(context.grid, ONE_TILE, "impassable") ?? undefined)
}

/** The open tiles touching a structure, where its troops step out. */
function ringOf(context: Ctx, ground: Ground, structure: Structure): Coord[] {
  return goalsNear(ground, ONE_TILE, structure.anchor, context.registry.get(structure.contentId).footprint, { kind: "touch", steps: 1 })
}

/** Whether a spot is somewhere the troops could get to: not rock, with ground to stand on in its area, and — with a
 *  Nexus of the player's on the map — a way to it from the Nexus. */
export function bannerSpot(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord): BannerSpot {
  const name = describe(context, plan, tile)
  const area = areaFor(context, plan, tile)
  if (!inBounds(context.grid, tile)) return { tile, name, area, refusal: "Off the map." }
  if (terrainAt(context, tile) === "terrain.rock") return { tile, name, area, refusal: "Rock: no troops can stand there." }
  const ground = groundOf(context, plan)
  if (goalsInside(ground, ONE_TILE, area).length === 0) return { tile, name, area, refusal: "No ground to stand on there." }
  const home = ownNexus(context)
  if (home !== undefined) {
    const field = fieldToward(context, ground, area)
    if (!ringOf(context, ground, home).some((start) => field.distanceAt(start) !== UNREACHABLE)) {
      return { tile, name, area, refusal: "Unreachable: no way there from your Nexus." }
    }
  }
  return { tile, name, area, refusal: null }
}

/** The way from `from` down `field` to its goal, a tile a step, the best step first and, of two as good, the one that
 *  turns least — the first in compass order after that. Empty when the field does not reach `from`. */
function walkDown(field: DistanceField, from: Coord, limit: number): Coord[] {
  if (field.distanceAt(from) === UNREACHABLE) return []
  const path: Coord[] = [from]
  let at = from
  let facing: Direction = "e"
  while (field.distanceAt(at) > 0 && path.length < limit) {
    const next: RankedStep | undefined = rankSteps(field, at, facing).flat().find((choice) => choice.downhill)
    if (next === undefined) break
    at = next.to
    facing = next.direction
    path.push(at)
  }
  return path
}

/** The march lines a banner on `tile` draws: from the player's Nexus, from the Commander, and — aggressive — on from
 *  the banner to the enemy. Each a list of tiles, empty when there is no such line. */
export type BannerLines = Readonly<{ fromNexus: readonly Coord[]; fromCommander: readonly Coord[]; onward: readonly Coord[] }>

/** Where the player's Commander stands this round: on the field, or where she arrives. */
function commanderTile(context: Ctx): Coord | null {
  const id = context.commander?.contentId
  if (id === undefined) return null
  const standing = (context.field ?? []).find((entity) => entity.player === "A" && entity.contentId === id)
  if (standing !== undefined) return standing.anchor
  const arriving = (context.incoming ?? []).find((entity) => entity.player === "A" && entity.contentId === id)
  return arriving?.anchor ?? null
}

/** What an aggressive banner's troops go on to: the enemy's Nexus, or — with none — the nearest enemy on the map or
 *  arriving as the round starts. */
function onwardGoal(context: Ctx, from: Coord): BannerArea | null {
  const nexus = enemyNexus(context)
  if (nexus !== undefined) return areaFor(context, { planned: [] }, centreOf(context, nexus))
  const enemies = [
    ...(context.field ?? []).filter((entity) => entity.player === "B" && context.registry.get(entity.contentId).layer !== "obstacles").map((entity) => entity.anchor),
    ...(context.incoming ?? []).filter((entity) => entity.player === "B" && entity.tick === 0).map((entity) => entity.anchor),
  ]
  if (enemies.length === 0) return null
  const closest = [...enemies].sort((a, b) => gridDistance(from, a) - gridDistance(from, b) || a.y - b.y || a.x - b.x)[0] as Coord
  return { x: closest.x - 1, y: closest.y - 1, width: 3, height: 3 }
}

export function bannerLines(context: Ctx, plan: Pick<BuildState, "planned">, tile: Coord, stance: BannerStance): BannerLines {
  const spot = bannerSpot(context, plan, tile)
  if (spot.refusal !== null) return { fromNexus: [], fromCommander: [], onward: [] }
  const ground = groundOf(context, plan)
  const field = fieldToward(context, ground, spot.area)
  const limit = context.grid.width * context.grid.height
  const home = ownNexus(context)
  let fromNexus: Coord[] = []
  if (home !== undefined) {
    const starts = ringOf(context, ground, home).filter((start) => field.distanceAt(start) !== UNREACHABLE)
    const start = [...starts].sort((a, b) => field.distanceAt(a) - field.distanceAt(b) || a.y - b.y || a.x - b.x)[0]
    if (start !== undefined) fromNexus = walkDown(field, start, limit)
  }
  const commander = commanderTile(context)
  const fromCommander = commander === null ? [] : walkDown(field, commander, limit)
  let onward: Coord[] = []
  if (stance === "aggressive") {
    const goal = onwardGoal(context, tile)
    const from = fromNexus[fromNexus.length - 1] ?? tile
    if (goal !== null && !inside(goal, from)) {
      const beyond = new DistanceField(ground, goalsInside(ground, ONE_TILE, goal), weightsFor(context.grid, ONE_TILE, "impassable") ?? undefined)
      onward = walkDown(beyond, from, limit)
    }
  }
  return { fromNexus, fromCommander, onward }
}

/** The order the Battle Round is handed for the banner: its area, its words and its stance — or `null` while it is
 *  the level's own default (or the Experiment is off, which the caller checks), so the round plays as it always did. */
export function bannerOrder(context: Ctx, plan: Plan): Readonly<{ area: BannerArea; name: string; stance: BannerStance }> | null {
  if (plan.banner === null) return null
  const spot = bannerSpot(context, plan, plan.banner.tile)
  if (spot.refusal !== null) return null
  return { area: spot.area, name: spot.name, stance: plan.banner.stance }
}
