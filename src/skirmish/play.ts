// Playing a Skirmish a round at a time: who plans each slot, and the round itself, from a save's setup and the duel as
// it stands. Pure, like the duel it plays (`src/duel/`): the command line (`src/cli/skirmish.ts`) and the game's screens
// both play through here, so a battle played headless and one played on screen are the same battle.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import type { DuelState, RoundReport, SidePlan } from "../duel/index.ts"
import { briefOf, playRound, scriptedPlayer } from "../duel/index.ts"
import type { MatchState } from "../state/types.ts"
import type { Profiles, SaveSetup, Slot } from "./save.ts"
import { controllerKind, duelSetupOf, IDLE_SCRIPT, scriptPlayed, SIDE_OF } from "./save.ts"

/** The plan an idle slot hands in: nothing kept, nothing built, holding. */
export const IDLE_PLAN: SidePlan = { build: [], stance: "hold" }

/** The plan a player's slot hands in when it gives none: nothing built, attacking. */
export const EMPTY_PLAN: SidePlan = { build: [], stance: "attack" }

/** Whether a person (or a plan file) plans the slot, rather than a script. */
export const isPlayer = (setup: SaveSetup, slot: Slot): boolean => controllerKind(setup.slots[slot].controller) === "player"

/** The plan a scripted slot makes this round, from its own brief. Throws for a slot no script plays. */
export function scriptPlan(setup: SaveSetup, state: DuelState, slot: Slot, profiles?: Profiles): SidePlan {
  const controller = setup.slots[slot].controller
  if (controllerKind(controller) === "agent") throw new Error(`${slot} is ${controller}: agent players are not built yet`)
  const script = scriptPlayed(controller, profiles)
  if (script === null) throw new Error(`${slot}: no script or profile for ${controller}`)
  if (script === IDLE_SCRIPT) return IDLE_PLAN
  const player = scriptedPlayer(script)
  if (player === undefined) throw new Error(`${slot}: no script "${script}"`)
  return player(briefOf(state, SIDE_OF[slot]).data)
}

/** A round played: the duel after it, what happened, and, when asked, every event and the battle's last state. */
export type Played = Readonly<{
  state: DuelState
  report: RoundReport
  events: readonly DomainEvent[]
  final: MatchState | null
  registry: ContentRegistry | null
}>

/**
 * **The next round of a Skirmish**: the duel brought up to the setup (who plans each slot, the modifiers and the credits
 * shares take effect from this round), each player's slot playing the plan given for it (or none: it builds nothing and
 * attacks), each scripted slot its script's plan, then the Battle Round.
 */
export function playNext(setup: SaveSetup, state: DuelState, plans: Readonly<Partial<Record<Slot, SidePlan>>>, profiles?: Profiles): Played {
  if (state.result !== null) throw new Error("the battle is over: there is no next round to play")
  const current: DuelState = { ...state, setup: { ...duelSetupOf(setup, profiles), ...(state.setup.rosters === undefined ? {} : { rosters: state.setup.rosters }) } }
  const plan = (slot: Slot): SidePlan => (isPlayer(setup, slot) ? (plans[slot] ?? EMPTY_PLAN) : scriptPlan(setup, current, slot, profiles))
  const events: DomainEvent[] = []
  let final: MatchState | null = null
  let registry: ContentRegistry | null = null
  const played = playRound(current, { A: plan("p1"), B: plan("p2") }, (battle, happened, drawn) => {
    events.push(...happened)
    final = battle
    registry = drawn
  })
  return { state: played.state, report: played.report, events, final, registry }
}
