// Semantic ids to glyphs. **The simulation never knows a glyph** (engine.md 9.6) — this is the only
// place the mapping exists, and a renderer never reverse-engineers a glyph back into a mechanic.
//
// Ownership is carried by letter case, never by colour: player A is lower case, player B is upper.
// That is what makes monochrome the floor rather than the degraded mode.

import type { Coord, Footprint, TerrainId } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { StyleRole } from "./roles.ts"

/**
 * Glyph packs — milestone-1-spike-battle.md 4.2 allows an optional Unicode pack alongside the ASCII
 * baseline. The pack changes the **field and the frame**, never the actors: units are letters
 * because case carries ownership and the shape families carry faction (engine.md 9.6,
 * terminal-nexus-lore.md 8), and that system is not improved by prettier symbols.
 *
 * ASCII stays the default and the acceptance target. Everything here is one cell wide.
 */
export type GlyphPack = "ascii" | "unicode"

export const GLYPH_PACKS: readonly GlyphPack[] = ["ascii", "unicode"]

export function parseGlyphPack(value: string): GlyphPack {
  const found = GLYPH_PACKS.find((pack) => pack === value)
  if (found === undefined) {
    throw new Error(`unknown glyph pack "${value}"; expected one of ${GLYPH_PACKS.join(", ")}`)
  }
  return found
}

const TERRAIN_GLYPHS: Readonly<
  Record<GlyphPack, Readonly<Record<TerrainId, { glyph: string; role: StyleRole }>>>
> = {
  ascii: {
    "terrain.plain": { glyph: ".", role: "terrain.plain" },
    "terrain.rock": { glyph: "#", role: "terrain.rock" },
    "terrain.deposit": { glyph: "*", role: "terrain.deposit" },
  },
  unicode: {
    "terrain.plain": { glyph: "·", role: "terrain.plain" },
    "terrain.rock": { glyph: "▓", role: "terrain.rock" },
    "terrain.deposit": { glyph: "◆", role: "terrain.deposit" },
  },
}

/** Frame furniture, the other half of what a pack changes. */
export const CHROME_GLYPHS: Readonly<Record<GlyphPack, Readonly<Record<string, string>>>> = {
  ascii: {
    horizontal: "-",
    vertical: "|",
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    edgeHorizontal: "-",
    edgeVertical: "|",
    edgeCorner: "+",
  },
  unicode: {
    horizontal: "─",
    vertical: "│",
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    edgeHorizontal: "┄",
    edgeVertical: "┆",
    edgeCorner: "·",
  },
}

export function chromeGlyph(pack: GlyphPack, part: string): string {
  return CHROME_GLYPHS[pack][part] ?? "?"
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
  // The Nexus is the visual identity the owner asked to see first, and the one worth the most
  // iteration — this is a first pass, not a final answer. Same 3x2 footprint order as
  // rectFootprint(3, 2): left-to-right on the top row, then left-to-right on the bottom
  // ([0,0] [1,0] [2,0] [0,1] [1,1] [2,1]). Citizen reuses the hauler's bracket language at a larger
  // scale — a domed core over a sealed, bracketed base — rather than inventing a second vocabulary.
  "structure.citizen.nexus": [".", "n", ".", "[", "=", "]"],
  "structure.citizen.barracks": "b",
  // Ravels: angular, forward-leaning, improvised. Their multi-tile body is the raider the lore
  // draws as `>x<`, where the arrowheads say which way the energy is going and the letter carries
  // the side. Same glyph vocabulary as `terminal-nexus-lore.md` Section 8.2.
  "unit.ravel.scav": "s",
  "unit.ravel.runner": "x",
  "unit.ravel.slinger": "z",
  "unit.ravel.fuelwagon": "v",
  "unit.ravel.raider": [">", "x", "<"],
  // The Ravel Nexus: a jagged canopy over exposed arrowheads radiating from a spark, instead of the
  // Citizen Nexus's dome and sealed base - welded, not engineered, and it shows even standing still.
  "structure.ravel.nexus": ["/", "n", "\\", "<", "*", ">"],
  "structure.ravel.den": "d",
}

export function terrainGlyph(
  id: TerrainId,
  pack: GlyphPack = "ascii",
): { glyph: string; role: StyleRole } {
  return TERRAIN_GLYPHS[pack][id]
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

const SALVAGE_GLYPHS: Readonly<Record<GlyphPack, string>> = { ascii: "%", unicode: "▪" }

export function salvageGlyph(pack: GlyphPack = "ascii"): string {
  return SALVAGE_GLYPHS[pack]
}
