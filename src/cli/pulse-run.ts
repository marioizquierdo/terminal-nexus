// A mission played on the Build Phase's screen — the application shell's part of the
// connection, and the only place the Build Phase, the mission, the rules layer, the kernel and the view
// meet.
//
// `src/build` and `src/view` may never reach the kernel (`tests/architecture.test.ts`), so neither can
// start a Pulse or work out what the next round looks like: they are handed the two functions here
// (`BuildSession`'s `startPulse` and `nextRound`) and get back a Pulse to play and the next Build Phase to
// open. Both are pure functions of the mission and of what the round's context carries — the state the
// last round left, after Recall — so the same plans give the same mission on every machine, and nothing
// about how it is watched can change it:
//
// - **starting a round's Pulse**: the plan and the carried state go to the trigger runner
//   (`src/match/mission.ts`), which resolves the Pulse on the unmodified kernel and says how the mission
//   stands; Recall is worked out from the state it ended in (`src/match/recall.ts`);
// - **the next round**: a Build Phase whose map is what Recall left — the player's buildings as standing
//   structures, every surviving unit and the raid's structures as the field — with the credits the last
//   one did not spend, and the next round's arrivals as incoming.

import type { BuildContext, BuildState } from "../build/state.ts"
import { nexusTile, remaining } from "../build/state.ts"
import type { FieldEntity, IncomingEntity, StandingStructure } from "../build/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import { laterArrivals, missionOpening, recall, resolveMissionPulse, trainingRegistry } from "../match/index.ts"
import type { Arrival, MissionPulseInput, TrainingPace } from "../match/index.ts"
import type { MissionDefinition } from "../mission/index.ts"
import { PERIMETER, validateMission } from "../mission/index.ts"
import type { MatchState } from "../state/types.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import { setting } from "../build/all-settings.ts"
import { status } from "../build/status.ts"
import { resultOf } from "../view/ending.ts"
import type { ResolvedPulse } from "../view/pulse-live.ts"
import { outcomeOf } from "../view/pulse-live.ts"
import { timelineOf } from "./timeline.ts"

/** Starting a round's Pulse and opening the round after it: what `BuildSession` is handed. */
export type MissionPlay = Readonly<{
  mission: MissionDefinition
  /** Round 1's Build Phase, from the map's own (a context with the grid, the registry, the catalog, what
   *  stands on the map and the opening allotment). Validates the mission against that map first. */
  firstRound: (base: BuildContext) => BuildContext
  startPulse: (context: BuildContext, state: BuildState) => ResolvedPulse | null
  nextRound: (context: BuildContext, state: BuildState, resolved: ResolvedPulse) => BuildContext | null
}>

const isStructure = (registry: ContentRegistry, contentId: string): boolean => registry.get(contentId).layer === "obstacles"

/** The player's buildings newly standing when the round's Pulse starts: the map's own in round 1 (after
 *  that they are in the carried state), and whatever the plan added. */
function newStructures(context: BuildContext, state: BuildState): MissionPulseInput["structures"] {
  const planned = state.planned.map((placement) => ({ contentId: placement.contentId, anchor: placement.anchor }))
  const standing = context.carried == null ? context.standing.map((structure) => ({ contentId: structure.contentId, anchor: structure.anchor })) : []
  return [...standing, ...planned]
}

const incomingOf = (arrivals: readonly Arrival[]): IncomingEntity[] =>
  arrivals.map((arrival) => ({
    contentId: arrival.contentId,
    anchor: arrival.anchor,
    player: arrival.player,
    tick: arrival.tick,
    intent: arrival.intent,
  }))

/** The map a round's Build Phase opens on, split the way the Build Phase draws it: the player's own
 *  buildings, which it plans around, and everything else. */
function mapOf(registry: ContentRegistry, carried: MatchState): Readonly<{ standing: StandingStructure[]; field: FieldEntity[] }> {
  const standing: StandingStructure[] = []
  const field: FieldEntity[] = []
  for (const entity of carried.entities) {
    if (entity.player === "A" && isStructure(registry, entity.contentId)) {
      standing.push({ contentId: entity.contentId, anchor: entity.anchor })
    } else {
      field.push({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player, hp: entity.hp })
    }
  }
  return { standing, field }
}

/** How often the mission's buildings train, and how many a round: the two Experiments, in the kernel's
 *  ticks. Read when a Pulse starts, so a change in Settings is felt from the next round. */
const paceOf = (state: BuildState): TrainingPace => ({
  intervalTicks: setting(state, "trainEvery") * TICKS_PER_SECOND,
  perPulse: setting(state, "trainPerRound"),
})

export function missionPlay(mission: MissionDefinition): MissionPlay {
  const inputFor = (context: BuildContext, pulse: number, structures: MissionPulseInput["structures"]): MissionPulseInput => ({
    mission,
    grid: context.grid,
    registry: context.registry,
    pulse,
    carried: context.carried ?? null,
    structures,
  })

  /** What the round's triggers bring, set down against the round's opening without a plan — a forecast:
   *  a building planned where an arrival would stand moves it, when the Pulse starts. */
  const forecast = (context: BuildContext, pulse: number): IncomingEntity[] => {
    const structures = context.carried == null ? context.standing.map((s) => ({ contentId: s.contentId, anchor: s.anchor })) : []
    const input = inputFor(context, pulse, structures)
    const opening = missionOpening(input)
    return incomingOf([...opening.arrivals, ...laterArrivals(input, opening.state)])
  }

  const round = (number: number) => ({ number, of: mission.pulses })

  return {
    mission,

    firstRound(base) {
      validateMission(mission, base.grid, base.registry)
      const context: BuildContext = {
        ...base,
        round: round(1),
        carried: null,
        field: [],
        // The mission's own words for its rounds, or none — so every round says the default.
        roundText: mission.roundText ?? {},
        ...(mission.trains === undefined ? {} : { trains: mission.trains }),
      }
      return { ...context, incoming: forecast(context, 1) }
    },

    startPulse(context, state) {
      const pulse = context.round?.number ?? 1
      // The Pulse runs on the content with the mission's buildings training at the Experiments' pace; the
      // Build Phase's own registry never carries a recipe, so nothing it draws or refuses depends on one.
      const registry = trainingRegistry(mission, context.registry, paceOf(state))
      const run = resolveMissionPulse({ ...inputFor(context, pulse, newStructures(context, state)), registry })
      const timeline = timelineOf({ id: mission.id, name: mission.name }, run.states, run.events, mission.pulseTicks, mission.seed, registry)
      return {
        timeline,
        recall: recall(run.final, registry),
        nexus: nexusTile(context),
        mission: {
          verdict: run.verdict,
          round: pulse,
          of: mission.pulses,
          ...(mission.endText === undefined ? {} : { endText: mission.endText }),
        },
      }
    },

    nextRound(context, state, resolved) {
      if (resolved.mission?.verdict.kind !== "continue") return null
      const number = (context.round?.number ?? 1) + 1
      const carried = resolved.recall.state
      const { standing, field } = mapOf(context.registry, carried)
      const last = resultOf(outcomeOf(resolved.timeline))
      const next: BuildContext = {
        ...context,
        standing,
        field,
        carried,
        round: round(number),
        // Credits carry over: what the last Build Phase did not spend, the Nexus power it picked included.
        allotment: remaining(context, state),
        openingStatus: status(`Round ${number - 1}: ${last.headline.toLowerCase()}. Build Phase ${number} - the Nexus stands.`, "hint"),
      }
      return { ...next, incoming: forecast(next, number) }
    },
  }
}

/** The mission the Build Phase's screen plays: PERIMETER's three waves, on the starter map. */
export const STARTER_MISSION: MissionPlay = missionPlay(PERIMETER)

/** The screen's two connections to it, as `BuildSession` takes them. */
export const { startPulse, nextRound } = STARTER_MISSION
