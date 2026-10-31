// A trial (docs/system-design/testing-ground.md): the same maps played over many seeds, as they are and as variants
// change them (another unit, another army, a tuned number, other ground), every battle recorded as every battle is
// (`battle.ts`). Optionally each seed is also played with the map mirrored and the sides swapped, so a result is the
// army's and not its end's. What the battles say is `trial-cells.ts`'s; how it is printed, `trial-summary.ts`'s.
//
// Pure: the same trial plays the same battles on every machine. The engine it plays by is a parameter (`Engine`), so
// a command can play the same trial by another build's kernel and content (`grid <trial> --against <ref>`), and so is
// what times a battle (`Meter`): nothing here reads a clock. Reading files and printing are the command's.

import type { ContentRegistry } from "../content/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { supplyCostOf } from "../content/supply.ts"
import type { DomainEvent } from "../events/types.ts"
import { contextFor, stepTick } from "../pulse/index.ts"
import { loadScenario } from "../scenario/load.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import type { Variant } from "../scenario/variant.ts"
import { applyVariant, mirrored, shuffled } from "../scenario/variant.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import type { BattleRecord } from "./battle.ts"
import { BattleRecorder } from "./battle.ts"

/** What a trial expects of one measure, on the maps and variants it names (every one when it names none). */
export type Expectation = Readonly<{
  map?: string
  variant?: string
  /** One of `TRIAL_MEASURES` (`trial-cells.ts`). */
  measure: string
  atLeast?: number
  atMost?: number
}>

export type TrialSpec = Readonly<{
  id: string
  /** What the trial is played to answer, in a sentence. */
  question?: string
  /** Map ids. */
  maps: readonly string[]
  seeds: readonly number[]
  /** Each side's units shuffled among their places by the seed (`shuffled`). */
  shuffle?: boolean
  /** Each seed played again with the map mirrored and the sides swapped (`mirrored`). */
  swap?: boolean
  /** By name, in order; the first is what the others are compared with. None: the maps as they are. */
  variants?: Readonly<Record<string, Variant>>
  /** What every variant starts from (a tune for the whole trial, say), each variant's own on top of it. */
  base?: Variant
  expect?: readonly Expectation[]
}>

/** The kernel and content a trial is played by: this build's (`OWN_ENGINE`), or another's loaded from its folder. */
export type Engine = Readonly<{
  registry: ContentRegistry
  loadScenario: typeof loadScenario
  contextFor: typeof contextFor
  stepTick: typeof stepTick
}>

export const OWN_ENGINE: Engine = { registry: FIXTURE_REGISTRY, loadScenario, contextFor, stepTick }

/** What one battle cost to play, as a command measured it: the time, the ticks, and the work the kernel's routes did
 *  (`src/cli/profile.ts`): distance fields built and the anchors they settled, the same on every machine. */
export type BattleCost = Readonly<{ ms: number; ticks: number; fields?: number; settled?: number }>

/** Measures what a battle costs: `begin` as it starts, `end` with the ticks it played. Supplied by a command. */
export type Meter = Readonly<{ begin(): void; end(ticks: number): BattleCost }>

/** One battle of a trial, its sides named by army: `A` is whatever the map places as side A, at whichever end; with the
 *  supply each army's units take (`supplyCostOf`), the game's own price of an army, and its cost when measured. */
export type TrialBattle = Readonly<{
  map: string
  variant: string
  seed: number
  swapped: boolean
  battle: BattleRecord
  supply: Readonly<Record<PlayerId, number>>
  cost?: BattleCost
}>

/** `variant` on top of `base`: its own parts win, its tunes, sets and armies added to the base's. */
export function onTopOf(base: Variant | undefined, variant: Variant): Variant {
  if (base === undefined) return variant
  return {
    ...base,
    ...variant,
    ...(base.set === undefined && variant.set === undefined ? {} : { set: { ...base.set, ...variant.set } }),
    ...(base.army === undefined && variant.army === undefined ? {} : { army: { ...base.army, ...variant.army } }),
    ...(base.tune === undefined && variant.tune === undefined ? {} : { tune: { ...base.tune, ...variant.tune } }),
    ...(base.terrain === undefined && variant.terrain === undefined ? {} : { terrain: { ...base.terrain, ...variant.terrain } }),
    ...(base.targets === undefined && variant.targets === undefined ? {} : { targets: { ...base.targets, ...variant.targets } }),
  }
}

/** The variants a trial plays, by name, in order, each on top of its base. */
export function trialVariants(spec: TrialSpec): Readonly<Record<string, Variant>> {
  return Object.fromEntries(Object.entries(spec.variants ?? { "as built": {} }).map(([name, variant]) => [name, onTopOf(spec.base, variant)]))
}

export type TrialRun = Readonly<{ map: string; variant: string; seed: number; swapped: boolean }>

/** The battles a trial plays, in order: map, variant, seed, then the mirrored one. */
export function trialRuns(spec: TrialSpec): TrialRun[] {
  const variants = Object.keys(trialVariants(spec))
  return spec.maps.flatMap((map) =>
    variants.flatMap((variant) => spec.seeds.flatMap((seed) => [false, ...(spec.swap === true ? [true] : [])].map((swapped) => ({ map, variant, seed, swapped })))),
  )
}

/** A record with its sides swapped and its winner with them: what a mirrored battle says of each army. */
function swapSides(battle: BattleRecord): BattleRecord {
  const winner = battle.winner === "A" ? "B" : battle.winner === "B" ? "A" : null
  return { ...battle, winner, sides: { A: battle.sides.B, B: battle.sides.A } }
}

/** The map `variant` makes of `scenario` for one battle: changed, shuffled by the seed and mirrored as asked; and the
 *  content it is played with. What `grid <map> --seed N ...` watches is this battle. */
export function trialMap(
  scenario: ScenarioDefinition,
  variant: Variant,
  seed: number,
  options: Readonly<{ shuffle?: boolean; swapped?: boolean; registry?: ContentRegistry }> = {},
): Readonly<{ scenario: ScenarioDefinition; registry: ContentRegistry; unmirrored: ScenarioDefinition }> {
  const made = applyVariant(scenario, options.registry ?? FIXTURE_REGISTRY, variant)
  const unmirrored = options.shuffle === true ? shuffled(made.scenario, made.registry, seed) : made.scenario
  return { scenario: options.swapped === true ? mirrored(unmirrored, made.registry) : unmirrored, registry: made.registry, unmirrored }
}

/** Plays `scenario` on `seed` by `engine` to its end, every state and its events handed to `recorder`. */
function playOut(engine: Engine, scenario: ScenarioDefinition, registry: ContentRegistry, seed: number, recorder: BattleRecorder): MatchState {
  const loaded = engine.loadScenario(scenario, { registry, seed })
  const context = engine.contextFor(loaded.state, loaded.registry, scenario.pulseTicks)
  let state: MatchState = loaded.state
  recorder.observe(state, [])
  while (state.outcome === null && state.tick < scenario.pulseTicks) {
    const step: { state: MatchState; events: readonly DomainEvent[] } = engine.stepTick(state, context)
    state = step.state
    recorder.observe(state, step.events)
  }
  return state
}

/** One battle of a trial: the map as the variant makes it, played and recorded, measured by `meter` when given. */
export function playTrialBattle(
  scenario: ScenarioDefinition,
  variant: Variant,
  seed: number,
  options: Readonly<{ shuffle?: boolean; swapped?: boolean; engine?: Engine; meter?: Meter }> = {},
): Readonly<{ battle: BattleRecord; supply: Readonly<Record<PlayerId, number>>; cost?: BattleCost }> {
  const engine = options.engine ?? OWN_ENGINE
  const made = trialMap(scenario, variant, seed, { ...options, registry: engine.registry })
  const opened = engine.loadScenario(made.unmirrored, { registry: made.registry }).state
  const supplyOf = (player: PlayerId): number =>
    opened.entities.filter((entity) => entity.player === player).reduce((sum, entity) => sum + supplyCostOf(made.registry.get(entity.contentId)), 0)
  const recorder = new BattleRecorder(made.registry)
  options.meter?.begin()
  const last = playOut(engine, made.scenario, made.registry, seed, recorder)
  const cost = options.meter?.end(last.tick)
  const battle = recorder.record()
  return {
    battle: options.swapped === true ? swapSides(battle) : battle,
    supply: { A: supplyOf("A"), B: supplyOf("B") },
    ...(cost === undefined ? {} : { cost }),
  }
}

/** Plays a trial's battles — every one, or those at `only` (indexes into `trialRuns`, for one of several processes) —
 *  by its engine; `maps` holds each map it names, `each` hears of every battle as it is played. */
export function playTrial(
  spec: TrialSpec,
  maps: ReadonlyMap<string, ScenarioDefinition>,
  options: Readonly<{ each?: (battle: TrialBattle, index: number, total: number) => void; engine?: Engine; meter?: Meter; only?: readonly number[] }> = {},
): TrialBattle[] {
  const runs = trialRuns(spec)
  const variants = trialVariants(spec)
  const indexes = options.only ?? runs.map((_, index) => index)
  return indexes.map((index, done) => {
    const run = runs[index]
    if (run === undefined) throw new Error(`trial ${spec.id}: no battle ${index}`)
    const scenario = maps.get(run.map)
    if (scenario === undefined) throw new Error(`trial ${spec.id}: no map "${run.map}"`)
    const played = playTrialBattle(scenario, variants[run.variant] ?? {}, run.seed, {
      swapped: run.swapped,
      ...(spec.shuffle === undefined ? {} : { shuffle: spec.shuffle }),
      ...(options.engine === undefined ? {} : { engine: options.engine }),
      ...(options.meter === undefined ? {} : { meter: options.meter }),
    })
    const battle: TrialBattle = { ...run, ...played }
    options.each?.(battle, done, indexes.length)
    return battle
  })
}

/** `"1-12"`, `"1,3,5"` or `"1-4,9"` as seeds. */
export function parseSeeds(text: string): number[] {
  const seeds: number[] = []
  for (const part of text.split(",").map((each) => each.trim()).filter((each) => each.length > 0)) {
    const range = /^(\d+)-(\d+)$/.exec(part)
    if (range !== null) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (to < from) throw new Error(`seeds ${part}: the range runs backwards`)
      for (let seed = from; seed <= to; seed += 1) seeds.push(seed)
    } else if (/^\d+$/.test(part)) seeds.push(Number(part))
    else throw new Error(`seeds are "1-12", "1,3,5" or "1-4,9", not "${part}"`)
  }
  if (seeds.length === 0) throw new Error("no seeds")
  return seeds
}
