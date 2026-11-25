// **The rally arrows** (the owner's playtest, 2026-11-25): during the Battle Round, a few arrows run from a side's Nexus
// to where its troops head — its rally point, the enemy's Nexus by default — like a pulse travelling along the line,
// then vanish. The player's run every `rallyArrowsEveryMs`, `rallyArrowsCount` at a time, while its troops still
// head there ("remind the player that the banner is in there"); the enemy's run once, as the battle begins, a couple
// of arrows and its flag for a few seconds ("a single effect that shows a couple of arrows that go to the banner").
//
// A map mark, as the raid's intent trail is, not an effect recipe: the scene draws it (`drawRallyMarks`,
// `pulse-scene.ts`), on open plain ground only, never over a glyph that stands (the corruption law). Everything here
// is a pure function of the resolved Pulse and the presentation time: the route is walked once per round from the
// opening state (`rallyPlan`), and what shows at an instant (`rallyMarksAt`) reads only that plan, the time and the
// state's own targets at that tick — so a side whose target is released (an aggressive rally point reached) shows
// nothing from that tick on. Nothing here reaches the state: a match resolves the same with it deleted.
//
// **The route is walked the way the Build Phase's line is** (`bannerLines`, `src/build/banner.ts`): a distance field
// toward the target's area over the battlefield's terrain, every structure standing at the opening a wall — but the
// ones the area itself covers (the enemy Nexus, when that is the target) — walked downhill a tile a step from the
// open tile beside the side's Nexus nearest the target, the best step first and, of two as good, the one that turns
// least.

import { inBounds, tileDistance, tilesOf } from "../engine/geometry/coords.ts"
import type { Coord, Direction } from "../engine/geometry/types.ts"
import { DistanceField, UNREACHABLE, goalsInside, goalsNear, groundFor, rankSteps, wallsOf, weightsFor } from "../engine/routing/index.ts"
import type { RankedStep } from "../engine/routing/index.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { MatchState, PlayerId, TargetArea } from "../engine/state/types.ts"
import { LOOK_AHEAD } from "./build-map.ts"

/** How long an arrow takes to go one column's distance along the route (a row is two): about thirty columns a second,
 *  so the pulse crosses the Crossing in a couple of seconds. Slowed for a long route, so a pulse is over well before
 *  the next (`PULSE_SHARE`). */
export const RALLY_STEP_MS = 30
/** How far apart, along the route, the arrows of one pulse run: the raid trail's spacing. */
export const RALLY_SPACING = 4
/** At most this share of the time between two pulses is spent on one: the line is quiet between them. */
const PULSE_SHARE = 0.6
/** At least this long a pulse runs, slowed on a short route, so it is seen rather than blinked. */
const SHORTEST_PULSE_MS = 1200
/** How long, at least, a pulse holds under reduced motion, its arrows still. */
const STILL_MS = 1500
/** How many arrows the enemy's one pulse sends: the owner's "a couple". */
export const ENEMY_ARROWS = 2
/** How long the enemy's flag stands as the battle begins: a few seconds. */
export const ENEMY_FLAG_MS = 4000

/** One side's route: where its troops head, the tiles from beside its Nexus to there, how far along each tile is by
 *  the battlefield's own distance, and the tile the flag is drawn on (the area's middle: the rally point's own tile). */
export type RallyRoute = Readonly<{ player: PlayerId; area: TargetArea; path: readonly Coord[]; along: readonly number[]; flag: Coord }>

/** What the round shows of each side's route, worked out once: the routes, the pace, and when the shooting stops. */
export type RallyPlan = Readonly<{
  routes: Readonly<Partial<Record<PlayerId, RallyRoute>>>
  everyMs: number
  count: number
  /** When the fight stops: no arrows from then on. */
  stopMs: number
}>

/** What shows at an instant: an arrow on a tile pointing `dx`, `dy`, or a side's flag. */
export type RallyMark = Readonly<{ kind: "arrow"; tile: Coord; dx: number; dy: number; player: PlayerId }> | Readonly<{ kind: "flag"; tile: Coord; player: PlayerId }>

const ONE_TILE: readonly Coord[] = [{ x: 0, y: 0 }]

const overlaps = (area: TargetArea, tile: Coord): boolean =>
  tile.x >= area.x && tile.x < area.x + area.width && tile.y >= area.y && tile.y < area.y + area.height

/** Whether two areas are the same: the side still heads where the route was walked to. */
export const sameArea = (a: TargetArea | undefined, b: TargetArea): boolean =>
  a !== undefined && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

/** The route of `player`'s troops to their target in `opening`, or `null` with no target, no Nexus or no way there. */
export function rallyRoute(opening: MatchState, registry: ContentRegistry, player: PlayerId): RallyRoute | null {
  const area = opening.targets?.[player]
  if (area === undefined) return null
  const { terrain } = opening
  const structures = opening.entities.filter((entity) => registry.get(entity.contentId).layer === "obstacles")
  const nexus = structures.find((entity) => entity.player === player && registry.get(entity.contentId).nexus === true)
  if (nexus === undefined) return null
  const blocked = structures.flatMap((entity) => {
    const tiles = tilesOf(entity.anchor, registry.get(entity.contentId).footprint)
    return tiles.some((tile) => overlaps(area, tile)) ? [] : tiles
  })
  const ground = groundFor(wallsOf(terrain, "impassable", blocked), ONE_TILE)
  const field = new DistanceField(ground, goalsInside(ground, ONE_TILE, area), weightsFor(terrain, ONE_TILE, "impassable") ?? undefined)
  const starts = goalsNear(ground, ONE_TILE, nexus.anchor, registry.get(nexus.contentId).footprint, { kind: "touch", steps: 1 })
    .filter((start) => field.distanceAt(start) !== UNREACHABLE)
    .sort((a, b) => field.distanceAt(a) - field.distanceAt(b) || a.y - b.y || a.x - b.x)
  const start = starts[0]
  if (start === undefined) return null
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
  const along: number[] = [0]
  for (let index = 1; index < path.length; index += 1) along.push((along[index - 1] as number) + tileDistance(path[index - 1] as Coord, path[index] as Coord))
  const flag = { x: area.x + Math.floor(area.width / 2), y: area.y + Math.floor(area.height / 2) }
  return { player, area, path, along, flag: inBounds(terrain, flag) ? flag : (path[path.length - 1] as Coord) }
}

/** Both sides' routes, from the round's opening state, with the pace the tuned values give. */
export function rallyPlan(opening: MatchState, registry: ContentRegistry, pace: Readonly<{ everyMs: number; count: number; stopMs: number }>): RallyPlan {
  const routes: Partial<Record<PlayerId, RallyRoute>> = {}
  for (const player of ["A", "B"] as const) {
    const route = rallyRoute(opening, registry, player)
    if (route !== null) routes[player] = route
  }
  return { routes, everyMs: Math.max(1, pace.everyMs), count: Math.max(0, Math.round(pace.count)), stopMs: pace.stopMs }
}

/** How long one arrow takes per column's distance on `route`: `RALLY_STEP_MS` — slower on a short route, so a pulse
 *  lasts `SHORTEST_PULSE_MS`, and faster on a long one, so a pulse of `count` arrows is over within its share of the
 *  time between two. */
function stepMsOf(route: RallyRoute, count: number, everyMs: number): number {
  const length = (route.along[route.along.length - 1] ?? 0) + RALLY_SPACING * Math.max(0, count - 1) + 1
  const slowest = Math.max(RALLY_STEP_MS, SHORTEST_PULSE_MS / length)
  return Math.min(slowest, (everyMs * PULSE_SHARE) / length)
}

/** How long one pulse lasts on `route`: until its last arrow reaches the end (held at least `STILL_MS` when still). */
export function pulseLengthMs(route: RallyRoute, count: number, everyMs: number, reducedMotion: boolean): number {
  const step = stepMsOf(route, count, everyMs)
  const moving = ((route.along[route.along.length - 1] ?? 0) + RALLY_SPACING * Math.max(0, count - 1) + 1) * step
  return reducedMotion ? Math.max(STILL_MS, moving) : moving
}

/** The index of the last tile of `route` that `distance` along it has reached. */
function tileIndexAt(route: RallyRoute, distance: number): number {
  let index = 0
  while (index < route.path.length - 1 && (route.along[index + 1] as number) <= distance) index += 1
  return index
}

function arrowAt(route: RallyRoute, index: number): RallyMark {
  const tile = route.path[index] as Coord
  const toward = route.path[index + LOOK_AHEAD] ?? route.flag
  return { kind: "arrow", tile, dx: toward.x - tile.x, dy: toward.y - tile.y, player: route.player }
}

/** The arrows of one pulse `localMs` into it, `count` of them: moving, the first leading, `RALLY_SPACING` apart;
 *  still (reduced motion), standing evenly along the route, the last beside the flag. */
function pulseArrows(route: RallyRoute, count: number, everyMs: number, localMs: number, reducedMotion: boolean): RallyMark[] {
  if (count <= 0 || route.path.length < 2) return []
  if (localMs < 0 || localMs >= pulseLengthMs(route, count, everyMs, reducedMotion)) return []
  const end = route.along[route.along.length - 1] as number
  const marks: RallyMark[] = []
  if (reducedMotion) {
    for (let index = 1; index <= count; index += 1) marks.push(arrowAt(route, tileIndexAt(route, (end * index) / (count + 1))))
    return marks
  }
  const travelled = localMs / stepMsOf(route, count, everyMs)
  for (let index = 0; index < count; index += 1) {
    const distance = travelled - index * RALLY_SPACING
    if (distance < 0 || distance > end) continue
    marks.push(arrowAt(route, tileIndexAt(route, distance)))
  }
  return marks
}

/**
 * What shows of the rally points at `timeMs`, given the targets the state holds at that instant: the player's (side
 * A's) arrows on each pulse, every `everyMs` from the start, its flag while they run; the enemy's (side B's) one
 * pulse at the start, `ENEMY_ARROWS` of them, and its flag for `ENEMY_FLAG_MS`. A side whose target is no longer the
 * one its route was walked to (released, or changed by the level) shows nothing; nothing at all once the shooting
 * stops. Pure: the same plan, time, targets and motion give the same marks.
 */
export function rallyMarksAt(plan: RallyPlan, timeMs: number, targets: MatchState["targets"], reducedMotion: boolean): RallyMark[] {
  if (timeMs < 0 || timeMs >= plan.stopMs) return []
  const marks: RallyMark[] = []
  const own = plan.routes.A
  if (own !== undefined && sameArea(targets?.A, own.area)) {
    const localMs = timeMs - Math.floor(timeMs / plan.everyMs) * plan.everyMs
    const arrows = pulseArrows(own, plan.count, plan.everyMs, localMs, reducedMotion)
    if (arrows.length > 0 || localMs < pulseLengthMs(own, plan.count, plan.everyMs, reducedMotion)) {
      marks.push(...arrows)
      if (plan.count > 0) marks.push({ kind: "flag", tile: own.flag, player: "A" })
    }
  }
  const enemy = plan.routes.B
  if (enemy !== undefined && sameArea(targets?.B, enemy.area)) {
    marks.push(...pulseArrows(enemy, ENEMY_ARROWS, plan.everyMs, timeMs, reducedMotion))
    if (timeMs < ENEMY_FLAG_MS) marks.push({ kind: "flag", tile: enemy.flag, player: "B" })
  }
  return marks
}
