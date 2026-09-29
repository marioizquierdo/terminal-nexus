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
import type { Coord, GridTerrain } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { StatusMessage } from "../status.ts"
import { status } from "../status.ts"
import type { EndingPhase, PulseResult } from "./ending.ts"
import { EFFECT_BAND_NUMBERS, effectCellStyle, mergeEffectCells } from "./effects/composite.ts"
import type { EffectCellSource } from "./effects/composite.ts"
import type { BandCell } from "./frame.ts"
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
  /** The Pulse's tick limit, and how many ticks a second run. */
  pulseTicks: number
  ticksPerSecond: number
  paused: boolean
  speed: number
  phase: EndingPhase
  /** The alarm's flash is lit at this instant. */
  alarmLit: boolean
  /** Where every entity is drawn: the fight's own interpolated positions, then Recall's walk home. */
  positions: ReadonlyMap<number, Coord>
  result: PulseResult
  /** After Recall: the mobile units each side has, standing where the next Build Phase finds them. */
  home: Readonly<Record<PlayerId, number>>
}>

/** The words for a side: the player's own units are "you", the other side "raid". */
const SIDE: Readonly<Record<PlayerId, string>> = { A: "you", B: "raid" }

type SceneView = Readonly<{ camera: Camera; viewport: Viewport; layout: BuildLayout; grid: GridTerrain }>

/**
 * Every entity, drawn where the frame says it is, through the camera and clipped to the view. Both sides,
 * structures bold, the same glyphs and colours as the Pulse view has always drawn them. Returns the tiles
 * they cover, which the effects must not paint a glyph onto (the corruption law).
 */
export function drawPulseEntities(cells: BandCell[], view: SceneView, pulse: PulseFrame): ReadonlySet<string> {
  const range = visibleRange(view.camera, view.viewport)
  const occupied = new Set<string>()
  const drawn: readonly Readonly<{ ordinal: number; contentId: string; player: PlayerId; anchor: Coord }>[] = [
    ...pulse.sample.state.entities,
    ...pulse.sample.heldCorpses,
  ]
  for (const entity of drawn) {
    const definition = pulse.registry.get(entity.contentId)
    const at = pulse.positions.get(entity.ordinal) ?? entity.anchor
    const band = definition.layer === "obstacles" ? BANDS.structures : definition.layer === "air" ? BANDS.air : BANDS.units
    for (const offset of definition.footprint) {
      const tile = { x: at.x + offset.x, y: at.y + offset.y }
      if (tile.x < 0 || tile.y < 0 || tile.x >= view.grid.width || tile.y >= view.grid.height) continue
      occupied.add(`${tile.x},${tile.y}`)
      if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
      const cell = cellForTile(view.layout, view.camera, tile)
      put(cells, band, cell.x, cell.y, entityGlyph(entity.contentId, entity.player, offset), playerRole(entity.player), {
        bold: definition.layer === "obstacles",
      })
      for (let extra = 1; extra < view.layout.tileWidth; extra += 1) {
        put(cells, band, cell.x + extra, cell.y, " ", playerRole(entity.player))
      }
    }
  }
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
  occupied: ReadonlySet<string>,
): void {
  const range = visibleRange(view.camera, view.viewport)
  const sources: EffectCellSource[] = []
  for (const painted of pulse.sample.effects) {
    for (const cell of painted.cells) {
      const { tile } = cell
      if (tile.x < 0 || tile.y < 0 || tile.x >= view.grid.width || tile.y >= view.grid.height) continue
      if (tile.x < range.firstX || tile.x > range.lastX || tile.y < range.firstY || tile.y > range.lastY) continue
      sources.push({ band: painted.instance.band, cell })
    }
  }
  for (const { band, cell } of mergeEffectCells(sources)) {
    const at = cellForTile(view.layout, view.camera, cell.tile)
    const style = effectCellStyle(cell)
    if (cell.glyph === "") {
      cells.push({ band: EFFECT_BAND_NUMBERS[band], x: at.x, y: at.y, style })
      continue
    }
    if (occupied.has(`${cell.tile.x},${cell.tile.y}`)) continue
    cells.push({ band: EFFECT_BAND_NUMBERS[band], x: at.x, y: at.y, cell: { glyph: cell.glyph, style } })
  }
}

/**
 * The alarm: the Grid pane's four sides flash in the danger colour, inverse and bold, on top of whatever
 * line each already is — a style-only write, so the map's own edge and the frame's junctions keep their
 * glyphs. It is the eye-catching half of the alarm; the words — "PULSE ENDING" in the panel, the top bar
 * and the status line — carry the meaning, so a monochrome screen or a player who cannot see the flash
 * loses nothing but the flash.
 */
export function drawAlarm(cells: BandCell[], layout: BuildLayout, pulse: PulseFrame): void {
  if (pulse.phase !== "alarm" || !pulse.alarmLit) return
  const box = layout.gridBox
  const style = { inverse: true, bold: true, fgRole: "notice.gate" as const }
  for (let x = box.left; x <= box.right; x += 1) {
    cells.push({ band: BANDS.chrome, x, y: box.top, style })
    cells.push({ band: BANDS.chrome, x, y: box.bottom, style })
  }
  for (let y = box.top + 1; y < box.bottom; y += 1) {
    cells.push({ band: BANDS.chrome, x: box.left, y, style })
    cells.push({ band: BANDS.chrome, x: box.right, y, style })
  }
}

// ---------------------------------------------------------------------------------------------
// The panel, the top bar, the key help and the status line
// ---------------------------------------------------------------------------------------------

/** The top bar's second word: where the player is. The alarm names itself here too. */
export function pulseSubtitle(pulse: PulseFrame): Readonly<{ text: string; role: StyleRole; lit: boolean }> {
  switch (pulse.phase) {
    case "alarm":
      return { text: "PULSE ENDING", role: "notice.gate", lit: pulse.alarmLit }
    case "halted":
      return { text: "cease fire", role: "chrome.muted", lit: false }
    case "walking":
      return { text: "recall", role: "chrome.muted", lit: false }
    case "home":
      return { text: `nexus pulse - ${pulse.result.headline.toLowerCase()}`, role: "chrome.muted", lit: false }
    default:
      return { text: "nexus pulse", role: "chrome.muted", lit: false }
  }
}

export type PulseKeyHelp = Readonly<{ label: string; bindings: readonly string[] }>

/** The key help while a Pulse is on screen: where the keyboard is, and what it does there. */
export function pulseKeyHelp(pulse: PulseFrame): PulseKeyHelp {
  return {
    label: "PULSE",
    bindings: [
      pulse.phase === "home" ? "r watch again" : pulse.paused ? "space resume" : "space pause",
      ...(pulse.phase === "home" ? [] : ["[ ] speed", "r watch again"]),
      "arrows look around",
    ],
  }
}

const unitsOf = (pulse: PulseFrame, player: PlayerId): number =>
  pulse.sample.state.entities.filter(
    (entity) => entity.player === player && pulse.registry.get(entity.contentId).layer !== "obstacles",
  ).length

const secondsOf = (pulse: PulseFrame, tick: number): string => (tick / pulse.ticksPerSecond).toFixed(1)

/** What Recall did, for the player's own side: "3 of yours came home." or, when nobody is left, "None of yours came home." */
const cameHome = (count: number): string => (count === 0 ? "None of yours came home." : `${count} of yours came home.`)

/** The one line under the map: what the Pulse is doing now, or how it ended, in plain words. */
export function pulseStatus(pulse: PulseFrame): StatusMessage {
  const held = pulse.paused && pulse.phase !== "home" ? "Paused. " : ""
  switch (pulse.phase) {
    case "alarm":
      return status(`${held}Pulse ending - hold your fire.`, "warning")
    case "halted":
      return status(`${held}Cease fire. The Pulse is over.`)
    case "walking":
      return status(`${held}Recall - the survivors are heading home.`)
    case "home":
      return status(
        `${pulse.result.headline} - ${pulse.result.reason} ${cameHome(pulse.home.A)}`,
        pulse.result.tone === "neutral" ? undefined : pulse.result.tone,
      )
    default:
      return status(
        `${held}Nexus Pulse - ${unitsOf(pulse, "A")} of yours against ${unitsOf(pulse, "B")} of the raid.`,
      )
  }
}

/** A force's line: who, how many, a bar of what is left of its opening health, and that health. */
function forceLine(pulse: PulseFrame, player: PlayerId): string {
  let units = 0
  let hp = 0
  for (const entity of pulse.sample.state.entities) {
    if (entity.player !== player || pulse.registry.get(entity.contentId).layer === "obstacles") continue
    units += 1
    hp += entity.hp
  }
  const opening = pulse.openingHealth.get(player) ?? 0
  const width = 10
  const filled = opening <= 0 ? 0 : Math.max(hp > 0 ? 1 : 0, Math.round((hp / opening) * width))
  const bar = `${"#".repeat(Math.min(width, filled))}${"-".repeat(Math.max(0, width - filled))}`
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
export function feedLine(pulse: PulseFrame, event: DomainEvent): Readonly<{ text: string; role: StyleRole }> | null {
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

/**
 * The panel while a Pulse is on screen: what it is (and, at the end, how it ended), each side's force,
 * the last few things that happened, and the two clickable controls. Where the menu was — the Build
 * Phase's menu has nothing to offer once the plan is committed. Laid out down a running row, so the
 * phases that say more (the result, and what Recall did) push what follows them down together.
 */
export function drawPulsePanel(cells: BandCell[], layout: BuildLayout, pulse: PulseFrame): void {
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

  // The headline: what this moment of the Pulse is called.
  switch (pulse.phase) {
    case "alarm":
      line("PULSE ENDING".padEnd(limit), "notice.gate", { bold: true, inverse: pulse.alarmLit })
      break
    case "halted":
      line("CEASE FIRE", "chrome.title", { bold: true })
      break
    case "walking":
      line("RECALL", "chrome.title", { bold: true })
      break
    case "home":
      line(
        pulse.result.headline,
        pulse.result.tone === "danger" ? "notice.gate" : pulse.result.tone === "success" ? "chrome.hotkey" : "chrome.title",
        { bold: true },
      )
      break
    default:
      line("NEXUS PULSE", "chrome.title", { bold: true })
  }

  // Under it: the clock while it runs, what the phase means as it ends, why it ended once it has.
  if (pulse.phase === "home") {
    for (const reason of wrapWords(pulse.result.reason, limit - 1)) line(reason, "chrome.value")
  } else if (pulse.phase === "halted") {
    line("The shooting has stopped.", "chrome.label")
  } else if (pulse.phase === "walking") {
    line("The survivors walk home.", "chrome.label")
  } else {
    line(`${secondsOf(pulse, pulse.sample.tick)}s of ${secondsOf(pulse, pulse.pulseTicks)}s  ${pulse.speed}x${pulse.paused ? " paused" : ""}`, "chrome.label")
  }
  gap()

  // Both forces, each in its own side's colour.
  for (const player of PLAYERS) line(forceLine(pulse, player), playerRole(player))
  gap()

  if (pulse.phase === "home") {
    line("RECALL", "chrome.label")
    line(cameHome(pulse.home.A), "chrome.value")
    gap()
    for (const hint of wrapWords("For a new Build Phase: Esc, then Restart.", limit - 1)) line(hint, "chrome.muted")
  } else {
    line("RECENT", "chrome.label")
    const lines = pulse.sample.recent
      .map((event) => feedLine(pulse, event))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .slice(-FEED_ROWS)
    for (const entry of lines) line(entry.text, entry.role)
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
