// The state a Nexus Pulse starts from — the start-of-Pulse rule in pulse.md: "At Pulse start plans reveal together and
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
// ordinals from where the last Pulse stopped (in Grid reading order among themselves). A building the
// player planned on a tile a carried unit stands on moves the unit to the nearest free tile, the same
// rule a muster point already follows: the plan is the player's, and a unit steps aside for it.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields, productionFields } from "../content/index.ts"
import { inBounds, tileIndex, tilesOf } from "../grid/coords.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { ENTITY_LAYERS, TERRAIN } from "../grid/types.ts"
import { gameplayRng } from "../rng/pcg32.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { SCHEMA_VERSION } from "../state/types.ts"
import { centreTile, nearestFit } from "./placement.ts"
import type { PulseSetup, StructurePlacement } from "./types.ts"
import { PulseSetupError } from "./types.ts"

/** How far from its muster point a unit may be set down before the Pulse is refused for lack of room. */
const MUSTER_RADIUS = 12

export type OpeningInput = Readonly<{
  grid: GridTerrain
  registry: ContentRegistry
  /** Everything newly standing or committed for this Pulse, the player's and anyone else's. */
  structures: readonly StructurePlacement[]
  setup: PulseSetup
  /** The state the last Pulse of a mission left, after Recall — absent for a first Pulse. Its seed,
   *  clock and ground items carry on; `setup.seed` is then not read. */
  carried?: MatchState
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
  const { grid, registry, structures, setup, carried } = input
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

  const known = (contentId: string, where: string): ContentDef => {
    if (!registry.has(contentId)) throw new PulseSetupError(`${where} names the unknown content id "${contentId}"`)
    return registry.get(contentId)
  }

  const unitMask = (definition: ContentDef) =>
    maskFrom(index, { layers: ENTITY_LAYERS, terrain: definition.layer === "air" ? "ignore" : "impassable" })

  // What still stands from the last Pulse goes down first, where it stood.
  const carriedEntities = carried?.entities ?? []
  const isStructure = (entity: EntityState): boolean => registry.get(entity.contentId).layer === "obstacles"
  for (const entity of carriedEntities.filter(isStructure)) {
    claim(entity.player, registry.get(entity.contentId), entity.anchor, `standing ${entity.id}`, { carried: entity })
  }

  structures.forEach((structure, position) => {
    const where = `structure ${position + 1}`
    const definition = known(structure.contentId, where)
    claim(
      structure.player ?? "A",
      definition,
      structure.anchor,
      `${where} (${structure.contentId} at ${structure.anchor.x},${structure.anchor.y})`,
    )
  })

  // Then the carried units: where they stood, or — a building planned on top of one — the nearest free
  // tile to it.
  for (const entity of carriedEntities.filter((candidate) => !isStructure(candidate))) {
    const definition = registry.get(entity.contentId)
    const anchor = nearestFit(unitMask(definition), definition.footprint, centreTile(entity.anchor, definition.footprint), MUSTER_RADIUS)
    if (anchor === null) throw new PulseSetupError(`${entity.id}: no room within ${MUSTER_RADIUS} tiles of where it stood`)
    claim(entity.player, definition, anchor, entity.id, { carried: entity })
  }

  // Units are set down after every structure, on tiles no other entity holds: at the start of a Pulse
  // nobody shares a tile, on any layer (the loader's rule for two players, kept for all of them, so a
  // plan can never begin with a unit inside a building).
  setup.forces.forEach((force, forceIndex) => {
    force.units.forEach((contentId, unitIndex) => {
      const where = `force ${forceIndex + 1}, unit ${unitIndex + 1}`
      const definition = known(contentId, where)
      const anchor = nearestFit(unitMask(definition), definition.footprint, force.muster, MUSTER_RADIUS)
      if (anchor === null) {
        throw new PulseSetupError(
          `${where}: no room for "${contentId}" within ${MUSTER_RADIUS} tiles of (${force.muster.x},${force.muster.y})`,
        )
      }
      claim(force.player, definition, anchor, where, { force: forceIndex })
    })
  })

  if (placed.length === 0) throw new PulseSetupError("the Pulse places no entities")

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
    // A carried producer starts the Pulse on the recipe this Pulse runs: Recall already set it to a full
    // interval, and this keeps it so when the recipe itself changed between rounds (an Experiment did).
    .map((entry) => {
      const { productionCooldown: _cooldown, produced: _produced, ...entity } = entry.carried as EntityState
      return { ...entity, anchor: entry.anchor, ...productionFields(entry.definition) }
    })
  const entities = [...kept, ...born].sort((a, b) => a.ordinal - b.ordinal)

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
