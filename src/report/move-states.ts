// The three movement states, read back from a resolved Pulse: when each unit went from marching to battle, from
// battle to retreat, and back (docs/system-design/movement.md, "Three states").
//
// The kernel decides a unit's state every tick (`moveStateOf`, src/pulse/march.ts) and keeps no record of it: a state
// is worked out from the unit's purpose and its target, and storing it, or emitting an event each time it changes,
// would change every pinned state or event hash for something nothing the rules decide ever reads. So the record is
// made here, after the fact, from what the Pulse did keep — every tick's settled state and its events — by the same
// rule, and nothing here can reach a tick's resolution:
//
// - **retreat**: the unit fled this tick (a `behavior.flee` event).
// - **battle**: it has a target (`targetOrdinal`, set by this tick's perception) and is not a worker that flees, and
//   that target is not the enemy's Grid Nexus while it is still beyond the unit's vision — a unit walking on the
//   Nexus it cannot see yet is marching for its side's goal (`marchesOn`).
// - **march**: anything else: walking for its side's goal, standing with nothing to fight, or making way for an ally
//   of higher priority (a `march.made-way` event).
//
// Distances are taken where the tick began (the state before it), as the kernel takes them when it decides. One
// moment reads differently from the kernel's: a unit stepping off a roof its building tells it to leave is marching
// there by the kernel's word and in battle by this one's, for the few ticks the step takes, when it already has a
// target. A test holds the vision rule here to the kernel's (`tests/move-states.test.ts`).

import type { ContentRegistry } from "../content/index.ts"
import type { ContentDef } from "../content/types.ts"
import type { DomainEvent } from "../events/types.ts"
import { footprintWithin } from "../grid/coords.ts"
import { wholeRows } from "../grid/reach.ts"
import type { Coord } from "../grid/types.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"

/** What a unit is doing, in a word: the kernel's `MoveState`. */
export type MoveStateName = "march" | "battle" | "retreat"

/** A unit changing state: the tick it changed on, who, where it stood, and from what to what. */
export type MoveStateChange = Readonly<{
  tick: number
  ordinal: number
  entity: string
  player: PlayerId
  contentId: string
  at: Coord
  from: MoveStateName
  to: MoveStateName
}>

/** The vision a unit turns to fight within: the kernel's `VISION` (src/pulse/target.ts), held equal by a test. */
export const DEFAULT_VISION = 6

/** The kernel's `visionOf`, restated here because a report may not reach the kernel (tests/architecture.test.ts). */
export function visionReach(definition: ContentDef): number {
  return wholeRows(Math.max(definition.vision ?? DEFAULT_VISION, definition.attack?.range ?? 0))
}

/** Whether this entity is a unit whose state is worth a line: one that walks. A turret has a state by the kernel's
 *  word too, battle whenever it has a target, but it never moves, so it is left out. */
function hasState(definition: ContentDef): boolean {
  return definition.layer !== "obstacles" && definition.movementRate !== undefined && definition.behavior !== "static"
}

/** The state an entity was in during the tick that settled it, `start` holding everyone as that tick began. */
function stateOf(
  entity: EntityState,
  definition: ContentDef,
  start: ReadonlyMap<number, EntityState>,
  registry: ContentRegistry,
  fled: ReadonlySet<number>,
  madeWay: ReadonlySet<number>,
): MoveStateName {
  if (fled.has(entity.ordinal)) return "retreat"
  if (madeWay.has(entity.ordinal)) return "march"
  if (entity.targetOrdinal === null || definition.behavior === "flee") return "march"
  const target = start.get(entity.targetOrdinal)
  if (target === undefined) return "march"
  const targetDef = registry.get(target.contentId)
  if (targetDef.nexus === true && target.player !== entity.player) {
    const from = start.get(entity.ordinal) ?? entity
    const seen = footprintWithin(from.anchor, definition.footprint, target.anchor, targetDef.footprint, visionReach(definition))
    if (!seen) return "march"
  }
  return "battle"
}

/**
 * Every unit's state changes over a resolved Pulse, in tick order and, within a tick, in ordinal order. A unit is
 * taken to start on the march: one that comes into the battle already fighting is listed going from march to battle
 * on the tick it first appears. Pure: the same states and events give the same list, on any runtime.
 */
export function moveStateChanges(
  pulse: Readonly<{ states: readonly MatchState[]; events: readonly DomainEvent[]; registry: ContentRegistry }>,
): MoveStateChange[] {
  const fledAt = new Map<number, Set<number>>()
  const madeWayAt = new Map<number, Set<number>>()
  for (const event of pulse.events) {
    if (event.kind !== "behavior.flee" && event.kind !== "march.made-way") continue
    const into = event.kind === "behavior.flee" ? fledAt : madeWayAt
    const set = into.get(event.tick)
    if (set === undefined) into.set(event.tick, new Set([event.ordinal]))
    else set.add(event.ordinal)
  }
  const none = new Set<number>()
  const last = new Map<number, MoveStateName>()
  const changes: MoveStateChange[] = []
  for (let index = 1; index < pulse.states.length; index += 1) {
    const before = pulse.states[index - 1]
    const now = pulse.states[index]
    if (before === undefined || now === undefined) continue
    const start = new Map(before.entities.map((entity) => [entity.ordinal, entity]))
    const fled = fledAt.get(now.tick) ?? none
    const madeWay = madeWayAt.get(now.tick) ?? none
    for (const entity of now.entities) {
      if (entity.hp <= 0) continue
      const definition = pulse.registry.get(entity.contentId)
      if (!hasState(definition)) continue
      const state = stateOf(entity, definition, start, pulse.registry, fled, madeWay)
      const was = last.get(entity.ordinal) ?? "march"
      last.set(entity.ordinal, state)
      if (state === was) continue
      changes.push({
        tick: now.tick,
        ordinal: entity.ordinal,
        entity: entity.id,
        player: entity.player,
        contentId: entity.contentId,
        at: (start.get(entity.ordinal) ?? entity).anchor,
        from: was,
        to: state,
      })
    }
  }
  return changes
}

/** What the Activity Logs' `unit.state` entry records for a change (src/log/activity.ts), a round's ticks counted at
 *  `ticksPerSecond`: the screen logs each change of the round just ended with it. */
export function moveStateEntry(
  change: MoveStateChange,
  round: number,
  ticksPerSecond: number,
): Readonly<{ round: number; second: number; unit: string; from: MoveStateName; to: MoveStateName; x: number; y: number }> {
  return {
    round,
    second: Math.round((change.tick * 10) / ticksPerSecond) / 10,
    unit: change.entity,
    from: change.from,
    to: change.to,
    x: change.at.x,
    y: change.at.y,
  }
}
