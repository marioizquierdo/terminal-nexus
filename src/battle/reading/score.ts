// The score after the rounds played (public): each side's damage dealt over the battle and its Nexus's share of health,
// and who leads by the rule a battle the rounds run out on is judged by — the healthier Nexus by share, then the damage.

import type { RoundReport, Side } from "../types.ts"
import { SIDES } from "../types.ts"

export type Score = Readonly<{
  dealt: Readonly<Record<Side, number>>
  nexus: Readonly<Record<Side, number>>
  leader: Side | null
  by: "health" | "damage" | "even"
}>

const dealtIn = (report: RoundReport, side: Side): number => {
  const { units, buildings, nexus } = report.reading.sides[side].damage.dealt
  return units + buildings + nexus
}

/** **The score**, from every round so far. Before any round, even. */
export function scoreOf(history: readonly RoundReport[]): Score {
  const last = history.at(-1)
  const share = (side: Side): number => {
    const nexus = last?.reading.sides[side].buildings.nexus
    return nexus === undefined || nexus.most === 0 ? 1 : nexus.after / nexus.most
  }
  const dealt = { A: 0, B: 0 }
  for (const report of history) for (const side of SIDES) dealt[side] += dealtIn(report, side)
  const nexus = { A: share("A"), B: share("B") }
  if (nexus.A !== nexus.B) return { dealt, nexus, leader: nexus.A > nexus.B ? "A" : "B", by: "health" }
  if (dealt.A !== dealt.B) return { dealt, nexus, leader: dealt.A > dealt.B ? "A" : "B", by: "damage" }
  return { dealt, nexus, leader: null, by: "even" }
}
