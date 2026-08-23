// Semantic ids to glyphs. **The simulation never knows a glyph** (engine.md 9.6) — this is the only
// place the mapping exists, and a renderer never reverse-engineers a glyph back into a mechanic.
//
// Ownership is carried by letter case, never by colour: player A is lower case, player B is upper.
// That is what makes monochrome the floor rather than the degraded mode.

import { artFor } from "../content/art.ts"
import type { Coord, TerrainId } from "../grid/types.ts"
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
 * The glyph for one tile of one entity, from the art table in `src/content/art.ts`. Content nobody
 * has drawn falls back to the first letter of the last segment of its id, so a new unit is legible
 * before anyone has drawn it — which is what keeps a test able to place content the art has never
 * heard of.
 */
export function entityGlyph(contentId: string, player: PlayerId, offset: Coord): string {
  const art = artFor(contentId)
  // Indexed by the offset directly rather than by position in the footprint array, so the drawing
  // does not silently depend on the order `rectFootprint` happens to emit tiles in.
  const drawn = art?.[offset.y]?.[offset.x]
  const segments = contentId.split(".")
  const base = drawn ?? (segments[segments.length - 1] ?? "?").slice(0, 1)
  return player === "B" ? base.toUpperCase() : base.toLowerCase()
}

const SALVAGE_GLYPHS: Readonly<Record<GlyphPack, string>> = { ascii: "%", unicode: "▪" }

export function salvageGlyph(pack: GlyphPack = "ascii"): string {
  return SALVAGE_GLYPHS[pack]
}
