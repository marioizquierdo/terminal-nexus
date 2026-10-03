// 9. Objectives and victory (phase order in pulse.md).

import type { Outcome, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { TickContext } from "./shared.ts"
import { isMobile } from "./shared.ts"

export function victory(context: TickContext): Outcome | null {
  const nexusAlive: Record<PlayerId, boolean> = { A: false, B: false }
  const mobileAlive: Record<PlayerId, boolean> = { A: false, B: false }
  for (const actor of context.actors) {
    if (actor.definition.nexus === true) nexusAlive[actor.player] = true
    if (isMobile(actor)) mobileAlive[actor.player] = true
  }

  const nexusLost = PLAYERS.filter(
    (player) => context.pulse.roster[player].hasNexus && !nexusAlive[player],
  )
  if (nexusLost.length === 2) {
    return { winner: null, reason: "nexus-destroyed", tick: context.tick }
  }
  const loser = nexusLost[0]
  if (loser !== undefined) {
    return { winner: loser === "A" ? "B" : "A", reason: "nexus-destroyed", tick: context.tick }
  }

  // "Annihilated" means every entity on `workers`, `units`, and `air` is dead. Workers count: a side with only workers left has lost its army.
  // A side whose Grid Nexus stands is never annihilated (Mario, 2026-10-01: "the player should only lose
  // when the nexus is destroyed"): its Pulse goes on until the Nexus falls or the time runs out. A side
  // with no Nexus — a raid — is still beaten by losing every unit.
  const annihilated = PLAYERS.filter(
    (player) => context.pulse.roster[player].hasMobile && !mobileAlive[player] && !nexusAlive[player],
  )
  if (annihilated.length === 2) {
    return { winner: null, reason: "annihilation", tick: context.tick }
  }
  const wiped = annihilated[0]
  if (wiped !== undefined) {
    return { winner: wiped === "A" ? "B" : "A", reason: "annihilation", tick: context.tick }
  }

  if (context.tick >= context.pulse.pulseTicks) {
    return { winner: null, reason: "tick-limit", tick: context.tick }
  }
  return null
}
