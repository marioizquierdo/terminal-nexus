// The battles a measurement plays (docs/system-design/measurement.md): a map from `scenarios/` on a seed, a duel
// between two Commanders round by round, and a campaign level played by a fixed plan. Each comes back as the records of
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
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { DuelResult, DuelSetup, Side, SidePlan } from "../duel/index.ts"
import { briefOf, newDuel, playRound } from "../duel/index.ts"
import type { Player } from "../duel/index.ts"
import { centreTile } from "../match/index.ts"
import { contextFor, stepTick } from "../pulse/index.ts"
import { loadScenario } from "../scenario/load.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import type { BattleRecord } from "./battle.ts"
import { BattleRecorder, recordBattle } from "./battle.ts"

/** A map from `scenarios/`, played on one seed. */
export type ScenarioMeasure = Readonly<{ scenario: string; seed: number; battle: BattleRecord }>

/** Plays a scenario on `seed` to its end and records it. */
export function measureScenario(scenario: ScenarioDefinition, seed: number, registry: ContentRegistry = FIXTURE_REGISTRY): ScenarioMeasure {
  const loaded = loadScenario(scenario, { registry, seed })
  const context = contextFor(loaded.state, loaded.registry, scenario.pulseTicks)
  const recorder = new BattleRecorder(loaded.registry)
  let state = loaded.state
  recorder.observe(state, [])
  while (state.outcome === null && state.tick < scenario.pulseTicks) {
    const step = stepTick(state, context)
    state = step.state
    recorder.observe(state, step.events)
  }
  return { scenario: scenario.id, seed, battle: recorder.record() }
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
  result: DuelResult
  rounds: readonly DuelRound[]
}>

/** A whole duel, each side's plans from its player, every round recorded. */
export function measureDuel(setup: DuelSetup, players: Readonly<Record<Side, Readonly<{ name: string; player: Player }>>>): DuelMeasure {
  let state = newDuel(setup)
  const rounds: DuelRound[] = []
  while (state.result === null) {
    const briefs = { A: briefOf(state, "A").data, B: briefOf(state, "B").data }
    const plans: Record<Side, SidePlan> = { A: players.A.player(briefs.A), B: players.B.player(briefs.B) }
    let recorder: BattleRecorder | null = null
    const played = playRound(state, plans, (battle, events, registry, sides) => {
      recorder ??= new BattleRecorder(registry, sides)
      recorder.observe(battle, events)
    })
    const sideRound = (side: Side): DuelSideRound => {
      const hand = briefs[side].hand
      const picked = plans[side].power === undefined || plans[side].power === 0 ? undefined : hand[(plans[side].power ?? 0) - 1]
      const report = played.report.sides[side]
      return {
        hand: hand.map((card) => card.rarity as Rarity),
        kept: picked === undefined ? null : (picked.rarity as Rarity),
        keptId: picked === undefined ? null : picked.id,
        nexus: report.nexus.after,
        nexusMost: report.nexus.most,
      }
    }
    const battle = (recorder as BattleRecorder | null)?.record()
    if (battle === undefined) throw new Error(`round ${state.round} of the duel played no battle`)
    rounds.push({ round: state.round, battle, sides: { A: sideRound("A"), B: sideRound("B") } })
    state = played.state
  }
  return {
    commanders: setup.commanders,
    players: { A: players.A.name, B: players.B.name },
    map: setup.map,
    seed: setup.seed,
    result: state.result as DuelResult,
    rounds,
  }
}

/** How lucky a hand kept was: its rarity's place among the rarities, common 1 up to legendary 4; none kept 0. */
export const luckOf = (kept: Rarity | null): number => (kept === null ? 0 : RARITIES.indexOf(kept) + 1)

/** A plan a campaign level is played by: what it buys each round, near the player's Grid Nexus. */
export type LevelPlan = Readonly<{ name: string; buys: CurvePlan["buys"] }>

export type LevelMeasure = Readonly<{
  level: string
  plan: string
  /** The round the level ended in, and how: won, lost, or still going when its rounds ran out. */
  ended: Readonly<{ round: number; verdict: string }>
  rounds: readonly Readonly<{ round: number; bought: readonly string[]; battle: BattleRecord }>[]
}>

/** Plays `level` by `plan` to its end, recording every round's battle. */
export function measureLevel(level: PlayableLevel, plan: LevelPlan): LevelMeasure {
  let context = level.firstRound()
  const nexus = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  const near = nexus === undefined ? STARTER_START_CURSOR : centreTile(nexus.anchor, context.registry.get(nexus.contentId).footprint)
  const curve: CurvePlan = { name: plan.name, buys: plan.buys, near }
  const rounds: { round: number; bought: readonly string[]; battle: BattleRecord }[] = []
  let ended = { round: 0, verdict: "unplayed" }
  for (let round = 1; round <= level.rounds; round += 1) {
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
    const opened = createBuildState(withoutScene(context), STARTER_START_CURSOR, viewport)
    const planned = planRound(context, opened, curve)
    const resolved = level.play.startPulse(context, planned.state)
    if (resolved === null) throw new Error(`level "${level.id}": round ${round} could not start`)
    const { states, events, registry } = resolved.timeline
    rounds.push({ round, bought: planned.bought, battle: recordBattle(states, events, registry) })
    ended = { round, verdict: resolved.mission?.verdict.kind ?? "none" }
    const next = level.play.nextRound(context, planned.state, resolved)
    if (next === null) break
    context = next
  }
  return { level: level.id, plan: plan.name, ended, rounds }
}
