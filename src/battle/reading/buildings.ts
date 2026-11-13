// A side's buildings in a Battle Round: what stands as it ends (a composition: how many of each and their value), which
// are damaged and how badly — the Nexus among them, as any building — and each one destroyed, with what destroyed it.
// Public.

import type { DomainEvent } from "../../events/types.ts"
import type { Coord } from "../../grid/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { Composition, RoundContext } from "./context.ts"
import type { Tracker } from "./index.ts"

/** A building that ended the round hurt: what, where, and its health of its most. */
export type Damaged = Readonly<{ contentId: string; at: Coord; hp: number; most: number }>

export type BuildingsReading = Readonly<{
  standing: Composition
  damaged: readonly Damaged[]
  /** Each destroyed, counted by "what by what": `building.citizen.barracks by unit.ravel.bomber`. */
  lost: Readonly<Record<string, number>>
}>

export function readBuildings(context: RoundContext): Tracker<Readonly<Record<Side, BuildingsReading>>> {
  const lost: Record<Side, Record<string, number>> = { A: {}, B: {} }
  return {
    step(_state: MatchState, events: readonly DomainEvent[]) {
      for (const event of events) {
        if (event.kind !== "structure.destroyed") continue
        const key = `${event.contentId} by ${event.killer === null ? "nothing" : (context.content(event.killer) ?? event.killer)}`
        const side = event.player as Side
        lost[side][key] = (lost[side][key] ?? 0) + 1
      }
    },
    done(end: MatchState) {
      const side = (which: Side): BuildingsReading => {
        const standing = end.entities.filter((entity) => entity.player === which && !context.isUnit(entity.id))
        const damaged = standing.flatMap((entity) => {
          const most = context.sides[which].get(entity.contentId).maxHp
          return entity.hp < most ? [{ contentId: entity.contentId, at: entity.anchor, hp: entity.hp, most }] : []
        })
        return { standing: context.composition(which, standing.map((entity) => entity.contentId)), damaged, lost: lost[which] }
      }
      return { A: side("A"), B: side("B") }
    },
  }
}
