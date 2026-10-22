// A Challenge run played on the Build Phase's screen — the application shell's part of it, beside the campaign's
// (`./pulse-run.ts`), and the only place a run, the duel, the Build Phase and the view meet.
//
// **A run battle is a duel** (`src/duel/`): the player plans side A on the Build Phase screen — the same screen, keys,
// menu, Nexus Pulse hand and Battle Round as a campaign level — and side B is the opponent's Commander Army, planned
// by a scripted duel player from its brief. The screen is handed the same four functions a campaign level hands it
// (`LevelPlay`): nothing below the mode knows it serves a run.
//
// - **a round's Build Phase** is side A's: the duel map, side A's build menu and credits, the hand its Nexus Pulse
//   deals, its buildings standing, and everything else — the enemy's buildings, every survivor — as the field;
// - **starting a round's Pulse** turns the plan (the buildings placed, at their exact anchors; the power kept; the
//   buildings held) into side A's duel plan, asks the scripted player for side B's, and plays the round with the
//   duel's own `playRound`, every state and event kept for the Battle Round on screen;
// - **the next round** is the battle's next, from what Recall left; or, once the battle is over, the next battle's
//   first, opening on a scene that says how the last one ended and what comes; or, once the run is over, a new run's
//   first, opening on the summary of the one that ended.
//
// The run and its duel travel in the round's context (`BuildContext.mode`), so a round can be opened, played and
// moved on from with nothing but the context — Restart, a route, a driver. Pure: the same setup and plans give the
// same run; the seed a new run takes from the clock is chosen by the screens (`clockSeed`), never here.

import type { BuildContext, BuildState } from "../build/state.ts"
import { createBuildState, nexusTile, withoutScene } from "../build/state.ts"
import { STARTER_START_CURSOR, nexusDraftOf } from "../build/catalog.ts"
import { buildLayout } from "../build/layout.ts"
import type { DialogLine, FieldEntity, IncomingEntity, StandingStructure } from "../build/types.ts"
import { status } from "../build/status.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { tilesOf } from "../grid/coords.ts"
import type { DuelState, Player, RoundReport, Side, SidePlan } from "../duel/index.ts"
import { SIDES, briefOf, duelArmy, duelGrid, handOf, loadoutOf, mapOf, musterOf, newDuel, placementsOf, playRound, scriptedPlayer, standingOf } from "../duel/index.ts"
import type { Force, Restoration } from "../match/index.ts"
import { centreTile, opening, recall, restoreCommanders } from "../match/index.ts"
import { spawnEvents } from "../pulse/index.ts"
import type { BattleRecord, RunBattle, RunSetup, RunState } from "../run/index.ts"
import {
  DEFAULT_RUN_COMMANDER,
  RUN_ROUNDS,
  RUN_SEED_LIMIT,
  battleCount,
  battleEnded,
  battleEndedLine,
  battleIntroLines,
  commanderNameOf,
  currentBattle,
  newRun,
  reasonWords,
  summaryLines,
} from "../run/index.ts"
import type { MatchState } from "../state/types.ts"
import { resultOf } from "../view/ending.ts"
import type { MissionEnding, MissionRound, ResolvedPulse } from "../view/pulse-live.ts"
import { outcomeOf } from "../view/pulse-live.ts"
import type { LevelPlay, PlayableLevel } from "./levels.ts"
import { commanderNews, keepPower } from "./pulse-run.ts"
import { timelineOf } from "./timeline.ts"

/** What a run's round carries in its context (`BuildContext.mode`): the run, and the duel of its battle in play. */
export type RunPosition = Readonly<{ kind: "run"; run: RunState; duel: DuelState }>

/** A round's run and duel. Throws for a context that is not a run's. */
export function positionOf(context: Pick<BuildContext, "mode">): RunPosition {
  const mode = context.mode as Partial<RunPosition> | undefined
  if (mode?.kind !== "run" || mode.run === undefined || mode.duel === undefined) throw new Error("this round is not a Challenge run's")
  return mode as RunPosition
}

/** Each side's content as its kept powers leave it: what the Build Phase draws and places by. */
function contentOf(duel: DuelState): Record<Side, ContentRegistry> {
  return {
    A: loadoutOf(duelArmy(duel.sides.A.commander), duel.sides.A).registry,
    B: loadoutOf(duelArmy(duel.sides.B.commander), duel.sides.B).registry,
  }
}

/** The Grid as the Battle Round will open on it before any plan: what Recall left, with every Commander due back set
 *  down beside her Nexus (as `playRound` will), and who was set down — `null` before a battle's first round. */
function restoredOf(duel: DuelState, content: Readonly<Record<Side, ContentRegistry>>): Readonly<{ state: MatchState; restored: Restoration[]; absent: DuelState["sides"]["A"]["absent"] }> | null {
  if (duel.carried === null) return null
  return restoreCommanders(duel.carried, [...duel.sides.A.absent, ...duel.sides.B.absent], duel.round, content.A, content)
}

/**
 * **What arrives as the round starts**, set down as the duel's opening will set it down without a plan: in a battle's
 * first round each side's Commander and her starting package beside its Nexus (both public: the enemy's arrive where
 * they always do), and the units a power kept this round calls up for the player. The Build Phase draws them
 * see-through where they arrive, as it draws a campaign's raid. Nothing when none comes, or when there is no room.
 */
function arrivalsOf(duel: DuelState, callups: BuildContext["callups"]): IncomingEntity[] {
  const content = contentOf(duel)
  const forces: Force[] = []
  for (const side of SIDES) {
    const units: string[] = []
    if (duel.carried === null) {
      const { commander } = duelArmy(duel.sides[side].commander)
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

/** The enemy's Grid Nexus as a dialog line looks at it. */
function enemyNexusFocus(duel: DuelState): DialogLine["focus"] {
  const nexus = duelArmy(duel.sides.B.commander).nexus
  const anchor = mapOf(duel).nexus.B
  const footprint = contentOf(duel).B.get(nexus).footprint
  return { tile: centreTile(anchor, footprint), own: tilesOf(anchor, footprint) }
}

/** A line in the game's own voice, looking at `focus` when given. */
const said = (text: string, focus: DialogLine["focus"] = null): DialogLine => ({ speaker: null, side: null, unit: null, text, focus })

/** What a round's context keeps from the one before it: the player's settings, Experiments, logs and exports — what
 *  the screen opened with — and nothing of the round itself. */
function carriedOver(context: Partial<BuildContext>): Partial<BuildContext> {
  const { settings, experiments, buildId, exportDestination, activity, activityExportDestination, scrollMargin } = context
  return {
    ...(settings === undefined ? {} : { settings }),
    ...(experiments === undefined ? {} : { experiments }),
    ...(buildId === undefined ? {} : { buildId }),
    ...(exportDestination === undefined ? {} : { exportDestination }),
    ...(activity === undefined ? {} : { activity }),
    ...(activityExportDestination === undefined ? {} : { activityExportDestination }),
    ...(scrollMargin === undefined ? {} : { scrollMargin }),
  }
}

/**
 * **A run's round, ready for the Build Phase**: side A's view of the duel in play. Its build menu and content are its
 * Commander's army with every power it kept applied (`loadoutOf`, as the duel reads it); its credits the duel's; its
 * hand the one the duel deals it (`handOf`), so the card picked is the card the round keeps; its buildings standing,
 * and everything else on the Grid as the field, every Commander due back already beside her Nexus. The round opens
 * on `scene` and says `opening` on the bottom line.
 */
function roundContext(position: RunPosition, previous: Partial<BuildContext>, scene: readonly DialogLine[], opening: string): BuildContext {
  const { run, duel } = position
  const battle = currentBattle(run)
  if (battle === null) throw new Error("the run is over: there is no round to open")
  const army = duelArmy(duel.sides.A.commander)
  const loadout = loadoutOf(army, duel.sides.A)
  const content = contentOf(duel)
  const map = mapOf(duel)
  const restored = restoredOf(duel, content)
  const standing: StandingStructure[] = []
  const field: FieldEntity[] = []
  if (restored === null) {
    standing.push(...standingOf(duel, "A").map(({ contentId, anchor }) => ({ contentId, anchor })))
    const nexus = duelArmy(duel.sides.B.commander).nexus
    field.push({ contentId: nexus, anchor: map.nexus.B, player: "B", hp: content.B.get(nexus).maxHp })
  } else {
    for (const entity of restored.state.entities) {
      if (entity.player === "A" && content.A.get(entity.contentId).layer === "obstacles") standing.push({ contentId: entity.contentId, anchor: entity.anchor })
      else field.push({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player, hp: entity.hp })
    }
  }
  const context: BuildContext = {
    ...carriedOver(previous),
    grid: duelGrid(map),
    registry: loadout.registry,
    catalog: loadout.catalog,
    standing,
    field,
    allotment: duel.sides.A.credits,
    nexusDraft: nexusDraftOf({ powers: handOf(duel, "A") }),
    kept: duel.sides.A.kept.flatMap((id) => army.powers.find((card) => card.id === id) ?? []),
    buildingCards: army.buildings,
    callups: [],
    commander: { contentId: army.commander.unit, name: army.commander.name, portrait: army.commander.portrait },
    round: { number: duel.round, of: duel.setup.rounds, stage: battleCount(run, battle.number).toLowerCase() },
    carried: restored?.state ?? null,
    absent: restored?.absent ?? [],
    restored: (restored?.restored ?? []).map((restoration) => ({ player: restoration.player, contentId: restoration.contentId })),
    incoming: arrivalsOf(duel, []),
    roundText: {},
    mode: position,
    openingStatus: status(opening, "hint"),
  }
  return scene.length === 0 ? context : { ...context, scene }
}

/** A run's first round: the run's opening words, then its first battle's. */
function firstRunRound(setup: RunSetup, extra: Partial<BuildContext>): BuildContext {
  const run = newRun(setup)
  const battle = currentBattle(run) as RunBattle
  const duel = newDuel(battle.duel)
  const name = commanderNameOf(setup.commander)
  const opponent = commanderNameOf(battle.opponent)
  const scene = [
    said(`A Challenge run: ${run.definition.battles.length} battles with ${name}, seed ${setup.seed}. A lost battle ends the run.`),
    ...battleIntroLines(run, battle).map((line) => said(line, enemyNexusFocus(duel))),
  ]
  return roundContext({ kind: "run", run, duel }, extra, scene, `${battleCount(run, 1)} against ${opponent}, seed ${setup.seed}. The Nexus Pulse deals: [n].`)
}

/** How a battle's end reads on the Battle Round's result. */
function endingOf(run: RunState, record: BattleRecord): MissionEnding {
  const opponent = commanderNameOf(run.definition.battles[record.battle - 1]?.opponent ?? "")
  const goOn = run.over ? "Run summary" : "Next battle"
  const reason = reasonWords(record, opponent)
  switch (record.outcome) {
    case "won":
      return { headline: "BATTLE WON", reason, tone: "success", goOn }
    case "lost":
      return { headline: "BATTLE LOST", reason, tone: "danger", goOn }
    case "drawn":
      return { headline: "BATTLE DRAWN", reason, tone: "neutral", goOn }
  }
}

/** What a played round leaves for the next: the run and its duel after it, and the round's report. */
export type Played = Readonly<{ run: RunState; duel: DuelState; report: RoundReport }>

/** Every round played, by the Pulse it resolved: the screen hands that Pulse back to open the next round
 *  (`BuildSession.moveOn`), so what the round left is found by it. Held weakly: a Pulse nobody holds is let go. */
const PLAYED = new WeakMap<ResolvedPulse, Played>()

/** What a round a run played left, by the Pulse it resolved; `undefined` for a Pulse a run did not resolve. */
export const playedOf = (resolved: ResolvedPulse): Played | undefined => PLAYED.get(resolved)

/** The card id of the building a structure is, for a duel plan. */
function cardIdOf(duel: DuelState, contentId: string): string {
  return duelArmy(duel.sides.A.commander).buildings.find((card) => card.structure === contentId)?.id ?? contentId
}

/**
 * **Side A's duel plan from a Build Phase**: the power picked (its number in the hand, which is the duel's hand), every
 * building placed at its exact anchor in the order placed, the buildings held this round, and the troops marching on
 * the enemy's Nexus — the Build Phase has no stance to choose, and a campaign's troops attack too.
 */
export function sidePlanOf(context: BuildContext, state: BuildState): SidePlan {
  const { duel } = positionOf(context)
  const hold = state.held.map((key) => {
    const [x = 0, y = 0] = key.split(",").map(Number)
    return { x, y }
  })
  // The upgrades bought and the modes switched, in the order taken, each on its building by anchor: the duel takes them
  // after the buildings are placed, as the Build Phase spent for them, so each building carries what it carries here.
  const actions = state.fitted.map((taken) => {
    const [x = 0, y = 0] = taken.anchor.split(",").map(Number)
    return { x, y, action: taken.action }
  })
  return {
    ...(state.nexusPick === null ? {} : { power: state.nexusPick + 1 }),
    build: state.planned.map((placement) => ({ building: cardIdOf(duel, placement.contentId), x: placement.anchor.x, y: placement.anchor.y })),
    stance: "attack",
    ...(hold.length === 0 ? {} : { hold }),
    ...(actions.length === 0 ? {} : { actions }),
  }
}

/** The round after a played one, by what it left. */
function nextAfter(played: Played, previous: BuildContext, resolved: ResolvedPulse): BuildContext {
  const { run, duel, report } = played
  // The battle goes on: its next round, from what Recall left.
  if (duel.result === null) {
    const last = `Round ${report.round}: ${resultOf(outcomeOf(resolved.timeline)).headline.toLowerCase()}.`
    const position: RunPosition = { kind: "run", run, duel }
    const opened = roundContext(position, previous, [], "")
    const back = restoredOf(duel, contentOf(duel))
    const news = back === null ? null : commanderNews(back.restored, back.absent, duel.round, duel.setup.rounds)
    const refused = report.sides.A.refused
    const scene = [
      ...(news === null ? [] : [said(news, nexusFocus(opened))]),
      ...(refused.length === 0 ? [] : [said(`Not built last round: ${refused.join("; ")}.`)]),
    ]
    return { ...withoutScene(opened), ...(scene.length === 0 ? {} : { scene }), openingStatus: status(`${last} The Nexus Pulse deals a new hand: [n].`, "hint") }
  }
  const record = run.played.at(-1) as BattleRecord
  // The battle is over and the run goes on: the next battle's first round.
  if (!run.over) {
    const battle = currentBattle(run) as RunBattle
    const next = newDuel(battle.duel)
    const scene = [said(battleEndedLine(run, record)), ...battleIntroLines(run, battle).map((line) => said(line, enemyNexusFocus(next)))]
    const opponent = commanderNameOf(battle.opponent)
    return roundContext({ kind: "run", run, duel: next }, previous, scene, `${battleCount(run, battle.number)} against ${opponent}. The Nexus Pulse deals: [n].`)
  }
  // The run is over: its summary, then a new run's first round, on the seed the run named for the next.
  const { setup, nextSeed } = run.definition
  const fresh = firstRunRound({ seed: nextSeed, commander: setup.commander }, carriedOver(previous))
  const won = run.played.filter((played) => played.outcome === "won").length
  // The summary in one box, a line of it a paragraph, so the whole run is read at once.
  const scene = [said(summaryLines(run).join("\n")), ...(fresh.scene ?? [])]
  return {
    ...fresh,
    scene,
    openingStatus: status(`A new run, seed ${nextSeed}. The last run, seed ${setup.seed}: ${won} of ${run.definition.battles.length} battles won.`, "hint"),
  }
}

/** The player's Grid Nexus as a dialog line looks at it. */
function nexusFocus(context: BuildContext): DialogLine["focus"] {
  const tile = nexusTile(context)
  const nexus = context.standing.find((structure) => context.registry.get(structure.contentId).nexus === true)
  if (tile === null || nexus === undefined) return null
  return { tile, own: tilesOf(nexus.anchor, context.registry.get(nexus.contentId).footprint) }
}

/**
 * **What the Build Phase screen is handed to play a run** (`LevelPlay`). One for every run: what a round needs is in
 * its context, and what a played round left is found by the Pulse it resolved (`playedOf`).
 */
function runPlay(): LevelPlay {
  return {
    keep(context, card) {
      const kept = keepPower(context, card)
      // Units it calls up arrive beside the Nexus as the round starts: drawn where they will.
      return kept.callups === context.callups ? kept : { ...kept, incoming: arrivalsOf(positionOf(kept).duel, kept.callups) }
    },

    // No raid comes: the enemy plans in secret and reveals with the player, as in a duel.
    foresee: () => [],

    startPulse(context, state) {
      const { run, duel } = positionOf(context)
      const battle = currentBattle(run)
      if (battle === null) return null
      const player = scriptedPlayer(battle.policy)
      if (player === undefined) throw new Error(`no scripted player "${battle.policy}" to plan ${commanderNameOf(battle.opponent)}'s side`)
      const plans = { A: sidePlanOf(context, state), B: player(briefOf(duel, "B").data) }
      const states: MatchState[] = []
      const events: DomainEvent[] = []
      let content: Readonly<{ registry: ContentRegistry; sides: Readonly<Record<Side, ContentRegistry>> }> | null = null
      const played = playRound(duel, plans, (battleState, tickEvents, registry, sides) => {
        states.push(battleState)
        events.push(...tickEvents)
        content ??= { registry, sides }
      })
      const { registry, sides } = content as unknown as NonNullable<typeof content>
      const start = states[0] as MatchState
      const final = states[states.length - 1] as MatchState
      const timeline = timelineOf(
        { id: `challenge-${run.definition.setup.seed}-battle-${battle.number}`, name: `${battleCount(run, battle.number)}` },
        states,
        [...spawnEvents(start, registry), ...events],
        duel.setup.pulseTicks,
        duel.setup.seed,
        registry,
      )
      const next = played.state
      const ran = next.result === null ? run : battleEnded(run, next.result)
      const record = next.result === null ? null : (ran.played.at(-1) as BattleRecord)
      const fell = SIDES.flatMap((side) => next.sides[side].absent.filter((absence) => absence.fellInRound === duel.round))
      const mission: MissionRound = {
        // The battle goes on, or it is over: a drawn battle goes on to the next as a won one does, so it reads as one
        // here; its own words say it was drawn.
        verdict: record === null ? { kind: "continue" } : { kind: record.outcome === "lost" ? "lost" : "won", trigger: `battle ${record.outcome}` },
        round: duel.round,
        of: duel.setup.rounds,
        ...(fell.length === 0 ? {} : { fell }),
        ...(record === null ? {} : { ending: endingOf(ran, record) }),
      }
      const resolved: ResolvedPulse = { timeline, recall: recall(final, registry, sides), nexus: nexusTile(context), mission, enemy: "enemy" }
      PLAYED.set(resolved, { run: ran, duel: next, report: played.report })
      return resolved
    },

    nextRound(context, _state, resolved) {
      const played = playedOf(resolved)
      return played === undefined ? null : nextAfter(played, context, resolved)
    },
  }
}

/** The one `LevelPlay` every run is played by. */
export const RUN_PLAY: LevelPlay = runPlay()

/** A new run's seed from a clock's milliseconds: their last six digits, a number to read out and type back
 *  (`RUN_SEED_LIMIT`). The screens choose it, for the title menu's Challenge; a run itself never reads a clock. */
export const clockSeed = (now: number): number => Math.floor(Math.abs(now)) % RUN_SEED_LIMIT

/** The route that opens a run: `challenge?seed=1234`, with `&commander=<id>` for any Commander but the default. */
export function runRoute(setup: RunSetup): string {
  return `challenge?seed=${setup.seed}${setup.commander === DEFAULT_RUN_COMMANDER ? "" : `&commander=${setup.commander}`}`
}

/** A run as a level the game opens: its first round is the first battle's, and it is played by `RUN_PLAY`. Throws
 *  for a seed or a Commander a run cannot have. */
export function runLevel(setup: RunSetup): PlayableLevel {
  newRun(setup)
  return {
    id: `challenge-${setup.seed}`,
    campaign: "challenge",
    title: `Challenge run, seed ${setup.seed}`,
    rounds: RUN_ROUNDS,
    route: runRoute(setup),
    play: RUN_PLAY,
    firstRound: (scrollMargin, extra = {}) => firstRunRound(setup, { ...extra, ...(scrollMargin === undefined ? {} : { scrollMargin }) }),
  }
}

/** A run headless, as the driver played it: the run at its end, and every round's report, battle by battle. */
export type DrivenRun = Readonly<{ run: RunState; rounds: readonly Readonly<{ battle: number; report: RoundReport }>[] }>

/**
 * **A round planned by a scripted duel player through the Build Phase's own functions**: `player` plans side A from
 * its brief, as a duel side would; the power it names is picked and kept (`keep`, as the screen keeps it the moment it
 * is picked), and each building it asks for is placed where the duel would place it (`placementsOf`) — the plan as a
 * Build Phase, ready to start. Its stance is not read: the Build Phase has none, and the troops attack.
 */
export function scriptedRound(context: BuildContext, player: Player): Readonly<{ context: BuildContext; state: BuildState }> {
  const { duel } = positionOf(context)
  const plan = player(briefOf(duel, "A").data)
  const pick = plan.power !== undefined && plan.power >= 1 ? plan.power - 1 : null
  const option = pick === null ? undefined : context.nexusDraft[pick]
  const planning = option === undefined ? context : (RUN_PLAY.keep as NonNullable<LevelPlay["keep"]>)(context, option.card)
  const planned = placementsOf(duel, "A", plan)
  const viewport = buildLayout({ columns: 80, rows: 24 }, planning.grid).viewport
  const opened = createBuildState(withoutScene(planning), nexusTile(planning) ?? STARTER_START_CURSOR, viewport)
  return {
    context: planning,
    state: { ...opened, planned, nextOrdinal: planned.length, nexusPick: option === undefined ? null : pick, bonusAllotment: option?.bonusAllotment ?? 0 },
  }
}

/**
 * **The driver plays a run end to end**, through the very functions the screen is handed (`RUN_PLAY`): each round
 * planned by `player` as a Build Phase (`scriptedRound`), its Pulse started from it and the next round opened from
 * that, battle after battle, until the run is over. The same setup and player give the same run, every time.
 */
export function driveRun(setup: RunSetup, player: Player): DrivenRun {
  let context = runLevel(setup).firstRound()
  const rounds: { battle: number; report: RoundReport }[] = []
  for (;;) {
    const battle = currentBattle(positionOf(context).run) as RunBattle
    const planned = scriptedRound(context, player)
    const resolved = RUN_PLAY.startPulse(planned.context, planned.state)
    const played = resolved === null ? undefined : playedOf(resolved)
    if (resolved === null || played === undefined) throw new Error("a run's round could not start")
    rounds.push({ battle: battle.number, report: played.report })
    // The driver stops at its run's end; the screen goes on to a new run.
    if (played.run.over) return { run: played.run, rounds }
    const next = RUN_PLAY.nextRound(planned.context, planned.state, resolved)
    if (next === null) throw new Error("a run's round led nowhere")
    context = next
  }
}
