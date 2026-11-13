// The opening of a Battle Round written by hand (a sandbox's `start`, src/skirmish/start.ts), as the state the
// kernel starts from. **Validation lives here, not in a later linter** — dimension mismatch,
// unknown legend key, overlapping footprint, and unknown content id all fail loudly, naming the
// offending line and column.

import type { ContentDef, ContentRegistry } from "../../content/index.ts"
import { FIXTURE_REGISTRY, freshEntityFields } from "../../content/index.ts"
import { footprintCentre, tilesOf } from "../../grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../../grid/types.ts"
import { TERRAIN } from "../../grid/types.ts"
import { gameplayRng } from "../../rng/pcg32.ts"
import type { EntityState, MatchState, PlayerId, TargetArea } from "../../state/types.ts"
import { PLAYERS, SCHEMA_VERSION, TICKS_PER_SECOND } from "../../state/types.ts"
import { presetDimensions } from "./presets.ts"
import type { PlacementEntry, BattleOpening } from "./types.ts"

export class OpeningError extends Error {}

/**
 * An opening declares its own grid size — there is no autoscroll, streaming, or chunked geography
 * yet, so an unbounded custom grid isn't a slow map, it's an unbounded per-tick allocation:
 * `OccupancyIndex` sizes four `Int32Array`s to `width * height` and rebuilds them every tick
 * (grid/occupancy.ts). This cap is a declared-mode convention, not a promise about what the
 * engine can render or path across — it exists so a mistyped or exploratory sandbox fails loudly
 * at load time instead of degrading silently, tick after tick. The largest current preset
 * (extra-large-extra-wide, 72x24 = 1728 tiles) has roughly 5x headroom under it; raise it
 * deliberately, with measurements, when a sandbox actually needs to be bigger — see
 * docs/system-design/grid-engine.md ("Scaling toward hundreds or thousands of units").
 */
export const MAX_DECLARED_GRID_TILES = 10_000

function fail(opening: BattleOpening, message: string): never {
  throw new OpeningError(`${opening.id}: ${message}`)
}

function dimensionsOf(opening: BattleOpening): { width: number; height: number } {
  const grid = opening.grid
  const { width, height } = "preset" in grid ? presetDimensions(grid.preset) : grid
  if (!("preset" in grid) && (!Number.isInteger(width) || !Number.isInteger(height))) {
    fail(opening, "grid width and height must be integers")
  }
  if (width * height > MAX_DECLARED_GRID_TILES) {
    fail(
      opening,
      `grid is ${width}x${height} (${width * height} tiles), over the ` +
        `${MAX_DECLARED_GRID_TILES}-tile declared-mode cap — see src/skirmish/opening/open.ts`,
    )
  }
  return { width, height }
}

function checkOverlay(
  opening: BattleOpening,
  rows: readonly string[],
  label: string,
  width: number,
  height: number,
): void {
  if (rows.length !== height) {
    fail(opening, `${label} has ${rows.length} rows; the grid is ${height} tall`)
  }
  rows.forEach((row, y) => {
    if (row.length !== width) {
      fail(
        opening,
        `${label} row ${y + 1} (y=${y}) is ${row.length} characters; the grid is ${width} wide`,
      )
    }
  })
}

export type OpenedBattle = Readonly<{
  opening: BattleOpening
  registry: ContentRegistry
  state: MatchState
}>

export function openBattle(
  opening: BattleOpening,
  options: Readonly<{ registry?: ContentRegistry; seed?: number }> = {},
): OpenedBattle {
  const registry = options.registry ?? FIXTURE_REGISTRY
  const { width, height } = dimensionsOf(opening)

  checkOverlay(opening, opening.terrain, "terrain", width, height)

  // Terrain, row-major from the north-west.
  const tiles: TerrainId[] = []
  opening.terrain.forEach((row, y) => {
    [...row].forEach((character, x) => {
      const terrainId = opening.terrainLegend[character]
      if (terrainId === undefined) {
        fail(
          opening,
          `terrain row ${y + 1}, column ${x + 1} (x=${x},y=${y}) uses "${character}", ` +
            `which the terrain legend does not define`,
        )
      }
      tiles.push(terrainId)
    })
  })
  const grid: GridTerrain = { width, height, tiles }

  // Placements — one block per player, gathered first and only then turned into entities, because
  // **ordinals are assigned in Grid reading order, not in the order the file happens to list the
  // players**. Ordinal is identity and the kernel's one iteration order (state/types.ts), so letting
  // it depend on whether the A block or the B block was typed first would let a purely editorial
  // change move every id, every event, and the state hash with them.
  const placed: Array<{
    player: PlayerId
    entry: PlacementEntry
    definition: ContentDef
    centre: Coord
    anchor: Coord
    where: string
  }> = []

  for (const player of PLAYERS) {
    const block = opening.placements[player]
    if (block === undefined) continue
    const origin = block.at ?? { x: 0, y: 0 }
    if (!Number.isInteger(origin.x) || !Number.isInteger(origin.y)) {
      fail(opening, `placements for player ${player} declare a non-integer origin`)
    }

    block.rows.forEach((row, rowIndex) => {
      [...row].forEach((character, columnIndex) => {
        if (character === " ") return
        const centre = { x: origin.x + columnIndex, y: origin.y + rowIndex }
        // Reported in absolute Grid coordinates as well as the block-relative row and column: the
        // block may be offset, so "row 2, column 3" alone would send a reader to the wrong tile.
        const where =
          `placements for player ${player}, row ${rowIndex + 1}, column ${columnIndex + 1} ` +
          `(x=${centre.x},y=${centre.y})`

        const entry = block.legend[character]
        if (entry === undefined) {
          fail(opening, `${where} uses "${character}", which that player's legend does not define`)
        }
        if (!registry.has(entry.content)) {
          fail(opening, `${where} names the unknown content id "${entry.content}"`)
        }
        const definition = registry.get(entry.content)

        // The symbol marks the entity's **centre tile**, whatever its size; the anchor it is stored
        // under is derived. Authoring a 3x3 walker by its middle is what makes a placement grid
        // still read as one character per unit once units stop being one tile.
        const offset = footprintCentre(definition.footprint)
        const anchor = { x: centre.x - offset.x, y: centre.y - offset.y }

        placed.push({ player, entry, definition, centre, anchor, where })
      })
    })
  }

  // Grid reading order: north to south, then west to east. Two entities may legally share a tile
  // across layers, so the last two keys only exist to make that tie deterministic as well.
  placed.sort(
    (a, b) =>
      a.centre.y - b.centre.y ||
      a.centre.x - b.centre.x ||
      a.player.localeCompare(b.player) ||
      a.definition.id.localeCompare(b.definition.id),
  )

  const entities: EntityState[] = []
  /** Per layer, per tile: who is standing there. Cross-layer sharing is legal, so the layer is a key. */
  const claimed = new Map<string, string>()
  /** Per tile, ignoring layer: which *player* holds it. Two players may never share a tile at all. */
  const heldBy = new Map<string, { player: PlayerId; id: string }>()

  placed.forEach((placement, ordinal) => {
    const { player, entry, definition, anchor, where } = placement
    const id = `${player}:${definition.short}#${ordinal + 1}`

    const hp = entry.hp ?? definition.maxHp
    if (!Number.isInteger(hp) || hp <= 0 || hp > definition.maxHp) {
      fail(
        opening,
        `${where} starts "${entry.content}" at ${hp} health, outside 1..${definition.maxHp}`,
      )
    }

    for (const tile of tilesOf(anchor, definition.footprint)) {
      if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) {
        fail(
          opening,
          `${where}: the footprint of "${entry.content}" reaches (${tile.x},${tile.y}), which is ` +
            `outside the ${width}x${height} Grid`,
        )
      }
      // A ground entity may not start inside terrain it could never walk into. The kernel builds
      // that entity's mask with `terrain: "impassable"` (src/pulse/shared.ts), so a unit placed on
      // rock is entombed from tick zero: it cannot leave the tile, and every tick after that it
      // reports itself blocked. Nothing downstream errors, which is why four units in
      // `citizen-mirror-skirmish` sat inside the eastern rock for the whole of the first battles without
      // anyone noticing. Air ignores terrain, exactly as its mask does.
      if (definition.layer !== "air") {
        const terrainId = tiles[tile.y * width + tile.x]
        if (terrainId !== undefined && TERRAIN[terrainId].impassable) {
          fail(
            opening,
            `${where}: the footprint of "${entry.content}" covers (${tile.x},${tile.y}), which is ` +
              `impassable ${terrainId}. A ground entity cannot start inside terrain it cannot ` +
              `walk into`,
          )
        }
      }

      // Two entities may legally share a tile across layers (a worker and a soldier do), so the
      // placement mask is per layer.
      const key = `${definition.layer}:${tile.x},${tile.y}`
      const occupant = claimed.get(key)
      if (occupant !== undefined) {
        fail(
          opening,
          `${where}: the footprint of "${entry.content}" overlaps ${occupant} at ` +
            `(${tile.x},${tile.y}) on the ${definition.layer} layer`,
        )
      }
      claimed.set(key, id)

      // Cross-layer sharing is a same-side convenience, never a way for two players to start on top
      // of each other. Separate placement blocks make that easy to write by accident — each player's
      // grid is legible on its own, and nothing in one block hints at what the other put there — so
      // it is checked rather than left to the author noticing.
      const tileKey = `${tile.x},${tile.y}`
      const holder = heldBy.get(tileKey)
      if (holder !== undefined && holder.player !== player) {
        fail(
          opening,
          `${where}: the footprint of "${entry.content}" covers (${tile.x},${tile.y}), which ` +
            `player ${holder.player}'s ${holder.id} already holds. Two players may not start on ` +
            `the same tile, even on different layers`,
        )
      }
      heldBy.set(tileKey, { player, id })
    }

    entities.push({
      ordinal,
      id,
      player,
      contentId: definition.id,
      hp,
      anchor,
      // Sides face each other by default: it is a rendering hint, and no rule reads it.
      facing: player === "A" ? "e" : "w",
      ...freshEntityFields(definition),
    })
  })

  const ordinal = entities.length

  if (entities.length === 0) fail(opening, "places no entities")
  if (!Number.isInteger(opening.pulseTicks) || opening.pulseTicks <= 0) {
    fail(opening, `pulseTicks must be a positive integer, received ${opening.pulseTicks}`)
  }

  const seed = options.seed ?? opening.seed
  if (!Number.isInteger(seed)) fail(opening, `seed must be an integer, received ${seed}`)

  const targets = targetsOf(opening, grid)
  const state: MatchState = {
    schemaVersion: SCHEMA_VERSION,
    tick: 0,
    ticksPerSecond: TICKS_PER_SECOND,
    grid,
    entities,
    groundItems: [],
    vacatedTiles: [],
    outcome: null,
    rng: gameplayRng(seed).snapshot(),
    nextOrdinal: ordinal,
    // Only when a side has one: a map with no target loads into exactly the state it always did.
    ...(targets === undefined ? {} : { targets }),
  }

  return { opening, registry, state }
}

/** A map's targets, checked: a side's is a rectangle of whole tiles on the Grid, on ground its units can
 *  stand on. `undefined` when the map gives none. */
function targetsOf(opening: BattleOpening, grid: GridTerrain): MatchState["targets"] {
  const given = opening.targets
  if (given === undefined) return undefined
  const targets: Partial<Record<PlayerId, TargetArea>> = {}
  for (const [side, area] of Object.entries(given)) {
    if (side !== "A" && side !== "B") fail(opening, `targets names the unknown side "${side}"`)
    if (area === undefined) continue
    const { x, y, width, height } = area
    if (![x, y, width, height].every((value) => Number.isInteger(value)) || width < 1 || height < 1) {
      fail(opening, `the target for side ${side} must be whole tiles, at least one wide and tall`)
    }
    if (x < 0 || y < 0 || x + width > grid.width || y + height > grid.height) {
      fail(opening, `the target for side ${side} reaches off the ${grid.width}x${grid.height} Grid`)
    }
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        const terrainId = grid.tiles[row * grid.width + column]
        if (terrainId !== undefined && TERRAIN[terrainId].impassable) {
          fail(opening, `the target for side ${side} covers (${column},${row}), which is impassable ${terrainId}: a target is ground its units can stand on`)
        }
      }
    }
    targets[side] = { x, y, width, height }
  }
  return Object.keys(targets).length === 0 ? undefined : targets
}
