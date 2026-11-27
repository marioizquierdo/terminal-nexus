// The battles a measurement plays (docs/system-design/measurement.md): a map from `sandboxes/` on a seed, a duel
// between two Commanders played as a Skirmish (the same save, seating and round loop the `skirmish` command plays by). Each comes back as the records of
// its battles (`battle.ts`) and what decided it. Pure: the same inputs measure the same on every machine. Reading the
// maps from disk, the clock and writing the results down are the command's (`bin/measure.ts`).

import { RARITIES } from "../armies/types.ts"
import type { Rarity } from "../armies/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../engine/events/types.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { BattleResult, Side } from "../battle/index.ts"
import { briefOf } from "../battle/index.ts"
import { playOn } from "../skirmish/play.ts"
import { playSandboxRound } from "../skirmish/sandbox-round.ts"
import { newBattle, openSave } from "../skirmish/request.ts"
import type { Profiles } from "../skirmish/save.ts"
import { slotAsk } from "../skirmish/slots.ts"
import type { BattleOpening } from "../skirmish/opening/types.ts"
import type { MatchState } from "../engine/state/types.ts"
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
  const opened = openSave(save, { slots: { p1: { ask: slotAsk(`script:${players.A}`, NO_PROFILES) }, p2: { ask: slotAsk(`script:${players.B}`, NO_PROFILES) } }, rules: { rounds: battle.rounds }, profiles: NO_PROFILES })
  const rounds: DuelRound[] = []
  let recorder: BattleRecorder | null = null
  const ran = playOn(
    opened.setup,
    opened.state,
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
        const nexus = played.report.reading.sides[side].buildings.nexus
        return {
          hand: hand.map((card) => card.rarity as Rarity),
          kept: picked === undefined ? null : (picked.rarity as Rarity),
          keptId: picked === undefined ? null : picked.id,
          nexus: nexus.after,
          nexusMost: nexus.most,
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

/** A Story level as it was played and measured: only in a record written before Story stopped (2026-11-26). */
export type LevelMeasure = Readonly<{
  level: string
  plan: string
  /** The round the level ended in, and the mission's verdict: won, lost, none (the rounds ran out undecided), or unplayed (no round ran). */
  ended: Readonly<{ round: number; verdict: string }>
  rounds: readonly Readonly<{ round: number; bought: readonly string[]; battle: BattleRecord }>[]
}>
