// Reconstruct entity state from the event stream alone.
//
// This is what makes `src/report` honest. The report derives everything it prints from the events
// and the final state, never from kernel internals (milestone-1-spike-battle.md 3.2) — and the
// cheapest way to *prove* that is to rebuild the cast from the events and check the result against
// the state the kernel actually finished with. A report that can do that cannot be narrating a
// story the events do not contain.
//
// Position, health, life, and target are reconstructible. Two fields deliberately are not:
// `facing`, which is a rendering hint no rule reads, and `moveCredit`, which appears on the events
// that carry a movement decision and nowhere else. Neither is invented here.

import type { DomainEvent } from "../events/types.ts"
import type { Coord } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"

export type ReplayEntity = {
  ordinal: number
  id: string
  player: PlayerId
  contentId: string
  hp: number
  anchor: Coord
  targetOrdinal: number | null
  alive: boolean
  diedAtTick: number | null
}

export type ReplayState = Readonly<{
  tick: number
  entities: ReadonlyMap<number, ReplayEntity>
}>

export function replayEvents(events: readonly DomainEvent[]): ReplayState {
  const entities = new Map<number, ReplayEntity>()
  let tick = 0
  for (const event of events) {
    tick = Math.max(tick, event.tick)
    switch (event.kind) {
      case "entity.spawned":
        entities.set(event.ordinal, {
          ordinal: event.ordinal,
          id: event.entity,
          player: event.player,
          contentId: event.contentId,
          hp: event.hp,
          anchor: event.at,
          targetOrdinal: null,
          alive: true,
          diedAtTick: null,
        })
        break
      case "entity.moved": {
        const entity = entities.get(event.ordinal)
        if (entity !== undefined) entity.anchor = event.to
        break
      }
      case "damage.applied": {
        const entity = entities.get(event.ordinal)
        if (entity !== undefined) entity.hp = event.hpAfter
        break
      }
      case "target.selected": {
        const entity = entities.get(event.ordinal)
        if (entity !== undefined) entity.targetOrdinal = event.targetOrdinal
        break
      }
      case "target.lost": {
        const entity = entities.get(event.ordinal)
        if (entity !== undefined) entity.targetOrdinal = null
        break
      }
      case "entity.died":
      case "structure.destroyed": {
        const entity = entities.get(event.ordinal)
        if (entity !== undefined) {
          entity.alive = false
          entity.hp = 0
          entity.anchor = event.at
          entity.diedAtTick = event.tick
        }
        break
      }
      default:
        break
    }
  }
  return { tick, entities }
}
