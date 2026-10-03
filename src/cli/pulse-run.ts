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
//   one did not spend, and the next round's arrivals as incoming. A Commander who fell is carried as an
//   absence and set down beside the Nexus again when her round out is over (`src/match/commander.ts`).

import type { BuildContext, BuildState } from "../build/state.ts"
import { nexusTile, remaining } from "../build/state.ts"
import type { CommanderAbsence, FieldEntity, IncomingEntity, StandingStructure } from "../build/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import { commanderName } from "../content/cards.ts"
import {
  commanderRegistry,
  fallen,
  laterArrivals,
  missionOpening,
  recall,
  resolveMissionPulse,
  restoreCommanders,
  trainingRegistry,
} from "../match/index.ts"
import type { Arrival, MissionPulseInput, Restoration, TrainingPace } from "../match/index.ts"
import { foreseeIntents } from "../match/index.ts"
import type { GroupIntent } from "../match/index.ts"
import type { RaidForecast, RaidGroup } from "../build/types.ts"
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
  /** What each group of the raid the round brings goes for first, and the way it would go, on the plan as
   *  it stands: the kernel's own first choice (`src/match/intent.ts`), for the Build Phase to draw and say. */
  foresee: (context: BuildContext, state: BuildState) => RaidForecast
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

/** The raid's intent as the Build Phase reads it: the match layer's groups, as plain data. */
const raidOf = (groups: readonly GroupIntent[]): RaidGroup[] =>
  groups.map(({ group, player, units, tick, intent, tiles, centre, target, path }) => ({
    group,
    player,
    units,
    tick,
    intent,
    tiles,
    centre,
    target: target === null ? null : { contentId: target.contentId, player: target.player, anchor: target.anchor, tiles: target.tiles },
    path,
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

/** What the next Build Phase's first line says of the player's Commander — back beside the Nexus, or out
 *  this round and, when the mission lasts that long, the round she is back for — or `null` when there is
 *  nothing to say. */
function commanderNews(restored: readonly Restoration[], absent: readonly CommanderAbsence[], round: number, of: number): string | null {
  const back = restored.find((restoration) => restoration.player === "A")
  if (back !== undefined) return `${commanderName(back.contentId)} is back beside the Nexus.`
  const out = absent.find((absence) => absence.player === "A")
  if (out === undefined) return null
  const name = commanderName(out.contentId)
  return out.returnsInRound > round && out.returnsInRound <= of ? `${name} is out this round, back for round ${out.returnsInRound}.` : `${name} is out this round.`
}

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

  /** The content a round's Pulse runs on: the mission's buildings training at the Experiments' pace, and
   *  its Commander as tough as the Experiment says. The Build Phase's own registry carries neither. */
  const pulseRegistry = (context: BuildContext, state: BuildState): ContentRegistry =>
    commanderRegistry(trainingRegistry(mission, context.registry, paceOf(state)), setting(state, "commanderHealth"))

  return {
    mission,

    foresee(context, state) {
      // The Pulse's own opening and content, so what is foreseen is what its first tick will do.
      const registry = pulseRegistry(context, state)
      return raidOf(foreseeIntents({ ...inputFor(context, context.round?.number ?? 1, newStructures(context, state)), registry }))
    },

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
      const registry = pulseRegistry(context, state)
      const run = resolveMissionPulse({ ...inputFor(context, pulse, newStructures(context, state)), registry })
      const timeline = timelineOf({ id: mission.id, name: mission.name }, run.states, run.events, mission.pulseTicks, mission.seed, registry)
      // A Commander who fell is out for the rest of this Pulse and the whole of the next round.
      const fell = fallen(run.events, registry, pulse)
      return {
        timeline,
        recall: recall(run.final, registry),
        nexus: nexusTile(context),
        mission: {
          verdict: run.verdict,
          round: pulse,
          of: mission.pulses,
          ...(mission.endText === undefined ? {} : { endText: mission.endText }),
          ...(fell.length === 0 ? {} : { fell }),
        },
      }
    },

    nextRound(context, state, resolved) {
      if (resolved.mission?.verdict.kind !== "continue") return null
      const number = (context.round?.number ?? 1) + 1
      // The Commanders who fell last round join the ones already out; whoever is due is set down beside the
      // Nexus before the Build Phase opens, at the health the Experiment says now.
      const absent = [...(context.absent ?? []), ...(resolved.mission.fell ?? [])]
      const back = restoreCommanders(resolved.recall.state, absent, number, commanderRegistry(context.registry, setting(state, "commanderHealth")))
      const carried = back.state
      const { standing, field } = mapOf(context.registry, carried)
      const last = `Round ${number - 1}: ${resultOf(outcomeOf(resolved.timeline)).headline.toLowerCase()}.`
      const news = commanderNews(back.restored, back.absent, number, mission.pulses)
      const next: BuildContext = {
        ...context,
        standing,
        field,
        carried,
        absent: back.absent,
        round: round(number),
        // Credits carry over: what the last Build Phase did not spend, the Nexus power it picked included.
        allotment: remaining(context, state),
        openingStatus: status(news === null ? `${last} Build Phase ${number} - the Nexus stands.` : `${last} ${news}`, "hint"),
      }
      return { ...next, incoming: forecast(next, number) }
    },
  }
}

/** The mission the Build Phase's screen plays: PERIMETER's three waves, on the starter map. */
export const STARTER_MISSION: MissionPlay = missionPlay(PERIMETER)

/** The screen's connections to it, as `BuildSession` takes them. */
export const { startPulse, nextRound, foresee } = STARTER_MISSION
