// A sandbox's one Battle Round (docs/system-design/skirmish-saves.md, a battlefield set up by hand): its battlefield opened on
// the content it is played with, and the battle engine run from it to its end or its ticks. The one path every door
// plays a sandbox by: the `skirmish` command (`src/cli/skirmish-sandbox.ts`), a measurement (`measureSave`,
// `src/measure/suites.ts`), the formations bench and the tests, so a sandbox says the same through each.
//
// The same engine as a battle's Battle Round, from a battlefield set up by hand rather than one a Build Phase built: no
// Commander, Nexus Pulse or credits unless the battlefield places them. Pure: the save is already read.

import type { ContentRegistry } from "../content/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import type { DomainEvent } from "../engine/events/types.ts"
import { resolvePulse } from "../engine/pulse/index.ts"
import type { PulseRun } from "../engine/pulse/index.ts"
import type { ReportInput } from "../report/index.ts"
import type { MatchState } from "../engine/state/types.ts"
import { openBattle } from "./opening/open.ts"
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

/** **A sandbox's round**, from its opening to its end or its last tick: the Battle Round the battle engine plays. */
export function playSandboxRound(opening: BattleOpening, options: SandboxRoundOptions = {}): SandboxRound {
  const seed = options.seed ?? opening.seed
  const pulseTicks = options.ticks ?? opening.pulseTicks
  const loaded = openBattle(opening, { registry: options.registry ?? FIXTURE_REGISTRY, seed })
  const run = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks, seed, ...(options.watch === undefined ? {} : { watch: options.watch }) })
  return {
    run,
    registry: loaded.registry,
    report: { battleId: opening.id, seed, pulseTicks: run.pulseTicks, registry: loaded.registry, events: run.events, finalState: run.finalState, stateHash: run.stateHash, eventsHash: run.eventsHash },
  }
}
