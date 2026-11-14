// A sandbox's one Battle Round, played (docs/system-design/sandboxes.md): its opening opened on the content
// it is played with, and the kernel run from it to its end or its ticks. The one path every door plays a sandbox
// by: `grid --headless`, the `skirmish` command (`src/cli/skirmish-sandbox.ts`), a measurement (`measureSave`,
// `src/measure/suites.ts`) and the formations bench, so a sandbox says the same through each.
//
// Not the battle: a sandbox tests one rule on the bench's content, with no Commander, Build Phase or wave a battle
// adds, so it starts the kernel straight from the units its `start` places. Pure: the save is already read.

import type { ContentRegistry } from "../content/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import type { PulseRun } from "../pulse/index.ts"
import type { ReportInput } from "../report/index.ts"
import type { MatchState } from "../state/types.ts"
import { openBattle } from "./opening/open.ts"
import { phaseOf, playPhase } from "./opening/phase.ts"
import type { BattleOpening } from "./opening/types.ts"

/** How a sandbox is played: on other content (a variant's), another seed, more or fewer ticks; and who watches. */
export type SandboxRoundOptions = Readonly<{
  registry?: ContentRegistry
  seed?: number
  ticks?: number
  /** Shown every state, the opening first, with the events of the tick that made it. */
  watch?: (state: MatchState, events: readonly DomainEvent[]) => void
}>

/** A sandbox's Battle Round played: the run, and what its report is written from (`buildLog`). */
export type SandboxRound = Readonly<{ run: PulseRun; registry: ContentRegistry; report: ReportInput }>

/** **A sandbox's round**, from its opening to its end or its last tick: the Battle Round the kernel plays, or, in the Build Phase, the regroup's walk (`playPhase`). */
export function playSandboxRound(opening: BattleOpening, options: SandboxRoundOptions = {}): SandboxRound {
  const seed = options.seed ?? opening.seed
  const pulseTicks = options.ticks ?? opening.pulseTicks
  const loaded = openBattle(opening, { registry: options.registry ?? FIXTURE_REGISTRY, seed })
  const run = playPhase(phaseOf(opening), loaded.state, loaded.registry, pulseTicks, seed, options.watch === undefined ? {} : { watch: options.watch })
  return {
    run,
    registry: loaded.registry,
    report: { battleId: opening.id, seed, pulseTicks: run.pulseTicks, registry: loaded.registry, events: run.events, finalState: run.finalState, stateHash: run.stateHash, eventsHash: run.eventsHash, ...(phaseOf(opening) === "build-phase" ? { phase: "build-phase" as const } : {}) },
  }
}
