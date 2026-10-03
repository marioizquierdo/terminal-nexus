// What each group a mission's round brings will go for first — the raid's intent, as the kernel will act
// on it (the owner: "reading the enemy intent is very important for basic ui/ux interaction").
//
// **The kernel's own choice, never a second guess.** A unit's first target is whatever the kernel picks on
// the round's first tick, so that is what is read: the round's opening state is built with the plan as it
// stands (`missionOpening`, the very function that starts the real Pulse), the round's later arrivals are
// set down beside it the way the Build Phase's forecast sets them down (`laterArrivals`), one unmodified
// `stepTick` is run on it, and each unit's `targetOrdinal` is read back. A group goes for what most of its
// units chose; on a tie, for the choice of its first unit among the tied. For everything that arrives as
// the round starts, that is exactly what the Pulse will do on its first tick (`tests/intent.test.ts` holds
// the two together); for a group that arrives later it is a forecast against the opening positions, since
// by its tick everything has moved. Place a building nearer the raid and the answer changes, because the
// kernel's answer does: every unit engages the nearest enemy (`src/pulse/perception.ts`).
//
// **Along which way**: the path the group's front unit would take toward that target by the kernel's own
// step rule (`rankedSteps`: greedy, four-way, sliding along whatever blocks it), over the terrain and the
// buildings as they stand when the round starts. Units are left out of it, since they move. It stops
// next to the target, or where the step rule leaves it with no step that gets closer. A forecast of the
// approach that never walks through a ridge, so a trail drawn on it cannot lie about the way round.
//
// Deterministic like the kernel: no clock, no randomness, nothing drawn. It reads the mission and the
// state and never changes either.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields } from "../content/index.ts"
import { footprintDistance, nearestFootprintTile, tilesOf } from "../grid/coords.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord } from "../grid/types.ts"
import type { MissionDefinition } from "../mission/types.ts"
import { contextFor, rankedSteps, stepTick } from "../pulse/index.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import type { Arrival, MissionPulseInput } from "./mission.ts"
import { laterArrivals, missionOpening } from "./mission.ts"

/** What a group goes for first: the entity, where it stands as the round starts, and every tile it covers. */
export type IntentTarget = Readonly<{
  ordinal: number
  contentId: string
  player: PlayerId
  anchor: Coord
  tiles: readonly Coord[]
}>

/** One group a round brings, and what it will do first. */
export type GroupIntent = Readonly<{
  /** The mission's name for the group, or the trigger's id when it names none. */
  group: string
  player: PlayerId
  /** What arrived, kind by kind in the order the mission lists them, with how many of each. */
  units: readonly Readonly<{ contentId: string; count: number }>[]
  /** The tick of the round it arrives at: 0 is as the round starts. */
  tick: number
  /** The mission's one line of what the group means to do, or `null`. */
  intent: string | null
  /** Every tile its units stand on as they arrive. */
  tiles: readonly Coord[]
  /** The tile of the group nearest its middle. */
  centre: Coord
  /** What most of its units go for first, or `null` when there is nothing to go for. */
  target: IntentTarget | null
  /** The way its front unit would walk toward the target: one tile a step, the first step first, ending
   *  next to it. Empty without a target, or when it arrives next to it. */
  path: readonly Coord[]
}>

/** The arrivals of one group, in the order they arrived. */
type Gathered = { readonly key: string; readonly arrivals: Arrival[] }

const keyOf = (arrival: Arrival): string => `${arrival.trigger}\u0000${arrival.group ?? ""}`

/** The arrivals grouped by the action that brought them: a group of a trigger, in order of first arrival. */
function gather(arrivals: readonly Arrival[]): Gathered[] {
  const groups: Gathered[] = []
  const byKey = new Map<string, Gathered>()
  for (const arrival of arrivals) {
    const key = keyOf(arrival)
    let found = byKey.get(key)
    if (found === undefined) {
      found = { key, arrivals: [] }
      byKey.set(key, found)
      groups.push(found)
    }
    found.arrivals.push(arrival)
  }
  return groups
}

/** The order the mission lists a group's kinds in, so "6 runners, 4 raiders" reads as it was written. */
function listedOrder(mission: MissionDefinition, arrival: Arrival): ReadonlyMap<string, number> {
  const order = new Map<string, number>()
  const trigger = mission.triggers.find((candidate) => candidate.id === arrival.trigger)
  for (const action of trigger?.do ?? []) {
    if (!("spawn" in action) || (action.spawn.group ?? null) !== arrival.group) continue
    for (const entry of action.spawn.units) if (!order.has(entry.unit)) order.set(entry.unit, order.size)
  }
  return order
}

/** How many of each kind arrived, in the mission's order (and, for a kind it does not list, as they came). */
function countsOf(mission: MissionDefinition, arrivals: readonly Arrival[]): Readonly<{ contentId: string; count: number }>[] {
  const first = arrivals[0]
  const order = first === undefined ? new Map<string, number>() : listedOrder(mission, first)
  const counts = new Map<string, number>()
  for (const arrival of arrivals) counts.set(arrival.contentId, (counts.get(arrival.contentId) ?? 0) + 1)
  const rank = (contentId: string): number => order.get(contentId) ?? order.size + [...counts.keys()].indexOf(contentId)
  return [...counts.entries()].sort(([a], [b]) => rank(a) - rank(b)).map(([contentId, count]) => ({ contentId, count }))
}

/** The tile of `tiles` nearest their mean — the first such, read in the order given. */
function middleOf(tiles: readonly Coord[]): Coord {
  const meanX = tiles.reduce((sum, tile) => sum + tile.x, 0) / tiles.length
  const meanY = tiles.reduce((sum, tile) => sum + tile.y, 0) / tiles.length
  let best = tiles[0] ?? { x: 0, y: 0 }
  let bestDistance = Number.POSITIVE_INFINITY
  for (const tile of tiles) {
    const distance = Math.abs(tile.x - meanX) + Math.abs(tile.y - meanY)
    if (distance < bestDistance) {
      best = tile
      bestDistance = distance
    }
  }
  return best
}

/** A later arrival as the entity it will be — the kernel's conventions for a fresh entity, as the trigger
 *  runner sets one down between ticks. */
function entityOf(registry: ContentRegistry, arrival: Arrival): EntityState {
  const definition = registry.get(arrival.contentId)
  return {
    ordinal: arrival.ordinal,
    id: `${arrival.player}:${definition.short}#${arrival.ordinal + 1}`,
    player: arrival.player,
    contentId: arrival.contentId,
    hp: definition.maxHp,
    anchor: arrival.anchor,
    facing: arrival.player === "A" ? "e" : "w",
    ...freshEntityFields(definition),
  }
}

/** The target most of a group's units chose on the first tick; on a tie, the first unit's among the tied. */
function chosenTarget(arrivals: readonly Arrival[], after: ReadonlyMap<number, EntityState>): number | null {
  const votes = new Map<number, number>()
  const order: number[] = []
  for (const arrival of arrivals) {
    const target = after.get(arrival.ordinal)?.targetOrdinal ?? null
    if (target === null) continue
    votes.set(target, (votes.get(target) ?? 0) + 1)
    order.push(target)
  }
  const most = Math.max(0, ...votes.values())
  return order.find((target) => votes.get(target) === most) ?? null
}

/**
 * The way `walker`, standing at `from`, would walk toward `target` by the kernel's step rule, over the
 * terrain and `state`'s structures: every step's anchor, until it stands next to the target, or no step
 * gets it closer. Next to it rather than in range: a group's ranged units stop short and its others close
 * in, and the way is drawn to what it goes for. Each step brings it one tile closer, so the walk ends
 * within the distance it started at.
 */
function walk(state: MatchState, registry: ContentRegistry, walker: ContentDef, from: Coord, target: IntentTarget): Coord[] {
  const index = new OccupancyIndex(state.grid)
  for (const entity of state.entities) {
    const definition = registry.get(entity.contentId)
    if (definition.layer === "obstacles") index.add(definition.layer, entity.ordinal, entity.anchor, definition.footprint)
  }
  const mask = maskFrom(index, { layers: walker.collidesWith, terrain: walker.layer === "air" ? "ignore" : "impassable" })
  const footprint = registry.get(target.contentId).footprint
  const path: Coord[] = []
  let at = from
  while (footprintDistance(at, walker.footprint, target.anchor, footprint) > 1) {
    const goal = nearestFootprintTile(at, target.anchor, footprint)
    const next = rankedSteps(at, walker, mask, { goal, intent: "toward" })[0]
    if (next === undefined) break
    at = next.to
    path.push(at)
  }
  return path
}

/**
 * Every group of `side` that the round of `input` brings — as the round starts and later — with what it
 * goes for first and the way it would go, on the plan `input.structures` holds. In order of arrival.
 */
export function foreseeIntents(input: MissionPulseInput, side: PlayerId = "B"): GroupIntent[] {
  const { mission, registry } = input
  const start = missionOpening(input)
  const later = laterArrivals(input, start.state)
  const born = later.map((arrival) => entityOf(registry, arrival))
  const nextOrdinal = Math.max(start.state.nextOrdinal, ...born.map((entity) => entity.ordinal + 1))
  const state: MatchState = { ...start.state, entities: [...start.state.entities, ...born], nextOrdinal }
  const after = new Map(stepTick(state, contextFor(state, registry, mission.pulseTicks)).state.entities.map((entity) => [entity.ordinal, entity]))
  const before = new Map(state.entities.map((entity) => [entity.ordinal, entity]))

  const arrivals = [...start.arrivals, ...later].filter((arrival) => arrival.player === side)
  return gather(arrivals).map(({ arrivals: own }) => {
    const first = own[0] as Arrival
    const tiles = own.flatMap((arrival) => tilesOf(arrival.anchor, registry.get(arrival.contentId).footprint))
    const ordinal = chosenTarget(own, after)
    const standing = ordinal === null ? undefined : (before.get(ordinal) ?? after.get(ordinal))
    const target: IntentTarget | null =
      standing === undefined
        ? null
        : {
            ordinal: standing.ordinal,
            contentId: standing.contentId,
            player: standing.player,
            anchor: standing.anchor,
            tiles: tilesOf(standing.anchor, registry.get(standing.contentId).footprint),
          }
    return {
      group: first.group ?? first.trigger,
      player: first.player,
      units: countsOf(mission, own),
      tick: first.tick,
      intent: first.intent,
      tiles,
      centre: middleOf(tiles),
      target,
      path: target === null ? [] : pathOf(state, registry, own, target),
    }
  })
}

/**
 * The way a group would go: walked from the front unit of each kind it brings — the one nearest the target,
 * the first of them on a tie — with that unit's own footprint and what it collides with, nearest kind first.
 * The first way that reaches the target is the group's; when none does, the nearest kind's. The step rule
 * is greedy, so a wide unit can be left pressing on a ridge a narrow one walks round (PERIMETER's raiders on
 * the ridge's north face, while its runners go round the west end): the trail shows the way the attack
 * gets there.
 */
function pathOf(state: MatchState, registry: ContentRegistry, arrivals: readonly Arrival[], target: IntentTarget): Coord[] {
  const footprint = registry.get(target.contentId).footprint
  const distanceOf = (arrival: Arrival): number =>
    footprintDistance(arrival.anchor, registry.get(arrival.contentId).footprint, target.anchor, footprint)
  const fronts = new Map<string, Arrival>()
  for (const arrival of arrivals) {
    const front = fronts.get(arrival.contentId)
    if (front === undefined || distanceOf(arrival) < distanceOf(front)) fronts.set(arrival.contentId, arrival)
  }
  // Stable: kinds at the same distance stay in the order they arrived.
  const kinds = [...fronts.values()].sort((a, b) => distanceOf(a) - distanceOf(b))
  let nearest: Coord[] | null = null
  for (const front of kinds) {
    const walker = registry.get(front.contentId)
    const way = walk(state, registry, walker, front.anchor, target)
    if (footprintDistance(way.at(-1) ?? front.anchor, walker.footprint, target.anchor, footprint) <= 1) return way
    nearest ??= way
  }
  return nearest ?? []
}
