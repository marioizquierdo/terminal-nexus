// Playing a Skirmish a round at a time: who plans each slot, and the round itself, from a save's setup and the battle as
// it stands. Pure, like the battle it plays (`src/battle/`): the command line (`src/cli/skirmish.ts`) and the game's screens
// both play through here, so a battle played headless and one played on screen are the same battle.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import type { BuildActions, BuildEntry, BattleState, RoundReport, Side } from "../battle/index.ts"
import { actionsFor, briefOf, playRound, scriptedPlayer } from "../battle/index.ts"
import type { RegroupResult } from "../match/index.ts"
import type { MatchState } from "../state/types.ts"
import type { Profiles, SaveSetup, Slot } from "./save.ts"
import { controllerKind, battleSetupOf, IDLE_SCRIPT, scriptPlayed, SIDE_OF, SLOTS } from "./save.ts"

/** The plan an idle slot hands in: nothing kept, nothing built, holding. */
export const IDLE_ACTIONS: BuildActions = { build: [], stance: "hold" }

/** The plan a player's slot hands in when it gives none: nothing built, attacking. */
export const NO_ACTIONS: BuildActions = { build: [], stance: "attack" }

/** Whether a person (or a build file) plays the slot, rather than a script. */
export const isPlayer = (setup: SaveSetup, slot: Slot): boolean => controllerKind(setup.slots[slot].controller) === "player"

/** The plan a scripted slot makes this round, from its own brief. Throws for a slot no script plays. */
export function scriptPlan(setup: SaveSetup, state: BattleState, slot: Slot, profiles?: Profiles): BuildActions {
  const controller = setup.slots[slot].controller
  if (controllerKind(controller) === "agent") throw new Error(`${slot} is ${controller}: agent players are not built yet`)
  const script = scriptPlayed(controller, profiles)
  if (script === null) throw new Error(`${slot}: no script or profile for ${controller}`)
  if (script === IDLE_SCRIPT) return IDLE_ACTIONS
  const player = scriptedPlayer(script)
  if (player === undefined) throw new Error(`${slot}: no script "${script}"`)
  return player(briefOf(state, SIDE_OF[slot]).data)
}

/** A round played: the battle after it, what happened, and, when asked, every event and the battle's last state. */
export type Played = Readonly<{
  state: BattleState
  report: RoundReport
  /** The build actions each slot played: a player's as given, a script's as it made them. */
  actions: Readonly<Record<Slot, BuildActions>>
  events: readonly DomainEvent[]
  final: MatchState | null
  registry: ContentRegistry | null
  /** The survivors' walk back as the next Build Phase opens; `null` once the battle is over. */
  regroup: RegroupResult | null
}>

/** What a screen watches of a round as it plays: every tick's state and events, and the content each side drew on. */
export type RoundWatch = (battle: MatchState, events: readonly DomainEvent[], registry: ContentRegistry, sides: Readonly<Record<Side, ContentRegistry>>) => void

/**
 * **The next round of a Skirmish**: the battle brought up to the setup (who plans each slot, the modifiers and the credits
 * shares take effect from this round), each player's slot playing the plan given for it (or none: it builds nothing and
 * attacks), each scripted slot its script's plan, then the Battle Round.
 */
export function playNext(setup: SaveSetup, state: BattleState, plans: Readonly<Partial<Record<Slot, BuildActions>>>, profiles?: Profiles, watch?: RoundWatch): Played {
  if (state.result !== null) throw new Error("the battle is over: there is no next round to play")
  const current: BattleState = { ...state, setup: { ...battleSetupOf(setup, profiles), ...(state.setup.rosters === undefined ? {} : { rosters: state.setup.rosters }) } }
  const plan = (slot: Slot): BuildActions => (isPlayer(setup, slot) ? (plans[slot] ?? NO_ACTIONS) : scriptPlan(setup, current, slot, profiles))
  const events: DomainEvent[] = []
  let final: MatchState | null = null
  let registry: ContentRegistry | null = null
  const actions = { p1: plan("p1"), p2: plan("p2") }
  const played = playRound(current, { A: actions.p1, B: actions.p2 }, (battle, happened, drawn, sides) => {
    events.push(...happened)
    final = battle
    registry = drawn
    watch?.(battle, happened, drawn, sides)
  })
  return { state: played.state, report: played.report, actions, events, final, registry, regroup: played.regroup }
}

/** Each player slot's build actions for `round` from its build file (`first`: the first round played with it), and the
 *  player slots that have none. A scripted slot makes its own. */
export function actionsAt(
  setup: SaveSetup,
  builds: Readonly<Partial<Record<Slot, readonly BuildEntry[]>>>,
  round: number,
  first: number,
): Readonly<{ actions: Partial<Record<Slot, BuildActions>>; missing: readonly Slot[] }> {
  const actions: Partial<Record<Slot, BuildActions>> = {}
  const missing: Slot[] = []
  for (const slot of SLOTS) {
    if (!isPlayer(setup, slot)) continue
    const given = actionsFor(builds[slot] ?? [], round, first)
    if (given === undefined) missing.push(slot)
    else actions[slot] = given
  }
  return { actions, missing }
}

/** A round `playOn` played: the battle as it stood before it, and what it played. */
export type RoundPlayed = Readonly<{ before: BattleState; played: Played }>

/** A run of rounds played: the battle after them, how many were played, and the player slots it stopped for. */
export type Ran = Readonly<{ state: BattleState; played: number; waiting: readonly Slot[] }>

/**
 * **Rounds played on** until the battle reaches round `stop`'s Build Phase, or ends, or a player slot has no build
 * actions for the round about to play (`builds` has no entry for it). Each round is handed to `each` once played, and
 * every tick of its Battle Round to `watch`. The one loop every door plays rounds by: the command, a measurement, a test.
 */
export function playOn(
  setup: SaveSetup,
  start: BattleState,
  builds: Readonly<Partial<Record<Slot, readonly BuildEntry[]>>>,
  stop: number,
  profiles?: Profiles,
  each?: (round: RoundPlayed) => void,
  watch?: RoundWatch,
): Ran {
  const first = start.round
  let state = start
  let played = 0
  while (state.result === null && state.round < stop) {
    const { actions, missing } = actionsAt(setup, builds, state.round, first)
    if (missing.length > 0) return { state, played, waiting: missing }
    const result = playNext(setup, state, actions, profiles, watch)
    each?.({ before: state, played: result })
    state = result.state
    played += 1
  }
  return { state, played, waiting: [] }
}
