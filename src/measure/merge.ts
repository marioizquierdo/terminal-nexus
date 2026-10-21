// A spec played as several processes side by side, and their results made one (docs/system-design/measurement.md).
// `jobsOf` splits a spec into the maps, each scripted player's duels on each seed, and the campaign levels; and
// `mergeMeasurements` puts the parts back in the order `runSpec` plays them, whatever order they finished or were
// named in, so a spec played in parallel writes down the same battles, in the same order, as one process would. Pure:
// starting the processes and keeping their files are the command's (`src/cli/measure.ts`).

import type { BattleRecord } from "./battle.ts"
import type { Measurement, MeasureSpec } from "./spec.ts"

/** One process's share of a spec: which parts it plays, and for duels which scripted player, with which Commander
 *  on side A, on which seeds. */
export type MeasureJob = Readonly<{
  label: string
  parts: readonly string[]
  players: readonly string[]
  west: readonly string[]
  seeds: readonly number[]
}>

/** A spec split into jobs: each player's duels for each Commander on side A on each seed (duels are the slow part,
 *  and one seed's can take several times another's, so they are cut small), then the levels, then the maps. */
export function jobsOf(spec: MeasureSpec, parts: ReadonlySet<string>): MeasureJob[] {
  const jobs: MeasureJob[] = []
  const { players } = spec.duels
  const west = spec.duels.west ?? spec.duels.commanders
  if (parts.has("duels")) {
    for (const player of players) {
      for (const a of west) {
        for (const seed of spec.seeds) {
          jobs.push({ label: `duels ${player} ${a} seed ${seed}`, parts: ["duels"], players: [player], west: [a], seeds: [seed] })
        }
      }
    }
  }
  if (parts.has("levels")) jobs.push({ label: "levels", parts: ["levels"], players, west, seeds: spec.seeds })
  if (parts.has("scenarios")) jobs.push({ label: "scenarios", parts: ["scenarios"], players, west, seeds: spec.seeds })
  return jobs
}

/** Where `value` stands in `order`; one it does not list after every one it does. */
const placeIn = <T>(order: readonly T[], value: T): number => {
  const at = order.indexOf(value)
  return at === -1 ? order.length : at
}

const battleTicks = (battles: readonly BattleRecord[]): number => battles.reduce((sum, battle) => sum + battle.ticks, 0)

/** Every tick a measurement played: what its time per tick is averaged over. */
export function ticksOf(measurement: Measurement): number {
  return (
    battleTicks(measurement.scenarios.map((run) => run.battle)) +
    battleTicks(measurement.duels.flatMap((duel) => duel.rounds.map((round) => round.battle))) +
    battleTicks(measurement.levels.flatMap((level) => level.rounds.map((round) => round.battle)))
  )
}

/**
 * Parts of one spec made one measurement. They must share the spec, the build and the rules named, or the merge is
 * refused: two builds in one file would compare nothing. The duels are put in the order `runSpec` plays them — by
 * player, then the west Commander, then the east, as `spec` lists them (one it does not list after, by name), then by
 * seed — so the result does not depend on how the spec was split; the maps and the levels in the order the parts are
 * given. A tick's time is weighted by the ticks each part played; `jobs` is how many played at once (all of them, unless
 * the caller knows better).
 */
export function mergeMeasurements(parts: readonly Measurement[], spec: MeasureSpec, jobs = parts.length): Measurement {
  const first = parts[0]
  if (first === undefined) throw new Error("nothing to merge")
  for (const part of parts) {
    for (const key of ["spec", "build", "routing"] as const) {
      if (part[key] !== first[key]) throw new Error(`cannot merge a ${key} of "${part[key]}" with one of "${first[key]}"`)
    }
  }
  const { players, commanders } = spec.duels
  const named = (order: readonly string[], x: string, y: string): number => placeIn(order, x) - placeIn(order, y) || x.localeCompare(y)
  const duels = parts
    .flatMap((part) => part.duels)
    .sort(
      (x, y) =>
        named(players, x.players.A, y.players.A) ||
        named(commanders, x.commanders.A, y.commanders.A) ||
        named(commanders, x.commanders.B, y.commanders.B) ||
        placeIn(spec.seeds, x.seed) - placeIn(spec.seeds, y.seed) ||
        x.seed - y.seed,
    )
  let ticks = 0
  let ms = 0
  for (const part of parts) {
    if (part.msPerTick === null) continue
    const played = ticksOf(part)
    ticks += played
    ms += part.msPerTick * played
  }
  const question = parts.find((part) => part.question !== undefined)?.question
  return {
    spec: first.spec,
    build: first.build,
    date: parts.reduce((latest, part) => (part.date > latest ? part.date : latest), first.date),
    routing: first.routing,
    ...(question === undefined ? {} : { question }),
    jobs,
    msPerTick: ticks === 0 ? null : Math.round((ms / ticks) * 1000) / 1000,
    scenarios: parts.flatMap((part) => part.scenarios),
    duels,
    levels: parts.flatMap((part) => part.levels),
  }
}
