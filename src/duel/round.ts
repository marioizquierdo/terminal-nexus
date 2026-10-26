// One round of a duel, both sides at once (`playRound`): each side's Nexus Pulse deals it a hand, its plan keeps a card
// and places buildings by the Build Phase's own rules, the two plans reveal together, and a Battle Round between the
// two armies decides what is left for the next round. Pure: the same duel and plans give the same round on every
// machine; nothing here reads a clock, a screen or a model — plans are handed in (`src/duel/players.ts` makes them).
//
// What it reuses rather than restates: the dealer (`dealHand`), the effect table (`applyEffect`, through each side's
// loadout), the Build Phase's legality (`legalityAt`: build range, footprint, rock, cost — the rules a
// player's cursor is held to), the opening and Recall (`src/match`), the Commander's absence and return, and the kernel
// itself, each side on its own content (`PulseContext.sides`).

import type { PowerCard } from "../armies/index.ts"
import { applyEffect, creditsOf, dealHand, fittingsWith, modeIn, modeSet } from "../armies/index.ts"
import { roundIncome } from "../armies/curve.ts"
import { defaultValue } from "../build/all-settings.ts"
import type { BuildContext } from "../build/state.ts"
import { legalityAt, missingFor } from "../build/state.ts"
import type { ConstructItem, FieldEntity, PlannedPlacement } from "../build/types.ts"
import { cardTextFor } from "../content/cards.ts"
import type { ContentRegistry } from "../content/index.ts"
import { baseContentId, fittedId, fittingsOf } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { footprintDistance, footprintExtent, footprintSteps, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint, GridTerrain } from "../grid/types.ts"
import { centreTile, creditsEarned, fallen, opening, recall, restoreCommanders, spawningRegistry } from "../match/index.ts"
import type { Force, StructurePlacement } from "../match/index.ts"
import { recallBy } from "../match/recall-variants.ts"
import { contextFor, stepTick } from "../pulse/index.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { MatchState, TargetArea } from "../state/types.ts"
import type { DuelMap } from "./maps.ts"
import { DUEL_MAPS, duelGrid } from "./maps.ts"
import type { DuelArmy } from "./sides.ts"
import { armyOf, duelArmy, loadoutOf, powerOf } from "./sides.ts"
import type { DuelResult, DuelSetup, DuelState, Formation, Placement, RoundReport, Side, SidePlan, SideReport, SideState, Zone } from "./types.ts"
import { APART_GAP, SIDES } from "./types.ts"

/** The other side. */
export const other = (side: Side): Side => (side === "A" ? "B" : "A")

/** Which way a side faces the enemy along the map's width: east (+1) when the enemy's Nexus stands east of its own. */
const facing = (map: DuelMap, side: Side): number => (map.nexus[other(side)].x >= map.nexus[side].x ? 1 : -1)

/** A duel's first state: round 1 to play, nothing on the Grid yet, each side with round 1's credits. */
export function newDuel(setup: DuelSetup): DuelState {
  if (DUEL_MAPS[setup.map] === undefined) throw new Error(`no duel map "${setup.map}" (${Object.keys(DUEL_MAPS).join(", ")})`)
  for (const side of SIDES) duelArmy(setup.commanders[side])
  const side = (which: Side): SideState => {
    const roster = setup.rosters?.[which]
    return { commander: setup.commanders[which], ...(roster === undefined ? {} : { roster }), credits: roundIncome(1), kept: roster?.doctrines ?? [], absent: [] }
  }
  return { setup, round: 1, carried: null, sides: { A: side("A"), B: side("B") }, history: [], result: null }
}

/** The duel's map. */
export function mapOf(state: Pick<DuelState, "setup">): DuelMap {
  return DUEL_MAPS[state.setup.map] as DuelMap
}

/** The hand a side's Nexus Pulse deals it this round: from its army's powers, by its Commander's schedule, for the
 *  buildings it has standing as the round opens. Each side's seed differs, so two armies of one faction are dealt
 *  apart. */
export function handOf(state: DuelState, side: Side): PowerCard[] {
  const army = armyOf(state, side)
  const kept = state.sides[side].kept.flatMap((id) => powerOf(army, id) ?? [])
  const standing = new Set(army.buildings.filter((card) => standingOf(state, side).some((structure) => baseContentId(structure.contentId) === card.structure)).map((card) => card.id))
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
  if (state.carried === null) return [{ contentId: armyOf(state, side).nexus, player: side, anchor: mapOf(state).nexus[side] }]
  return state.carried.entities.flatMap((entity) =>
    entity.player === side && contentFor(state, side).get(entity.contentId).layer === "obstacles" ? [{ contentId: entity.contentId, player: side, anchor: entity.anchor }] : [],
  )
}

/** The content a side is defined by this round. */
function contentFor(state: DuelState, side: Side): ContentRegistry {
  return loadoutOf(armyOf(state, side), state.sides[side]).registry
}

/** A Build Phase's context for one side: its own structures as what it builds from, everything else as the field —
 *  what the Build Phase's legality needs to hold a duel's placement to a player's rules. */
function sideBuild(state: DuelState, side: Side, grid: GridTerrain, catalog: readonly ConstructItem[], registry: ContentRegistry, credits: number): BuildContext {
  const field: FieldEntity[] = []
  if (state.carried === null) {
    const enemy = other(side)
    field.push({ contentId: armyOf(state, enemy).nexus, anchor: mapOf(state).nexus[enemy], player: enemy, hp: 1 })
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
  const nexusFootprint = registry.get(armyOf(state, side).nexus).footprint
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

/** A building that trains units, where it stands: what a formation sets its next one by. */
type Producer = Readonly<{ anchor: Coord; footprint: Footprint }>

/**
 * The anchors a formation tries for its next building that trains units, best first; the first of them the rules
 * allow is where it goes. `order` is every anchor, nearest the formation's centre first (`nearest`), and `producers`
 * the side's buildings that train units, standing and planned this round.
 *
 * - **block**: the anchors whose footprint touches a producer along a side, nearest the centre first; then, when none
 *   of those is legal (the block hemmed in by rock or the build range), the rest. With no producer yet, the nearest.
 * - **apart**: the anchors furthest from every producer, up to `APART_GAP` (so beyond it, every anchor counts the
 *   same), nearest the centre on a tie: the first goes nearest the centre, each next one as near it as the gap allows,
 *   and where the gap fits nowhere legal, as far from the others as it can.
 *
 * **Neither builds past its centre toward the enemy while it has room behind it**: an anchor whose middle stands
 * further toward the enemy than the centre comes after every one that does not. Without it, set apart, a base reached
 * further forward each round than a block did (a building furthest forward moves `forward` with it), and a duel of
 * block against apart measured how far forward a base was as much as how tight its army stood.
 *
 * Mirror-fair: the order is mirrored for the other side (`nearest`, `way`) and the distances are a footprint's to a
 * footprint's, the same either way.
 */
function formationOrder(
  formation: Exclude<Formation, "zones">,
  order: readonly Coord[],
  centre: Coord,
  way: number,
  footprint: Footprint,
  producers: readonly Producer[],
): Coord[] {
  const { width } = footprintExtent(footprint)
  const ahead = (anchor: Coord): number => ((2 * anchor.x + width - 1 - 2 * centre.x) * way > 0 ? 1 : 0)
  const touching = (anchor: Coord): number => (producers.some((producer) => footprintSteps(anchor, footprint, producer.anchor, producer.footprint) === 1) ? 0 : 1)
  const room = (anchor: Coord): number => Math.min(APART_GAP, ...producers.map((producer) => footprintDistance(anchor, footprint, producer.anchor, producer.footprint)))
  const scored = order.map((anchor, index) => ({
    anchor,
    index,
    ahead: ahead(anchor),
    shape: producers.length === 0 ? 0 : formation === "block" ? touching(anchor) : -room(anchor),
  }))
  // A block: touching first, then not ahead. Apart: not ahead first, then the most room.
  const block = (a: (typeof scored)[number], b: (typeof scored)[number]): number => a.shape - b.shape || a.ahead - b.ahead || a.index - b.index
  const apart = (a: (typeof scored)[number], b: (typeof scored)[number]): number => a.ahead - b.ahead || a.shape - b.shape || a.index - b.index
  return scored.sort(formation === "block" ? block : apart).map((entry) => entry.anchor)
}

/** What a side's plan builds: each placement in order, held to the Build Phase's rules — the card in its menu, what it
 *  requires standing as the round opens, its cost, and a legal spot — with every refusal said. With a formation other
 *  than `zones`, each building that trains units goes where the formation sets it (`formationOrder`), round where the
 *  plan asks for the first of them; every other building where its own placement says. */
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
  const army = armyOf(state, side)
  const planned: PlannedPlacement[] = []
  const built: string[] = []
  const refused: string[] = []
  let spent = 0
  const context = sideBuild(state, side, grid, catalog, registry, credits)
  const formation = plan.formation ?? "zones"
  const trains = (contentId: string): boolean => catalog.find((item) => item.contentId === baseContentId(contentId))?.spawns !== undefined
  const producers: Producer[] =
    formation === "zones"
      ? []
      : standingOf(state, side).flatMap((structure) => (trains(structure.contentId) ? [{ anchor: structure.anchor, footprint: registry.get(structure.contentId).footprint }] : []))
  let centre: Coord | undefined
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
    const footprint = registry.get(row.contentId).footprint
    const asked = (): Coord => (placement.x !== undefined && placement.y !== undefined ? { x: placement.x, y: placement.y } : zonePoint(state, side, placement.at ?? "nexus", registry))
    const formed = formation !== "zones" && row.spawns !== undefined
    if (formed) centre ??= asked()
    const tiles = formed
      ? formationOrder(formation, nearest(grid, centre as Coord, facing(map, side), footprint), centre as Coord, facing(map, side), footprint, producers)
      : placement.x !== undefined && placement.y !== undefined
        ? [{ x: placement.x, y: placement.y }]
        : nearest(grid, asked(), facing(map, side), footprint).slice(0, 600)
    let reason = "no legal spot near there"
    for (const anchor of tiles) {
      const legality = legalityAt(context, planned, row.contentId, anchor, left, defaultValue("buildRange"))
      if (!legality.ok) {
        if (tiles.length === 1) reason = legality.reason
        continue
      }
      planned.push({ ordinal: index, contentId: row.contentId, anchor })
      if (formed) producers.push({ anchor, footprint })
      spent += row.cost
      built.push(`${card.id} at ${anchor.x},${anchor.y}`)
      return
    }
    say(reason)
  })
  return { planned, spent, built, refused }
}

/** What a side's building actions did this round (`actOn`). */
type Acted = Readonly<{
  /** Its buildings placed this round, each as the Battle Round starts it: carrying what was taken on it. */
  planned: readonly PlannedPlacement[]
  /** Its standing buildings whose content the actions changed, and the content id each starts the battle with. */
  refits: readonly Readonly<{ anchor: Coord; contentId: string }>[]
  /** The buildings an order holds this round (Hold production). */
  held: readonly Coord[]
  spent: number
  /** What each building's actions cost, by its anchor (`x,y`): refunded with it when a clash takes it away. */
  costAt: ReadonlyMap<string, number>
  took: readonly string[]
  refused: readonly string[]
}>

/**
 * **A side's building actions** (`SidePlan.actions`), in order, after its buildings are placed, from the credits they
 * left — by the Build Phase's rules (`buildingAction`, `src/build/state.ts`): a building of its own at that anchor,
 * standing or just placed; an action its card has; an upgrade it does not carry yet, whose requirements are met and
 * whose price is left; a mode not already in force; an order, given. Each building carries what was taken on it as its
 * content id (`fittedId`), which the opening sets it down as.
 */
function actOn(state: DuelState, side: Side, plan: SidePlan, catalog: readonly ConstructItem[], planned: readonly PlannedPlacement[], credits: number): Acted {
  const army = armyOf(state, side)
  const key = (anchor: Readonly<{ x: number; y: number }>): string => `${anchor.x},${anchor.y}`
  const standing = standingOf(state, side)
  const now = new Map<string, string>()
  for (const structure of [...standing, ...planned]) now.set(key(structure.anchor), structure.contentId)
  const standingIds = new Set(standing.map((structure) => baseContentId(structure.contentId)))
  const held: Coord[] = []
  const costAt = new Map<string, number>()
  const took: string[] = []
  const refused: string[] = []
  let spent = 0
  for (const asked of plan.actions ?? []) {
    const where = `${asked.action} at ${asked.x},${asked.y}`
    const contentId = now.get(key(asked))
    if (contentId === undefined) {
      refused.push(`${where}: no building of yours stands there`)
      continue
    }
    const base = baseContentId(contentId)
    const card = army.buildings.find((each) => each.structure === base)
    const actions = catalog.find((item) => item.contentId === base)?.actions ?? []
    const action = actions.find((each) => each.id === asked.action)
    if (action === undefined) {
      refused.push(`${where}: the ${titleOf(base)} has no such action (${actions.map((each) => each.id).join(", ") || "none"})`)
      continue
    }
    const named = `${action.id} on ${card?.id ?? base} at ${asked.x},${asked.y}`
    if (action.kind === "order") {
      held.push({ x: asked.x, y: asked.y })
      took.push(named)
      continue
    }
    const fittings = fittingsOf(contentId)
    if (action.kind === "upgrade" && fittings.includes(action.id)) {
      refused.push(`${where}: it has it already`)
      continue
    }
    if (action.kind === "mode" && modeIn(actions, fittings, modeSet(action)) === action.id) {
      refused.push(`${where}: it is set so already`)
      continue
    }
    const needed = (action.requires?.actions ?? []).filter((id) => !fittings.includes(id))
    const missing = (action.requires?.buildings ?? []).filter((id) => !standingIds.has(army.buildings.find((each) => each.id === id)?.structure ?? id))
    if (needed.length > 0 || missing.length > 0) {
      refused.push(`${where}: needs ${[...needed, ...missing].join(" and ")} first`)
      continue
    }
    const cost = action.cost ?? 0
    if (cost > credits - spent) {
      refused.push(`${where}: costs ${cost}, ${credits - spent} left`)
      continue
    }
    spent += cost
    costAt.set(key(asked), (costAt.get(key(asked)) ?? 0) + cost)
    now.set(key(asked), fittedId(base, fittingsWith(actions, fittings, action)))
    took.push(named)
  }
  const fitted = (structure: Readonly<{ contentId: string; anchor: Coord }>): string => now.get(key(structure.anchor)) ?? structure.contentId
  return {
    planned: planned.map((placed) => ({ ...placed, contentId: fitted(placed) })),
    refits: standing.flatMap((structure) => (fitted(structure) === structure.contentId ? [] : [{ anchor: structure.anchor, contentId: fitted(structure) }])),
    held,
    spent,
    costAt,
    took,
    refused,
  }
}

/**
 * Where a side's plan puts its buildings this round, by the Build Phase's rules, as `playRound` places them before the
 * other side's plan is revealed (a clash with it is settled only once both are): each building's card and anchor, in
 * order. For a driver that plays a side through the Build Phase's own functions, which take a plan as placed buildings.
 */
export function placementsOf(state: DuelState, side: Side, plan: SidePlan): PlannedPlacement[] {
  const army = armyOf(state, side)
  const hand = handOf(state, side)
  const pick = plan.power !== undefined && plan.power >= 1 ? (hand[plan.power - 1] ?? null) : null
  const loadout = loadoutOf(army, { kept: pick === null ? state.sides[side].kept : [...state.sides[side].kept, pick.id] })
  const credits = state.sides[side].credits + (pick === null ? 0 : creditsOf(pick.effect))
  return placeAll(state, side, plan, loadout.catalog, loadout.registry, credits).planned
}

/** A building card's id for its menu row. */
const buildingIdOf = (army: DuelArmy, item: ConstructItem): string => army.buildings.find((card) => card.structure === item.contentId)?.id ?? item.contentId

/** What a card calls a content id, or its short name. */
export const titleOf = (contentId: string): string => cardTextFor(contentId)?.title ?? baseContentId(contentId).slice(baseContentId(contentId).lastIndexOf(".") + 1)

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
    acted: Acted
    side: SideState
  }>
  const phase = (side: Side): Planned => {
    const army = armyOf(state, side)
    const hand = handOf(state, side)
    const plan = plans[side]
    const pick = plan.power !== undefined && plan.power >= 1 ? (hand[plan.power - 1] ?? null) : null
    const kept = pick === null ? state.sides[side].kept : [...state.sides[side].kept, pick.id]
    const loadout = loadoutOf(army, { kept })
    // The units the card picked this round calls up, if it calls any: what keeping it adds to no call-ups at all.
    const callups = pick === null ? [] : applyEffect(loadoutOf(army, state.sides[side]), pick.effect).callups
    const credits = state.sides[side].credits + (pick === null ? 0 : creditsOf(pick.effect))
    const built = placeAll(state, side, plan, loadout.catalog, loadout.registry, credits)
    // Then what it does with its buildings, from what building them left.
    const acted = actOn(state, side, plan, loadout.catalog, built.planned, credits - built.spent)
    const placed = { ...built, planned: [...acted.planned], spent: built.spent + acted.spent, refused: [...built.refused, ...acted.refused] }
    return {
      army,
      registry: battleContent(loadout.registry, loadout.catalog),
      catalog: loadout.catalog,
      hand,
      pick,
      callups,
      placed,
      acted,
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
    ...heldBy(state, plans, phases),
    ...refitsOf(phases),
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
  const recalled = (state.setup.recall === undefined ? recall(current, sides.A, sides) : recallBy(state.setup.recall, current, sides.A, sides)).state
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
function clashesSettled<P extends Readonly<{ placed: ReturnType<typeof placeAll>; acted: Acted; side: SideState; catalog: readonly ConstructItem[] }>>(
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
    // The building and what its actions cost, both paid back.
    const costOf = (placed: PlannedPlacement): number =>
      (phase.catalog.find((item) => item.contentId === baseContentId(placed.contentId))?.cost ?? 0) + (phase.acted.costAt.get(`${placed.anchor.x},${placed.anchor.y}`) ?? 0)
    const refund = [...clashing[side]].reduce((sum, placed) => sum + costOf(placed), 0)
    const dropped = [...clashing[side]].map((placed) => `${titleOf(placed.contentId)} at ${placed.anchor.x},${placed.anchor.y}: the enemy built there at the same moment, so neither was built`)
    return {
      ...phase,
      placed: { ...phase.placed, planned: keep, spent: phase.placed.spent - refund, built: phase.placed.built.filter((_, index) => !clashing[side].has(phase.placed.planned[index] as PlannedPlacement)), refused: [...phase.placed.refused, ...dropped] },
      side: { ...phase.side, credits: phase.side.credits + refund },
    }
  }
  return { A: settled("A"), B: settled("B") }
}

/** The buildings both plans hold this round (Hold production), each a building of its own side standing as the round
 *  opens: what the opening holds. Nothing when neither plan holds any, as every script plays. */
function heldBy(state: DuelState, plans: Readonly<Record<Side, SidePlan>>, phases: Readonly<Record<Side, Readonly<{ acted: Acted }>>>): Readonly<{ held?: readonly Coord[] }> {
  const held = SIDES.flatMap((side) => {
    const own = standingOf(state, side)
    const asked = (plans[side].hold ?? []).filter((anchor) => own.some((structure) => structure.anchor.x === anchor.x && structure.anchor.y === anchor.y))
    // And the buildings its actions gave the order to, not already held.
    return [...asked, ...phases[side].acted.held.filter((anchor) => !asked.some((each) => each.x === anchor.x && each.y === anchor.y))]
  })
  return held.length === 0 ? {} : { held: held.map(({ x, y }) => ({ x, y })) }
}

/** The standing buildings both sides' actions changed, and the content id each starts the battle with: what the
 *  opening sets them down as. Nothing when neither side's actions changed one. */
function refitsOf(phases: Readonly<Record<Side, Readonly<{ acted: Acted }>>>): Readonly<{ refits?: readonly Readonly<{ anchor: Coord; contentId: string }>[] }> {
  const refits = SIDES.flatMap((side) => phases[side].acted.refits)
  return refits.length === 0 ? {} : { refits }
}

/** Where a side's arriving units gather: in front of its Nexus, toward the enemy. */
export function musterOf(state: DuelState, side: Side, registry: ContentRegistry): Coord {
  const map = mapOf(state)
  const centre = centreTile(map.nexus[side], registry.get(armyOf(state, side).nexus).footprint)
  return { x: centre.x + facing(map, side) * 4, y: centre.y }
}

/** Where a side's troops head: the enemy's Nexus when it attacks, its own holding ground when it holds. */
function targetOf(state: DuelState, side: Side, stance: SidePlan["stance"], sides: Readonly<Record<Side, ContentRegistry>>): TargetArea {
  const map = mapOf(state)
  if (stance === "hold") return map.hold[side]
  const enemy = other(side)
  const anchor = map.nexus[enemy]
  const footprint = sides[enemy].get(armyOf(state, enemy).nexus).footprint
  const tiles = tilesOf(anchor, footprint)
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 }
}

/** What one side did and suffered in the round, from its phase, the opening, the end and the events. */
function sideReport(
  side: Side,
  phase: Readonly<{ army: DuelArmy; hand: PowerCard[]; pick: PowerCard | null; placed: ReturnType<typeof placeAll>; acted: Acted }>,
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
    ...(phase.acted.took.length === 0 ? {} : { actions: phase.acted.took }),
    refused: phase.placed.refused,
    stance: plan.stance,
    ...(plan.formation === undefined ? {} : { formation: plan.formation }),
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
