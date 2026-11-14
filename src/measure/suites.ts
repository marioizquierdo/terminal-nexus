// The battles a measurement plays (docs/system-design/measurement.md): a map from `sandboxes/` on a seed, a duel
// between two Commanders played as a Skirmish (the same save, seating and round loop the `skirmish` command plays by), and a Story level played by a fixed plan. Each comes back as the records of
// its battles (`battle.ts`) and what decided it. Pure: the same inputs measure the same on every machine. Reading the
// maps from disk, the clock and writing the results down are the command's (`bin/measure.ts`).

import { RARITIES } from "../armies/types.ts"
import type { Rarity } from "../armies/types.ts"
import type { CurvePlan } from "../cli/curve-measure.ts"
import { planRound } from "../cli/curve-measure.ts"
import type { PlayableLevel } from "../cli/levels.ts"
import { STARTER_START_CURSOR } from "../build/catalog.ts"
import { buildLayout } from "../build/layout.ts"
import { createBuildState, withoutScene } from "../build/state.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { BattleResult, Side } from "../battle/index.ts"
import { briefOf } from "../battle/index.ts"
import { centreTile } from "../match/index.ts"
import { playOn } from "../skirmish/play.ts"
import { playSandboxRound } from "../skirmish/sandbox-round.ts"
import { newBattle, seat, withRules } from "../skirmish/request.ts"
import type { Profiles } from "../skirmish/save.ts"
import { battleOf } from "../skirmish/save.ts"
import { slotAsk } from "../skirmish/slots.ts"
import type { BattleOpening } from "../skirmish/opening/types.ts"
import type { MatchState } from "../state/types.ts"
import type { BattleRecord } from "./battle.ts"
import { BattleRecorder, recordBattle } from "./battle.ts"

/** A map from `sandboxes/`, played on one seed. */
export type SaveMeasure = Readonly<{ save: string; seed: number; battle: BattleRecord }>

/** Plays a sandbox's opening on `seed` to its end and records it. */
export function measureSave(opening: BattleOpening, seed: number, registry: ContentRegistry = FIXTURE_REGISTRY): SaveMeasure {
  const recorder = new BattleRecorder(registry)
  playSandboxRound(opening, { registry, seed, watch: (state, events) => recorder.observe(state, events) })
  return { save: opening.id, seed, battle: recorder.record() }
}

/** One side of one duel round: the rarities of the hand it was dealt, the rarity of the card it kept (null for none)
 *  and which card that was, and its Nexus's health when the battle ended. A result written before cards were named
 *  has no `keptId`. */
export type DuelSideRound = Readonly<{ hand: readonly Rarity[]; kept: Rarity | null; keptId?: string | null; nexus: number; nexusMost: number }>

export type DuelRound = Readonly<{ round: number; battle: BattleRecord; sides: Readonly<Record<Side, DuelSideRound>> }>

export type DuelMeasure = Readonly<{
  commanders: Readonly<Record<Side, string>>
  players: Readonly<Record<Side, string>>
  map: string
  seed: number
  result: BattleResult
  rounds: readonly DuelRound[]
}>

/** A duel a measurement plays: where, on which seed, for how long, and whose armies, side A (p1, west) and side B. */
export type DuelBattle = Readonly<{ map: string; seed: number; rounds: number; pulseTicks: number; commanders: Readonly<Record<Side, string>> }>

const NO_PROFILES: Profiles = new Map()

/**
 * **A whole duel, played as a Skirmish**: a new battle set up as `battle` says, each slot played by its script (`players`,
 * by name, as `--p1 script:<name>` names one), played to its end by the Skirmish's own loop (`playOn`, the one the
 * `skirmish` command and the screens play by), and every round's Battle Round recorded.
 */
export function measureDuel(battle: DuelBattle, players: Readonly<Record<Side, string>>): DuelMeasure {
  const save = newBattle({ map: battle.map, seed: battle.seed, roundTicks: battle.pulseTicks, commanders: { p1: battle.commanders.A, p2: battle.commanders.B } }, NO_PROFILES)
  const seated = seat(save, { p1: { ask: slotAsk(`script:${players.A}`, NO_PROFILES) }, p2: { ask: slotAsk(`script:${players.B}`, NO_PROFILES) } }, () => "")
  const setup = withRules(seated.setup, 1, { rounds: battle.rounds })
  const rounds: DuelRound[] = []
  let recorder: BattleRecorder | null = null
  const ran = playOn(
    setup,
    battleOf({ ...save, setup }, NO_PROFILES),
    {},
    Number.POSITIVE_INFINITY,
    NO_PROFILES,
    ({ before, played }) => {
      const record = (recorder as BattleRecorder | null)?.record()
      recorder = null
      if (record === undefined) throw new Error(`round ${before.round} of the duel played no battle`)
      const sideRound = (side: Side): DuelSideRound => {
        const hand = briefOf(before, side).data.hand
        const power = played.actions[side === "A" ? "p1" : "p2"].power
        const picked = power === undefined || power === 0 ? undefined : hand[power - 1]
        const report = played.report.sides[side]
        return {
          hand: hand.map((card) => card.rarity as Rarity),
          kept: picked === undefined ? null : (picked.rarity as Rarity),
          keptId: picked === undefined ? null : picked.id,
          nexus: report.nexus.after,
          nexusMost: report.nexus.most,
        }
      }
      rounds.push({ round: before.round, battle: record, sides: { A: sideRound("A"), B: sideRound("B") } })
    },
    (state, events, registry, sides) => {
      recorder ??= new BattleRecorder(registry, sides)
      recorder.observe(state, events)
    },
  )
  return {
    commanders: battle.commanders,
    players,
    map: battle.map,
    seed: battle.seed,
    result: ran.state.result as BattleResult,
    rounds,
  }
}

/** How lucky a hand kept was: its rarity's place among the rarities, common 1 up to legendary 4; none kept 0. */
export const luckOf = (kept: Rarity | null): number => (kept === null ? 0 : RARITIES.indexOf(kept) + 1)

/** A plan a Story level is played by: what it buys each round, near the player's Grid Nexus. */
export type LevelPlan = Readonly<{ name: string; buys: CurvePlan["buys"] }>

export type LevelMeasure = Readonly<{
  level: string
  plan: string
  /** The round the level ended in, and how: won, lost, or still going when its rounds ran out. */
  ended: Readonly<{ round: number; verdict: string }>
  rounds: readonly Readonly<{ round: number; bought: readonly string[]; battle: BattleRecord }>[]
}>

/** One round of a level as it was played: what the plan bought and the battle's states and events. */
export type LevelRound = Readonly<{
  round: number
  bought: readonly string[]
  states: readonly MatchState[]
  events: readonly DomainEvent[]
  registry: ContentRegistry
}>

/** Plays `level` by `plan` to its end, handing each round to `each` as it is played; says how it ended. */
export function playLevel(level: PlayableLevel, plan: LevelPlan, each: (round: LevelRound) => void): LevelMeasure["ended"] {
  let context = level.firstRound()
  const nexus = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  const near = nexus === undefined ? STARTER_START_CURSOR : centreTile(nexus.anchor, context.registry.get(nexus.contentId).footprint)
  const curve: CurvePlan = { name: plan.name, buys: plan.buys, near }
  let ended = { round: 0, verdict: "unplayed" }
  for (let round = 1; round <= level.rounds; round += 1) {
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
    const opened = createBuildState(withoutScene(context), STARTER_START_CURSOR, viewport)
    const planned = planRound(context, opened, curve)
    const resolved = level.play.startPulse(context, planned.state)
    if (resolved === null) throw new Error(`level "${level.id}": round ${round} could not start`)
    const { states, events, registry } = resolved.timeline
    each({ round, bought: planned.bought, states, events, registry })
    ended = { round, verdict: resolved.mission?.verdict.kind ?? "none" }
    const next = level.play.nextRound(context, planned.state, resolved)
    if (next === null) break
    context = next
  }
  return ended
}

/** Plays `level` by `plan` to its end, recording every round's battle. */
export function measureLevel(level: PlayableLevel, plan: LevelPlan): LevelMeasure {
  const rounds: { round: number; bought: readonly string[]; battle: BattleRecord }[] = []
  const ended = playLevel(level, plan, ({ round, bought, states, events, registry }) => {
    rounds.push({ round, bought, battle: recordBattle(states, events, registry) })
  })
  return { level: level.id, plan: plan.name, ended, rounds }
}
