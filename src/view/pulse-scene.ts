// The Nexus Pulse on the Build Phase's own screen (gate 6A) — the fight drawn through the same
// cursor-driven camera, in the same frame, under the same popups. The map is 96 x 40; the old Pulse view
// (`compose.ts`) draws a fixed 48 x 16 pane with its own chrome, and so could not have shown it.
//
// Everything here is drawing: it takes a `PulseFrame` — what the presenter (`pulse-live.ts`) has already
// worked out for one presentation instant — and paints cells. It reads no clock and asks nothing of the
// kernel, and the frame it draws is a pure function of the resolved Pulse and the time.

import type { Camera, Viewport } from "../build/camera.ts"
import { visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { cellForTile, pulseControlRows } from "../build/layout.ts"
import { wrapWords } from "../build/overlay.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { inBounds, tileIndex } from "../grid/coords.ts"
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { StatusMessage } from "../status.ts"
import { status } from "../status.ts"
import type { EndingPhase, EndingTimes, PulseResult } from "./ending.ts"
import { BEAM_BOLD, beamFrame, beamLight, formatTimer, timerLit, timerSeconds } from "./ending.ts"
import { forceBar } from "./compose.ts"
import { paintEffectCells } from "./effects/composite.ts"
import type { EffectCellSource } from "./effects/composite.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import type { DrawExtra } from "./draw.ts"
import { put, text } from "./draw.ts"
import type { StyleRole } from "./roles.ts"
import type { PulseSample } from "./snapshot.ts"
import { entityGlyph, playerRole } from "./theme.ts"

/** What the Pulse's scene needs for one presentation instant. Built by `PulsePresenter.frame`. */
export type PulseFrame = Readonly<{
  sample: PulseSample
  registry: ContentRegistry
  /** Each side's health at tick zero, structures excluded — what a force bar is measured against. */
  openingHealth: ReadonlyMap<PlayerId, number>
  ticksPerSecond: number
  paused: boolean
  speed: number
  phase: EndingPhase
  /** Where the Pulse is in presentation time, and the ending's moments: the timer, the light and the
   *  walk are all read from these, so the scene holds no clock of its own. */
  timeMs: number
  times: EndingTimes
  reducedMotion: boolean
  /** How red the map's border is at this instant, 0 (not at all) to a faint ceiling: the player's Nexus
   *  being hurt, and nothing else. */
  redAlert: number
  /** Where every entity is drawn: the fight's own interpolated positions, then Recall's walk home. */
  positions: ReadonlyMap<number, Coord>
  result: PulseResult
  /** What each side has in the field right now: its mobile units and their health, structures excluded. */
  forces: Readonly<Record<PlayerId, Readonly<{ units: number; hp: number }>>>
  /** After Recall: how many mobile units the player has, standing where the next Build Phase finds them. */
  home: number
}>

/** The words for a side: the player's own units are "you", the other side "raid". */
const SIDE: Readonly<Record<PlayerId, string>> = { A: "you", B: "raid" }

type SceneView = Readonly<{ camera: Camera; viewport: Viewport; layout: BuildLayout; grid: GridTerrain }>

/**
 * Every entity, drawn where the frame says it is, through the camera and clipped to the view. Both sides,
 * structures bold, the same glyphs and colours as the Pulse view has always drawn them. Returns the tiles
 * they cover (as `tileIndex` numbers), which the effects must not paint a glyph onto (the corruption law).
 */
export function drawPulseEntities(cells: BandCell[], view: SceneView, pulse: PulseFrame): ReadonlySet<number> {
  const range = visibleRange(view.camera, view.viewport)
  const occupied = new Set<number>()
  const draw = (entity: Readonly<{ ordinal: number; contentId: string; player: PlayerId; anchor: Coord }>): void => {
    const definition = pulse.registry.get(entity.contentId)
    const at = pulse.positions.get(entity.ordinal) ?? entity.anchor
    const band = definition.layer === "obstacles" ? BANDS.structures : definition.layer === "air" ? BANDS.air : BANDS.units
    for (const offset of definition.footprint) {
      const tile = { x: at.x + offset.x, y: at.y + offset.y }
      if (!inBounds(view.grid, tile)) continue
      if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
      occupied.add(tileIndex(view.grid, tile))
      const cell = cellForTile(view.layout, view.camera, tile)
      put(cells, band, cell.x, cell.y, entityGlyph(entity.contentId, entity.player, offset), playerRole(entity.player), {
        bold: definition.layer === "obstacles",
      })
      for (let extra = 1; extra < view.layout.tileWidth; extra += 1) {
        put(cells, band, cell.x + extra, cell.y, " ", playerRole(entity.player))
      }
    }
  }
  pulse.sample.state.entities.forEach(draw)
  pulse.sample.heldCorpses.forEach(draw)
  return occupied
}

/**
 * What every effect is painting, through the camera. The corruption law, enforced here as the Pulse
 * view enforces it and the Build Phase's placement effects do: a glyphless cell only restyles what is
 * beneath it, and one that would replace a unit's or a structure's glyph is dropped on that tile —
 * the screen may look wrong, but the player can always see what is attacking them. Two effects on one
 * tile merge the way they always have.
 */
export function drawPulseEffects(
  cells: BandCell[],
  view: SceneView,
  pulse: PulseFrame,
  occupied: ReadonlySet<number>,
): void {
  const range = visibleRange(view.camera, view.viewport)
  const sources: EffectCellSource[] = []
  for (const painted of pulse.sample.effects) {
    for (const cell of painted.cells) {
      const { tile } = cell
      if (!inBounds(view.grid, tile)) continue
      if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
      sources.push({ band: painted.instance.band, cell })
    }
  }
  paintEffectCells(
    cells,
    sources,
    (tile) => cellForTile(view.layout, view.camera, tile),
    (tile) => occupied.has(tileIndex(view.grid, tile)),
  )
}

/** The border's cells, clockwise from the top left corner — the same list every frame of a layout. */
const borders = new WeakMap<BuildLayout["gridBox"], readonly Coord[]>()

function borderOf(box: BuildLayout["gridBox"]): readonly Coord[] {
  let border = borders.get(box)
  if (border === undefined) {
    const cells: Coord[] = []
    for (let x = box.left; x <= box.right; x += 1) cells.push({ x, y: box.top })
    for (let y = box.top + 1; y < box.bottom; y += 1) cells.push({ x: box.right, y })
    for (let x = box.right; x >= box.left; x -= 1) cells.push({ x, y: box.bottom })
    for (let y = box.bottom - 1; y > box.top; y -= 1) cells.push({ x: box.left, y })
    border = cells
    borders.set(box, border)
  }
  return border
}

/**
 * The light on the map's border (owner, 2026-09-29): in the last seconds a soft white light sweeps round
 * the frame like a lighthouse calling, and, a moment at a time, the border goes a faint red when the
 * player's Nexus is hurt (and then only red — the news of a hurt Nexus comes first). Both are a colour
 * pulled a little toward another — a style-only write, so the map's own edge and the frame's junctions
 * keep their glyphs and nothing on the Grid is ever covered. Where colour cannot show (monochrome) the
 * beam is the border going bold as it passes; the red has nothing to say there, because every red flash
 * is said again in words.
 */
export function drawFrameLight(cells: BandCell[], layout: BuildLayout, pulse: PulseFrame): void {
  const border = borderOf(layout.gridBox)
  if (pulse.redAlert > 0) {
    const style: CellStyle = { tint: { role: "notice.gate", amount: pulse.redAlert } }
    for (const { x, y } of border) cells.push({ band: BANDS.chrome, x, y, style })
    return
  }
  const beam = beamFrame(pulse.times, pulse.timeMs, border.length, pulse.reducedMotion)
  if (beam === null) return
  border.forEach(({ x, y }, index) => {
    const light = beamLight(beam, index)
    if (light <= 0) return
    cells.push({
      band: BANDS.chrome,
      x,
      y,
      style: { tint: { role: "fx.flash", amount: light }, ...(light >= BEAM_BOLD ? { bold: true, dim: false } : {}) },
    })
  })
}

// ---------------------------------------------------------------------------------------------
// The panel, the top bar and the bottom line (the Pulse's keys are on the Controls page, feedback F60)
// ---------------------------------------------------------------------------------------------

/** The top bar's second word: where the player is. */
export function pulseSubtitle(pulse: PulseFrame): string {
  switch (pulse.phase) {
    case "halted":
      return "cease fire"
    case "walking":
      return "recall"
    case "home":
      return `nexus pulse - ${pulse.result.headline.toLowerCase()}`
    default:
      return "nexus pulse"
  }
}

const secondsOf = (pulse: PulseFrame, tick: number): string => (tick / pulse.ticksPerSecond).toFixed(1)

/** What Recall did, for the player's own side: "3 of yours came home." or, when nobody is left, "None of yours came home." */
const cameHome = (count: number): string => (count === 0 ? "None of yours came home." : `${count} of yours came home.`)

/** The one line under the map: what the Pulse is doing now, or how it ended, in plain words. */
export function pulseStatus(pulse: PulseFrame): StatusMessage {
  const held = pulse.paused && pulse.phase !== "home" ? "Paused. " : ""
  switch (pulse.phase) {
    case "final":
      return status(`${held}The Pulse is about to end.`)
    case "halted":
      return status(`${held}Cease fire. The Pulse is over.`)
    case "walking":
      return status(`${held}Recall - the survivors are heading home.`)
    case "home":
      return status(`${pulse.result.headline} - ${pulse.result.reason} ${cameHome(pulse.home)}`, pulse.result.tone)
    default:
      return status(`${held}Nexus Pulse - ${pulse.forces.A.units} of yours against ${pulse.forces.B.units} of the raid.`)
  }
}

/** A force's line: who, how many, a bar of what is left of its opening health, and that health. */
function forceLine(pulse: PulseFrame, player: PlayerId): string {
  const { units, hp } = pulse.forces[player]
  const bar = forceBar(hp, pulse.openingHealth.get(player) ?? 0)
  return `${SIDE[player].toUpperCase().padEnd(5)}${String(units).padStart(2)} [${bar}] ${String(hp).padStart(4)}`
}

/** `A:trooper#5` is a trooper of side A. */
function whoIs(id: string): Readonly<{ player: PlayerId | null; name: string }> {
  const [side = "?", rest = ""] = id.split(":")
  const [name = "?"] = rest.split("#")
  return { player: side === "A" || side === "B" ? side : null, name }
}

/**
 * One line of the feed in plain words — "3.5s trooper > raider", "3.8s raider dies" — drawn in the colour of
 * the side it is about, or `null` for an event the feed does not carry. Short enough for the panel at the
 * floor without cutting a word: the units' own names say whose they are (a trooper is yours, a raider is
 * the raid's) and the colour says it again where colour reaches.
 */
function feedLine(pulse: PulseFrame, event: DomainEvent): Readonly<{ text: string; role: StyleRole }> | null {
  const at = `${secondsOf(pulse, event.tick)}s`
  const sideRole = (player: PlayerId | null): StyleRole => (player === null ? "chrome.value" : playerRole(player))
  switch (event.kind) {
    case "attack.launched": {
      const by = whoIs(event.attacker)
      return { text: `${at} ${by.name} > ${whoIs(event.target).name}`, role: sideRole(by.player) }
    }
    case "entity.died":
      return { text: `${at} ${whoIs(event.entity).name} dies`, role: sideRole(event.player) }
    case "structure.destroyed":
      return { text: `${at} ${whoIs(event.entity).name} falls`, role: sideRole(whoIs(event.entity).player) }
    case "pulse.ended":
      return { text: `${at} the Pulse ends`, role: "chrome.title" }
    default:
      return null
  }
}

const FEED_ROWS = 5

/** The last few feed lines, newest last — read back from the end of the feed until there are enough. */
function recentLines(pulse: PulseFrame): Array<NonNullable<ReturnType<typeof feedLine>>> {
  const lines: Array<NonNullable<ReturnType<typeof feedLine>>> = []
  const { recent } = pulse.sample
  for (let index = recent.length - 1; index >= 0 && lines.length < FEED_ROWS; index -= 1) {
    const entry = feedLine(pulse, recent[index] as DomainEvent)
    if (entry !== null) lines.unshift(entry)
  }
  return lines
}

/**
 * The panel while a Pulse is on screen: what it is (and, at the end, how it ended), each side's force,
 * the last few things that happened, and the two clickable controls. Where the menu was — the Build
 * Phase's menu has nothing to offer once the plan is committed. Laid out down a running row, so the
 * phases that say more (the result, and what Recall did) push what follows them down together.
 */
export function drawPulsePanel(cells: BandCell[], layout: BuildLayout, pulse: PulseFrame, pulseNumber: number): void {
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  let at = 0
  const line = (value: string, role: StyleRole, extra: DrawExtra = {}): void => {
    text(cells, band, column, layout.panelRow + at, value, role, { ...extra, limit })
    at += 1
  }
  const gap = (): void => {
    at += 1
  }

  // The headline — what this moment of the Pulse is called — and the line under it: what the timer counts
  // and how fast it runs while it goes, what the phase means as it ends, why it ended once it has. While
  // it runs the headline is the Pulse's title, with the time left until the shooting stops at its right
  // end — the one thing on the screen that flashes, in the last seconds.
  switch (pulse.phase) {
    case "halted":
      line("CEASE FIRE", "chrome.title", { bold: true })
      line("The shooting has stopped.", "chrome.label")
      break
    case "walking":
      line("RECALL", "chrome.title", { bold: true })
      line("The survivors walk home.", "chrome.label")
      break
    case "home":
      line(
        pulse.result.headline,
        pulse.result.tone === "danger" ? "notice.gate" : pulse.result.tone === "success" ? "chrome.hotkey" : "chrome.title",
        { bold: true },
      )
      for (const reason of wrapWords(pulse.result.reason, limit - 1)) line(reason, "chrome.value")
      break
    default: {
      const lit = timerLit(pulse.times, pulse.timeMs, pulse.reducedMotion)
      const timer = formatTimer(timerSeconds(pulse.times, pulse.timeMs))
      // One column in from the divider, as the panel's prose is.
      const right = limit - 1
      text(cells, band, column + right - timer.length, layout.panelRow + at, timer, lit ? "chrome.title" : "chrome.value", {
        bold: lit,
        inverse: lit,
      })
      line(`NEXUS PULSE ${pulseNumber}`, "chrome.title", { bold: true, limit: right - timer.length - 1 })
      line(`time left  ${pulse.speed}x${pulse.paused ? " paused" : ""}`, "chrome.label")
    }
  }
  gap()

  // Both forces, each in its own side's colour.
  for (const player of PLAYERS) line(forceLine(pulse, player), playerRole(player))
  gap()

  if (pulse.phase === "home") {
    line("RECALL", "chrome.label")
    line(cameHome(pulse.home), "chrome.value")
    gap()
    for (const hint of wrapWords("For a new Build Phase: Esc, then Restart.", limit - 1)) line(hint, "chrome.muted")
  } else {
    line("RECENT", "chrome.label")
    for (const entry of recentLines(pulse)) line(entry.text, entry.role)
  }

  // The controls, where the mouse can reach them: the hotkey in its own colour, then what it does.
  for (const control of pulseControlRows(layout)) {
    if (control.control === "toggle" && pulse.phase === "home") continue
    const label = control.control === "toggle" ? (pulse.paused ? "Resume" : "Pause") : "Watch again"
    text(cells, band, column, control.row, `[${control.hotkey}]`, "chrome.hotkey", { bold: true, limit })
    text(cells, band, column + control.hotkey.length + 3, control.row, label, "chrome.value", {
      limit: limit - control.hotkey.length - 3,
    })
  }
}
