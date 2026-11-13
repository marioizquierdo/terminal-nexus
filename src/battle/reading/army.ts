// A side's army in a Battle Round: its units as the round opened and as it ended, and what it lost — each a composition
// (how many of each, how many in all, and their value in credits). Public: the Battle Round is seen by both sides.

import type { DomainEvent } from "../../events/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { Composition, RoundContext } from "./context.ts"
import type { Tracker } from "./index.ts"

export type ArmyReading = Readonly<{ start: Composition; end: Composition; lost: Composition }>

export function readArmy(context: RoundContext, start: MatchState): Tracker<Readonly<Record<Side, ArmyReading>>> {
  const unitsOf = (state: MatchState, side: Side): string[] =>
    state.entities.filter((entity) => entity.player === side && context.isUnit(entity.id)).map((entity) => entity.contentId)
  const opened = { A: unitsOf(start, "A"), B: unitsOf(start, "B") }
  const lost: Record<Side, string[]> = { A: [], B: [] }
  return {
    step(_state: MatchState, events: readonly DomainEvent[]) {
      for (const event of events) if (event.kind === "entity.died") lost[event.player as Side].push(event.contentId)
    },
    done(end: MatchState) {
      const side = (which: Side): ArmyReading => ({
        start: context.composition(which, opened[which]),
        end: context.composition(which, unitsOf(end, which)),
        lost: context.composition(which, lost[which]),
      })
      return { A: side("A"), B: side("B") }
    },
  }
}
