// How far each side's army got in a Battle Round: where its units stood, on average, between its Nexus and the enemy's
// as the round opened and as it ended (whole percent: 0 at its own Nexus, 100 at theirs), and the nearest any enemy
// unit came to its Nexus, in tiles (a row counting two). The end less the start is how far the front moved. Public.

import type { DomainEvent } from "../../events/types.ts"
import { gridDistance } from "../../grid/coords.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { RoundContext } from "./context.ts"
import type { Tracker } from "./index.ts"

export type AdvanceReading = Readonly<{ start: number | null; end: number | null; closest: number | null }>

export function readAdvance(context: RoundContext, start: MatchState): Tracker<Readonly<Record<Side, AdvanceReading>>> {
  const position = (state: MatchState, side: Side): number | null => {
    const shares = state.entities
      .filter((entity) => entity.player === side && context.isUnit(entity.id))
      .map((entity) => context.toward(side, entity.anchor))
      .filter((share): share is number => share !== null)
    return shares.length === 0 ? null : Math.round(shares.reduce((sum, share) => sum + share, 0) / shares.length)
  }
  const opened = { A: position(start, "A"), B: position(start, "B") }
  const closest: Record<Side, number | null> = { A: null, B: null }
  return {
    step(state: MatchState, _events: readonly DomainEvent[]) {
      for (const side of ["A", "B"] as const) {
        const nexus = context.nexus[side]
        if (nexus === undefined) continue
        for (const entity of state.entities) {
          if (entity.player === side || !context.isUnit(entity.id)) continue
          const distance = gridDistance(entity.anchor, nexus)
          if (closest[side] === null || distance < (closest[side] as number)) closest[side] = distance
        }
      }
    },
    done(end: MatchState) {
      return {
        A: { start: opened.A, end: position(end, "A"), closest: closest.A },
        B: { start: opened.B, end: position(end, "B"), closest: closest.B },
      }
    },
  }
}
