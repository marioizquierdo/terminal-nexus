// What hurt a side in a Battle Round: the damage it took, by the content that dealt it — its own side's blasts and
// splashes among them, since a death's blast hurts friend and foe unless its content says enemies alone — and how much
// of that its own side dealt. Public.

import type { DomainEvent } from "../../events/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { RoundContext } from "./context.ts"
import type { Tracker } from "./index.ts"

export type DamageReading = Readonly<{ taken: Readonly<Record<string, number>>; own: number }>

export function readDamage(context: RoundContext): Tracker<Readonly<Record<Side, DamageReading>>> {
  const taken: Record<Side, Record<string, number>> = { A: {}, B: {} }
  const own: Record<Side, number> = { A: 0, B: 0 }
  return {
    step(_state: MatchState, events: readonly DomainEvent[]) {
      for (const event of events) {
        if (event.kind !== "damage.applied") continue
        const victim = context.owner(event.entity)
        if (victim === undefined) continue
        const by = context.content(event.source) ?? event.source
        taken[victim][by] = (taken[victim][by] ?? 0) + event.amount
        if (context.owner(event.source) === victim) own[victim] += event.amount
      }
    },
    done() {
      return { A: { taken: taken.A, own: own.A }, B: { taken: taken.B, own: own.B } }
    },
  }
}
