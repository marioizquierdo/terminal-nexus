// **The rally arrows** (the owner's playtests, 2026-11-25): during the Battle Round, a few arrows run from a side's
// Nexus to where its troops head — its rally point, the enemy's Nexus by default — like a pulse travelling along the
// line, then vanish, and the side's flag shows briefly where they arrive. Once only, for both sides together,
// `rallyArrowsAtMs` into the round ("let's do that only once ... 5 seconds later, you can see those lines ... only
// showing the banner at the very end when the arrows arrive, and only once. And do the same for the enemy as well"):
// nothing before, nothing after, and no flag while they run.
//
// A map mark, as the raid's intent trail is, not an effect recipe: the scene draws it (`drawRallyMarks`,
// `pulse-scene.ts`), on open plain ground only, never over a glyph that stands (the corruption law); a flag whose tile
// something stands on is not drawn at all. Everything here is a pure function of the resolved Pulse and the
// presentation time: the route is walked once per round from the opening state (`rallyPlan`), and what shows at an
// instant (`rallyMarksAt`) reads only that plan, the time and the state's own targets at that tick — so a side whose
// target is released (an aggressive rally point reached) shows nothing from that tick on, and nothing at all when it
// was released before the run. Nothing here reaches the state: a match resolves the same with it deleted.
//
// **The route goes round impassable terrain only** (the owner: "the line just needs to go skip buildings, because
// usually what's going to happen is when the units get there, they're not going to work around. They're going to
// destroy the building"): the rules layer's route walk (`rallyRoute`, `src/match/rally.ts`), the same the Build
// Phase's march line walks, from the side's Nexus to its target's area.

import { inBounds } from "../engine/geometry/coords.ts"
import type { Coord } from "../engine/geometry/types.ts"
import { alongRoute, rallyRoute as routeTo } from "../match/rally.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { MatchState, PlayerId, TargetArea } from "../engine/state/types.ts"
import { LOOK_AHEAD } from "./build-map.ts"

/** How long an arrow takes to go one column's distance along the route (a row is two): about thirty columns a second,
 *  so the run crosses the Crossing in a couple of seconds. Slowed on a short route (`SHORTEST_RUN_MS`), hurried on a
 *  long one (`LONGEST_RUN_MS`). */
export const RALLY_STEP_MS = 30
/** How far apart, along the route, the arrows of the run go: the raid trail's spacing. */
export const RALLY_SPACING = 4
/** At least this long the run lasts, slowed on a short route, so it is seen rather than blinked. */
const SHORTEST_RUN_MS = 1200
/** At most this long the run lasts, hurried on a long route, so the flag is not kept waiting. */
const LONGEST_RUN_MS = 3000
/** How long the run holds under reduced motion, its arrows standing still along the route before the flag shows. */
export const STILL_MS = 1500
/** How long the flag shows once the arrows arrive: a glance's worth, long enough to find the `!` the arrows pointed
 *  at, short enough to stay the "very end" of the run rather than a mark that stands ("only once"). */
export const FLAG_MS = 1500

/** One side's route: where its troops head, the tiles from beside its Nexus to there, how far along each tile is by
 *  the battlefield's own distance, and the tile the flag is drawn on (the area's middle: the rally point's own tile). */
export type RallyRoute = Readonly<{ player: PlayerId; area: TargetArea; path: readonly Coord[]; along: readonly number[]; flag: Coord }>

/** What the round shows of each side's route, worked out once: the routes, when the run starts, how many arrows run,
 *  and when the shooting stops. */
export type RallyPlan = Readonly<{
  routes: Readonly<Partial<Record<PlayerId, RallyRoute>>>
  /** When, into the round, both sides' arrows set off together. */
  atMs: number
  count: number
  /** When the fight stops: nothing from then on. */
  stopMs: number
}>

/** What shows at an instant: an arrow on a tile pointing `dx`, `dy`, or a side's flag. */
export type RallyMark = Readonly<{ kind: "arrow"; tile: Coord; dx: number; dy: number; player: PlayerId }> | Readonly<{ kind: "flag"; tile: Coord; player: PlayerId }>

/** Whether two areas are the same: the side still heads where the route was walked to. */
export const sameArea = (a: TargetArea | undefined, b: TargetArea): boolean =>
  a !== undefined && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height

/** The route of `player`'s troops to their target in `opening`, or `null` with no target, no Nexus or no way there.
 *  Round impassable terrain only: every building, either side's, standing or not, is passed straight through. */
export function rallyRoute(opening: MatchState, registry: ContentRegistry, player: PlayerId): RallyRoute | null {
  const area = opening.targets?.[player]
  if (area === undefined) return null
  const { terrain } = opening
  const nexus = opening.entities.find((entity) => entity.player === player && registry.get(entity.contentId).nexus === true)
  if (nexus === undefined) return null
  const path = routeTo(terrain, { anchor: nexus.anchor, footprint: registry.get(nexus.contentId).footprint }, area)
  if (path.length === 0) return null
  const along = alongRoute(path)
  const flag = { x: area.x + Math.floor(area.width / 2), y: area.y + Math.floor(area.height / 2) }
  return { player, area, path, along, flag: inBounds(terrain, flag) ? flag : (path[path.length - 1] as Coord) }
}

/** Both sides' routes, from the round's opening state, with the moment and the count the tuned values give. */
export function rallyPlan(opening: MatchState, registry: ContentRegistry, pace: Readonly<{ atMs: number; count: number; stopMs: number }>): RallyPlan {
  const routes: Partial<Record<PlayerId, RallyRoute>> = {}
  for (const player of ["A", "B"] as const) {
    const route = rallyRoute(opening, registry, player)
    if (route !== null) routes[player] = route
  }
  return { routes, atMs: Math.max(0, pace.atMs), count: Math.max(0, Math.round(pace.count)), stopMs: pace.stopMs }
}

/** How far the run goes on `route`: its length, the trailing arrows' spacing, and a step past the end. */
function runLength(route: RallyRoute, count: number): number {
  return (route.along[route.along.length - 1] ?? 0) + RALLY_SPACING * Math.max(0, count - 1) + 1
}

/** How long one arrow takes per column's distance on `route`: `RALLY_STEP_MS`, slowed so the run lasts
 *  `SHORTEST_RUN_MS` and hurried so it lasts no more than `LONGEST_RUN_MS`. */
function stepMsOf(route: RallyRoute, count: number): number {
  const length = runLength(route, count)
  return Math.min(Math.max(RALLY_STEP_MS, SHORTEST_RUN_MS / length), LONGEST_RUN_MS / length)
}

/** How long the run lasts on `route`: until its last arrow arrives (`STILL_MS` when still). The flag shows from then. */
export function runLengthMs(route: RallyRoute, count: number, reducedMotion: boolean): number {
  return reducedMotion ? STILL_MS : runLength(route, count) * stepMsOf(route, count)
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

/** The arrows of the run `localMs` into it, `count` of them: moving, the first leading, `RALLY_SPACING` apart;
 *  still (reduced motion), standing evenly along the route, the last nearest the flag. */
function runArrows(route: RallyRoute, count: number, localMs: number, reducedMotion: boolean): RallyMark[] {
  if (count <= 0 || route.path.length < 2) return []
  if (localMs < 0 || localMs >= runLengthMs(route, count, reducedMotion)) return []
  const end = route.along[route.along.length - 1] as number
  const marks: RallyMark[] = []
  if (reducedMotion) {
    for (let index = 1; index <= count; index += 1) marks.push(arrowAt(route, tileIndexAt(route, (end * index) / (count + 1))))
    return marks
  }
  const travelled = localMs / stepMsOf(route, count)
  for (let index = 0; index < count; index += 1) {
    const distance = travelled - index * RALLY_SPACING
    if (distance < 0 || distance > end) continue
    marks.push(arrowAt(route, tileIndexAt(route, distance)))
  }
  return marks
}

/**
 * What shows of the rally points at `timeMs`, given the targets the state holds at that instant: from `plan.atMs`,
 * each side's `plan.count` arrows run along its route, both sides at once, each in its side's colour; as a side's last
 * arrow arrives its flag shows, for `FLAG_MS`, and then nothing more. A side whose target is no longer the one its
 * route was walked to (released, or changed by the level) shows nothing; nothing at all once the shooting stops.
 * Pure: the same plan, time, targets and motion give the same marks.
 */
export function rallyMarksAt(plan: RallyPlan, timeMs: number, targets: MatchState["targets"], reducedMotion: boolean): RallyMark[] {
  const localMs = timeMs - plan.atMs
  if (localMs < 0 || timeMs >= plan.stopMs || plan.count <= 0) return []
  const marks: RallyMark[] = []
  for (const player of ["A", "B"] as const) {
    const route = plan.routes[player]
    if (route === undefined || !sameArea(targets?.[player], route.area)) continue
    const arrives = runLengthMs(route, plan.count, reducedMotion)
    if (localMs < arrives) marks.push(...runArrows(route, plan.count, localMs, reducedMotion))
    else if (localMs < arrives + FLAG_MS) marks.push({ kind: "flag", tile: route.flag, player })
  }
  return marks
}
