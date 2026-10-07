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
import { nexusTile, remaining, withoutScene } from "../build/state.ts"
import type { CommanderAbsence, DialogFocus, DialogLine, FieldEntity, IncomingEntity, StandingStructure } from "../build/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import { CARD_TEXT, commanderName } from "../content/cards.ts"
import { tilesOf } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import {
  auraReachRegistry,
  auraRegistry,
  commanderRegistry,
  fallen,
  laterArrivals,
  missionOpening,
  recall,
  resolveMissionPulse,
  restoreCommanders,
  spawningRegistry,
} from "../match/index.ts"
import type { Arrival, Force, MissionPulseInput, Restoration } from "../match/index.ts"
import type { BuildingSpawns, PowerCard } from "../armies/index.ts"
import { dealHand } from "../armies/index.ts"
import { constructItem, nexusDraftOf } from "../build/catalog.ts"
import { foreseeRound } from "../match/index.ts"
import type { GroupIntent, TroopsIntent } from "../match/index.ts"
import type { TroopsGroup } from "../view/troops-post.ts"
import type { RaidForecast, RaidGroup } from "../build/types.ts"
import { PERIMETER } from "../armies/index.ts"
import type { MissionDefinition, SceneLine } from "../mission/index.ts"
import { regionCentre, regionOf, regionTiles, sceneOf, validateMission } from "../mission/index.ts"
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
  /** The round's context once `card`, the Nexus power just picked, is kept: what it does, applied for the rest of
   *  the mission (`keepPower`), and what the round brings foreseen again with it. */
  keep: (context: BuildContext, card: PowerCard) => BuildContext
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

/** The player's troops as the Build Phase reads them: one more group of the forecast, with the target its
 *  level names for it (`TroopsGroup`) — or none, when it names none. */
const troopsGroupOf = (troops: TroopsIntent | null): TroopsGroup[] => {
  if (troops === null) return []
  const first = troops.unitTiles[0] ?? troops.tiles[0] ?? { x: 0, y: 0 }
  return [
    {
      group: "your troops",
      player: troops.player,
      units: troops.units,
      tick: 0,
      intent: null,
      tiles: troops.unitTiles,
      centre: troops.unitTiles.length === 0 ? first : middleOf(troops.unitTiles),
      target: null,
      path: [],
      post: { name: troops.name, tiles: troops.tiles },
    },
  ]
}

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

/** What each building the level offers spawns in its battles, by its content id: its army's word for it,
 *  carried on its row of the construct menu (`spawns`). A building the level does not offer spawns nothing. */
function spawnsOf(context: Pick<BuildContext, "catalog">): Readonly<Record<string, BuildingSpawns>> {
  const spawns: Record<string, BuildingSpawns> = {}
  for (const item of context.catalog) if (item.spawns !== undefined) spawns[item.contentId] ??= item.spawns
  return spawns
}

/** How far into a round every building's first wave comes, in the kernel's ticks: the owner's tuned number. */
const firstWaveTicks = (state: BuildState): number => setting(state, "firstWave") * TICKS_PER_SECOND

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

// --- A round's scene: the dialog's lines, resolved on the round's own map ---------------------------

/** The units the Nexus powers kept this round call up, mustered on the player's Grid Nexus — none on a map
 *  without one. */
function callupsOf(context: BuildContext): Force[] {
  const nexus = nexusTile(context)
  if (nexus === null) return []
  return (context.callups ?? []).map((callup) => ({ player: "A", muster: nexus, units: Array.from({ length: callup.count }, () => callup.unit) }))
}

/** The round's arrivals set down against its opening without a plan, with the group each came in: the
 *  forecast the Build Phase draws (`incomingOf` drops the groups) and what a dialog line can look at. */
function arrivalsFor(mission: MissionDefinition, context: BuildContext, pulse: number): Arrival[] {
  const structures = context.carried == null ? context.standing.map((s) => ({ contentId: s.contentId, anchor: s.anchor })) : []
  const input: MissionPulseInput = {
    mission,
    grid: context.grid,
    registry: context.registry,
    pulse,
    carried: context.carried ?? null,
    structures,
    callups: callupsOf(context),
  }
  const opening = missionOpening(input)
  return [...opening.arrivals, ...laterArrivals(input, opening.state)]
}

/** The tile in the middle of some tiles' bounding box — where the camera looks at a group. */
function middleOf(tiles: readonly Coord[]): Coord {
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  return { x: Math.floor((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.floor((Math.min(...ys) + Math.max(...ys)) / 2) }
}

/** A unit of this round's map: a survivor standing on the field, or else one of the round's arrivals. */
function unitOnMap(context: BuildContext, arrivals: readonly Arrival[], contentId: string): Readonly<{ anchor: Coord; player: PlayerId }> | undefined {
  return (context.field ?? []).find((entity) => entity.contentId === contentId) ?? arrivals.find((arrival) => arrival.contentId === contentId)
}

/** Where a line looks on this round's map — the tile the camera centres on and the focus's own tiles — or
 *  `null` when what it names is not on the map this round (a unit that fell, a group not yet come). */
function focusOn(mission: MissionDefinition, context: BuildContext, arrivals: readonly Arrival[], focus: SceneLine["focus"]): DialogFocus | null {
  if (focus === undefined) return null
  const footprint = (contentId: string, anchor: Coord): Coord[] => tilesOf(anchor, context.registry.get(contentId).footprint)
  if ("region" in focus) {
    const region = regionOf(mission, focus.region)
    if (region === undefined) return null
    return { tile: regionCentre(region), own: regionTiles(region) }
  }
  if ("group" in focus) {
    const own = arrivals.filter((arrival) => arrival.group === focus.group).flatMap((arrival) => footprint(arrival.contentId, arrival.anchor))
    return own.length === 0 ? null : { tile: middleOf(own), own }
  }
  const unit = unitOnMap(context, arrivals, focus.unit)
  return unit === undefined ? null : { tile: unit.anchor, own: footprint(focus.unit, unit.anchor) }
}

/** The side of the spawn that brings a unit, for a speaker the mission gives no side. */
function spawnSide(mission: MissionDefinition, contentId: string): PlayerId | null {
  for (const trigger of mission.triggers) {
    for (const action of trigger.do) {
      if ("spawn" in action && action.spawn.units.some((entry) => entry.unit === contentId)) return action.spawn.side
    }
  }
  return null
}

/**
 * A mission's `say` as the dialog shows it on this round's map: a speaker given as a unit is named as its
 * card names it, speaks for its side, and has its glyph beside its name when it stands on the map (or is
 * arriving this round); a named speaker is as the mission writes it. What the line looks at is resolved
 * here, once, so the dialog only reads tiles.
 */
function dialogLine(mission: MissionDefinition, context: BuildContext, arrivals: readonly Arrival[], say: SceneLine): DialogLine {
  const unit = context.registry.has(say.speaker) ? say.speaker : null
  const standing = unit === null ? undefined : unitOnMap(context, arrivals, unit)
  const side = say.side ?? standing?.player ?? (unit === null ? null : spawnSide(mission, unit))
  return {
    speaker: unit === null ? say.speaker : (CARD_TEXT[unit]?.title ?? context.registry.get(unit).short),
    side,
    unit: standing === undefined ? null : unit,
    text: say.text,
    focus: focusOn(mission, context, arrivals, say.focus),
  }
}

/**
 * **A round's scene**, the lines the dialog shows as its Build Phase opens: the round a Commander is
 * restored, first the game's own line saying so — the bottom line's words, with no speaker, looking at
 * her: her highlight when she shows up again — and then the mission's own lines for the round
 * (`sceneOf`), in trigger order.
 */
function roundScene(
  mission: MissionDefinition,
  context: BuildContext,
  round: number,
  restored: readonly Restoration[],
  absent: readonly CommanderAbsence[] = [],
): DialogLine[] {
  const back: DialogLine[] = restored
    .filter((restoration) => restoration.player === "A")
    .map((restoration) => ({
      speaker: null,
      side: null,
      unit: null,
      text: commanderNews([restoration], [], round, mission.pulses) ?? "",
      focus: { tile: restoration.anchor, own: tilesOf(restoration.anchor, context.registry.get(restoration.contentId).footprint) },
    }))
  // A Commander out this round is said too, in the same voice, looking at the Nexus that will restore her:
  // Commanders die as part of the game, and the round without her opens by saying so (the owner, 2026-10-04).
  const nexus = nexusTile(context)
  const nexusAt = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  const out: DialogLine[] = absent
    .filter((absence) => absence.player === "A" && absence.fellInRound < round)
    .map((absence) => ({
      speaker: null,
      side: null,
      unit: null,
      text: commanderNews([], [absence], round, mission.pulses) ?? "",
      focus:
        nexus === null
          ? null
          : { tile: nexus, own: nexusAt === undefined ? [nexus] : tilesOf(nexusAt.anchor, context.registry.get(nexusAt.contentId).footprint) },
    }))
  const lines = sceneOf(mission, round)
  if (lines.length === 0) return [...back, ...out]
  const arrivals = arrivalsFor(mission, context, round)
  return [...back, ...out, ...lines.map((say) => dialogLine(mission, context, arrivals, say))]
}

/** The round's context with its own scene — none carried over from the round before it. */
function withRoundScene(context: BuildContext, scene: readonly DialogLine[]): BuildContext {
  const bare = withoutScene(context)
  return scene.length === 0 ? bare : { ...bare, scene }
}

/**
 * What keeping a Nexus power does to the round's context, for the rest of the mission (commander-armies.md, what
 * a Nexus power does): `kept` gains it, and its effect is applied where the Build Phase and the Pulse both read
 * it — so what it changes is on screen the moment it is picked, and is what the battle runs on.
 *
 * - `spawnUnits` calls its units up for this round's Pulse (`callups`), mustered on the Grid Nexus; the caller
 *   foresees the round again so they show as arriving.
 * - `modifyCommander` multiplies every Commander's aura reach (`auraReachRegistry`): her card and the battle.
 * - `modifyContent` gives every row of the building it names more waves a round: its card and the battle.
 * - `addBuilding` adds the building it names to the construct menu, after the rows already there.
 * - `credits` changes nothing here: the reducer adds them to what is left to spend when the pick is made.
 */
export function keepPower(context: BuildContext, card: PowerCard): BuildContext {
  const kept: BuildContext = { ...context, kept: [...(context.kept ?? []), card] }
  const { effect } = card
  const building = (id: string) => (context.buildingCards ?? []).find((candidate) => candidate.id === id)
  if ("spawnUnits" in effect) {
    return { ...kept, callups: [...(context.callups ?? []), { unit: effect.spawnUnits.unit, count: effect.spawnUnits.count }] }
  }
  if ("modifyCommander" in effect) return { ...kept, registry: auraReachRegistry(context.registry, effect.modifyCommander.auraReachTimes) }
  if ("modifyContent" in effect) {
    const structure = building(effect.modifyContent.building)?.structure
    const addWaves = effect.modifyContent.addWaves
    return {
      ...kept,
      catalog: context.catalog.map((item) =>
        item.contentId === structure && item.spawns !== undefined ? { ...item, spawns: { ...item.spawns, waves: item.spawns.waves + addWaves } } : item,
      ),
    }
  }
  if ("addBuilding" in effect) {
    const card = building(effect.addBuilding.building)
    if (card === undefined || context.catalog.some((item) => item.contentId === card.structure)) return kept
    return { ...kept, catalog: [...context.catalog, constructItem(card, context.catalog.length)] }
  }
  return kept
}

/** The hand round `round` deals from the context's Nexus power pool, under its digits — or the draft as it is,
 *  for a context with no pool to deal from. */
function dealtDraft(mission: MissionDefinition, context: BuildContext, round: number): BuildContext["nexusDraft"] {
  if (context.powerPool === undefined) return context.nexusDraft
  return nexusDraftOf({ powers: dealHand(context.powerPool, context.kept ?? [], mission.seed, round) })
}

export function missionPlay(mission: MissionDefinition): MissionPlay {
  const inputFor = (context: BuildContext, pulse: number, structures: MissionPulseInput["structures"]): MissionPulseInput => ({
    mission,
    grid: context.grid,
    registry: context.registry,
    pulse,
    carried: context.carried ?? null,
    structures,
    callups: callupsOf(context),
  })

  /** What the round's triggers bring, set down against the round's opening without a plan — a forecast:
   *  a building planned where an arrival would stand moves it, when the Pulse starts. */
  const forecast = (context: BuildContext, pulse: number): IncomingEntity[] => incomingOf(arrivalsFor(mission, context, pulse))

  const round = (number: number) => ({ number, of: mission.pulses })

  /** The content a round's Pulse runs on: the level's buildings spawning their waves as their army says, and
   *  its Commander as tough, and her aura as strong, as the Experiments say. The Build Phase's own registry
   *  carries none of them. */
  const pulseRegistry = (context: BuildContext, state: BuildState): ContentRegistry =>
    auraRegistry(
      commanderRegistry(spawningRegistry(context.registry, spawnsOf(context), firstWaveTicks(state)), setting(state, "commanderHealth")),
      setting(state, "commanderAura"),
    )

  return {
    mission,

    keep(context, card) {
      const next = keepPower(context, card)
      // What arrives changed only with units called up; the rest of the round's forecast is as it was.
      return "spawnUnits" in card.effect ? { ...next, incoming: forecast(next, next.round?.number ?? 1) } : next
    },

    foresee(context, state) {
      // The Pulse's own opening and content, so what is foreseen is what its first tick will do — and, after
      // the raid's groups, where the player's troops head.
      const registry = pulseRegistry(context, state)
      const round = foreseeRound({ ...inputFor(context, context.round?.number ?? 1, newStructures(context, state)), registry })
      return [...raidOf(round.groups), ...troopsGroupOf(round.troops)]
    },

    firstRound(base) {
      validateMission(mission, base.grid, base.registry)
      const opened: BuildContext = {
        ...base,
        round: round(1),
        carried: null,
        field: [],
        // The mission's own words for its rounds, or none — so every round says the default.
        roundText: mission.roundText ?? {},
        // Nothing kept yet, nothing called up: a mission starts with a fresh hand.
        kept: [],
        callups: [],
      }
      const context: BuildContext = { ...opened, nexusDraft: dealtDraft(mission, opened, 1) }
      // The round opens on its scene, when the mission has one for it: PERIMETER's intro.
      return withRoundScene({ ...context, incoming: forecast(context, 1) }, roundScene(mission, context, 1, []))
    },

    startPulse(context, state) {
      const pulse = context.round?.number ?? 1
      // The Pulse runs on the content with the level's buildings spawning their waves; the Build Phase's own
      // registry never carries a recipe, so nothing it draws or refuses depends on one.
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
        // What was kept stays kept (it is in this context already); what was called up has arrived.
        callups: [],
        nexusDraft: dealtDraft(mission, context, number),
        openingStatus: status(news === null ? `${last} Build Phase ${number} - the Nexus stands.` : `${last} ${news}`, "hint"),
      }
      // Its own scene, never the last round's: a Commander back, then the mission's lines for the round.
      return withRoundScene({ ...next, incoming: forecast(next, number) }, roundScene(mission, next, number, back.restored, back.absent))
    },
  }
}

/** The mission the Build Phase's screen plays: PERIMETER's three Battle Rounds, on the starter map — the mission of the
 *  first level of Vasse's campaign (`armies/vasse/army.json`, level `vasse-test-1`). */
export const STARTER_MISSION: MissionPlay = missionPlay(PERIMETER)

/** The screen's connections to it, as `BuildSession` takes them. */
export const { startPulse, nextRound, foresee } = STARTER_MISSION
