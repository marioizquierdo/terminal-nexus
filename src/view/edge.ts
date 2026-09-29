// The map's own edge — the sides of the Grid rectangle that have reached the end of the map — in each
// style a map may name (feedback F25; the owner's choice of 2026-09-29: "using map-specific borders
// looks a lot better! Even in ascii mode, the rugged border style applied to the UI border when
// reaching the map edge is an awesome UI touch").
//
// **One rule holds for every style: the same weight on all four sides.** A style is a glyph for each
// place on the rectangle — its four sides and four corners — or, for the line styles, a junction worked
// out from which way each line runs and how heavy it is, so a heavy side meets the frame's light rules
// in a real mixed-weight junction rather than a line running past them. Every style means the same
// thing in both glyph packs: where the ASCII pack has no glyph for a style it falls back to the solid
// bar (an inverse-video cell), which is the same weight in both directions (Q56).
//
// Colour is a role, never a colour (engine.md 9.1): the edge is always `chrome.edge`, a quieter role
// of its own between the frame and the ground in each theme (F25: "the border color should probably
// be less accentuated" — the owner kept it after trying the frame's own colour and a dimmed one).

import type { MapEdgeStyle } from "../build/types.ts"
import type { DrawExtra } from "./draw.ts"
import type { StyleRole } from "./roles.ts"
import type { GlyphPack } from "./theme.ts"

/** How a frame line leaves a cell in one direction: not at all, as the frame's light line, or as the
 *  map's edge. */
export type ArmWeight = 0 | 1 | 2

/** A cell's four arms, north, south, east and west. */
export type Arms = Readonly<{ n: ArmWeight; s: ArmWeight; e: ArmWeight; w: ArmWeight }>

/** Where on the Grid rectangle an edge cell is: along one side, or on a corner where two edges meet. */
export type EdgePlace = "north" | "south" | "west" | "east" | "nw" | "ne" | "sw" | "se"

export type EdgeCell = Readonly<{ glyph: string; role: StyleRole; extra: DrawExtra }>

/**
 * Box-drawing junctions by their arms, as `n s e w` with `0` none, `l` light and `h` heavy (or `d`
 * double) — every light/heavy combination Unicode has, and the light/double ones it has (fewer: a
 * double line cannot meet a light one from every side). Generated from the Unicode character names
 * (U+2500-U+257F), so none is placed by hand.
 */
function junctionTable(entries: string): Readonly<Record<string, string>> {
  const table: Record<string, string> = {}
  for (const entry of entries.split(" ")) table[entry.slice(0, 4)] = entry.slice(5)
  return table
}

const HEAVY_JUNCTIONS = junctionTable(
  "00hh:━ 00ll:─ 00hl:╼ 00lh:╾ hl00:╿ lh00:╽ 0h0h:┓ 0h0l:┒ 0hh0:┏ 0hhh:┳ 0hhl:┲ 0hl0:┎ 0hlh:┱ 0hll:┰ " +
    "0l0h:┑ 0l0l:┐ 0lh0:┍ 0lhh:┯ 0lhl:┮ 0ll0:┌ 0llh:┭ 0lll:┬ h00h:┛ h00l:┚ h0h0:┗ h0hh:┻ h0hl:┺ " +
    "h0l0:┖ h0lh:┹ h0ll:┸ hh00:┃ hh0h:┫ hh0l:┨ hhh0:┣ hhhh:╋ hhhl:╊ hhl0:┠ hhlh:╉ hhll:╂ hl0h:┩ " +
    "hl0l:┦ hlh0:┡ hlhh:╇ hlhl:╄ hll0:┞ hllh:╃ hlll:╀ l00h:┙ l00l:┘ l0h0:┕ l0hh:┷ l0hl:┶ l0l0:└ " +
    "l0lh:┵ l0ll:┴ lh0h:┪ lh0l:┧ lhh0:┢ lhhh:╈ lhhl:╆ lhl0:┟ lhlh:╅ lhll:╁ ll00:│ ll0h:┥ ll0l:┤ " +
    "llh0:┝ llhh:┿ llhl:┾ lll0:├ lllh:┽ llll:┼",
)

const DOUBLE_JUNCTIONS = junctionTable(
  "00dd:═ 00ll:─ 0d0d:╗ 0d0l:╖ 0dd0:╔ 0ddd:╦ 0dl0:╓ 0dll:╥ 0l0d:╕ 0l0l:┐ 0ld0:╒ 0ldd:╤ 0ll0:┌ " +
    "0lll:┬ d00d:╝ d00l:╜ d0d0:╚ d0dd:╩ d0l0:╙ d0ll:╨ dd00:║ dd0d:╣ dd0l:╢ ddd0:╠ dddd:╬ ddl0:╟ " +
    "ddll:╫ l00d:╛ l00l:┘ l0d0:╘ l0dd:╧ l0l0:└ l0ll:┴ ll00:│ ll0d:╡ ll0l:┤ lld0:╞ lldd:╪ lll0:├ " +
    "llll:┼",
)

function armKey(arms: Arms, heavy: "h" | "d"): string {
  const one = (weight: ArmWeight): string => (weight === 0 ? "0" : weight === 1 ? "l" : heavy)
  return one(arms.n) + one(arms.s) + one(arms.e) + one(arms.w)
}

/** The straight run for a place: horizontal along the north and south sides, vertical otherwise. */
function straight(place: EdgePlace, horizontal: string, vertical: string): string {
  return place === "north" || place === "south" ? horizontal : vertical
}

/**
 * The line styles' junction. A double line meets a light one only along one axis in Unicode, so a
 * combination it lacks is drawn with its light arms doubled too (the double corner a light rule runs
 * into), and failing that as the straight double run.
 */
function lineJunction(arms: Arms, place: EdgePlace, style: "heavy" | "double"): string {
  if (style === "heavy") return HEAVY_JUNCTIONS[armKey(arms, "h")] ?? straight(place, "━", "┃")
  const exact = DOUBLE_JUNCTIONS[armKey(arms, "d")]
  if (exact !== undefined) return exact
  const promoted: Arms = {
    n: arms.n === 0 ? 0 : 2,
    s: arms.s === 0 ? 0 : 2,
    e: arms.e === 0 ? 0 : 2,
    w: arms.w === 0 ? 0 : 2,
  }
  return DOUBLE_JUNCTIONS[armKey(promoted, "d")] ?? straight(place, "═", "║")
}

/** Half blocks on the map's side of the cell, and the quadrant where two meet — so the edge is half
 *  as thick as the solid bar and hugs the map rather than the menu or the bars. */
const HALF_BLOCKS: Readonly<Record<EdgePlace, string>> = {
  north: "▄",
  south: "▀",
  west: "▐",
  east: "▌",
  nw: "▗",
  ne: "▖",
  sw: "▝",
  se: "▘",
}

/**
 * The glyph and look of one cell of the map's edge.
 *
 * `phase` is the cell's position along its side in map columns (north and south) or rows (west and
 * east), counted from the map's own corner, so a patterned style — the fence's posts — is fixed to the
 * map and scrolls with it rather than crawling over it.
 */
export function edgeCell(
  pack: GlyphPack,
  style: MapEdgeStyle,
  arms: Arms,
  place: EdgePlace,
  phase: number,
): EdgeCell {
  const role: StyleRole = "chrome.edge"
  const solid: EdgeCell = { glyph: " ", role, extra: { inverse: true } }
  const glyph = (value: string): EdgeCell => ({ glyph: value, role, extra: {} })

  if (style === "solid") return solid
  if (pack === "ascii") {
    // ASCII has no half block, no heavier line of equal weight both ways (Q56), and no double
    // vertical: those styles are the solid bar there. A shade and a fence have honest ASCII forms.
    if (style === "shade") return glyph(":")
    if (style === "fence") {
      // Posts on the ground lattice's own spacing (every fourth column, every second row), and at
      // every corner and every place another line meets the fence.
      const junction = place.length === 2 || arms.n === 1 || arms.s === 1 || arms.e === 1 || arms.w === 1
      if (junction) return glyph("+")
      const horizontal = place === "north" || place === "south"
      const spacing = horizontal ? 4 : 2
      return glyph(((phase % spacing) + spacing) % spacing === 0 ? "+" : horizontal ? "-" : "|")
    }
    return solid
  }
  switch (style) {
    case "half":
      return glyph(HALF_BLOCKS[place])
    case "shade":
      return glyph("░")
    case "heavy":
    case "double":
      return glyph(lineJunction(arms, place, style))
    case "fence": {
      // A dashed heavy line on the straight runs; a real heavy junction where it meets anything.
      const run = arms.n === 0 && arms.s === 0 ? "━" : arms.e === 0 && arms.w === 0 ? "┃" : null
      const straightRun = run !== null && (run === "━" ? arms.e === 2 && arms.w === 2 : arms.n === 2 && arms.s === 2)
      if (straightRun) return glyph(run === "━" ? "┅" : "┇")
      return glyph(lineJunction(arms, place, "heavy"))
    }
  }
}
