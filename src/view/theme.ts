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

/** Frame furniture, the other half of what a pack changes. Every pack draws every part the ASCII pack
 *  names (`ChromePart`): `chromeGlyph` refuses to compile otherwise. */
export const CHROME_GLYPHS = {
  ascii: {
    horizontal: "-",
    vertical: "|",
    topLeft: "+",
    topRight: "+",
    bottomLeft: "+",
    bottomRight: "+",
    // Where two frame lines meet partway along one of them: named for the direction the stem
    // points, so `teeRight` is the left border's junction with a rule running right from it.
    teeRight: "+",
    teeLeft: "+",
    teeDown: "+",
    teeUp: "+",
    cross: "+",
    edgeHorizontal: "-",
    edgeVertical: "|",
    edgeCorner: "+",
    // A side of the Build Phase's Grid pane with more Grid beyond it: the frame's own line, drawn dim
    // by the caller — one unbroken rectangle, never the ground lattice's `.`, whose dotted edge read as
    // "arbitrary" (gate 5C). A side where the map ends is the map's own edge style (`edge.ts`).
    softHorizontal: "-",
    softVertical: "|",
    // A popup's shadow, drawn dim: a blank cell vanished against the dark theme's near-black ground
    // (feedback F17), so the shadow is a shade, which reads on either theme and in monochrome.
    shadow: ":",
    // A popup's scroll bar, in its right border (feedback F36): the two ends, and the thumb — the part
    // of the list in view — textured on the plain border that is its track (F78). Drawn inverse, as the
    // border is. Never the shadow's glyph: a track in the shadow's texture read as more shadow.
    scrollUp: "^",
    scrollDown: "v",
    scrollThumb: "#",
    // The focus arrow (feedback F54): its head, pointing the way it flies, and the trail behind it,
    // along the line it flies — level, upright, falling to the right (`\`) or rising to it (`/`).
    arrowRight: ">",
    arrowLeft: "<",
    arrowDown: "v",
    arrowUp: "^",
    trailLevel: "-",
    trailUpright: "|",
    trailFall: "\\",
    trailRise: "/",
  },
  unicode: {
    horizontal: "─",
    vertical: "│",
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    teeRight: "├",
    teeLeft: "┤",
    teeDown: "┬",
    teeUp: "┴",
    cross: "┼",
    edgeHorizontal: "┄",
    edgeVertical: "┆",
    edgeCorner: "·",
    softHorizontal: "─",
    softVertical: "│",
    shadow: "░",
    scrollUp: "▲",
    scrollDown: "▼",
    scrollThumb: "╬",
    arrowRight: "▶",
    arrowLeft: "◀",
    arrowDown: "▼",
    arrowUp: "▲",
    trailLevel: "━",
    trailUpright: "┃",
    trailFall: "╲",
    trailRise: "╱",
  },
} as const satisfies Readonly<Record<GlyphPack, Readonly<Record<string, string>>>>

/** A part of the frame furniture, by the name every glyph pack draws it under. */
export type ChromePart = keyof (typeof CHROME_GLYPHS)["ascii"]

export function chromeGlyph(pack: GlyphPack, part: ChromePart): string {
  return CHROME_GLYPHS[pack][part]
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
