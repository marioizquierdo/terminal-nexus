// One round of a duel, both sides at once (`playRound`): each side's Nexus Pulse deals it a hand, its plan keeps a card
// and places buildings by the Build Phase's own rules, the two plans reveal together, and a Battle Round between the
// two armies decides what is left for the next round. Pure: the same duel and plans give the same round on every
// machine; nothing here reads a clock, a screen or a model — plans are handed in (`src/duel/players.ts` makes them).
//
// What it reuses rather than restates: the dealer (`dealHand`), the effect table (`applyEffect`, through each side's
// loadout), the Build Phase's legality (`legalityAt`: build range, clearance, footprint, rock, cost — the rules a
// player's cursor is held to), the opening and Recall (`src/match`), the Commander's absence and return, and the kernel
// itself, each side on its own content (`PulseContext.sides`).

import type { PowerCard } from "../armies/index.ts"
import { applyEffect, creditsOf, dealHand } from "../armies/index.ts"
import { roundIncome } from "../armies/curve.ts"
import { defaultValue } from "../build/all-settings.ts"
import type { BuildContext } from "../build/state.ts"
import { legalityAt, missingFor } from "../build/state.ts"
import type { ConstructItem, FieldEntity, PlannedPlacement } from "../build/types.ts"
import { CARD_TEXT } from "../content/cards.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { footprintExtent, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint, GridTerrain } from "../grid/types.ts"
import { centreTile, creditsEarned, fallen, opening, recall, restoreCommanders, spawningRegistry } from "../match/index.ts"
import type { Force, StructurePlacement } from "../match/index.ts"
import { contextFor, stepTick } from "../pulse/index.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { MatchState, TargetArea } from "../state/types.ts"
import type { DuelMap } from "./maps.ts"
import { DUEL_MAPS, duelGrid } from "./maps.ts"
import type { DuelArmy } from "./sides.ts"
import { duelArmy, loadoutOf, powerOf } from "./sides.ts"
import type { DuelResult, DuelSetup, DuelState, Placement, RoundReport, Side, SidePlan, SideReport, SideState, Zone } from "./types.ts"
import { SIDES } from "./types.ts"

/** The other side. */
export const other = (side: Side): Side => (side === "A" ? "B" : "A")

/** Which way a side faces the enemy along the map's width: east (+1) when the enemy's Nexus stands east of its own. */
const facing = (map: DuelMap, side: Side): number => (map.nexus[other(side)].x >= map.nexus[side].x ? 1 : -1)

/** A duel's first state: round 1 to play, nothing on the Grid yet, each side with round 1's credits. */
export function newDuel(setup: DuelSetup): DuelState {
  if (DUEL_MAPS[setup.map] === undefined) throw new Error(`no duel map "${setup.map}" (${Object.keys(DUEL_MAPS).join(", ")})`)
  for (const side of SIDES) duelArmy(setup.commanders[side])
  const side = (commander: string): SideState => ({ commander, credits: roundIncome(1), kept: [], absent: [] })
  return { setup, round: 1, carried: null, sides: { A: side(setup.commanders.A), B: side(setup.commanders.B) }, history: [], result: null }
}

/** The duel's map. */
export function mapOf(state: Pick<DuelState, "setup">): DuelMap {
  return DUEL_MAPS[state.setup.map] as DuelMap
}

/** The hand a side's Nexus Pulse deals it this round: from its army's powers, by its Commander's schedule, for the
 *  buildings it has standing as the round opens. Each side's seed differs, so two armies of one faction are dealt
 *  apart. */
export function handOf(state: DuelState, side: Side): PowerCard[] {
  const army = duelArmy(state.sides[side].commander)
  const kept = state.sides[side].kept.flatMap((id) => powerOf(army, id) ?? [])
  const standing = new Set(army.buildings.filter((card) => standingOf(state, side).some((structure) => structure.contentId === card.structure)).map((card) => card.id))
  return dealHand({
    pool: army.powers,
    kept,
    seed: state.setup.seed + (side === "A" ? 0 : 7919),
    round: state.round,
    standing,
    ...(army.commander.schedule === undefined ? {} : { schedule: army.commander.schedule }),
  })
}

/** A side's structures standing as the round opens: its Nexus alone before the first round. */
export function standingOf(state: DuelState, side: Side): readonly StructurePlacement[] {
  if (state.carried === null) return [{ contentId: duelArmy(state.sides[side].commander).nexus, player: side, anchor: mapOf(state).nexus[side] }]
  return state.carried.entities.flatMap((entity) =>
    entity.player === side && contentFor(state, side).get(entity.contentId).layer === "obstacles" ? [{ contentId: entity.contentId, player: side, anchor: entity.anchor }] : [],
  )
}

/** The content a side is defined by this round. */
function contentFor(state: DuelState, side: Side): ContentRegistry {
  return loadoutOf(duelArmy(state.sides[side].commander), state.sides[side]).registry
}

/** A Build Phase's context for one side: its own structures as what it builds from, everything else as the field —
 *  what the Build Phase's legality needs to hold a duel's placement to a player's rules. */
function sideBuild(state: DuelState, side: Side, grid: GridTerrain, catalog: readonly ConstructItem[], registry: ContentRegistry, credits: number): BuildContext {
  const field: FieldEntity[] = []
  if (state.carried === null) {
    const enemy = other(side)
    field.push({ contentId: duelArmy(state.sides[enemy].commander).nexus, anchor: mapOf(state).nexus[enemy], player: enemy, hp: 1 })
  } else {
    for (const entity of state.carried.entities) {
      if (entity.player === side && registry.get(entity.contentId).layer === "obstacles") continue
      field.push({ contentId: entity.contentId, anchor: entity.anchor, player: entity.player, hp: entity.hp })
    }
  }
  return {
    grid,
    registry,
    catalog,
    standing: standingOf(state, side).map(({ contentId, anchor }) => ({ contentId, anchor })),
    field,
    allotment: credits,
    nexusDraft: [],
  }
}

/**
 * The tile a named place points at, for a side: its Nexus (`nexus`); ahead of its furthest building toward the enemy
 * (`forward`); behind its Nexus (`back`); and beside it to the north or the south. A placement goes to the legal spot
 * nearest it.
 */
export function zonePoint(state: DuelState, side: Side, zone: Zone, registry: ContentRegistry): Coord {
  const map = mapOf(state)
  const nexusAt = map.nexus[side]
  const nexusFootprint = registry.get(duelArmy(state.sides[side].commander).nexus).footprint
  const centre = centreTile(nexusAt, nexusFootprint)
  const way = facing(map, side)
  const grid = duelGrid(map)
  const clamp = (tile: Coord): Coord => ({ x: Math.max(0, Math.min(grid.width - 1, tile.x)), y: Math.max(0, Math.min(grid.height - 1, tile.y)) })
  switch (zone) {
    case "nexus":
      return centre
    case "back":
      return clamp({ x: centre.x - way * 6, y: centre.y })
    case "north":
      return clamp({ x: centre.x + way * 2, y: centre.y - 6 })
    case "south":
      return clamp({ x: centre.x + way * 2, y: centre.y + 6 })
    case "forward": {
      // Ahead of the building furthest toward the enemy: a base pushed forward builds further forward.
      const xs = standingOf(state, side).flatMap((structure) => tilesOf(structure.anchor, registry.get(structure.contentId).footprint).map((tile) => tile.x * way))
      const front = Math.max(centre.x * way, ...xs) * way
      return clamp({ x: front + way * 5, y: centre.y })
    }
  }
}

/** Anchors for `footprint` in order of how near its middle stands to `point`, a row counting two columns as range
 *  does; on a tie the one further toward the enemy, then the northern. Measured from the footprint's middle, in
 *  half tiles, not from its anchor (its north-west tile): the same choice for either side, mirrored, so neither
 *  side's buildings land a tile further forward by the corner they are measured from. */
function nearest(grid: GridTerrain, point: Coord, way: number, footprint: Footprint): Coord[] {
  const { width, height } = footprintExtent(footprint)
  const middle = (anchor: Coord): Coord => ({ x: 2 * anchor.x + width - 1, y: 2 * anchor.y + height - 1 })
  const distance = (anchor: Coord): number => {
    const at = middle(anchor)
    return Math.abs(at.x - 2 * point.x) + 2 * Math.abs(at.y - 2 * point.y)
  }
  const anchors: Coord[] = []
  for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) anchors.push({ x, y })
  return anchors.sort((a, b) => distance(a) - distance(b) || (middle(b).x - middle(a).x) * way || a.y - b.y)
}

/** What a side's plan builds: each placement in order, held to the Build Phase's rules — the card in its menu, what it
 *  requires standing as the round opens, its cost, and a legal spot — with every refusal said. */
function placeAll(
  state: DuelState,
  side: Side,
  plan: SidePlan,
  catalog: readonly ConstructItem[],
  registry: ContentRegistry,
  credits: number,
): Readonly<{ planned: PlannedPlacement[]; spent: number; built: string[]; refused: string[] }> {
  const map = mapOf(state)
  const grid = duelGrid(map)
  const army = duelArmy(state.sides[side].commander)
  const planned: PlannedPlacement[] = []
  const built: string[] = []
  const refused: string[] = []
  let spent = 0
  const context = sideBuild(state, side, grid, catalog, registry, credits)
  plan.build.forEach((placement: Placement, index) => {
    const card = army.buildings.find((candidate) => candidate.id === placement.building)
    const row = card === undefined ? undefined : catalog.find((item) => item.contentId === card.structure)
    const say = (why: string): void => {
      refused.push(`${placement.building}: ${why}`)
    }
    if (card === undefined || row === undefined) return say(`not a building you can build (${catalog.map((item) => buildingIdOf(army, item)).join(", ")})`)
    const missing = missingFor(context, row)
    if (missing.length > 0) return say(`needs ${missing.map((contentId) => titleOf(contentId)).join(" and ")} standing as the round opens`)
    const left = credits - spent
    if (row.cost > left) return say(`costs ${row.cost}, ${left} left`)
    const tiles =
      placement.x !== undefined && placement.y !== undefined
        ? [{ x: placement.x, y: placement.y }]
        : nearest(grid, zonePoint(state, side, placement.at ?? "nexus", registry), facing(map, side), registry.get(row.contentId).footprint).slice(0, 600)
    let reason = "no legal spot near there"
    for (const anchor of tiles) {
      const legality = legalityAt(context, planned, row.contentId, anchor, left, defaultValue("buildRange"), defaultValue("spawnClearance"))
      if (!legality.ok) {
        if (tiles.length === 1) reason = legality.reason
        continue
      }
      planned.push({ ordinal: index, contentId: row.contentId, anchor })
      spent += row.cost
      built.push(`${card.id} at ${anchor.x},${anchor.y}`)
      return
    }
    say(reason)
  })
  return { planned, spent, built, refused }
}

/** A building card's id for its menu row. */
const buildingIdOf = (army: DuelArmy, item: ConstructItem): string => army.buildings.find((card) => card.structure === item.contentId)?.id ?? item.contentId

/** What a card calls a content id, or its short name. */
export const titleOf = (contentId: string): string => CARD_TEXT[contentId]?.title ?? contentId.slice(contentId.lastIndexOf(".") + 1)

/** `registry` with each building of `catalog` that makes units making them in waves, as its card says. */
function battleContent(registry: ContentRegistry, catalog: readonly ConstructItem[]): ContentRegistry {
  const spawns: Record<string, NonNullable<ConstructItem["spawns"]>> = {}
  for (const item of catalog) if (item.spawns !== undefined) spawns[item.contentId] ??= item.spawns
  return spawningRegistry(registry, spawns, defaultValue("firstWave") * TICKS_PER_SECOND)
}

/** Counts of things by their card's name. */
function tally(contentIds: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const contentId of contentIds) counts[titleOf(contentId)] = (counts[titleOf(contentId)] ?? 0) + 1
  return counts
}

/**
 * **One round of the duel.** Each side keeps the card its plan names from its hand, builds what its plan asks for that
 * the rules allow, and its troops take its stance; the Battle Round runs until a Nexus falls or time runs out; Recall
 * brings the survivors home; a Commander who fell is out by her own rule; credits carry over, the next round adds the
 * curve's and each side's battle earnings. Returns the duel after the round, and what happened in it. `watch`, when
 * given, sees every state of the battle from its opening on, and each tick's events, with side A's content to draw it by and
 * each side's own: for a picture, a viewer or a measure, never read back.
 */
export function playRound(
  state: DuelState,
  plans: Readonly<Record<Side, SidePlan>>,
  watch?: (battle: MatchState, events: readonly DomainEvent[], registry: ContentRegistry, sides: Readonly<Record<Side, ContentRegistry>>) => void,
): Readonly<{ state: DuelState; report: RoundReport }> {
  if (state.result !== null) throw new Error("the duel is over")
  const map = mapOf(state)
  const grid = duelGrid(map)
  const round = state.round

  // Each side's Build Phase, blind to the other's.
  type Planned = Readonly<{
    army: DuelArmy
    registry: ContentRegistry
    catalog: readonly ConstructItem[]
    hand: PowerCard[]
    pick: PowerCard | null
    callups: readonly Readonly<{ unit: string; count: number }>[]
    placed: ReturnType<typeof placeAll>
    side: SideState
  }>
  const phase = (side: Side): Planned => {
    const army = duelArmy(state.sides[side].commander)
    const hand = handOf(state, side)
    const plan = plans[side]
    const pick = plan.power !== undefined && plan.power >= 1 ? (hand[plan.power - 1] ?? null) : null
    const kept = pick === null ? state.sides[side].kept : [...state.sides[side].kept, pick.id]
    const loadout = loadoutOf(army, { kept })
    // The units the card picked this round calls up, if it calls any: what keeping it adds to no call-ups at all.
    const callups = pick === null ? [] : applyEffect(loadoutOf(army, state.sides[side]), pick.effect).callups
    const credits = state.sides[side].credits + (pick === null ? 0 : creditsOf(pick.effect))
    const placed = placeAll(state, side, plan, loadout.catalog, loadout.registry, credits)
    return {
      army,
      registry: battleContent(loadout.registry, loadout.catalog),
      catalog: loadout.catalog,
      hand,
      pick,
      callups,
      placed,
      side: { ...state.sides[side], kept, credits: credits - placed.spent },
    }
  }
  const planned = { A: phase("A"), B: phase("B") }
  const sides = { A: planned.A.registry, B: planned.B.registry }
  const phases = clashesSettled(planned, sides)

  // The Battle Round's opening: what Recall left, with every Commander due back set down beside her Nexus; both
  // plans revealed together; the first round's Nexuses, Commanders and starting packages; this round's call-ups.
  const restored = state.carried === null
    ? null
    : restoreCommanders(state.carried, [...state.sides.A.absent, ...state.sides.B.absent], round, sides.A, sides)
  const structures: StructurePlacement[] = []
  if (state.carried === null) for (const side of SIDES) structures.push(...standingOf(state, side))
  for (const side of SIDES) for (const placed of phases[side].placed.planned) structures.push({ contentId: placed.contentId, player: side, anchor: placed.anchor })
  const forces: Force[] = []
  for (const side of SIDES) {
    const muster = musterOf(state, side, sides[side])
    const units: string[] = []
    if (state.carried === null) {
      units.push(phases[side].army.commander.unit)
      for (const { unit, count } of phases[side].army.commander.start) for (let n = 0; n < count; n += 1) units.push(unit)
    }
    for (const { unit, count } of phases[side].callups) for (let n = 0; n < count; n += 1) units.push(unit)
    if (units.length > 0) forces.push({ player: side, muster, units })
  }
  const opened = opening({
    grid,
    registry: sides.A,
    sides,
    structures,
    setup: { seed: state.setup.seed, pulseTicks: state.setup.pulseTicks, forces },
    ...(restored === null ? {} : { carried: restored.state }),
  }).state
  const targets: Record<Side, TargetArea> = { A: targetOf(state, "A", plans.A.stance, sides), B: targetOf(state, "B", plans.B.stance, sides) }
  const start: MatchState = { ...opened, targets }

  // The Battle Round, each side on its own content.
  const context = contextFor(start, sides.A, state.setup.pulseTicks, { sides })
  const events: DomainEvent[] = []
  let current = start
  watch?.(current, [], sides.A, sides)
  while (current.outcome === null && current.tick < state.setup.pulseTicks) {
    const step = stepTick(current, context)
    current = step.state
    events.push(...step.events)
    watch?.(current, step.events, sides.A, sides)
  }

  // After it: who fell, what each side earned, what the next round starts from.
  const fell = fallen(events, sides.A, round)
  const recalled = recall(current, sides.A, sides).state
  const next: Record<Side, SideState> = { A: phases.A.side, B: phases.B.side }
  const reports = {} as Record<Side, SideReport>
  for (const side of SIDES) {
    const earned = creditsEarned(events, side)
    const stillOut = restored === null ? [] : restored.absent.filter((absence) => absence.player === side)
    next[side] = {
      ...next[side],
      credits: next[side].credits + roundIncome(round + 1) + earned,
      absent: [...stillOut, ...fell.filter((absence) => absence.player === side)],
    }
    reports[side] = sideReport(side, phases[side], plans[side], state.sides[side].credits, earned, start, current, events, sides, fell.some((absence) => absence.player === side))
  }
  const ended = current.outcome?.reason === "nexus-destroyed" ? "nexus" : "time"
  const report: RoundReport = { round, sides: reports, ticks: current.tick, ended }
  const result: DuelResult | null =
    ended === "nexus" && current.outcome !== null
      ? { winner: current.outcome.winner, by: current.outcome.winner === null ? "draw" : "nexus", round }
      : round >= state.setup.rounds
        ? judged([...state.history, report], round)
        : null
  return {
    state: { setup: state.setup, round: round + 1, carried: recalled, sides: next, history: [...state.history, report], result },
    report,
  }
}

/**
 * Two plans revealed together may put buildings on the same ground: the sides plan blind, and where their build ranges
 * meet both may claim a tile. Neither is built there — it would favour one side by a rule of order — and each is paid
 * back, the refusal said in both reports.
 */
function clashesSettled<P extends Readonly<{ placed: ReturnType<typeof placeAll>; side: SideState; catalog: readonly ConstructItem[] }>>(
  phases: Readonly<Record<Side, P>>,
  sides: Readonly<Record<Side, ContentRegistry>>,
): Record<Side, P> {
  const tilesOfPlaced = (side: Side, placed: PlannedPlacement): Set<string> =>
    new Set(tilesOf(placed.anchor, sides[side].get(placed.contentId).footprint).map((tile) => `${tile.x},${tile.y}`))
  const clashing = { A: new Set<PlannedPlacement>(), B: new Set<PlannedPlacement>() }
  for (const a of phases.A.placed.planned) {
    const own = tilesOfPlaced("A", a)
    for (const b of phases.B.placed.planned) {
      if ([...tilesOfPlaced("B", b)].some((tile) => own.has(tile))) {
        clashing.A.add(a)
        clashing.B.add(b)
      }
    }
  }
  const settled = (side: Side): P => {
    const phase = phases[side]
    if (clashing[side].size === 0) return phase
    const keep = phase.placed.planned.filter((placed) => !clashing[side].has(placed))
    const refund = [...clashing[side]].reduce((sum, placed) => sum + (phase.catalog.find((item) => item.contentId === placed.contentId)?.cost ?? 0), 0)
    const dropped = [...clashing[side]].map((placed) => `${titleOf(placed.contentId)} at ${placed.anchor.x},${placed.anchor.y}: the enemy built there at the same moment, so neither was built`)
    return {
      ...phase,
      placed: { ...phase.placed, planned: keep, spent: phase.placed.spent - refund, built: phase.placed.built.filter((_, index) => !clashing[side].has(phase.placed.planned[index] as PlannedPlacement)), refused: [...phase.placed.refused, ...dropped] },
      side: { ...phase.side, credits: phase.side.credits + refund },
    }
  }
  return { A: settled("A"), B: settled("B") }
}

/** Where a side's arriving units gather: in front of its Nexus, toward the enemy. */
function musterOf(state: DuelState, side: Side, registry: ContentRegistry): Coord {
  const map = mapOf(state)
  const centre = centreTile(map.nexus[side], registry.get(duelArmy(state.sides[side].commander).nexus).footprint)
  return { x: centre.x + facing(map, side) * 4, y: centre.y }
}

/** Where a side's troops head: the enemy's Nexus when it attacks, its own holding ground when it holds. */
function targetOf(state: DuelState, side: Side, stance: SidePlan["stance"], sides: Readonly<Record<Side, ContentRegistry>>): TargetArea {
  const map = mapOf(state)
  if (stance === "hold") return map.hold[side]
  const enemy = other(side)
  const anchor = map.nexus[enemy]
  const footprint = sides[enemy].get(duelArmy(state.sides[enemy].commander).nexus).footprint
  const tiles = tilesOf(anchor, footprint)
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 }
}

/** What one side did and suffered in the round, from its phase, the opening, the end and the events. */
function sideReport(
  side: Side,
  phase: Readonly<{ army: DuelArmy; hand: PowerCard[]; pick: PowerCard | null; placed: ReturnType<typeof placeAll> }>,
  plan: SidePlan,
  credits: number,
  earned: number,
  start: MatchState,
  end: MatchState,
  events: readonly DomainEvent[],
  sides: Readonly<Record<Side, ContentRegistry>>,
  commanderFell: boolean,
): SideReport {
  const enemy = other(side)
  const definition = (player: Side, contentId: string) => sides[player].get(contentId)
  const nexusOf = (state: MatchState, player: Side) => state.entities.find((entity) => entity.player === player && definition(player, entity.contentId).nexus === true)
  const before = nexusOf(start, side)
  const after = nexusOf(end, side)
  const ownerOf = new Map(start.entities.map((entity) => [entity.id, entity.player] as const))
  const nexusIds = new Set(start.entities.filter((entity) => definition(entity.player, entity.contentId).nexus === true).map((entity) => entity.id))
  const layerOf = new Map(start.entities.map((entity) => [entity.id, definition(entity.player, entity.contentId).layer] as const))
  const dealt = { units: 0, buildings: 0, nexus: 0 }
  const lost: string[] = []
  const killed: string[] = []
  const trained: string[] = []
  const abilities: Record<string, number> = {}
  for (const event of events) {
    if (event.kind === "entity.spawned") {
      ownerOf.set(event.entity, event.player)
      layerOf.set(event.entity, definition(event.player, event.contentId).layer)
      if (event.player === side) trained.push(event.contentId)
    }
    if (event.kind === "damage.applied" && event.source.startsWith(`${side}:`) && ownerOf.get(event.entity) === enemy) {
      if (nexusIds.has(event.entity)) dealt.nexus += event.amount
      else if (layerOf.get(event.entity) === "obstacles") dealt.buildings += event.amount
      else dealt.units += event.amount
    }
    if ((event.kind === "entity.died" || event.kind === "structure.destroyed") && event.player === side) lost.push(event.contentId)
    if ((event.kind === "entity.died" || event.kind === "structure.destroyed") && event.player === enemy) killed.push(event.contentId)
    if (event.kind === "ability.triggered" && event.player === side) abilities[event.name ?? event.ability] = (abilities[event.name ?? event.ability] ?? 0) + 1
  }
  return {
    commander: phase.army.commander.id,
    credits,
    spent: phase.placed.spent,
    earned,
    kept: phase.pick?.name ?? null,
    hand: phase.hand.map((card) => card.name),
    built: phase.placed.built,
    refused: phase.placed.refused,
    stance: plan.stance,
    ...(plan.note === undefined ? {} : { note: plan.note }),
    fielded: tally(start.entities.filter((entity) => entity.player === side && definition(side, entity.contentId).layer !== "obstacles").map((entity) => entity.contentId)),
    trained: tally(trained),
    lost: tally(lost),
    killed: tally(killed),
    dealt,
    nexus: { before: before?.hp ?? 0, after: after?.hp ?? 0, most: before === undefined ? 0 : definition(side, before.contentId).maxHp },
    commanderFell,
    abilities,
  }
}

/**
 * The rounds ran out: the side whose Nexus kept the larger share of its health wins; on an even share, the side that
 * dealt more damage over the whole duel; on that too, a draw.
 */
function judged(history: readonly RoundReport[], round: number): DuelResult {
  const last = history.at(-1) as RoundReport
  const share = (side: Side): number => (last.sides[side].nexus.most === 0 ? 0 : last.sides[side].nexus.after / last.sides[side].nexus.most)
  if (share("A") !== share("B")) return { winner: share("A") > share("B") ? "A" : "B", by: "health", round }
  const dealt = (side: Side): number => history.reduce((sum, report) => sum + report.sides[side].dealt.units + report.sides[side].dealt.buildings + report.sides[side].dealt.nexus, 0)
  if (dealt("A") !== dealt("B")) return { winner: dealt("A") > dealt("B") ? "A" : "B", by: "damage", round }
  return { winner: null, by: "draw", round }
}
