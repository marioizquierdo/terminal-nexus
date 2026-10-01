// The trigger runner's simulation band — campaigns.md: a mission's triggers decide
// what each Pulse brings and when the mission is over.
//
// **It drives the kernel and never changes it.** A Pulse of a mission is resolved here the way
// `resolvePulse` resolves any Pulse — the unmodified `stepTick`, one tick at a time, from an opening
// state, to an outcome or the tick limit — with the mission's actions applied at the only two places a
// rules layer outside the kernel can reach:
//
// - **at tick 0**, into the opening state: what arrives when the Pulse starts (`spawn`) and the
//   scripted side's own Build Phase plan (`commitPlan`), beside the player's plan and whatever survived
//   the last Pulse (`opening.ts`);
// - **between two ticks**, for a `spawn` at a later tick: new entities go into the state the kernel just
//   settled, with the kernel's own conventions (the next ordinal, a fresh entity's fields, the id format)
//   and the kernel's own `entity.spawned` event, so a report or a renderer reading only events learns of
//   them exactly as it learns of a spawner's children. They act from the next tick.
//
// campaigns.md imagines scripted actions running "inside the kernel, as scripted intents"; the kernel has
// no door for intents yet (the narrow hook content.md describes is unbuilt), so between ticks is the nearest
// place that needs no kernel change — a finding recorded in docs/history/reports/2026-09-30-round-loop-and-missions.md.
//
// One consequence is deliberate and visible: **the kernel's victory rule ends a Pulse the moment a side with
// no Grid Nexus standing is wiped out** — a raid — so a reinforcement of its scheduled after that tick never
// comes. A side whose Nexus stands is never wiped out and plays on (Mario, 2026-10-01). The victory check
// reads what each side has fielded (its roster) from the opening state; an arrival between ticks widens that
// roster for the rest of the Pulse, so a side that only arrives later can still be wiped out, and win.
//
// After the Pulse, the triggers waiting for its end are read in list order and the first `win` or `lose`
// decides the mission — the kernel's own outcome is never overridden, only read (a mission's goal is
// resolved here, one level above the victory check, which stays the fallback for a battle with no
// mission). Deterministic like the kernel: no clock, no unseeded randomness, nothing drawn.

import type { ContentRegistry } from "../content/index.ts"
import { freshEntityFields } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { OccupancyIndex, VacatedOverlay, maskFrom } from "../grid/occupancy.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { ENTITY_LAYERS } from "../grid/types.ts"
import { isMoment, regionCentre, regionOf } from "../mission/validate.ts"
import type { MissionDefinition, MissionVerdict, Order, SpawnAction, TriggerDefinition } from "../mission/types.ts"
import type { PulseContext } from "../pulse/context.ts"
import { contextFor, spawnEvents, stepTick } from "../pulse/index.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { opening } from "./opening.ts"
import { nearestFit } from "./placement.ts"
import type { Force, StructurePlacement } from "./types.ts"

/** How far from a region's centre an arrival may be set down. */
const ARRIVAL_RADIUS = 12

export type MissionPulseInput = Readonly<{
  mission: MissionDefinition
  grid: GridTerrain
  registry: ContentRegistry
  /** Which Pulse of the mission, from 1. */
  pulse: number
  /** What the last Pulse left, after Recall — `null` for the mission's first Pulse. */
  carried: MatchState | null
  /** The player's buildings newly standing this Pulse: for the first, the map's own and the plan's; for
   *  a later one, only what the plan added (the rest is in `carried`). */
  structures: readonly StructurePlacement[]
}>

/** A unit that arrived by a mission's `spawn`, and what it came with — the group, its order, its line of
 *  intention. What the preview draws as incoming, and the card over it reads. */
export type Arrival = Readonly<{
  ordinal: number
  player: PlayerId
  contentId: string
  anchor: Coord
  /** The tick of the Pulse it arrives at. */
  tick: number
  trigger: string
  group: string | null
  order: Order | null
  intent: string | null
}>

/** A trigger that fired, and when. */
export type Fired = Readonly<{ trigger: string; pulse: number; tick: number | "end" }>

export type MissionPulse = Readonly<{
  pulse: number
  /** Every state the Pulse passed through, the opening first, one a tick (an arrival's tick shows it). */
  states: readonly MatchState[]
  /** The Pulse's events, in order — the opening's `entity.spawned` first, as `resolvePulse` gives them. */
  events: readonly DomainEvent[]
  final: MatchState
  arrivals: readonly Arrival[]
  fired: readonly Fired[]
  verdict: MissionVerdict
}>

type Spawn = SpawnAction["spawn"]
type Scheduled = Readonly<{ trigger: TriggerDefinition; spawn: Spawn }>

/** The `spawn` actions of this Pulse's triggers at one tick, in list order. */
function spawnsAt(mission: MissionDefinition, pulse: number, tick: number): Scheduled[] {
  const found: Scheduled[] = []
  for (const trigger of mission.triggers) {
    const { when } = trigger
    if (!isMoment(when) || when.pulse !== pulse || when.tick !== tick) continue
    for (const action of trigger.do) if ("spawn" in action) found.push({ trigger, spawn: action.spawn })
  }
  return found
}

/** The ticks after 0 at which this Pulse has something arriving. */
function laterTicks(mission: MissionDefinition, pulse: number): Set<number> {
  const ticks = new Set<number>()
  for (const { when } of mission.triggers) if (isMoment(when) && when.pulse === pulse && when.tick > 0) ticks.add(when.tick)
  return ticks
}

/** One content id per unit, in the order the action lists them. */
const unitsOf = (spawn: Spawn): string[] => spawn.units.flatMap((entry) => Array.from({ length: entry.count }, () => entry.unit))

const musterOf = (mission: MissionDefinition, spawn: Spawn): Coord => {
  const region = regionOf(mission, spawn.at)
  if (region === undefined) throw new Error(`unknown region "${spawn.at}" — validate the mission first`)
  return regionCentre(region)
}

const arrivalOf = (scheduled: Scheduled, entity: EntityState, tick: number): Arrival => ({
  ordinal: entity.ordinal,
  player: entity.player,
  contentId: entity.contentId,
  anchor: entity.anchor,
  tick,
  trigger: scheduled.trigger.id,
  group: scheduled.spawn.group ?? null,
  order: scheduled.spawn.order ?? null,
  intent: scheduled.spawn.intent ?? null,
})

/**
 * The opening state of a mission's Pulse — the carried state, the player's new structures, the scripted
 * side's plan and the tick-0 arrivals — and who arrived. Also what the Build Phase before the Pulse shows
 * as incoming: the same function, asked with the plan as it stands.
 */
export function missionOpening(input: MissionPulseInput): Readonly<{ state: MatchState; arrivals: Arrival[]; fired: Fired[] }> {
  const { mission, grid, registry, pulse, carried } = input
  const structures: StructurePlacement[] = [...input.structures]
  const fired: Fired[] = []
  for (const trigger of mission.triggers) {
    const { when } = trigger
    if (!isMoment(when) || when.pulse !== pulse || when.tick !== 0) continue
    fired.push({ trigger: trigger.id, pulse, tick: 0 })
    for (const action of trigger.do) {
      if ("commitPlan" in action) {
        for (const structure of action.commitPlan.structures) {
          structures.push({ contentId: structure.contentId, anchor: structure.anchor, player: action.commitPlan.side })
        }
      }
    }
  }
  const scheduled = spawnsAt(mission, pulse, 0)
  const forces: Force[] = scheduled.map(({ spawn }) => ({ player: spawn.side, muster: musterOf(mission, spawn), units: unitsOf(spawn) }))
  const result = opening({
    grid,
    registry,
    structures,
    setup: { seed: mission.seed, pulseTicks: mission.pulseTicks, forces },
    ...(carried === null ? {} : { carried }),
  })
  const arrivals: Arrival[] = []
  for (const entity of result.state.entities) {
    const force = result.forceOf.get(entity.ordinal)
    if (force !== undefined) arrivals.push(arrivalOf(scheduled[force] as Scheduled, entity, 0))
  }
  return { state: result.state, arrivals, fired }
}

/**
 * Arrivals between two ticks: each unit set down on the free tile nearest its region's centre, under its
 * own collision mask, avoiding a tile still cooling from a death — one after another, in list order, so
 * two never contest a tile. A unit with no room within reach does not arrive (said by its absence from
 * the arrivals). Emits the kernel's own `entity.spawned` for each, at the tick they arrive.
 */
function arriveBetweenTicks(
  mission: MissionDefinition,
  registry: ContentRegistry,
  state: MatchState,
  scheduled: readonly Scheduled[],
): Readonly<{ state: MatchState; arrivals: Arrival[]; events: DomainEvent[] }> {
  const index = new OccupancyIndex(state.grid)
  for (const entity of state.entities) {
    const definition = registry.get(entity.contentId)
    index.add(definition.layer, entity.ordinal, entity.anchor, definition.footprint)
  }
  const vacated = new VacatedOverlay(state.vacatedTiles.filter((entry) => entry.until > state.tick))
  const born: EntityState[] = []
  const arrivals: Arrival[] = []
  const events: DomainEvent[] = []
  let nextOrdinal = state.nextOrdinal
  for (const entry of scheduled) {
    const muster = musterOf(mission, entry.spawn)
    for (const contentId of unitsOf(entry.spawn)) {
      const definition = registry.get(contentId)
      const mask = maskFrom(index, {
        layers: ENTITY_LAYERS,
        terrain: definition.layer === "air" ? "ignore" : "impassable",
        vacated,
      })
      const anchor = nearestFit(mask, definition.footprint, muster, ARRIVAL_RADIUS)
      if (anchor === null) continue
      const ordinal = nextOrdinal
      nextOrdinal += 1
      const entity: EntityState = {
        ordinal,
        id: `${entry.spawn.side}:${definition.short}#${ordinal + 1}`,
        player: entry.spawn.side,
        contentId,
        hp: definition.maxHp,
        anchor,
        facing: entry.spawn.side === "A" ? "e" : "w",
        ...freshEntityFields(definition),
      }
      index.add(definition.layer, ordinal, anchor, definition.footprint)
      born.push(entity)
      arrivals.push(arrivalOf(entry, entity, state.tick))
      events.push({
        kind: "entity.spawned",
        tick: state.tick,
        entity: entity.id,
        ordinal,
        player: entity.player,
        contentId,
        at: anchor,
        hp: entity.hp,
      })
    }
  }
  return { state: { ...state, entities: [...state.entities, ...born], nextOrdinal }, arrivals, events }
}

/** The kernel's roster, widened by what arrived: a side counts as having fielded units or a Nexus once it
 *  has. */
function widened(context: PulseContext, state: MatchState, registry: ContentRegistry): PulseContext {
  const fresh = contextFor(state, registry, context.pulseTicks).roster
  const roster = {
    A: {
      hasNexus: context.roster.A.hasNexus || fresh.A.hasNexus,
      hasMobile: context.roster.A.hasMobile || fresh.A.hasMobile,
    },
    B: {
      hasNexus: context.roster.B.hasNexus || fresh.B.hasNexus,
      hasMobile: context.roster.B.hasMobile || fresh.B.hasMobile,
    },
  }
  return { ...context, roster }
}

/** Whether a side has a Grid Nexus standing in a state. */
function hasNexus(state: MatchState, registry: ContentRegistry, side: PlayerId): boolean {
  return state.entities.some((entity) => entity.player === side && registry.get(entity.contentId).nexus === true)
}

/**
 * The triggers waiting for this Pulse's end, read in list order: the first `win` or `lose` among those
 * that hold decides the mission. `nexus.destroyed` holds when the side had a Nexus when the Pulse began
 * and has none now.
 */
function verdictAt(
  mission: MissionDefinition,
  registry: ContentRegistry,
  pulse: number,
  initial: MatchState,
  final: MatchState,
): Readonly<{ verdict: MissionVerdict; fired: Fired[] }> {
  const fired: Fired[] = []
  let verdict: MissionVerdict = { kind: "continue" }
  for (const trigger of mission.triggers) {
    const { when } = trigger
    if (isMoment(when)) continue
    const holds =
      when.event === "pulse.end"
        ? when.pulse === undefined || when.pulse === pulse
        : hasNexus(initial, registry, when.side) && !hasNexus(final, registry, when.side)
    if (!holds) continue
    fired.push({ trigger: trigger.id, pulse, tick: "end" })
    if (verdict.kind !== "continue") continue
    for (const action of trigger.do) {
      if ("win" in action) verdict = { kind: "won", trigger: trigger.id }
      else if ("lose" in action) verdict = { kind: "lost", trigger: trigger.id }
      if (verdict.kind !== "continue") break
    }
  }
  return { verdict, fired }
}

/** One Pulse of a mission, resolved on the unmodified kernel, and how the mission stands after it. */
export function resolveMissionPulse(input: MissionPulseInput): MissionPulse {
  const { mission, registry, pulse } = input
  const start = missionOpening(input)
  let context = contextFor(start.state, registry, mission.pulseTicks)
  const events: DomainEvent[] = spawnEvents(start.state, registry)
  const states: MatchState[] = [start.state]
  const arrivals: Arrival[] = [...start.arrivals]
  const fired: Fired[] = [...start.fired]
  const later = laterTicks(mission, pulse)

  let state = start.state
  while (state.outcome === null && state.tick < mission.pulseTicks) {
    const result = stepTick(state, context)
    state = result.state
    events.push(...result.events)
    if (state.outcome === null && later.has(state.tick)) {
      const scheduled = spawnsAt(mission, pulse, state.tick)
      for (const trigger of new Set(scheduled.map((entry) => entry.trigger.id))) fired.push({ trigger, pulse, tick: state.tick })
      const arrived = arriveBetweenTicks(mission, registry, state, scheduled)
      state = arrived.state
      events.push(...arrived.events)
      arrivals.push(...arrived.arrivals)
      context = widened(context, state, registry)
    }
    states.push(state)
  }

  const end = verdictAt(mission, registry, pulse, start.state, state)
  return {
    pulse,
    states,
    events,
    final: state,
    arrivals,
    fired: [...fired, ...end.fired],
    verdict: end.verdict,
  }
}

/** Every unit this Pulse's triggers will bring after tick 0, set down against the opening state as it
 *  stands — a forecast for the Build Phase to show, since where they actually land is decided by the
 *  state at their tick. */
export function laterArrivals(input: MissionPulseInput, openingState: MatchState): Arrival[] {
  const { mission, registry, pulse } = input
  const found: Arrival[] = []
  let state = openingState
  for (const tick of [...laterTicks(mission, pulse)].sort((a, b) => a - b)) {
    const arrived = arriveBetweenTicks(mission, registry, { ...state, tick }, spawnsAt(mission, pulse, tick))
    state = arrived.state
    found.push(...arrived.arrivals)
  }
  return found
}
