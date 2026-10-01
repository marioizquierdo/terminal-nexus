// Load-time validation of a mission — the reason a mission is data and not code: every reference, every range
// and whether the mission can end at all are checked before a single tick runs, and every problem is
// reported at once, by name, so an author fixes a mission in one pass rather than one crash at a time.
//
// Deterministic and blind to presentation, like the rest of the rules layer: no clock, no randomness,
// nothing drawn.

import type { ContentRegistry } from "../content/index.ts"
import { inBounds, tilesOf } from "../grid/coords.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type {
  MissionDefinition,
  Region,
  SimulationAction,
  TriggerCondition,
  TriggerDefinition,
} from "./types.ts"
import { MissionError } from "./types.ts"

/** The centre tile of a region — where its arrivals gather around. */
export function regionCentre(region: Region): Coord {
  return { x: region.x + Math.floor((region.width - 1) / 2), y: region.y + Math.floor((region.height - 1) / 2) }
}

/** A region by id, or `undefined`. */
export function regionOf(mission: Pick<MissionDefinition, "regions">, id: string): Region | undefined {
  return mission.regions.find((region) => region.id === id)
}

/** Whether a condition is a moment in a Pulse (rather than an event). */
export function isMoment(condition: TriggerCondition): condition is Readonly<{ pulse: number; tick: number }> {
  return !("event" in condition)
}

/** Where a trigger's actions run: at a tick of a Pulse, or at a Pulse's end. */
function whenOf(condition: TriggerCondition): "moment" | "end" {
  return isMoment(condition) ? "moment" : "end"
}

/** What an action is, as the error messages name it. */
export function actionName(action: SimulationAction): string {
  if ("spawn" in action) return "spawn"
  if ("order" in action) return "order"
  if ("commitPlan" in action) return "commitPlan"
  if ("win" in action) return "win"
  return "lose"
}

const isPositiveInteger = (value: number): boolean => Number.isInteger(value) && value > 0

/**
 * Throws `MissionError` listing every problem, or returns the mission unchanged. The grid is the map the
 * mission is played on (its regions must be on it); the registry is the content its units and
 * structures come from.
 */
export function validateMission(mission: MissionDefinition, grid: GridTerrain, registry: ContentRegistry): MissionDefinition {
  const problems: string[] = []
  const say = (problem: string): void => {
    problems.push(problem)
  }

  if (!isPositiveInteger(mission.pulses)) say(`pulses must be a positive integer, received ${mission.pulses}`)
  if (!isPositiveInteger(mission.pulseTicks)) say(`pulseTicks must be a positive integer, received ${mission.pulseTicks}`)
  if (!Number.isInteger(mission.seed)) say(`seed must be an integer, received ${mission.seed}`)

  // Regions: unique, sized, on the map.
  const regionIds = new Set<string>()
  for (const region of mission.regions) {
    if (regionIds.has(region.id)) say(`region "${region.id}" is declared twice`)
    regionIds.add(region.id)
    if (!isPositiveInteger(region.width) || !isPositiveInteger(region.height)) {
      say(`region "${region.id}" must be at least one tile wide and tall`)
      continue
    }
    const corners = [
      { x: region.x, y: region.y },
      { x: region.x + region.width - 1, y: region.y + region.height - 1 },
    ]
    if (!corners.every((corner) => inBounds(grid, corner))) {
      say(`region "${region.id}" reaches off the ${grid.width}x${grid.height} map`)
    }
  }
  const knownRegion = (id: string, where: string): void => {
    if (!regionIds.has(id)) say(`${where} names the unknown region "${id}"`)
  }

  // Triggers, in order: a group must be spawned by a trigger that fires no later than one that orders it.
  const triggerIds = new Set<string>()
  const groups = new Map<string, Readonly<{ pulse: number; tick: number }>>()
  const lastPulseDecided = { value: false }

  const checkCondition = (trigger: TriggerDefinition): void => {
    const { when } = trigger
    const where = `trigger "${trigger.id}"`
    if (isMoment(when)) {
      if (!isPositiveInteger(when.pulse) || when.pulse > mission.pulses) {
        say(`${where} is at Pulse ${when.pulse}, but the mission has Pulses 1 to ${mission.pulses}`)
      }
      if (!Number.isInteger(when.tick) || when.tick < 0 || when.tick >= mission.pulseTicks) {
        say(`${where} is at tick ${when.tick}, but a Pulse runs ticks 0 to ${mission.pulseTicks - 1}`)
      }
      return
    }
    if (when.event === "pulse.end") {
      if (when.pulse !== undefined && (!isPositiveInteger(when.pulse) || when.pulse > mission.pulses)) {
        say(`${where} waits for the end of Pulse ${when.pulse}, but the mission has Pulses 1 to ${mission.pulses}`)
      }
      return
    }
    if (when.event === "nexus.destroyed") {
      if (when.side !== "A" && when.side !== "B") say(`${where} names the unknown side "${String(when.side)}"`)
      return
    }
    say(`${where} has a condition this vocabulary does not know: ${JSON.stringify(when)}`)
  }

  const checkAction = (trigger: TriggerDefinition, action: SimulationAction, index: number): void => {
    const where = `trigger "${trigger.id}", action ${index + 1} (${actionName(action)})`
    const at = whenOf(trigger.when)
    const moment = isMoment(trigger.when) ? trigger.when : null

    if ("spawn" in action) {
      const { spawn } = action
      if (at !== "moment") say(`${where} must happen at a moment in a Pulse, not at an event`)
      if (spawn.side !== "A" && spawn.side !== "B") say(`${where} names the unknown side "${String(spawn.side)}"`)
      knownRegion(spawn.at, where)
      if (spawn.units.length === 0) say(`${where} spawns nothing`)
      for (const entry of spawn.units) {
        if (!registry.has(entry.unit)) {
          say(`${where} names the unknown content id "${entry.unit}"`)
        } else if (registry.get(entry.unit).layer === "obstacles") {
          say(`${where} spawns "${entry.unit}", a structure — structures arrive by commitPlan`)
        }
        if (!isPositiveInteger(entry.count)) say(`${where} spawns ${entry.count} of "${entry.unit}"; a count is a positive integer`)
      }
      if (spawn.order !== undefined) checkOrder(spawn.order, where)
      if (spawn.group !== undefined && moment !== null) {
        if (groups.has(spawn.group)) say(`${where} spawns the group "${spawn.group}" a second time`)
        else groups.set(spawn.group, moment)
      }
      return
    }
    if ("order" in action) {
      const { order } = action
      if (at !== "moment") say(`${where} must happen at a moment in a Pulse, not at an event`)
      checkOrder(order, where)
      const spawned = groups.get(order.group)
      if (spawned === undefined) {
        say(`${where} orders the group "${order.group}", which no earlier trigger spawns`)
      } else if (moment !== null && (moment.pulse < spawned.pulse || (moment.pulse === spawned.pulse && moment.tick < spawned.tick))) {
        say(`${where} orders the group "${order.group}" before it arrives`)
      }
      return
    }
    if ("commitPlan" in action) {
      const { commitPlan } = action
      if (moment === null || moment.tick !== 0) say(`${where} must be at tick 0 of a Pulse: a plan reveals when the Pulse starts`)
      if (commitPlan.side !== "A" && commitPlan.side !== "B") say(`${where} names the unknown side "${String(commitPlan.side)}"`)
      for (const structure of commitPlan.structures) {
        if (!registry.has(structure.contentId)) {
          say(`${where} names the unknown content id "${structure.contentId}"`)
          continue
        }
        const definition = registry.get(structure.contentId)
        if (definition.layer !== "obstacles") say(`${where} plans "${structure.contentId}", which is not a structure`)
        if (!tilesOf(structure.anchor, definition.footprint).every((tile) => inBounds(grid, tile))) {
          say(`${where} plans "${structure.contentId}" at ${structure.anchor.x},${structure.anchor.y}, reaching off the map`)
        }
      }
      return
    }
    // win and lose: the mission's end, read when a Pulse is over.
    if (at !== "end") say(`${where} must wait for an event — a mission is decided when a Pulse ends`)
    const { when } = trigger
    if (!isMoment(when) && when.event === "pulse.end" && (when.pulse === undefined || when.pulse === mission.pulses)) {
      lastPulseDecided.value = true
    }
  }

  const checkOrder = (given: object, where: string): void => {
    const order = given as Readonly<Record<string, unknown>>
    const keys = Object.keys(order).filter((key) => key !== "group")
    for (const key of keys) {
      if (key !== "advance") {
        say(`${where} gives the order "${key}", which the kernel cannot carry out yet — only "advance" (Q69)`)
      }
    }
    if (typeof order.advance === "string") knownRegion(order.advance, where)
    else if (!keys.includes("advance")) say(`${where} gives no order`)
  }

  for (const trigger of mission.triggers) {
    if (triggerIds.has(trigger.id)) say(`trigger "${trigger.id}" is declared twice`)
    triggerIds.add(trigger.id)
    checkCondition(trigger)
    if (trigger.do.length === 0) say(`trigger "${trigger.id}" does nothing`)
    trigger.do.forEach((action, index) => checkAction(trigger, action, index))
  }

  if (!lastPulseDecided.value && isPositiveInteger(mission.pulses)) {
    say(`nothing decides the mission when Pulse ${mission.pulses} ends: add a win or lose on its end`)
  }
  for (const pulse of Object.keys(mission.roundText ?? {})) {
    const number = Number(pulse)
    if (!isPositiveInteger(number) || number > mission.pulses) say(`roundText names round ${pulse}, but the mission has rounds 1 to ${mission.pulses}`)
  }

  if (problems.length > 0) throw new MissionError(mission.id, problems)
  return mission
}
