// The state a Nexus Pulse starts from — engine.md Section 5: "At Pulse start plans reveal together and
// valid construction becomes operational." The Build Phase's plan is a list of placements on a screen;
// this is where it becomes entities the kernel can resolve.
//
// It follows the scenario loader's conventions exactly — ids, ordinals in Grid reading order, a
// fresh entity's fields from `freshEntityFields`, sides facing each other — so a Pulse that starts here
// is indistinguishable, to the kernel, from one a `.map.json` file started. What it adds is the two
// things a Build Phase has and a file does not: structures given by an anchor (the way the Build Phase
// stores a placement) rather than by a centre tile in a character grid, and units mustered around a
// point on whatever free tiles the plan left them.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields } from "../content/index.ts"
import { footprintCentre, inBounds, tileIndex, tilesOf } from "../grid/coords.ts"
import { OccupancyIndex, maskFrom } from "../grid/occupancy.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { ENTITY_LAYERS, TERRAIN } from "../grid/types.ts"
import { gameplayRng } from "../rng/pcg32.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { SCHEMA_VERSION } from "../state/types.ts"
import { nearestFit } from "./placement.ts"
import type { PulseSetup, StructurePlacement } from "./types.ts"
import { PulseSetupError } from "./types.ts"

/** How far from its muster point a unit may be set down before the Pulse is refused for lack of room. */
export const MUSTER_RADIUS = 12

export type OpeningInput = Readonly<{
  grid: GridTerrain
  registry: ContentRegistry
  /** Everything already standing or committed, the player's and anyone else's. */
  structures: readonly StructurePlacement[]
  setup: PulseSetup
}>

type Placed = Readonly<{ player: PlayerId; definition: ContentDef; anchor: Coord }>

/**
 * The opening `MatchState` for a Pulse. Throws `PulseSetupError`, naming what is wrong, for anything
 * the scenario loader would refuse too: an unknown content id, a footprint off the Grid, a ground
 * entity on rock, two things on one layer overlapping — or a force with no room to stand.
 */
export function openingState(input: OpeningInput): MatchState {
  const { grid, registry, structures, setup } = input
  if (!Number.isInteger(setup.seed)) throw new PulseSetupError(`seed must be an integer, received ${setup.seed}`)
  if (!Number.isInteger(setup.pulseTicks) || setup.pulseTicks <= 0) {
    throw new PulseSetupError(`pulseTicks must be a positive integer, received ${setup.pulseTicks}`)
  }

  const placed: Placed[] = []
  // Temporary ordinals, only to tell one occupant from another while placing. The real ones are
  // assigned in Grid reading order once everything has a place (below), as the loader does.
  const index = new OccupancyIndex(grid)
  const claim = (player: PlayerId, definition: ContentDef, anchor: Coord, where: string): void => {
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
    placed.push({ player, definition, anchor })
  }

  const known = (contentId: string, where: string): ContentDef => {
    if (!registry.has(contentId)) throw new PulseSetupError(`${where} names the unknown content id "${contentId}"`)
    return registry.get(contentId)
  }

  structures.forEach((structure, position) => {
    const where = `structure ${position + 1}`
    const definition = known(structure.contentId, where)
    claim(structure.player ?? "A", definition, structure.anchor, `${where} (${structure.contentId} at ${structure.anchor.x},${structure.anchor.y})`)
  })

  // Units are set down after every structure, on tiles no other entity holds: at the start of a Pulse
  // nobody shares a tile, on any layer (the loader's rule for two players, kept for all of them, so a
  // plan can never begin with a unit inside a building).
  setup.forces.forEach((force, forceIndex) => {
    force.units.forEach((contentId, unitIndex) => {
      const where = `force ${forceIndex + 1}, unit ${unitIndex + 1}`
      const definition = known(contentId, where)
      const mask = maskFrom(index, {
        layers: ENTITY_LAYERS,
        terrain: definition.layer === "air" ? "ignore" : "impassable",
      })
      const anchor = nearestFit(mask, definition.footprint, force.muster, MUSTER_RADIUS)
      if (anchor === null) {
        throw new PulseSetupError(
          `${where}: no room for "${contentId}" within ${MUSTER_RADIUS} tiles of (${force.muster.x},${force.muster.y})`,
        )
      }
      claim(force.player, definition, anchor, where)
    })
  })

  if (placed.length === 0) throw new PulseSetupError("the Pulse places no entities")

  // Grid reading order: north to south, then west to east, ties by side and then content id — the
  // loader's own order, so an editorial change (which list came first) can never move an id.
  const centreOf = (entry: Placed): Coord => {
    const centre = footprintCentre(entry.definition.footprint)
    return { x: entry.anchor.x + centre.x, y: entry.anchor.y + centre.y }
  }
  const ordered = [...placed].sort((a, b) => {
    const ca = centreOf(a)
    const cb = centreOf(b)
    return ca.y - cb.y || ca.x - cb.x || a.player.localeCompare(b.player) || a.definition.id.localeCompare(b.definition.id)
  })

  const entities: EntityState[] = ordered.map((entry, ordinal) => ({
    ordinal,
    id: `${entry.player}:${entry.definition.short}#${ordinal + 1}`,
    player: entry.player,
    contentId: entry.definition.id,
    hp: entry.definition.maxHp,
    anchor: entry.anchor,
    // Sides face each other by default: a rendering hint, and no rule reads it.
    facing: entry.player === "A" ? "e" : "w",
    ...freshEntityFields(entry.definition),
  }))

  return {
    schemaVersion: SCHEMA_VERSION,
    tick: 0,
    ticksPerSecond: TICKS_PER_SECOND,
    grid,
    entities,
    groundItems: [],
    vacatedTiles: [],
    outcome: null,
    rng: gameplayRng(setup.seed).snapshot(),
    nextOrdinal: entities.length,
  }
}
