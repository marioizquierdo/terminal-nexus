// ***The raid in the panel***: the coming raid, said in the side panel's free rows between the buildings
// and Start Battle Round, so a player reads it without looking for it (the owner: "reading the enemy intent is
// very important for basic ui/ux interaction"). Under when it comes — as the round starts, or so many
// seconds in — each group says how many and from where, of what, and what it goes for first:
//
//   AS THE ROUND STARTS
//   13 from the north-east
//     6 runners, 4 raiders,
//     3 slingers
//     goes for your Turret
//
// Information, not a menu row: nothing here is a choice, so the keyboard never lands on it and a click on it
// does nothing (`menuEntryAt` knows no such row). Plain words sized to the panel at 80 x 24, never a cut
// word; where the panel has fewer free rows (a longer menu), the kinds go first, then whole groups, and the
// last line says how many groups the panel had no room for. What a group goes for is the kernel's own first
// choice on the plan as it stands (`BuildSession.raid`), so the words change with the plan, as the trail
// and the mark on the map do (`drawRaidIntent`).

import { CREDITS_ROW, constructLines, startRow } from "../build/layout.ts"
import type { BuildLayout } from "../build/layout.ts"
import type { TileWidth } from "../build/camera.ts"
import type { BuildContext } from "../build/state.ts"
import { nexusTile } from "../build/state.ts"
import { cardText, counted } from "../build/card.ts"
import type { RaidForecast, RaidGroup, RaidTarget } from "../build/types.ts"
import type { Coord } from "../grid/types.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { text, wrapWords } from "./draw.ts"
import type { StyleRole } from "./roles.ts"
import { playerRole } from "./theme.ts"
import type { BuildCompositionInput } from "./build.ts"
import { isTroops, troopsIn } from "./troops-post.ts"
import type { TroopsGroup } from "./troops-post.ts"

/** One run of a line's words, in its own role and weight. */
export type RaidPart = Readonly<{ text: string; role: StyleRole; bold?: boolean }>

/** One line of the raid's words: how far in it starts, and its parts in order. */
export type RaidLine = Readonly<{ indent: number; parts: readonly RaidPart[] }>

/** How far under a group's first line its kinds and its target are set. */
const INDENT = 2

/** What a group's last line says before what it goes for first. */
const GOES_FOR = "goes for "

/** The panel rows the raid may use: from the second row under the last building (a blank row between) to
 *  the second row above Start Battle Round (a blank row before it) — or `null` when the menu leaves none. */
export function raidRows(layout: BuildLayout, catalog: BuildContext["catalog"]): Readonly<{ first: number; last: number }> | null {
  const lines = constructLines(layout, catalog)
  // A menu cut short by the panel's height has no room under it.
  if (lines.length < catalog.length) return null
  const lastBuilding = lines.at(-1)?.row ?? layout.panelRow + CREDITS_ROW
  const first = lastBuilding + 2
  const last = startRow(layout) - 2
  return last >= first ? { first, last } : null
}

/** The eight points of the compass, as a player reads them, from east turning north. */
const BEARINGS = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"] as const

/**
 * Where `to` lies from `from`, as one of the eight points of the compass, **as the map is seen**: a terminal
 * cell is about twice as tall as it is wide, so where a tile is one column (`tileWidth`, as at 80 x 24) a row
 * weighs as two tiles across, and where a tile is two columns wide (square tiles, or 128 columns and wider) a
 * row is as tall as a tile is wide and weighs one. So at one column a tile the ridge at the top right of
 * PERIMETER's map is to the north-east of the Nexus, and the flats level with it to the east.
 */
export function bearing(from: Coord, to: Coord, tileWidth: TileWidth = 1): string {
  const angle = Math.atan2(-(to.y - from.y) * rowWeight(tileWidth), to.x - from.x)
  const sector = (Math.round(angle / (Math.PI / 4)) + 8) % 8
  return BEARINGS[sector] ?? "east"
}

/** How many tiles across a row is as tall as, on screen: two where a tile is one column, one where it is two. */
function rowWeight(tileWidth: TileWidth): number {
  return 2 / tileWidth
}

/** What a group goes for, as the panel names it: a building as the menu does ("your Barracks", "your
 *  Nexus"), a unit as the kinds are counted ("your trooper"), a Commander by her name ("Vasse"). */
export function targetName(context: Pick<BuildContext, "registry">, target: RaidTarget): string {
  const definition = context.registry.get(target.contentId)
  const title = cardText(context, target.contentId).title
  if (definition.commander === true) return title
  const name = definition.nexus === true ? "Nexus" : definition.layer === "obstacles" ? title : title.toLowerCase()
  return target.player === "A" ? `your ${name}` : `the raid's ${name}`
}

/** A group's kinds as lines of at most `width` glyphs, never breaking a count from its kind:
 *  "6 runners, 4 raiders," then "3 slingers". */
function kindLines(context: Pick<BuildContext, "registry">, units: RaidGroup["units"], width: number): string[] {
  const items = units.map((entry, index) => `${counted(context, entry.contentId, entry.count)}${index < units.length - 1 ? "," : ""}`)
  const lines: string[] = []
  for (const item of items) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + item.length <= width) lines[lines.length - 1] = `${last} ${item}`
    else lines.push(item)
  }
  return lines
}

/** When a group comes, as its heading says it. */
export function whenHeading(tick: number): string {
  const seconds = Math.round(tick / TICKS_PER_SECOND)
  if (tick === 0) return "AS THE ROUND STARTS"
  return seconds === 1 ? "1 SECOND IN" : `${seconds} SECONDS IN`
}

/** One group's lines: how many and from where (as the map is seen at `tileWidth`), of what (when `kinds`), and
 *  what it goes for first. */
function groupLines(
  context: Pick<BuildContext, "registry">,
  group: RaidGroup,
  from: Coord,
  width: number,
  kinds: boolean,
  tileWidth: TileWidth,
): RaidLine[] {
  const side = playerRole(group.player)
  const count = group.units.reduce((sum, entry) => sum + entry.count, 0)
  const lines: RaidLine[] = [
    { indent: 0, parts: [{ text: String(count), role: side, bold: true }, { text: ` from the ${bearing(from, group.centre, tileWidth)}`, role: side }] },
  ]
  if (kinds) {
    for (const words of kindLines(context, group.units, width - INDENT)) lines.push({ indent: INDENT, parts: [{ text: words, role: "chrome.value" }] })
  }
  if (group.target !== null) {
    const name: RaidPart = { text: targetName(context, group.target), role: playerRole(group.target.player), bold: true }
    // A name too long to follow "goes for" on one line goes under it, so no word is cut.
    if (INDENT + GOES_FOR.length + name.text.length <= width) {
      lines.push({ indent: INDENT, parts: [{ text: GOES_FOR, role: "chrome.label" }, name] })
    } else {
      lines.push({ indent: INDENT, parts: [{ text: GOES_FOR.trimEnd(), role: "chrome.label" }] }, { indent: INDENT * 2, parts: [name] })
    }
  }
  return lines
}

/** Every line of the raid at a level of detail: a heading for each moment something comes, its groups under it. */
function linesAt(
  context: Pick<BuildContext, "registry">,
  raid: RaidForecast,
  from: Coord,
  width: number,
  kinds: boolean,
  tileWidth: TileWidth,
): RaidLine[][] {
  // One block a group, its moment's heading leading the first group to come at that moment.
  const blocks: RaidLine[][] = []
  let heading: number | null = null
  for (const group of [...raid].sort((a, b) => a.tick - b.tick)) {
    const block: RaidLine[] = []
    if (group.tick !== heading) {
      heading = group.tick
      block.push({ indent: 0, parts: [{ text: whenHeading(group.tick), role: "chrome.label" }] })
    }
    block.push(...groupLines(context, group, from, width, kinds, tileWidth))
    blocks.push(block)
  }
  return blocks
}

/** What the troops' line says they do: "6 head for the line". */
const HEAD_FOR = " head for "

/**
 * ***Your troops' target*** in the panel (`troops-post.ts`): under the raid, where the player's troops head as
 * the battle starts, in the raid's voice — how many, those standing and those the round's waves will bring
 * (`TroopsIntent`, `src/match/intent.ts`), then the place, by the name the level gives it:
 *
 *   YOUR TROOPS
 *   10 head for the line
 *
 * A name too long to follow on one line goes under it, wrapped at words, so no word is cut. Where it is, not
 * the way there: that is the battle's to show.
 */
export function troopsLines(troops: TroopsGroup, width: number): RaidLine[] {
  const side = playerRole(troops.player)
  const count = troops.units.reduce((sum, entry) => sum + entry.count, 0)
  const place: RaidPart = { text: troops.post.name, role: side, bold: true }
  // With nobody to send, none standing and no wave coming, the line still names the place.
  const lead: RaidPart[] = count === 0 ? [{ text: HEAD_FOR.trimStart(), role: side }] : [{ text: String(count), role: side, bold: true }, { text: HEAD_FOR, role: side }]
  const lines: RaidLine[] = [{ indent: 0, parts: [{ text: "YOUR TROOPS", role: "chrome.label" }] }]
  const leadLength = lead.reduce((sum, part) => sum + part.text.length, 0)
  if (leadLength + place.text.length <= width) {
    lines.push({ indent: 0, parts: [...lead, place] })
    return lines
  }
  lines.push({ indent: 0, parts: lead.map((part, index) => (index === lead.length - 1 ? { ...part, text: part.text.trimEnd() } : part)) })
  for (const words of wrapWords(place.text, width - INDENT)) lines.push({ indent: INDENT, parts: [{ ...place, text: words }] })
  return lines
}

/**
 * The raid's lines for `room` rows of `width` glyphs, and under them where the player's troops head, when the
 * level names a target for them. The raid's groups come with their kinds when they fit; else without them (the
 * Explore Map card over any of its units still names them). The troops' lines follow, after a blank line when
 * there is room for it — but never at the cost of a whole group of the raid: when the raid would have to leave
 * one out to make room for them, the troops' lines are left out instead, and the raid shows the groups that fit
 * whole and a last line saying how many more there are. Measured from `from`, the player's Nexus, as the map is
 * seen with tiles `tileWidth` columns wide (`bearing`).
 */
export function raidLines(
  context: Pick<BuildContext, "registry">,
  forecast: RaidForecast,
  from: Coord,
  width: number,
  room: number,
  tileWidth: TileWidth = 1,
): RaidLine[] {
  const troops = troopsIn(forecast)
  const raid = forecast.filter((group) => !isTroops(group))
  const own = troops === null ? [] : troopsLines(troops, width)
  if (raid.length === 0) return own.length <= room ? own : []
  // The fewest rows the raid takes with every group whole: without its kinds.
  const least = linesAt(context, raid, from, width, false, tileWidth).flat().length
  for (const gap of own.length === 0 ? [] : [1, 0]) {
    const left = room - own.length - gap
    if (least > left) continue
    return [...raidOnly(context, raid, from, width, left, tileWidth), ...Array.from({ length: gap }, () => ({ indent: 0, parts: [] })), ...own]
  }
  return raidOnly(context, raid, from, width, room, tileWidth)
}

/** The raid's own lines, as `raidLines` lays them out. */
function raidOnly(context: Pick<BuildContext, "registry">, raid: RaidForecast, from: Coord, width: number, room: number, tileWidth: TileWidth): RaidLine[] {
  for (const kinds of [true, false]) {
    const lines = linesAt(context, raid, from, width, kinds, tileWidth).flat()
    if (lines.length <= room) return lines
  }
  const blocks = linesAt(context, raid, from, width, false, tileWidth)
  const shown: RaidLine[] = []
  let left = blocks.length
  for (const block of blocks) {
    if (shown.length + block.length > room - 1) break
    shown.push(...block)
    left -= 1
  }
  if (room > 0) shown.push({ indent: 0, parts: [{ text: `+${left} more group${left === 1 ? "" : "s"}`, role: "chrome.muted" }] })
  return shown.slice(0, Math.max(0, room))
}

/** The raid in the side panel's free rows, under the menu — nothing when the round brings none, or the menu
 *  leaves no room. One column in from the divider, as the panel's prose is; where from as the map is drawn. */
export function drawRaidPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, layout, raid } = input
  if (raid === undefined || raid.length === 0) return
  const rows = raidRows(layout, context.catalog)
  if (rows === null) return
  const from = nexusTile(context) ?? { x: Math.floor(context.grid.width / 2), y: Math.floor(context.grid.height / 2) }
  const width = layout.panelLimit - 1
  raidLines(context, raid, from, width, rows.last - rows.first + 1, layout.tileWidth).forEach((line, index) => {
    let at = layout.panelColumn + line.indent
    for (const part of line.parts) {
      const limit = layout.panelColumn + width - at
      text(cells, BANDS.chrome, at, rows.first + index, part.text, part.role, { limit, ...(part.bold === true ? { bold: true } : {}) })
      at += part.text.length
    }
  })
}
