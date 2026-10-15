// ***The Commander's moments*** — how the screen makes her stand out without a panel of her own (the owner,
// 2026-10-14: "the commander is just another unit ... So I suggest highlighting the commander in different ways"):
//
// - **She appears.** As a level begins, and the round the Nexus Pulse restores her, she is not on the map as the
//   Build Phase opens: a moment later (`APPEAR.delayMs`) the Nexus sets her down — a ring of her side's colour closes
//   on her tile, she flashes in at full strength — and she says a line of her own beside her (`appears`, or
//   `restored`), unless the round's scene opens on her speaking already.
// - **She falls.** A small window opens beside where she fell, over the battle, like a comic's panel: her portrait,
//   her face changing as she falls (her army's `portraitFalls`), then the whole of it evaporating (`VIGNETTE`).
//   A window, not an effect: like a popup it is drawn over the map, so it is small, short and placed where it covers
//   least of the fight.
// - **She is out.** A dim `@` — her own glyph, nothing else — on the free tile nearest her side's Grid Nexus: in a
//   Build Phase she sits out, and in a Battle Round from the moment she falls.
// - **She is explored.** Explore Map on her lights a ring round her, as the dialog's focus does, and her card shows
//   her portrait (`build-card.ts`).
//
// Every one is a pure function of what the screen already has — the context, a Battle Round's frame — and of a
// presentation clock the live loop hands in. Still frames (tests, the scripted playtest's Build Phase) show each
// finished: she stands where she is, her line said. Nothing here is a rule: when she falls and when she is back are
// the match layer's (`src/match/commander.ts`).

import { ARMIES } from "../armies/index.ts"
import type { BarkMoment } from "../armies/barks.ts"
import { quoted } from "../armies/barks.ts"
import { visibleRange } from "../build/camera.ts"
import type { Camera, Viewport } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { cellForTile } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { cardShowing, nexusTile } from "../build/state.ts"
import { gridDistance, inBounds, tilesOf } from "../grid/coords.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put } from "./draw.ts"
import type { ColorDepth } from "./roles.ts"
import { chromeGlyph, entityGlyph, playerRole } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"
import { cosmeticHash, cosmeticUnit } from "./effects/random.ts"
import { lineLength, pickLine } from "./pulse-voice.ts"
import type { BuildCompositionInput } from "./build.ts"
import { drawLightAround } from "./build-dialog.ts"

/** The player's Commander as her army has her: her unit, her name, her portrait and the frames of her fall, and her
 *  lines for appearing and being restored. `null` for a unit no army leads. */
export type CommanderArt = Readonly<{
  contentId: string
  name: string
  portrait: readonly string[]
  falls: readonly (readonly string[])[]
  lines: Readonly<Partial<Record<BarkMoment, readonly string[]>>>
}>

/** Her art, from the armies the game ships. */
export function commanderArt(contentId: string): CommanderArt | null {
  const commander = ARMIES.commanders.find((entry) => entry.unit === contentId)
  if (commander === undefined) return null
  return { contentId, name: commander.name, portrait: commander.portrait, falls: commander.portraitFalls, lines: commander.barks }
}

/** The moments a Commander speaks at in a Build Phase, which this module finds — the rest are a Battle Round's
 *  (`PRIORITY`, `pulse-voice.ts`). */
export const BUILD_MOMENTS: readonly BarkMoment[] = ["appears", "restored"]

// --- She appears --------------------------------------------------------------------------------------

/**
 * Her appearance's timing, in milliseconds from the first frame of the round's Build Phase: she is not on the map
 * for `delayMs` ("It could just wait half second or something and then do the commander apparition"); a ring
 * closes on her tile over `ringMs`; she flashes in, inverse, for `flashMs`; and her line starts `lineAfterMs` after
 * she lands. Under reduced motion she is there from the start, a still ring round her for `ringMs + flashMs`.
 */
export const APPEAR = { delayMs: 500, ringMs: 700, flashMs: 350, lineAfterMs: 150 } as const

/** How long after the round opens her appearance and her line have both run their course: the live loop draws
 *  frames until then. */
export function appearanceLengthMs(line: string | null): number {
  const landed = APPEAR.delayMs + APPEAR.ringMs + APPEAR.flashMs
  return line === null ? landed : landed + APPEAR.lineAfterMs + lineLength(line).totalMs
}

/** Where she stands as the round opens and which moment this is — a level beginning (`appears`) or the Nexus Pulse
 *  restoring her (`restored`) — or `null` when she does not appear this round: she was standing already, or is out. */
export function appearing(context: BuildContext): Readonly<{ contentId: string; at: Coord; moment: BarkMoment }> | null {
  const contentId = context.commander?.contentId
  if (contentId === undefined) return null
  const restored = (context.restored ?? []).some((entry) => entry.player === "A" && entry.contentId === contentId)
  const first = (context.round?.number ?? 1) === 1
  if (!restored && !first) return null
  const standing = [...(context.field ?? []), ...(context.incoming ?? [])].find((entity) => entity.player === "A" && entity.contentId === contentId)
  if (standing === undefined) return null
  return { contentId, at: standing.anchor, moment: restored ? "restored" : "appears" }
}

/** The line she says as she appears, or `null`: none written for the moment, or the round's scene opens on her
 *  speaking already (PERIMETER's first round), which says it for her. */
export function appearanceLine(context: BuildContext): string | null {
  const now = appearing(context)
  if (now === null) return null
  if ((context.scene ?? []).some((line) => line.unit === now.contentId)) return null
  const lines = commanderArt(now.contentId)?.lines[now.moment] ?? []
  return lines.length === 0 ? null : pickLine(lines, now.moment, context.round?.number ?? 1, 0)
}

/** Whether she is still to appear `elapsedMs` into the round: the map leaves her tile as it is without her. */
export function commanderHidden(context: BuildContext, elapsedMs: number | undefined, reducedMotion: boolean): boolean {
  return elapsedMs !== undefined && !reducedMotion && elapsedMs < APPEAR.delayMs && appearing(context) !== null
}

/** The ring that closes on her as she appears: sparks on the tiles round her at a distance that shrinks from 3 to 1,
 *  most of them lit at a time (cosmetic randomness on her tile), bold in her side's colour — then, as she lands, a
 *  ring of `+` round her. Under reduced motion, that ring for the whole of it. */
export function appearanceRing(at: Coord, sinceMs: number, reducedMotion: boolean): readonly Readonly<{ tile: Coord; glyph: string; bold: boolean }>[] {
  const ring = (radius: number): Coord[] => {
    const tiles: Coord[] = []
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -2 * radius - 1; dx <= 2 * radius + 1; dx += 1) {
        const tile = { x: at.x + dx, y: at.y + dy }
        const distance = gridDistance(at, tile)
        if (distance === 2 * radius || distance === 2 * radius + 1) tiles.push(tile)
      }
    }
    return tiles
  }
  const length = APPEAR.ringMs + APPEAR.flashMs
  if (sinceMs < 0 || sinceMs >= length) return []
  if (reducedMotion) return ring(1).map((tile) => ({ tile, glyph: "+", bold: true }))
  if (sinceMs >= APPEAR.ringMs) return ring(1).map((tile) => ({ tile, glyph: "+", bold: true }))
  const progress = sinceMs / APPEAR.ringMs
  const radius = Math.max(1, 3 - Math.floor(progress * 3))
  const glyph = radius === 1 ? "+" : "*"
  return ring(radius)
    .filter((tile) => cosmeticUnit(cosmeticHash(0, "commander.appear", radius, tile.x - at.x, tile.y - at.y, Math.floor(sinceMs / 120))) < 0.75)
    .map((tile) => ({ tile, glyph, bold: true }))
}

/** Her appearance on the Build Phase's map, at `elapsedMs` into the round: the ring closing on her, her flash in,
 *  and her line beside her, typed in. Nothing in still frames, nor for a round she does not appear in. */
export function drawAppearance(cells: BandCell[], input: BuildCompositionInput): void {
  const elapsedMs = input.roundElapsed?.elapsedMs
  if (elapsedMs === undefined) return
  const { context, state, layout } = input
  const now = appearing(context)
  if (now === null) return
  const reduced = input.reducedMotion === true
  const since = elapsedMs - (reduced ? 0 : APPEAR.delayMs)
  const range = visibleRange(state.camera, state.viewport)
  const inView = (tile: Coord): boolean => tile.x >= range.firstX && tile.x <= range.lastX && tile.y >= range.firstY && tile.y <= range.lastY
  const taken = takenOnMap(context, state)
  const side = playerRole("A")
  for (const { tile, glyph, bold } of appearanceRing(now.at, since, reduced)) {
    if (!inBounds(context.grid, tile) || !inView(tile) || taken.has(`${tile.x},${tile.y}`)) continue
    const cell = cellForTile(layout, state.camera, tile)
    put(cells, BANDS.effects, cell.x, cell.y, glyph, side, bold ? { bold: true } : {})
  }
  // She flashes in as she lands: her own glyph, inverse.
  if (!reduced && since >= APPEAR.ringMs && since < APPEAR.ringMs + APPEAR.flashMs && inView(now.at)) {
    const cell = cellForTile(layout, state.camera, now.at)
    put(cells, BANDS.effects, cell.x, cell.y, entityGlyph(now.contentId, "A", { x: 0, y: 0 }), side, { bold: true, inverse: true })
  }
  const line = appearanceLine(context)
  const lineSince = since - APPEAR.ringMs - APPEAR.flashMs - APPEAR.lineAfterMs
  if (line === null || lineSince < 0) return
  const { typeMs, totalMs } = lineLength(line)
  if (lineSince >= totalMs) return
  const words = quoted(line)
  const typed = reduced ? words.length : Math.min(words.length, Math.ceil((lineSince / Math.max(1, typeMs)) * words.length))
  drawLineBeside(cells, input, now.at, words, typed, lineSince > totalMs - 600, taken)
}

/** Her line on the row above her (below, at the map's top), centred on her and kept inside the map's view, a blank
 *  cell either side; a letter that would cover something standing is left out (the corruption law). */
function drawLineBeside(cells: BandCell[], input: BuildCompositionInput, at: Coord, words: string, typed: number, fading: boolean, taken: ReadonlySet<string>): void {
  const { context, state, layout } = input
  const range = visibleRange(state.camera, state.viewport)
  const label = ` ${words.slice(0, typed)}${typed >= words.length ? " " : ""}`
  const width = ` ${words} `.length
  const left = Math.max(range.firstX, Math.min(at.x - Math.floor(width / 2), range.lastX - width + 1))
  // The row near her, above before below, whose span covers least of what stands there.
  const rows = [-1, 1, -2, 2].map((dy) => at.y + dy).filter((y) => y >= range.firstY && y <= range.lastY)
  const covered = (y: number): number => Array.from({ length: width }, (_, index) => taken.has(`${left + index},${y}`)).filter(Boolean).length
  const row = rows.reduce((best, y) => (covered(y) < covered(best) ? y : best), rows[0] ?? at.y - 1)
  ;[...label].forEach((glyph, index) => {
    const tile = { x: left + index, y: row }
    if (tile.x > range.lastX || !inBounds(context.grid, tile) || taken.has(`${tile.x},${tile.y}`)) return
    const cell = cellForTile(layout, state.camera, tile)
    put(cells, BANDS.effects, cell.x, cell.y, glyph, playerRole("A"), fading ? { dim: true } : { bold: true })
  })
}

// --- She falls ----------------------------------------------------------------------------------------

/**
 * The vignette's timing, from the moment she falls, in presentation time: her portrait for `faceMs`, each frame of
 * her fall for `fallFrameMs`, then the whole window evaporating over `evaporateMs`. Under reduced motion the
 * window shows her last frame, still, for as long, and is gone without evaporating.
 */
export const VIGNETTE = { faceMs: 500, fallFrameMs: 600, evaporateMs: 1100 } as const

/** How long the vignette is open, for a Commander with `frames` frames of her fall. */
export function vignetteLengthMs(frames: number): number {
  return VIGNETTE.faceMs + frames * VIGNETTE.fallFrameMs + VIGNETTE.evaporateMs
}

/** Where she fell, as a Battle Round's frame carries it: the tile, the presentation time, and who. */
export type FallFrame = Readonly<{ at: Coord; atMs: number; contentId: string; player: PlayerId }>

/** The face she shows `sinceMs` after she falls, and how far the window has evaporated (0 to 1). */
export function vignetteFace(art: CommanderArt, sinceMs: number, reducedMotion: boolean): Readonly<{ rows: readonly string[]; evaporated: number }> {
  const frames = [art.portrait, ...art.falls]
  if (reducedMotion) return { rows: frames[frames.length - 1] ?? art.portrait, evaporated: 0 }
  const index = sinceMs < VIGNETTE.faceMs ? 0 : Math.min(frames.length - 1, 1 + Math.floor((sinceMs - VIGNETTE.faceMs) / VIGNETTE.fallFrameMs))
  const evaporateFrom = VIGNETTE.faceMs + art.falls.length * VIGNETTE.fallFrameMs
  const evaporated = Math.max(0, Math.min(1, (sinceMs - evaporateFrom) / VIGNETTE.evaporateMs))
  return { rows: frames[index] ?? art.portrait, evaporated }
}

/** The vignette's window, as glyphs from its top-left: a border with her name in it, and her face inside, a column
 *  of room either side — 9 by 5 for a 5 by 3 portrait. */
export function vignetteGlyphs(art: CommanderArt, rows: readonly string[], pack: GlyphPack): readonly string[] {
  const width = Math.max(...rows.map((row) => row.length)) + 2
  const name = art.name.split(" ").at(-1)?.toUpperCase() ?? ""
  const h = chromeGlyph(pack, "horizontal")
  const v = chromeGlyph(pack, "vertical")
  const title = name.length <= width - 2 ? `${h}${name}${h.repeat(width - name.length - 1)}` : h.repeat(width)
  return [
    `${chromeGlyph(pack, "topLeft")}${title}${chromeGlyph(pack, "topRight")}`,
    ...rows.map((row) => `${v} ${row.padEnd(width - 2)} ${v}`),
    `${chromeGlyph(pack, "bottomLeft")}${h.repeat(width)}${chromeGlyph(pack, "bottomRight")}`,
  ]
}

/** Where the window opens beside her: above or below her row, to her right or her left, inside the view — the place
 *  that keeps clear of her last words (`keepClear`) and covers fewest of the tiles something stands on, above-right
 *  first among equals. Its top-left tile. */
export function vignettePlace(
  at: Coord,
  size: Readonly<{ width: number; height: number }>,
  range: Readonly<{ firstX: number; lastX: number; firstY: number; lastY: number }>,
  occupied: (tile: Coord) => boolean,
  keepClear: (tile: Coord) => boolean = () => false,
): Coord {
  const candidates: Coord[] = [
    { x: at.x + 2, y: at.y - size.height },
    { x: at.x - 1 - size.width, y: at.y - size.height },
    { x: at.x + 2, y: at.y + 1 },
    { x: at.x - 1 - size.width, y: at.y + 1 },
  ].map((corner) => ({
    x: Math.max(range.firstX, Math.min(corner.x, range.lastX - size.width + 1)),
    y: Math.max(range.firstY, Math.min(corner.y, range.lastY - size.height + 1)),
  }))
  let best = candidates[0] as Coord
  let bestCost = Number.POSITIVE_INFINITY
  for (const corner of candidates) {
    let cost = 0
    for (let dy = 0; dy < size.height; dy += 1) {
      for (let dx = 0; dx < size.width; dx += 1) {
        const tile = { x: corner.x + dx, y: corner.y + dy }
        if (tile.x === at.x && tile.y === at.y) cost += 1000
        else if (keepClear(tile)) cost += 100
        else if (occupied(tile)) cost += 1
      }
    }
    if (cost < bestCost) {
      best = corner
      bestCost = cost
    }
  }
  return best
}

/** The scene's view a Battle Round draws through. */
type SceneView = Readonly<{ camera: Camera; viewport: Viewport; layout: BuildLayout; grid: GridTerrain }>

/**
 * ***Her vignette*** over the battle, while it is open: the window beside where she fell, her face going through
 * its frames, then every glyph of it evaporating — a few at a time, in an order that is cosmetic randomness on the
 * glyph's place, each first thinning to `.` and then gone. Drawn over everything on the map, under the popups.
 */
export function drawVignette(
  cells: BandCell[],
  view: SceneView,
  fall: FallFrame | undefined,
  timeMs: number,
  reducedMotion: boolean,
  pack: GlyphPack,
  occupied: ReadonlySet<number>,
  voice?: Readonly<{ text: string; place: Coord; where: "map" | "panel" }>,
): void {
  if (fall === undefined) return
  const art = commanderArt(fall.contentId)
  if (art === null || art.portrait.length === 0) return
  const sinceMs = timeMs - fall.atMs
  if (sinceMs < 0 || sinceMs >= vignetteLengthMs(art.falls.length)) return
  const { rows, evaporated } = vignetteFace(art, sinceMs, reducedMotion)
  const glyphs = vignetteGlyphs(art, rows, pack)
  const size = { width: Math.max(...glyphs.map((row) => row.length)), height: glyphs.length }
  const range = visibleRange(view.camera, view.viewport)
  // Her last words beside her stay readable: the window keeps off their row's span.
  const said = voice === undefined || voice.where !== "map" ? null : { y: voice.place.y, half: Math.ceil((voice.text.length + 4) / 2), x: voice.place.x }
  const keepClear = (tile: Coord): boolean => said !== null && tile.y === said.y && Math.abs(tile.x - said.x) <= said.half
  const corner = vignettePlace(fall.at, size, range, (tile) => inBounds(view.grid, tile) && occupied.has(tile.y * view.grid.width + tile.x), keepClear)
  const side = playerRole(fall.player)
  glyphs.forEach((line, dy) => {
    ;[...line].forEach((glyph, dx) => {
      const tile = { x: corner.x + dx, y: corner.y + dy }
      if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) return
      const gone = cosmeticUnit(cosmeticHash(0, "commander.vignette", fall.atMs, dx, dy, 0))
      if (evaporated > 0 && gone < evaporated) return
      const thinning = evaporated > 0 && gone < evaporated + 0.25
      const border = dy === 0 || dy === glyphs.length - 1 || dx === 0 || dx === line.length - 1
      const style: CellStyle = thinning
        ? { fgRole: border ? "chrome.frame" : side, dim: true }
        : border
          ? { fgRole: "chrome.frame", ...(dy === 0 && glyph !== chromeGlyph(pack, "horizontal") && dx > 0 && dx < line.length - 1 ? { fgRole: side, bold: true } : {}) }
          : { fgRole: side, bold: true }
      const cell = cellForTile(view.layout, view.camera, tile)
      cells.push({ band: BANDS.highlights, x: cell.x, y: cell.y, cell: { glyph: thinning && glyph !== " " ? "." : glyph, style } })
    })
  })
}

// --- She is out ---------------------------------------------------------------------------------------

/** The free tile nearest a side's Grid Nexus, outside it, by the Grid's own distance — east, then the top, first
 *  among equals — or `null` with none within four rows. */
export function besideNexus(grid: GridTerrain, nexus: Coord, taken: (tile: Coord) => boolean): Coord | null {
  const free: Coord[] = []
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -8; dx <= 8; dx += 1) {
      const tile = { x: nexus.x + dx, y: nexus.y + dy }
      if (!inBounds(grid, tile) || taken(tile)) continue
      const terrain = grid.tiles[tile.y * grid.width + tile.x]
      if (terrain !== undefined && TERRAIN[terrain].impassable) continue
      free.push(tile)
    }
  }
  free.sort((a, b) => gridDistance(nexus, a) - gridDistance(nexus, b) || b.x - a.x || a.y - b.y)
  return free[0] ?? null
}

/** Every tile something stands on in the Build Phase, or will as the round starts. */
export function takenOnMap(context: BuildContext, state: BuildState): Set<string> {
  const taken = new Set<string>()
  const hold = (contentId: string, anchor: Coord): void => {
    for (const tile of tilesOf(anchor, context.registry.get(contentId).footprint)) taken.add(`${tile.x},${tile.y}`)
  }
  for (const structure of context.standing) hold(structure.contentId, structure.anchor)
  for (const placement of state.planned) hold(placement.contentId, placement.anchor)
  for (const entity of context.field ?? []) hold(entity.contentId, entity.anchor)
  for (const entity of context.incoming ?? []) hold(entity.contentId, entity.anchor)
  return taken
}

/** The dim mark of her, her own glyph and nothing else ("just keep the exactly same symbol"). */
const outLook = (player: PlayerId): CellStyle => ({ fgRole: playerRole(player), dim: true })

/** A Build Phase she sits out: her dim glyph beside the Nexus that will restore her. Not where she will stand — the
 *  Nexus sets her down on the free tile nearest it as her round opens, which the plan may still change. */
export function drawOutInBuild(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const contentId = context.commander?.contentId
  if (contentId === undefined) return
  const absence = (context.absent ?? []).find((entry) => entry.player === "A" && entry.contentId === contentId)
  if (absence === undefined) return
  const nexus = nexusTile(context)
  if (nexus === null) return
  const taken = takenOnMap(context, state)
  const at = besideNexus(context.grid, nexus, (tile) => taken.has(`${tile.x},${tile.y}`))
  if (at === null) return
  const range = visibleRange(state.camera, state.viewport)
  if (at.x < range.firstX || at.x > range.lastX || at.y < range.firstY || at.y > range.lastY) return
  const cell = cellForTile(layout, state.camera, at)
  cells.push({ band: BANDS.units, x: cell.x, y: cell.y, cell: { glyph: entityGlyph(contentId, "A", { x: 0, y: 0 }), style: outLook("A") } })
}

/** A Battle Round after she falls: her dim glyph beside her side's Grid Nexus, on a tile nothing stands on now. */
export function drawOutInBattle(cells: BandCell[], view: SceneView, fall: FallFrame | undefined, timeMs: number, nexus: Coord | null, occupied: ReadonlySet<number>): void {
  if (fall === undefined || nexus === null || timeMs < fall.atMs) return
  const at = besideNexus(view.grid, nexus, (tile) => occupied.has(tile.y * view.grid.width + tile.x))
  if (at === null) return
  const range = visibleRange(view.camera, view.viewport)
  if (at.x < range.firstX || at.x > range.lastX || at.y < range.firstY || at.y > range.lastY) return
  const cell = cellForTile(view.layout, view.camera, at)
  cells.push({ band: BANDS.units, x: cell.x, y: cell.y, cell: { glyph: entityGlyph(fall.contentId, fall.player, { x: 0, y: 0 }), style: outLook(fall.player) } })
}

// --- She is explored ----------------------------------------------------------------------------------

/** Explore Map's cursor on her: a ring of light round her, as the dialog's focus has (`drawLightAround`). */
export function drawExploredCommander(cells: BandCell[], input: BuildCompositionInput, colors: ColorDepth): void {
  const { context, state } = input
  const contentId = context.commander?.contentId
  if (contentId === undefined || !cardShowing(state) || state.armed !== null) return
  const her = [...(context.field ?? []), ...(context.incoming ?? [])].find((entity) => entity.player === "A" && entity.contentId === contentId)
  if (her === undefined || her.anchor.x !== state.cursor.x || her.anchor.y !== state.cursor.y) return
  drawLightAround(cells, input, [her.anchor], colors, input.dialogLight?.elapsedMs ?? 0)
}

/** Her portrait as her card's icon: drawn in her side's colour, bold. `null` for a unit no army gives one. */
export function portraitOf(contentId: string): readonly string[] | null {
  const art = commanderArt(contentId)
  return art === null || art.portrait.length === 0 ? null : art.portrait
}

