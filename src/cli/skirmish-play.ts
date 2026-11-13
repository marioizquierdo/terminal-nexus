// A Skirmish played on the Build Phase's screen — the application shell's part of it, beside a story mission's
// (`./pulse-run.ts`), and the only place a save, the duel, the Build Phase and the view meet.
//
// **A Skirmish is a save played on**: its setup (`SaveSetup`, `src/skirmish/save.ts`) and the duel as it stands at a
// Build Phase (`DuelState`) travel in the round's context (`BuildContext.mode`), so the screen's battle is always one
// `saveOf` away from a file, and a file one `duelOf` away from the screen. The player plans slot p1 (side A) on the
// Build Phase screen — the same screen, keys, menu, Nexus Pulse hand and Battle Round as a story mission — and slot p2
// is planned by its controller, a scripted duel player from its own brief. The screen is handed the same functions a
// story mission hands it (`LevelPlay`): nothing below the mode knows it serves a Skirmish.
//
// - **a round's Build Phase** is side A's: the duel map, its Commander's whole army with every power kept applied, the
//   duel's credits, the hand its Nexus Pulse deals, its buildings standing, and everything else as the field;
// - **starting a round's Pulse** turns the plan into side A's duel plan (`buildActionsOf`), asks p2's controller for side
//   B's, and plays the round with the duel's own `playRound`, every state and event kept for the Battle Round;
// - **the next round** is the battle's next, from where the survivors regrouped; or, once the battle is over, the same
//   battle again from round 1, or (the result's other choice) a new battle on a new seed;
// - **a save** of the round is its setup, its duel and the plan so far as p1's draft (`saveOfRound`); a save opened
//   at its Build Phase restores that draft (`resume`), so loading returns to exactly where the player stopped.
//
// **Parity with the `skirmish` command** (`./skirmish.ts`): every round, the player's and a script's, is played by
// `playNext` (`src/skirmish/play.ts`), the function the command plays, with the same profiles, credits shares and
// modifiers; a battle is opened by the steps the command opens one with (`./skirmish-open.ts`); and a save written here
// is one the command plays on, and back. A rule of play belongs in `src/skirmish/`, never here, or the two drift apart.
//
// Pure: the same save and plans give the same battle. A new seed is chosen by the screens (`clockSeed`) and handed in
// (`SkirmishOptions.newSeed`); nothing here reads a clock or a file.

import type { BuildContext, BuildState } from "../build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../build/state.ts"
import { STARTER_START_CURSOR, nexusDraftOf } from "../build/catalog.ts"
import { buildLayout } from "../build/layout.ts"
import type { DialogLine, FieldEntity, IncomingEntity, StandingStructure } from "../build/types.ts"
import { status } from "../build/status.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { tilesOf } from "../grid/coords.ts"
import type { DuelState, Player, RoundReport, Side, BuildActions } from "../duel/index.ts"
import { SIDES, armyOf, briefOf, duelGrid, handOf, loadoutOf, mapOf, musterOf, newDuel, placementsOf, standingOf } from "../duel/index.ts"
import type { Force, RegroupResult, Restoration } from "../match/index.ts"
import { centreTile, opening, restoreCommanders, standDown } from "../match/index.ts"
import { spawnEvents } from "../pulse/index.ts"
import type { Profiles, SaveFile, SaveSetup } from "../skirmish/save.ts"
import { controllerKind, duelOf, duelSetupOf, newSetup, saveOf, SLOTS } from "../skirmish/save.ts"
import { isPlayer, playNext } from "../skirmish/play.ts"
import { spectating } from "../skirmish/setup.ts"
import { skirmishSetupRoute } from "./route.ts"
import { commanderNameOf, endedLine, mapNameOf, openingLines, outcomeFor, reasonWords, spectatorReason } from "../skirmish/words.ts"
import type { MatchState } from "../state/types.ts"
import { resultOf } from "../view/ending.ts"
import type { MissionEnding, MissionRound, ResolvedPulse } from "../view/pulse-live.ts"
import { outcomeOf } from "../view/pulse-live.ts"
import type { LevelPlay, PlayableLevel } from "./levels.ts"
import { commanderNews, keepPower } from "./pulse-run.ts"
import { timelineOf } from "./timeline.ts"

/** What a Skirmish's round carries in its context (`BuildContext.mode`): the setup, the duel at this Build Phase, the
 *  file it was loaded from or last saved to (what Save game offers to write over), and p1's draft still to restore. */
export type SkirmishPosition = Readonly<{ kind: "skirmish"; setup: SaveSetup; duel: DuelState; file?: string; draft?: BuildActions }>

/** A round's Skirmish. Throws for a context that is not a Skirmish's. */
export function positionOf(context: Pick<BuildContext, "mode">): SkirmishPosition {
  const mode = context.mode as Partial<SkirmishPosition> | undefined
  if (mode?.kind !== "skirmish" || mode.setup === undefined || mode.duel === undefined) throw new Error("this round is not a Skirmish's")
  return mode as SkirmishPosition
}

/** Whether a round is a Skirmish's. */
export const isSkirmish = (context: Pick<BuildContext, "mode">): boolean => (context.mode as { kind?: unknown } | undefined)?.kind === "skirmish"

/** Each side's content as its kept powers leave it: what the Build Phase draws and places by. */
function contentOf(duel: DuelState): Record<Side, ContentRegistry> {
  return {
    A: loadoutOf(armyOf(duel, "A"), duel.sides.A).registry,
    B: loadoutOf(armyOf(duel, "B"), duel.sides.B).registry,
  }
}

/** The Grid as the Battle Round will open on it before any plan: where the regroup left everyone, with every Commander
 *  due back set down beside her Nexus (as `playRound` will), and who was set down — `null` before a battle's first round. */
function restoredOf(duel: DuelState, content: Readonly<Record<Side, ContentRegistry>>): Readonly<{ state: MatchState; restored: Restoration[]; absent: DuelState["sides"]["A"]["absent"] }> | null {
  if (duel.carried === null) return null
  return restoreCommanders(duel.carried, [...duel.sides.A.absent, ...duel.sides.B.absent], duel.round, content.A, content)
}

/**
 * **What arrives as the round starts**, set down as the duel's opening will set it down without a plan: in a battle's
 * first round each side's Commander and her starting package beside its Nexus, and the units a power kept this round
 * calls up for the player. The Build Phase draws them see-through where they arrive. Nothing when none comes, or when
 * there is no room.
 */
function arrivalsOf(duel: DuelState, callups: BuildContext["callups"]): IncomingEntity[] {
  const content = contentOf(duel)
  const forces: Force[] = []
  for (const side of SIDES) {
    const units: string[] = []
    if (duel.carried === null) {
      const { commander } = armyOf(duel, side)
      units.push(commander.unit)
      for (const { unit, count } of commander.start) for (let n = 0; n < count; n += 1) units.push(unit)
    }
    if (side === "A") for (const { unit, count } of callups ?? []) for (let n = 0; n < count; n += 1) units.push(unit)
    if (units.length > 0) forces.push({ player: side, muster: musterOf(duel, side, content[side]), units })
  }
  if (forces.length === 0) return []
  const restored = restoredOf(duel, content)
  try {
    const opened = opening({
      grid: duelGrid(mapOf(duel)),
      registry: content.A,
      sides: content,
      structures: restored === null ? SIDES.flatMap((side) => standingOf(duel, side)) : [],
      setup: { seed: duel.setup.seed, pulseTicks: duel.setup.pulseTicks, forces },
      ...(restored === null ? {} : { carried: restored.state }),
    }).state
    const before = new Set((restored?.state.entities ?? []).map((entity) => entity.id))
    return opened.entities
      .filter((entity) => !before.has(entity.id) && content[entity.player].get(entity.contentId).layer !== "obstacles")
      .map((entity) => ({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player, tick: 0, intent: null }))
  } catch {
    return []
  }
}

/** A Commander as a watched battle's force bars and lines call her: her id, capitalized (Vasse, Averno, Dob). */
const shortName = (commander: string | undefined): string => (commander === undefined ? "?" : `${commander.slice(0, 1).toUpperCase()}${commander.slice(1)}`)

/** The enemy's Grid Nexus as a dialog line looks at it. */
function enemyNexusFocus(duel: DuelState): DialogLine["focus"] {
  const nexus = armyOf(duel, "B").nexus
  const anchor = mapOf(duel).nexus.B
  const footprint = contentOf(duel).B.get(nexus).footprint
  return { tile: centreTile(anchor, footprint), own: tilesOf(anchor, footprint) }
}

/** A line in the game's own voice, looking at `focus` when given. */
const said = (text: string, focus: DialogLine["focus"] = null): DialogLine => ({ speaker: null, side: null, unit: null, text, focus })

/** What a round's context keeps from the one before it: the player's settings, Experiments, logs and exports — what
 *  the screen opened with — and nothing of the round itself. */
function carriedOver(context: Partial<BuildContext>): Partial<BuildContext> {
  const { settings, experiments, buildId, exportDestination, activity, activityExportDestination, scrollMargin, saveDestination } = context
  return {
    ...(saveDestination === undefined ? {} : { saveDestination }),
    ...(settings === undefined ? {} : { settings }),
    ...(experiments === undefined ? {} : { experiments }),
    ...(buildId === undefined ? {} : { buildId }),
    ...(exportDestination === undefined ? {} : { exportDestination }),
    ...(activity === undefined ? {} : { activity }),
    ...(activityExportDestination === undefined ? {} : { activityExportDestination }),
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
  }
}

/** Whether a file is one of the example saves that ship with the game (`saves/`, or `skirmish-testing/`): never offered
 *  back by Save game, which would write over a file in the repository. */
export const isShippedSave = (file: string): boolean => /(^|\/)(saves|skirmish-testing)\/[^/]+(\/[^/]+)?\.save\.json$/u.test(file) && !file.includes(".terminal-nexus/") && !file.includes(".playtest/")

/** The name Save game offers for a round: the file it was loaded from or last saved to (but never a shipped example),
 *  or a new one by its setup. */
export function saveNameOf(position: SkirmishPosition): string {
  if (position.file !== undefined && !isShippedSave(position.file)) return position.file
  const { setup } = position
  return `${setup.slots.p1.commander}-${setup.slots.p2.commander}-${setup.seed}-round-${position.duel.round}`
}

/**
 * **A Skirmish's round, ready for the Build Phase**: side A's view of the duel in play. Its build menu and content are
 * its Commander's whole army with every power it kept applied (`loadoutOf`, as the duel reads it); its credits the
 * duel's; its hand the one the duel deals it (`handOf`), so the card picked is the card the round keeps; its buildings
 * standing, and everything else on the Grid as the field, every Commander due back already beside her Nexus — each
 * survivor with the walk that brought it there when `regroup` is the one the last round ended in. The round opens on
 * `scene` and says `opening` on the bottom line.
 */
function roundContext(position: SkirmishPosition, previous: Partial<BuildContext>, scene: readonly DialogLine[], opening: string, regroup?: RegroupResult | null): BuildContext {
  const { duel } = position
  const army = armyOf(duel, "A")
  const loadout = loadoutOf(army, duel.sides.A)
  const content = contentOf(duel)
  const map = mapOf(duel)
  const restored = restoredOf(duel, content)
  const standing: StandingStructure[] = []
  const field: FieldEntity[] = []
  if (restored === null) {
    standing.push(...standingOf(duel, "A").map(({ contentId, anchor }) => ({ contentId, anchor })))
    const nexus = armyOf(duel, "B").nexus
    field.push({ contentId: nexus, anchor: map.nexus.B, player: "B", hp: content.B.get(nexus).maxHp })
  } else {
    const walks = new Map((regroup?.paths ?? []).map((path) => [path.ordinal, path] as const))
    for (const entity of restored.state.entities) {
      if (entity.player === "A" && content.A.get(entity.contentId).layer === "obstacles") {
        standing.push({ contentId: entity.contentId, anchor: entity.anchor })
        continue
      }
      const walk = walks.get(entity.ordinal)
      field.push({
        contentId: entity.contentId,
        anchor: entity.anchor,
        ordinal: entity.ordinal,
        player: entity.player,
        hp: entity.hp,
        ...(walk === undefined || walk.steps.length === 0 ? {} : { walk: { from: walk.from, steps: walk.steps } }),
      })
    }
  }
  // Spectating: nobody builds at the screen, so it offers nothing to build or pick (`BuildContext.spectating`).
  const watching = spectating(position.setup)
  const context: BuildContext = {
    ...carriedOver(previous),
    grid: duelGrid(map),
    registry: loadout.registry,
    catalog: watching ? [] : loadout.catalog,
    standing,
    field,
    allotment: watching ? 0 : duel.sides.A.credits,
    nexusDraft: watching ? [] : nexusDraftOf({ powers: handOf(duel, "A") }),
    ...(watching ? { spectating: true } : {}),
    kept: duel.sides.A.kept.flatMap((id) => army.powers.find((card) => card.id === id) ?? []),
    buildingCards: army.buildings,
    callups: [],
    commander: { contentId: army.commander.unit, name: army.commander.name, portrait: army.commander.portrait },
    round: { number: duel.round, of: duel.setup.rounds },
    carried: restored?.state ?? null,
    absent: restored?.absent ?? [],
    restored: (restored?.restored ?? []).map((restoration) => ({ player: restoration.player, contentId: restoration.contentId })),
    incoming: arrivalsOf(duel, []),
    roundText: {},
    mode: position,
    saveName: saveNameOf(position),
    openingStatus: status(opening, "hint"),
  }
  return scene.length === 0 ? context : { ...context, scene }
}

/** A new battle's first round: what it is, then how the other side plays, looking at its Nexus. */
function firstRound(setup: SaveSetup, previous: Partial<BuildContext>, before: readonly DialogLine[] = [], extras: Pick<SkirmishPosition, "file" | "draft"> = {}, profiles?: Profiles): BuildContext {
  const duel = newDuel(duelSetupOf(setup, profiles))
  const lines = openingLines(setup, profiles)
  const scene = [...before, ...lines.map((line, index) => (index === lines.length - 1 ? said(line, enemyNexusFocus(duel)) : said(line)))]
  const opponent = commanderNameOf(setup.slots.p2.commander)
  const restored = extras.draft === undefined ? "" : " The plan so far is restored."
  const opening = spectating(setup)
    ? `Watching, seed ${setup.seed}: both sides are scripts. [s] starts the round.`
    : `Against ${opponent} on ${mapNameOf(setup.map)}, seed ${setup.seed}.${restored} The Nexus Pulse deals: [n].`
  return roundContext({ kind: "skirmish", setup, duel, ...extras }, previous, scene, opening)
}

/** How a battle's end reads on the Battle Round's result: what happened, and the two ways on. */
function endingOf(setup: SaveSetup, duel: DuelState): MissionEnding {
  const result = duel.result as NonNullable<DuelState["result"]>
  const ways = { goOn: "Same battle again", alternative: "New seed", setup: "Setup screen" }
  // Watching two scripts, nobody won or lost: the winner is named.
  if (spectating(setup)) {
    const winner = result.winner === null ? null : commanderNameOf(setup.slots[result.winner === "A" ? "p1" : "p2"].commander)
    return { headline: winner === null ? "BATTLE DRAWN" : `${winner.toUpperCase()} WINS`, reason: spectatorReason(setup, result), tone: "neutral", ...ways }
  }
  const reason = reasonWords(result, commanderNameOf(setup.slots.p2.commander))
  switch (outcomeFor(result)) {
    case "won":
      return { headline: "BATTLE WON", reason, tone: "success", ...ways }
    case "lost":
      return { headline: "BATTLE LOST", reason, tone: "danger", ...ways }
    case "drawn":
      return { headline: "BATTLE DRAWN", reason, tone: "neutral", ...ways }
  }
}

/** What a played round leaves for the next: the duel after it, the round's report, and the survivors' regroup (`null`
 *  once the battle is over). */
export type Played = Readonly<{ duel: DuelState; report: RoundReport; regroup: RegroupResult | null }>

/** Every round played, by the Pulse it resolved: the screen hands that Pulse back to open the next round, so what the
 *  round left is found by it. Held weakly: a Pulse nobody holds is let go. */
const PLAYED = new WeakMap<ResolvedPulse, Played>()

/** What a round a Skirmish played left, by the Pulse it resolved; `undefined` for a Pulse a Skirmish did not resolve. */
export const playedOf = (resolved: ResolvedPulse): Played | undefined => PLAYED.get(resolved)

/** The card id of the building a structure is, for a duel plan. */
function cardIdOf(duel: DuelState, contentId: string): string {
  return armyOf(duel, "A").buildings.find((card) => card.structure === contentId)?.id ?? contentId
}

/** "x,y", a tile as the Build Phase keys it. */
const tileOf = (key: string): Readonly<{ x: number; y: number }> => {
  const [x = 0, y = 0] = key.split(",").map(Number)
  return { x, y }
}

/**
 * **Side A's duel plan from a Build Phase**: the power picked (its number in the hand, which is the duel's hand), every
 * building placed at its exact anchor in the order placed, the buildings held this round, the building actions taken,
 * and the troops marching on the enemy's Nexus — the Build Phase has no stance to choose.
 */
export function buildActionsOf(context: BuildContext, state: BuildState): BuildActions {
  const { duel } = positionOf(context)
  const hold = state.held.map(tileOf)
  const actions = state.fitted.map((taken) => ({ ...tileOf(taken.anchor), action: taken.action }))
  return {
    ...(state.nexusPick === null ? {} : { power: state.nexusPick + 1 }),
    build: state.planned.map((placement) => ({ building: cardIdOf(duel, placement.contentId), x: placement.anchor.x, y: placement.anchor.y })),
    stance: "attack",
    ...(hold.length === 0 ? {} : { hold }),
    ...(actions.length === 0 ? {} : { actions }),
  }
}

/** Whether a plan has anything in it: a power, a building, a hold or an action. */
const planned = (plan: BuildActions): boolean => plan.power !== undefined || plan.build.length > 0 || (plan.hold?.length ?? 0) > 0 || (plan.actions?.length ?? 0) > 0

/**
 * **A round as a save**: its setup, the duel as this Build Phase opened, and the plan so far as p1's draft — what Save
 * game writes. `name` is the save's own name for a person, when given. Loading it (`skirmishLevel`) returns to exactly
 * this screen: the round, its hand and its credits, the power picked and every building placed.
 */
export function saveOfRound(context: BuildContext, state: BuildState, name?: string): SaveFile {
  const { setup, duel } = positionOf(context)
  const plan = buildActionsOf(context, state)
  return saveOf(setup, duel, { ...(name === undefined ? {} : { name }), ...(planned(plan) ? { draft: { p1: plan } } : {}) })
}

/**
 * **A plan laid on a Build Phase**, as the player would have made it: the power it names picked and kept (`keep`, as the
 * screen keeps it the moment it is picked), each building placed where the duel places it (`placementsOf`), the
 * buildings held and the actions taken. A draft restored and a scripted round both come this way.
 */
export function planOnRound(context: BuildContext, state: BuildState, plan: BuildActions, keep: NonNullable<LevelPlay["keep"]>): Readonly<{ context: BuildContext; state: BuildState }> {
  const { duel } = positionOf(context)
  const pick = plan.power !== undefined && plan.power >= 1 ? plan.power - 1 : null
  const option = pick === null ? undefined : context.nexusDraft[pick]
  const planning = option === undefined ? context : keep(context, option.card)
  const placed = placementsOf(duel, "A", plan)
  const nextOrdinal = placed.reduce((last, placement) => Math.max(last, placement.ordinal), 0) + 1
  return {
    context: planning,
    state: {
      ...state,
      planned: placed,
      nextOrdinal: Math.max(nextOrdinal, state.nextOrdinal),
      nexusPick: option === undefined ? null : pick,
      bonusAllotment: option?.bonusAllotment ?? 0,
      held: (plan.hold ?? []).map((tile) => `${tile.x},${tile.y}`),
      fitted: (plan.actions ?? []).map((taken) => ({ anchor: `${taken.x},${taken.y}`, action: taken.action })),
    },
  }
}

/** What a Skirmish needs from the screens: a new battle's seed, chosen by them (from the clock), or a test's own; and
 *  the script profiles its scripted slots name (`players/scripts/`, or the shipped ones on the browser page). */
export type SkirmishOptions = Readonly<{ newSeed?: () => number; profiles?: Profiles }>

/** A seed after `seed` when no screen chose one: a fixed walk, so a test or a driver plays the same battles. */
const nextSeedOf = (seed: number): number => (seed * 7919 + 104729) % 1_000_000

/**
 * **What the Build Phase screen is handed to play a Skirmish** (`LevelPlay`). What a round needs is in its context, and
 * what a played round left is found by the Pulse it resolved (`playedOf`).
 */
export function skirmishPlay(options: SkirmishOptions = {}): LevelPlay {
  const play: LevelPlay = {
    keep(context, card) {
      const kept = keepPower(context, card)
      // Units it calls up arrive beside the Nexus as the round starts: drawn where they will.
      return kept.callups === context.callups ? kept : { ...kept, incoming: arrivalsOf(positionOf(kept).duel, kept.callups) }
    },

    // No raid comes: the enemy plans in secret and reveals with the player, as in a duel.
    foresee: () => [],

    startPulse(context, state) {
      const position = positionOf(context)
      const { duel, setup } = position
      if (duel.result !== null) return null
      // The round as the command line plays it (`playNext`): p1's plan from this Build Phase when a person plays it, every
      // scripted slot its profile's plan, the modifiers and the credits shares as the setup has them.
      const plans = isPlayer(setup, "p1") ? { p1: buildActionsOf(context, state) } : {}
      const states: MatchState[] = []
      const events: DomainEvent[] = []
      let content: Readonly<{ registry: ContentRegistry; sides: Readonly<Record<Side, ContentRegistry>> }> | null = null
      const played = playNext(setup, duel, plans, options.profiles, (battleState, tickEvents, registry, sides) => {
        states.push(battleState)
        events.push(...tickEvents)
        content ??= { registry, sides }
      })
      const { registry, sides } = content as unknown as NonNullable<typeof content>
      const start = states[0] as MatchState
      const final = states[states.length - 1] as MatchState
      const timeline = timelineOf(
        { id: `skirmish-${setup.seed}-round-${duel.round}`, name: `Skirmish, seed ${setup.seed}` },
        states,
        [...spawnEvents(start, registry), ...events],
        duel.setup.pulseTicks,
        duel.setup.seed,
        registry,
      )
      const next = played.state
      const fell = SIDES.flatMap((side) => next.sides[side].absent.filter((absence) => absence.fellInRound === duel.round))
      const mission: MissionRound = {
        // The battle goes on, or it is over: a drawn battle reads as a won one here, its own words saying it was drawn.
        verdict: next.result === null ? { kind: "continue" } : { kind: outcomeFor(next.result) === "lost" ? "lost" : "won", trigger: `battle ${outcomeFor(next.result)}` },
        round: duel.round,
        of: duel.setup.rounds,
        ...(fell.length === 0 ? {} : { fell }),
        ...(next.result === null ? {} : { ending: endingOf(setup, next) }),
      }
      // Nobody walks home: the survivors stand where the shooting stopped, and regroup in the next Build Phase. Once the
      // battle is over nothing regroups; its end, settled where everyone stands, is what the result shows.
      const resolved: ResolvedPulse = { timeline, regroup: played.regroup ?? standDown(final, registry, sides), nexus: nexusTile(context), mission, enemy: "enemy", ...(spectating(setup) ? { watched: { A: shortName(setup.slots.p1.commander), B: shortName(setup.slots.p2.commander) } } : {}) }
      PLAYED.set(resolved, { duel: next, report: played.report, regroup: played.regroup })
      return resolved
    },

    nextRound(context, _state, resolved, alternative = false) {
      const played = playedOf(resolved)
      if (played === undefined) return null
      const position = positionOf(context)
      const { setup } = position
      const { duel, report } = played
      // The battle goes on: its next round, from where the survivors regrouped, their walk played as it opens.
      if (duel.result === null) {
        const last = `Round ${report.round}: ${resultOf(outcomeOf(resolved.timeline)).headline.toLowerCase()}.`
        const opened = roundContext({ kind: "skirmish", setup, duel, ...(position.file === undefined ? {} : { file: position.file }) }, context, [], "", played.regroup)
        const back = restoredOf(duel, contentOf(duel))
        const news = back === null ? null : commanderNews(back.restored, back.absent, duel.round, duel.setup.rounds)
        const refused = isPlayer(setup, "p1") ? report.sides.A.refused : []
        const scene = [
          ...(news === null ? [] : [said(news, nexusFocus(opened))]),
          ...(refused.length === 0 ? [] : [said(`Not built last round: ${refused.join("; ")}.`)]),
        ]
        const next = spectating(setup) ? "[s] starts the next round." : "The Nexus Pulse deals a new hand: [n]."
        return { ...withoutScene(opened), ...(scene.length === 0 ? {} : { scene }), openingStatus: status(`${last} ${next}`, "hint") }
      }
      // The battle is over: the same battle again from round 1, or a new one on a new seed (the result's other choice).
      // Either is a new battle: no longer the file it was loaded from, so Save game offers a new name.
      const seed = alternative ? (options.newSeed?.() ?? nextSeedOf(setup.seed)) : setup.seed
      const again: SaveSetup = { ...setup, seed }
      const ended = said(`${endedLine(setup, duel.result)} ${alternative ? `A new battle, seed ${seed}.` : "The same battle again."}`)
      return firstRound(again, carriedOver(context), [ended], {}, options.profiles)
    },
  }
  return play
}

/** The player's Grid Nexus as a dialog line looks at it. */
function nexusFocus(context: BuildContext): DialogLine["focus"] {
  const tile = nexusTile(context)
  const nexus = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  if (tile === null || nexus === undefined) return null
  return { tile, own: tilesOf(nexus.anchor, context.registry.get(nexus.contentId).footprint) }
}

/** The route that opens a new Skirmish of this seed, on the defaults: `skirmish?seed=1234`. */
export const skirmishRoute = (seed: number): string => `skirmish?seed=${seed}`

/** The route that opens a new Skirmish of this setup: its seed and every part that is not the default
 *  (`skirmish?seed=7&map=pocket&p2=script:agro`), so a battle set up on the setup screen can be opened again from it. */
export function setupRoute(setup: SaveSetup): string {
  const plain = newSetup({ seed: setup.seed })
  const ask: Record<string, string | readonly string[]> = {}
  if (setup.map !== plain.map && typeof setup.map === "string") ask["map"] = setup.map
  for (const slot of SLOTS) {
    const now = setup.slots[slot]
    if (now.commander !== plain.slots[slot].commander && now.commander !== undefined) ask[`${slot}Commander`] = now.commander
    // A player is a player whatever their name: the route names who plays a slot only when it is not the default.
    const same = now.controller === plain.slots[slot].controller || (controllerKind(now.controller) === "player" && controllerKind(plain.slots[slot].controller) === "player")
    if (!same) ask[slot] = controllerKind(now.controller) === "player" ? "build:" : now.controller
  }
  if (setup.modifiers.length > 0) ask["modifiers"] = setup.modifiers
  return Object.keys(ask).length === 0 ? skirmishRoute(setup.seed) : skirmishSetupRoute(setup.seed, ask)
}

/** Where a save opened on screen came from, to name it and offer it back. */
export type SkirmishSource = Readonly<{ file?: string; route?: string }>

/**
 * **A save as a level the game opens**: round `state.round`'s Build Phase (round 1 for a new battle), the draft
 * restored when the save has one (`play.resume`), played by `skirmishPlay`. The setup must be one the screen can
 * play (`screenProblem`, `src/skirmish/slots.ts`): p1 a player, p2 a script.
 */
export function skirmishLevel(save: SaveFile, source: SkirmishSource = {}, options: SkirmishOptions = {}): PlayableLevel {
  const { setup } = save
  const base = skirmishPlay(options)
  // A draft is p1's plan at the screen: a p1 now played by a script has none to lay.
  const draft = isPlayer(setup, "p1") ? save.draft?.p1 : undefined
  const keep = base.keep as NonNullable<LevelPlay["keep"]>
  const play: LevelPlay = {
    ...base,
    // A draft is laid on the round it was saved at, once: Restart and every later round start from an empty plan.
    resume: (context, state) => {
      const mode = positionOf(context)
      if (mode.draft === undefined) return { context, state }
      const { draft: _laid, ...rest } = mode
      return planOnRound({ ...context, mode: rest }, state, mode.draft, keep)
    },
  }
  const duel = duelOf(save, options.profiles)
  return {
    id: `skirmish-${setup.seed}`,
    story: "skirmish",
    title: save.name ?? `Skirmish on ${mapNameOf(setup.map)}, seed ${setup.seed}`,
    rounds: setup.rounds,
    route: source.route ?? (source.file === undefined ? setupRoute(setup) : `skirmish?load=${source.file}`),
    play,
    firstRound: (scrollMargin, extra = {}) => {
      const previous = { ...extra, ...(scrollMargin === undefined ? {} : { scrollMargin }) }
      const extras = { ...(source.file === undefined ? {} : { file: source.file }), ...(draft === undefined ? {} : { draft }) }
      // Nothing played yet: the battle opens as a new one does, on what it is and how the other side plays.
      if (save.state === undefined) return firstRound(setup, previous, [], extras, options.profiles)
      const position: SkirmishPosition = { kind: "skirmish", setup, duel, ...extras }
      const where = duel.result === null ? `round ${duel.round} of ${setup.rounds}` : "the battle over"
      // The whole of what was loaded in a line of the game's own voice; the bottom line, short enough for 80 columns.
      const file = source.file ?? save.name ?? "a save"
      const restored = draft === undefined ? "" : " The plan so far is restored."
      const watching = spectating(setup)
      const scene = [said(`Loaded ${file}: ${where}, ${commanderNameOf(setup.slots.p1.commander)} against ${commanderNameOf(setup.slots.p2.commander)} on ${mapNameOf(setup.map)}, seed ${setup.seed}.${restored}${watching ? " Both sides are scripts: watch, and start each round." : ""}`)]
      const short = file.slice(file.lastIndexOf("/") + 1)
      const next = watching ? ": watching. [s] starts the round." : draft === undefined ? ". The Nexus Pulse deals: [n]." : ", the plan so far restored."
      return roundContext(position, previous, scene, `Loaded ${short}: ${where}${next}`)
    },
  }
}

/** A new Skirmish on the defaults (Vasse as the player against Dob Hunter's `balanced` script on the Crossing) and
 *  this seed, as a level. What the title menu's Skirmish opens until the setup screen chooses its own. */
export const newSkirmishLevel = (seed: number, options: SkirmishOptions = {}): PlayableLevel =>
  skirmishLevel({ format: "terminal-nexus.save/1", setup: newSetup({ seed }) }, {}, options)

/** A Skirmish headless, as the driver played it: the duel at its end, and every round's report. */
export type DrivenSkirmish = Readonly<{ duel: DuelState; rounds: readonly RoundReport[] }>

/**
 * **A round planned by a scripted duel player through the Build Phase's own functions**: `player` plans side A from its
 * brief, as a duel side would, and the plan is laid on the Build Phase as the player would lay it (`planOnRound`) —
 * ready to start.
 */
export function scriptedRound(context: BuildContext, player: Player, play: LevelPlay): Readonly<{ context: BuildContext; state: BuildState }> {
  const { duel } = positionOf(context)
  const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
  const opened = createBuildState(withoutScene(context), nexusTile(context) ?? STARTER_START_CURSOR, viewport)
  return planOnRound(context, opened, player(briefOf(duel, "A").data), play.keep as NonNullable<LevelPlay["keep"]>)
}

/**
 * **The driver plays a Skirmish to its end**, through the very functions the screen is handed: each round planned by
 * `player` as a Build Phase (`scriptedRound`), its Pulse started from it and the next round opened from that, until the
 * battle is over. The same save and player give the same battle, every time.
 */
export function driveSkirmish(level: PlayableLevel, player: Player): DrivenSkirmish {
  let context = level.firstRound()
  const rounds: RoundReport[] = []
  for (;;) {
    const planned = scriptedRound(context, player, level.play)
    const resolved = level.play.startPulse(planned.context, planned.state)
    const played = resolved === null ? undefined : playedOf(resolved)
    if (resolved === null || played === undefined) throw new Error("a Skirmish's round could not start")
    rounds.push(played.report)
    if (played.duel.result !== null) return { duel: played.duel, rounds }
    const next = level.play.nextRound(planned.context, planned.state, resolved)
    if (next === null) throw new Error("a Skirmish's round led nowhere")
    context = next
  }
}
