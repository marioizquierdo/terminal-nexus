// Measuring battles the same way before and after a rule changes (docs/system-design/measurement.md): the spec of
// what is played (`spec.ts`), the battles themselves (`suites.ts`), a battle's record (`battle.ts`), and the plain
// words a measurement says (`summary.ts`); a spec split into processes and merged back (`merge.ts`); and what one
// unit did in each round of each campaign level (`who.ts`). `runSpec` plays a whole spec; the command around it
// (`bin/measure.ts`) reads the maps, keeps time and writes the result down.

import type { PlayableLevel } from "../cli/levels.ts"
import type { Player } from "../duel/index.ts"
import { scriptedNames, scriptedPlayer } from "../duel/index.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import type { MeasureSpec } from "./spec.ts"
import { playerPairs } from "./spec.ts"
import type { DuelMeasure, LevelMeasure, ScenarioMeasure } from "./suites.ts"
import { measureDuel, measureLevel, measureScenario } from "./suites.ts"

export * from "./battle.ts"
export * from "./formations.ts"
export * from "./merge.ts"
export * from "./spec.ts"
export * from "./suites.ts"
export { luckByCards, summaryLines } from "./summary.ts"
export * from "./who.ts"

export type SpecInputs = Readonly<{
  /** The maps to play, already read. */
  scenarios: readonly ScenarioDefinition[]
  levels: readonly PlayableLevel[]
  /** Which parts to play: any of "scenarios", "duels", "levels". */
  parts: ReadonlySet<string>
  /** Told of each battle as it is played, for a line on the console. */
  progress?: (line: string) => void
}>

export type SpecResult = Readonly<{
  scenarios: readonly ScenarioMeasure[]
  duels: readonly DuelMeasure[]
  levels: readonly LevelMeasure[]
  /** Every tick played, for the time a tick took. */
  ticks: number
}>

/** Plays everything `spec` names, in a fixed order. */
export function runSpec(spec: MeasureSpec, inputs: SpecInputs): SpecResult {
  const say = inputs.progress ?? (() => {})
  const scenarios: ScenarioMeasure[] = []
  const duels: DuelMeasure[] = []
  const levels: LevelMeasure[] = []
  let ticks = 0
  if (inputs.parts.has("scenarios")) {
    const maps = inputs.scenarios.filter((scenario) => spec.scenarios === "all" || scenario.id.startsWith("route-"))
    for (const scenario of maps) {
      // A route scenario is played on every seed; every other map on its own seed, the one its tests use.
      const seeds = scenario.id.startsWith("route-") ? spec.seeds : [scenario.seed]
      for (const seed of seeds) {
        const run = measureScenario(scenario, seed)
        ticks += run.battle.ticks
        scenarios.push(run)
        say(`scenario ${scenario.id} seed ${seed}: ${run.battle.winner ?? "draw"} at ${run.battle.ticks}`)
      }
    }
  }
  if (inputs.parts.has("duels")) {
    const { duels: setup } = spec
    const scripted = (name: string): Player => {
      const player = scriptedPlayer(name)
      if (player === undefined) throw new Error(`no scripted player "${name}" (${scriptedNames()})`)
      return player
    }
    for (const name of setup.players) {
      for (const pair of playerPairs(setup, name)) {
        const players = { A: { name: pair.A, player: scripted(pair.A) }, B: { name: pair.B, player: scripted(pair.B) } }
        const label = pair.A === pair.B ? pair.A : `${pair.A} v ${pair.B}`
        for (const a of setup.west ?? setup.commanders) {
          for (const b of setup.commanders) {
            for (const seed of spec.seeds) {
              const duel = measureDuel({ map: setup.map, seed, rounds: setup.rounds, pulseTicks: setup.pulseTicks, commanders: { A: a, B: b } }, players)
              ticks += duel.rounds.reduce((sum, round) => sum + round.battle.ticks, 0)
              duels.push(duel)
              const won = duel.result.winner
              const winner = won === null ? "draw" : pair.A === pair.B ? duel.commanders[won] : `${duel.commanders[won]} (${duel.players[won]})`
              say(`duel ${label} ${a} v ${b} seed ${seed}: ${winner} (${duel.result.by}, round ${duel.result.round})`)
            }
          }
        }
      }
    }
  }
  if (inputs.parts.has("levels")) {
    const chosen = spec.levels.length === 0 ? inputs.levels : inputs.levels.filter((level) => spec.levels.includes(level.id))
    for (const level of chosen) {
      for (const plan of spec.plans) {
        const run = measureLevel(level, plan)
        ticks += run.rounds.reduce((sum, round) => sum + round.battle.ticks, 0)
        levels.push(run)
        say(`level ${level.id} "${plan.name}": ${run.ended.verdict} in round ${run.ended.round}`)
      }
    }
  }
  return { scenarios, duels, levels, ticks }
}
