// Semantic ids to glyphs. **The simulation never knows a glyph** (engine.md 9.6) — this is the only
// place the mapping exists, and a renderer never reverse-engineers a glyph back into a mechanic.
//
// Ownership is carried by letter case, never by colour: player A is lower case, player B is upper.
// That is what makes monochrome the floor rather than the degraded mode.

import type { Coord, Footprint, TerrainId } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { StyleRole } from "./roles.ts"

const TERRAIN_GLYPHS: Readonly<Record<TerrainId, { glyph: string; role: StyleRole }>> = {
  "terrain.plain": { glyph: ".", role: "terrain.plain" },
  "terrain.rock": { glyph: "#", role: "terrain.rock" },
  "terrain.deposit": { glyph: "*", role: "terrain.deposit" },
}

/**
 * Per-content glyphs. A multi-tile entity may name one glyph per footprint tile, in footprint
 * order — the hauler's `( h )` is one unit spanning three cells, and each cell is still exactly one
 * character wide.
 */
const CONTENT_GLYPHS: Readonly<Record<string, string | readonly string[]>> = {
  // Citizens: rounded, contained, engineered. Their multi-tile body is bracketed — `(h)` — which
  // reads as a chassis holding something.
  "unit.citizen.worker": "w",
  "unit.citizen.trooper": "t",
  "unit.citizen.marksman": "m",
  "unit.citizen.hauler": ["(", "h", ")"],
  "structure.citizen.nexus": "n",
  "structure.citizen.barracks": "b",
  // Ravels: angular, forward-leaning, improvised. Their multi-tile body is the raider the lore
  // draws as `>x<`, where the arrowheads say which way the energy is going and the letter carries
  // the side. Same glyph vocabulary as `terminal-nexus-lore.md` Section 8.2.
  "unit.ravel.scav": "s",
  "unit.ravel.runner": "x",
  "unit.ravel.slinger": "z",
  "unit.ravel.fuelwagon": "v",
  "unit.ravel.raider": [">", "x", "<"],
  "structure.ravel.den": "d",
}

export function terrainGlyph(id: TerrainId): { glyph: string; role: StyleRole } {
  return TERRAIN_GLYPHS[id]
}

export function playerRole(player: PlayerId): StyleRole {
  return player === "A" ? "player.a" : "player.b"
}

/**
 * The glyph for one tile of one entity. Content with no entry falls back to the first letter of the
 * last segment of its id, so a new unit is legible before anyone has drawn it — which is what keeps
 * a test able to place an entity the theme has never heard of.
 */
export function entityGlyph(
  contentId: string,
  player: PlayerId,
  footprint: Footprint,
  offset: Coord,
): string {
  const entry = CONTENT_GLYPHS[contentId]
  let base: string
  if (Array.isArray(entry)) {
    const index = footprint.findIndex((tile) => tile.x === offset.x && tile.y === offset.y)
    base = entry[index === -1 ? 0 : index % entry.length] ?? "?"
  } else if (typeof entry === "string") {
    base = entry
  } else {
    const segments = contentId.split(".")
    base = (segments[segments.length - 1] ?? "?").slice(0, 1)
  }
  return player === "B" ? base.toUpperCase() : base.toLowerCase()
}

export const SALVAGE_GLYPH = "%"
