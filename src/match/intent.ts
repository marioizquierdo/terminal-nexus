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
// kernel's answer does: every unit of a side with no target — the raid's — engages the nearest enemy
// (`src/pulse/perception.ts`). The player's troops head out on that same first tick, so the raid soon meets
// them on the way; what it goes for *first* is still this, and the panel says no more than that.
//
// **Along which way**: the path one of the group's units would take toward that target by the kernel's
// own step rule (`rankedSteps`: greedy, four-way, sliding along whatever blocks it), over the terrain and
// the buildings as they stand when the round starts — the nearest unit whose walk gets there, since a
// greedy step can leave some pressing on a ridge that others go round. Units are left out of what blocks
// it, since they move. A forecast of the approach that never walks through a ridge, so a trail drawn on it
// cannot lie about the way round; a group none of whose units can get there is shown pressing on what
// stops it, which is what the kernel will do too.
//
// **And where the player's own troops head** (`foreseeRound`): the target the level names for their side,
// read off the same opening — which units go, and the region they head for, by the name the mission gives
// it. That much is data, not a guess; how they get there, and whom they meet on the way, is the kernel's to
// play and is not foreseen (the owner: "don't over-promise").
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
import { followsTarget } from "../pulse/target.ts"
import { regionTiles } from "../mission/validate.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import type { Arrival, MissionPulseInput } from "./mission.ts"
import { laterArrivals, missionOpening, targetRegionsAt } from "./mission.ts"

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
  /** The way it would go to the target, one tile a step, the first step first: the walk of the nearest of
   *  its units that gets next to it, or — when none can — the nearest unit's, pressed on what stops it.
   *  Empty without a target, or when it arrives next to it. */
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
 * terrain and `structures` (an index of the structures alone): every step's anchor, until it stands next
 * to the target, or no step gets it closer. Next to it rather than in range: a group's ranged units stop
 * short and its others close in, and the way is drawn to what it goes for. Each step brings it one tile
 * closer, so the walk ends within the distance it started at.
 */
function walk(structures: OccupancyIndex, registry: ContentRegistry, walker: ContentDef, from: Coord, target: IntentTarget): Coord[] {
  const mask = maskFrom(structures, { layers: walker.collidesWith, terrain: walker.layer === "air" ? "ignore" : "impassable" })
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
  return foreseeRound(input, side).groups
}

/**
 * Where a side's troops head as a round starts: the target its level names for it (a `target` action, by
 * the region the mission names), and who goes — every unit of the side that follows a target, standing on
 * the Grid as the round opens. Not a forecast of the way: the kernel walks them there and has them fight
 * what comes within reach on it (`src/pulse/target.ts`), and that is not foreseen.
 */
export type TroopsIntent = Readonly<{
  player: PlayerId
  /** The region they head for: its id, the name the player reads, and every tile of it. */
  region: string
  name: string
  tiles: readonly Coord[]
  /** Who heads there as the round starts, kind by kind in the order they stand on the Grid, with how many. */
  units: readonly Readonly<{ contentId: string; count: number }>[]
  /** Every tile they stand on as the round starts. */
  unitTiles: readonly Coord[]
}>

/** What a round's opening says of the side its raid comes for: where its troops head, or `null` when its
 *  level names no target for it. */
function troopsOf(input: MissionPulseInput, state: MatchState, side: PlayerId): TroopsIntent | null {
  const { mission, registry, pulse } = input
  const region = targetRegionsAt(mission, pulse, 0)[side]
  if (region === undefined) return null
  const own = state.entities.filter((entity) => entity.player === side && followsTarget(registry.get(entity.contentId)))
  const counts = new Map<string, number>()
  for (const entity of own) counts.set(entity.contentId, (counts.get(entity.contentId) ?? 0) + 1)
  return {
    player: side,
    region: region.id,
    name: region.name ?? region.id,
    tiles: regionTiles(region),
    units: [...counts.entries()].map(([contentId, count]) => ({ contentId, count })),
    unitTiles: own.flatMap((entity) => tilesOf(entity.anchor, registry.get(entity.contentId).footprint)),
  }
}

/**
 * **What a round brings, foreseen once**: every group of `side` that it brings, with what each goes for
 * first and the way it would go (`foreseeIntents`), and where the troops of the side it comes for head
 * (`TroopsIntent`) — both read off the one opening the real Pulse starts from, on the plan as it stands.
 */
export function foreseeRound(input: MissionPulseInput, side: PlayerId = "B"): Readonly<{ groups: GroupIntent[]; troops: TroopsIntent | null }> {
  const { mission, registry } = input
  const start = missionOpening(input)
  const troops = troopsOf(input, start.state, side === "B" ? "A" : "B")
  const later = laterArrivals(input, start.state)
  const born = later.map((arrival) => entityOf(registry, arrival))
  const nextOrdinal = Math.max(start.state.nextOrdinal, ...born.map((entity) => entity.ordinal + 1))
  const state: MatchState = { ...start.state, entities: [...start.state.entities, ...born], nextOrdinal }
  const after = new Map(stepTick(state, contextFor(state, registry, mission.pulseTicks)).state.entities.map((entity) => [entity.ordinal, entity]))
  const before = new Map(state.entities.map((entity) => [entity.ordinal, entity]))
  // What a way goes round: the terrain and the structures as the round starts. Units move, so none blocks it.
  const structures = new OccupancyIndex(state.grid)
  for (const entity of state.entities) {
    const definition = registry.get(entity.contentId)
    if (definition.layer === "obstacles") structures.add(definition.layer, entity.ordinal, entity.anchor, definition.footprint)
  }

  const arrivals = [...start.arrivals, ...later].filter((arrival) => arrival.player === side)
  const groups = gather(arrivals).map(({ arrivals: own }): GroupIntent => {
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
      path: target === null ? [] : pathOf(structures, registry, own, target),
    }
  })
  return { groups, troops }
}

/**
 * The way a group would go: walked from each of its units in turn, nearest the target first (the first to
 * arrive on a tie), with that unit's own footprint and what it collides with. The first way that reaches
 * the target is the group's; when none does, the nearest unit's. The step rule is greedy, so units can be
 * left pressing on a ridge that others walk round or come through the gap in (PERIMETER's raiders on the
 * ridge's north face, while its runners go round the west end): the trail shows the way the attack gets
 * there, and only a group that cannot get there at all is shown pressing on what stops it.
 */
function pathOf(structures: OccupancyIndex, registry: ContentRegistry, arrivals: readonly Arrival[], target: IntentTarget): Coord[] {
  const footprint = registry.get(target.contentId).footprint
  const distanceOf = (arrival: Arrival): number =>
    footprintDistance(arrival.anchor, registry.get(arrival.contentId).footprint, target.anchor, footprint)
  // Stable: units at the same distance stay in the order they arrived.
  const fronts = [...arrivals].sort((a, b) => distanceOf(a) - distanceOf(b))
  let nearest: Coord[] | null = null
  for (const front of fronts) {
    const walker = registry.get(front.contentId)
    const way = walk(structures, registry, walker, front.anchor, target)
    if (footprintDistance(way.at(-1) ?? front.anchor, walker.footprint, target.anchor, footprint) <= 1) return way
    nearest ??= way
  }
  return nearest ?? []
}
