// A side's army in a Battle Round: its units as the round opened and as it ended, those its buildings trained during it
// and what it lost — each a composition (how many of each, how many in all, and their value in credits) — whether its
// Commander fell, and what its abilities did, counted by name ("Bounty": 4). Public: the Battle Round is seen by both
// sides.

import type { DomainEvent } from "../../events/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { Composition, RoundContext } from "./context.ts"
import type { Tracker } from "./index.ts"

export type ArmyReading = Readonly<{
  start: Composition
  end: Composition
  trained: Composition
  lost: Composition
  commanderFell: boolean
  abilities: Readonly<Record<string, number>>
}>

export function readArmy(context: RoundContext, start: MatchState): Tracker<Readonly<Record<Side, ArmyReading>>> {
  const unitsOf = (state: MatchState, side: Side): string[] =>
    state.entities.filter((entity) => entity.player === side && context.isUnit(entity.id)).map((entity) => entity.contentId)
  const opened = { A: unitsOf(start, "A"), B: unitsOf(start, "B") }
  const lost: Record<Side, string[]> = { A: [], B: [] }
  const trained: Record<Side, string[]> = { A: [], B: [] }
  const fell: Record<Side, boolean> = { A: false, B: false }
  const abilities: Record<Side, Record<string, number>> = { A: {}, B: {} }
  return {
    step(_state: MatchState, events: readonly DomainEvent[]) {
      for (const event of events) {
        if (event.kind === "entity.spawned") trained[event.player as Side].push(event.contentId)
        if (event.kind === "entity.died") {
          lost[event.player as Side].push(event.contentId)
          if (context.definition(event.entity)?.commander === true) fell[event.player as Side] = true
        }
        if (event.kind === "ability.triggered") {
          const named = abilities[event.player as Side]
          named[event.name ?? event.ability] = (named[event.name ?? event.ability] ?? 0) + 1
        }
      }
    },
    done(end: MatchState) {
      const side = (which: Side): ArmyReading => ({
        start: context.composition(which, opened[which]),
        end: context.composition(which, unitsOf(end, which)),
        trained: context.composition(which, trained[which]),
        lost: context.composition(which, lost[which]),
        commanderFell: fell[which],
        abilities: abilities[which],
      })
      return { A: side("A"), B: side("B") }
    },
  }
}
