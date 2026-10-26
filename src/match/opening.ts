// The state a Battle Round starts from — the start-of-Pulse rule in pulse.md: "At Pulse start plans reveal together and
// valid construction becomes operational." The Build Phase's plan is a list of placements on a screen;
// this is where it becomes entities the kernel can resolve.
//
// It follows the scenario loader's conventions exactly — ids, ordinals in Grid reading order, a
// fresh entity's fields from `freshEntityFields`, sides facing each other — so a Pulse that starts here
// is indistinguishable, to the kernel, from one a `.map.json` file started. What it adds is the two
// things a Build Phase has and a file does not: structures given by an anchor (the way the Build Phase
// stores a placement) rather than by a centre tile in a character grid, and units mustered around a
// point on whatever free tiles the plan left them.
//
// **A later Pulse of a mission starts from what the last one left**: the state after Recall is
// `carried` in, and everything in it keeps its ordinal, id, health and place — a survivor is the same
// unit it was — while the new plan's structures and whatever arrives at tick 0 are added after it, with
// ordinals from where the last Pulse stopped (in Grid reading order among themselves). A carried unit may stand on
// the roof of one of its side's standing buildings, as Recall leaves it; a building the player planned on a tile a
// carried unit stands on moves the unit to the nearest free tile, the same rule a muster point already follows: the
// plan is the player's, and a unit steps aside for it — after everyone who keeps their place, in a fixed order. (The
// Build Phase lets a side build only on its own units, never on an enemy's: `legalityAt`, `src/build/state.ts`.)

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields, productionFields } from "../content/index.ts"
import { gridDistance, inBounds, tileIndex, tilesOf } from "../grid/coords.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { ENTITY_LAYERS, TERRAIN } from "../grid/types.ts"
import { gameplayRng } from "../rng/pcg32.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { SCHEMA_VERSION } from "../state/types.ts"
import { centreTile, enemyNexusMiddle, nearestFit } from "./placement.ts"
import type { PulseSetup, StructurePlacement } from "./types.ts"
import { PulseSetupError } from "./types.ts"

/** How far from its muster point a unit is first looked for room, by the Grid's own distance (`nearestFit`): 12 rows up
 *  and down, 24 columns across. With none there — a base built solid, its ground held by the army standing in front of
 *  it, as a kept front can leave one — the search goes on over the whole Grid; only a Grid with no room anywhere refuses
 *  the Pulse. */
const MUSTER_RADIUS = 24

export type OpeningInput = Readonly<{
  grid: GridTerrain
  registry: ContentRegistry
  /** Each side's own content, when the sides' differ (a duel's: `PulseContext.sides`). Absent: `registry` for both. */
  sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>
  /** Everything newly standing or committed for this Pulse, the player's and anyone else's. */
  structures: readonly StructurePlacement[]
  setup: PulseSetup
  /** The state the last Pulse of a mission left, after Recall — absent for a first Pulse. Its seed,
   *  clock and ground items carry on; `setup.seed` is then not read. */
  carried?: MatchState
  /** The buildings, by anchor, that hold their wave this Pulse (Hold production): they open with every wave of the
   *  Pulse already sent, so they send none. Whichever side's they are (a duel's sides may each hold some); no two
   *  buildings share an anchor. Absent: none. */
  held?: readonly Coord[]
  /** The carried buildings, by anchor, whose content the Build Phase changed — an upgrade bought on one, its mode
   *  switched — and the content id each starts this Pulse with (`fittedId`, `src/content/fitted.ts`): what still
   *  stands is set down as that, its health and its place its own. Absent: none. A new building already carries its
   *  own in `structures`. */
  refits?: readonly Readonly<{ anchor: Coord; contentId: string }>[]
}>

type Placed = Readonly<{
  player: PlayerId
  definition: ContentDef
  anchor: Coord
  /** The entity this was in the carried state, kept whole but for where it stands. */
  carried?: EntityState
  /** Which of `setup.forces` it came from, for a unit that arrived with one. */
  force?: number
}>

/** An opening state, and which force each newly arrived unit came from (by its ordinal) — what the
 *  trigger runner reads to know which group, and which line of intention, a unit belongs to. */
export type Opening = Readonly<{ state: MatchState; forceOf: ReadonlyMap<number, number> }>

/** `carried` with each building a refit names set down as the content id it names — the start-of-Pulse rule: what the
 *  Build Phase changed of a building becomes operational as the Pulse starts. The same state, untouched, for none. */
function refitted(input: OpeningInput): MatchState | undefined {
  const { carried, refits = [] } = input
  if (carried === undefined || refits.length === 0) return carried
  // A building's, never a unit's standing on its roof at the same tile.
  const building = (entity: EntityState): boolean => (input.sides?.[entity.player] ?? input.registry).get(entity.contentId).layer === "obstacles"
  const contentAt = (entity: EntityState): string | undefined =>
    building(entity) ? refits.find((refit) => refit.anchor.x === entity.anchor.x && refit.anchor.y === entity.anchor.y)?.contentId : undefined
  return { ...carried, entities: carried.entities.map((entity) => ({ ...entity, contentId: contentAt(entity) ?? entity.contentId })) }
}

/**
 * The opening `MatchState` for a Pulse. Throws `PulseSetupError`, naming what is wrong, for anything
 * the scenario loader would refuse too: an unknown content id, a footprint off the Grid, a ground
 * entity on rock, two things on one layer overlapping — or a force with no room to stand.
 */
export function openingState(input: OpeningInput): MatchState {
  return opening(input).state
}

/** `openingState`, with which force each new unit came from. */
export function opening(input: OpeningInput): Opening {
  const { grid, structures, setup } = input
  const carried = refitted(input)
  /** The content `player`'s things are defined by. */
  const contentFor = (player: PlayerId): ContentRegistry => input.sides?.[player] ?? input.registry
  if (!Number.isInteger(setup.seed)) throw new PulseSetupError(`seed must be an integer, received ${setup.seed}`)
  if (!Number.isInteger(setup.pulseTicks) || setup.pulseTicks <= 0) {
    throw new PulseSetupError(`pulseTicks must be a positive integer, received ${setup.pulseTicks}`)
  }

  const placed: Placed[] = []
  // Temporary ordinals, only to tell one occupant from another while placing. The real ones are
  // assigned in Grid reading order once everything has a place (below), as the loader does.
  const index = new OccupancyIndex(grid)
  const claim = (
    player: PlayerId,
    definition: ContentDef,
    anchor: Coord,
    where: string,
    from: Readonly<{ carried?: EntityState; force?: number }> = {},
  ): void => {
    for (const tile of tilesOf(anchor, definition.footprint)) {
      if (!inBounds(grid, tile)) {
        throw new PulseSetupError(`${where}: "${definition.id}" reaches (${tile.x},${tile.y}), outside the ${grid.width}x${grid.height} Grid`)
      }
      const terrainId = grid.tiles[tileIndex(grid, tile)]
      if (definition.layer !== "air" && terrainId !== undefined && TERRAIN[terrainId].impassable) {
        throw new PulseSetupError(`${where}: "${definition.id}" covers (${tile.x},${tile.y}), which is impassable ${terrainId}`)
      }
    }
    try {
      index.add(definition.layer, placed.length, anchor, definition.footprint)
    } catch (error) {
      throw new PulseSetupError(`${where}: ${error instanceof Error ? error.message : String(error)}`)
    }
    placed.push({ player, definition, anchor, ...from })
  }

  const known = (player: PlayerId, contentId: string, where: string): ContentDef => {
    const content = contentFor(player)
    if (!content.has(contentId)) throw new PulseSetupError(`${where} names the unknown content id "${contentId}"`)
    return content.get(contentId)
  }
  const definitionOf = (entity: EntityState): ContentDef => contentFor(entity.player).get(entity.contentId)

  /** The nearest room for `footprint` round `around`: within `MUSTER_RADIUS`, else anywhere on the Grid. */
  const roomNear = (mask: ReturnType<typeof maskFrom>, footprint: ContentDef["footprint"], around: Coord, toward: Coord | undefined): Coord | null =>
    nearestFit(mask, footprint, around, MUSTER_RADIUS, around, toward) ?? nearestFit(mask, footprint, around, grid.width + 2 * grid.height, around, toward)

  const unitMask = (definition: ContentDef) =>
    maskFrom(index, { layers: ENTITY_LAYERS, terrain: definition.layer === "air" ? "ignore" : "impassable" })

  // What still stands from the last Pulse goes down first, where it stood.
  const carriedEntities = carried?.entities ?? []
  const isStructure = (entity: EntityState): boolean => definitionOf(entity).layer === "obstacles"
  for (const entity of carriedEntities.filter(isStructure)) {
    claim(entity.player, definitionOf(entity), entity.anchor, `standing ${entity.id}`, { carried: entity })
  }

  structures.forEach((structure, position) => {
    const where = `structure ${position + 1}`
    const definition = known(structure.player ?? "A", structure.contentId, where)
    claim(
      structure.player ?? "A",
      definition,
      structure.anchor,
      `${where} (${structure.contentId} at ${structure.anchor.x},${structure.anchor.y})`,
    )
  })

  // Then the carried units: where they stood — on the roof of one of their side's standing buildings, where Recall
  // brings them home, too — or, a building planned on top of one, the nearest free tile to it.
  // Everyone who still has room where they stood goes down first; then, **in a fixed order**, each one a new building
  // stands on steps out to the nearest free ground: the one nearest the enemy's Nexus first, then the northern, then
  // by ordinal — the same order for either side of a mirrored map, and never onto a place someone kept.
  const displaced: EntityState[] = []
  for (const entity of carriedEntities.filter((candidate) => !isStructure(candidate))) {
    const definition = definitionOf(entity)
    const ownRoofs = maskFrom(index, {
      layers: ENTITY_LAYERS.filter((layer) => layer !== "obstacles"),
      terrain: definition.layer === "air" ? "ignore" : "impassable",
      sideLayers: { layers: ["obstacles"], blocks: (occupant) => placed[occupant]?.carried === undefined || placed[occupant]?.player !== entity.player },
    })
    if (ownRoofs.footprintFits(entity.anchor, definition.footprint)) claim(entity.player, definition, entity.anchor, entity.id, { carried: entity })
    else displaced.push(entity)
  }
  const facingKey = (entity: EntityState): number => {
    const stood = centreTile(entity.anchor, definitionOf(entity).footprint)
    const enemy = enemyNexusMiddle(placed, entity.player, stood)
    return enemy === undefined ? 0 : gridDistance(stood, enemy)
  }
  displaced.sort((a, b) => facingKey(a) - facingKey(b) || a.anchor.y - b.anchor.y || a.ordinal - b.ordinal)
  for (const entity of displaced) {
    const definition = definitionOf(entity)
    const stood = centreTile(entity.anchor, definition.footprint)
    const anchor = roomNear(unitMask(definition), definition.footprint, stood, enemyNexusMiddle(placed, entity.player, stood))
    if (anchor === null) throw new PulseSetupError(`${entity.id}: no room within ${MUSTER_RADIUS} tiles of where it stood`)
    claim(entity.player, definition, anchor, entity.id, { carried: entity })
  }

  // Units are set down after every structure, on tiles no other entity holds: at the start of a Pulse
  // nobody shares a tile, on any layer (the loader's rule for two players, kept for all of them, so a
  // plan can never begin with a unit inside a building). **In turns**, one unit of each force at a time, the
  // forces taking turns in the order given and then in the order reversed, so two forces whose musters meet share
  // the ground between them rather than the first claiming all of it (no side wins by where it stands, pulse.md).
  const turns: Array<Readonly<{ force: (typeof setup.forces)[number]; forceIndex: number; contentId: string; unitIndex: number }>> = []
  const longest = Math.max(0, ...setup.forces.map((force) => force.units.length))
  for (let unitIndex = 0; unitIndex < longest; unitIndex += 1) {
    const order = setup.forces.map((force, forceIndex) => ({ force, forceIndex }))
    if (unitIndex % 2 === 1) order.reverse()
    for (const { force, forceIndex } of order) {
      const contentId = force.units[unitIndex]
      if (contentId !== undefined) turns.push({ force, forceIndex, contentId, unitIndex })
    }
  }
  turns.forEach(({ force, forceIndex, contentId, unitIndex }) => {
    {
      const where = `force ${forceIndex + 1}, unit ${unitIndex + 1}`
      const definition = known(force.player, contentId, where)
      const anchor = roomNear(unitMask(definition), definition.footprint, force.muster, enemyNexusMiddle(placed, force.player, force.muster))
      if (anchor === null) {
        throw new PulseSetupError(
          `${where}: no room for "${contentId}" within ${MUSTER_RADIUS} tiles of (${force.muster.x},${force.muster.y})`,
        )
      }
      claim(force.player, definition, anchor, where, { force: forceIndex })
    }
  })

  if (placed.length === 0) throw new PulseSetupError("the battle would start with nothing on the Grid")

  // Grid reading order: north to south, then west to east, ties by side and then content id — the
  // loader's own order, so an editorial change (which list came first) can never move an id. Only what
  // is new is ordered: a carried entity keeps the ordinal it has always had.
  const fresh = placed.filter((entry) => entry.carried === undefined)
  const ordered = [...fresh].sort((a, b) => {
    const ca = centreTile(a.anchor, a.definition.footprint)
    const cb = centreTile(b.anchor, b.definition.footprint)
    return ca.y - cb.y || ca.x - cb.x || a.player.localeCompare(b.player) || a.definition.id.localeCompare(b.definition.id)
  })

  const firstOrdinal = carried?.nextOrdinal ?? 0
  const forceOf = new Map<number, number>()
  const born: EntityState[] = ordered.map((entry, position) => {
    const ordinal = firstOrdinal + position
    if (entry.force !== undefined) forceOf.set(ordinal, entry.force)
    return {
      ordinal,
      id: `${entry.player}:${entry.definition.short}#${ordinal + 1}`,
      player: entry.player,
      contentId: entry.definition.id,
      hp: entry.definition.maxHp,
      anchor: entry.anchor,
      // Sides face each other by default: a rendering hint, and no rule reads it.
      facing: entry.player === "A" ? "e" : "w",
      ...freshEntityFields(entry.definition),
    }
  })
  const kept: EntityState[] = placed
    .filter((entry) => entry.carried !== undefined)
    // A carried producer starts the Pulse on the recipe this Pulse runs: Recall already set its first wave
    // `firstTicks` away, and this keeps it so when the recipe itself changed between rounds — a building
    // given another wave, or none any more.
    .map((entry) => {
      const { productionCooldown: _cooldown, produced: _produced, owed: _owed, ...entity } = entry.carried as EntityState
      // Never more health than its content now allows: a content changed between rounds may allow less.
      return { ...entity, hp: Math.min(entity.hp, entry.definition.maxHp), anchor: entry.anchor, ...productionFields(entry.definition) }
    })
  const held = input.held ?? []
  const holding = (entity: EntityState): boolean => held.some((anchor) => anchor.x === entity.anchor.x && anchor.y === entity.anchor.y)
  const entities = [...kept, ...born]
    .map((entity) => {
      // A building held this Pulse opens with every wave already sent (a building's action, Hold production).
      const recipe = definitionOf(entity).production
      return recipe !== undefined && holding(entity) ? { ...entity, produced: recipe.waves } : entity
    })
    .sort((a, b) => a.ordinal - b.ordinal)

  const state: MatchState = {
    schemaVersion: SCHEMA_VERSION,
    tick: 0,
    ticksPerSecond: TICKS_PER_SECOND,
    grid,
    entities,
    groundItems: carried?.groundItems ?? [],
    vacatedTiles: [],
    outcome: null,
    rng: carried?.rng ?? gameplayRng(setup.seed).snapshot(),
    nextOrdinal: firstOrdinal + born.length,
  }
  return { state, forceOf }
}
