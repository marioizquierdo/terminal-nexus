// The Build Phase frame — engine.md 9.2's composition, on the same band compositor, style roles and
// glyph packs as the Pulse view and the menu, so monochrome and the colour tiers come free.
//
// The Grid pane is a **window onto a Grid larger than itself**: every tile is drawn at
// `tile - camera` and clipped to the viewport, and the signal engine.md 3.3 requires in place of a
// minimap — the weight of the lines around the Grid pane — comes from the same camera the cursor moved
// (the only signal: no position readout, feedback F59).
//
// This file puts the frame together; each part the design names is drawn in a file of its own: the
// frame and the two bars (`build-frame.ts`), the Grid pane (`build-grid.ts`), the menu and its rows
// (`build-menu.ts`), cards and the card reveal (`build-card.ts`), hand-offs to the map
// (`build-handoff.ts`) and popups (`build-popup.ts`).

import type { Coord } from "../grid/types.ts"
import type { Camera } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { armedPreview, cardShowing } from "../build/state.ts"
import type { Ack } from "../build/types.ts"
import type { BandCell, ReadonlyCellFrame } from "./frame.ts"
import { BANDS, composeBands } from "./frame.ts"
import { text } from "./draw.ts"
import { drawTerrain } from "./grid-layer.ts"
import type { PulseFrame } from "./pulse-scene.ts"
import { drawFrameLight, drawPulseEffects, drawPulseEntities, drawPulsePanel } from "./pulse-scene.ts"
import type { CapabilityMode } from "./roles.ts"
import type { GlyphPack } from "./theme.ts"
import type { PlacementClock, PlacementTuning, RemovalClock } from "./placement.ts"
import { drawChrome, drawTopBarAndBottomLine } from "./build-frame.ts"
import { animatingPlacements, drawGrid, drawEffects, drawPreview, drawCursor, drawRefusedTry } from "./build-grid.ts"
import { drawPanel } from "./build-menu.ts"
import type { CardReveal } from "./build-card.ts"
import { drawCard } from "./build-card.ts"
import { drawHandoff } from "./build-handoff.ts"
import type { PopupBreath } from "./build-popup.ts"
import { drawPopup } from "./build-popup.ts"

// What tests and scripts import from here, wherever it now lives.
export { ACTIVE_VALUE } from "./build-menu.ts"
export { CARD_BEATS } from "./build-card.ts"
export type { CardReveal } from "./build-card.ts"
export type { PopupBreath } from "./build-popup.ts"
export { SEE_THROUGH_TRAIL } from "./build-handoff.ts"

export type BuildCompositionInput = Readonly<{
  context: BuildContext
  state: BuildState
  layout: BuildLayout
  glyphPack?: GlyphPack
  /** A menu row's brief acknowledgement (`BuildState.ack`), while the live loop is showing it — the
   *  "pressed" flash or the "refused" flicker. Presentation only; absent in every still frame. */
  ack?: RowAck
  /**
   * The camera the Grid is drawn through, while the live loop is sliding the view toward the state's
   * own camera (gate 5H). Presentation only: absent, the state's camera is drawn — every still frame,
   * every test, every scripted playtest.
   */
  camera?: Camera
  /**
   * The tile the cursor is drawn on, while the live loop glides it toward the state's own cursor
   * (after the owner's 2026-09-28 playtest). Presentation only: the armed preview and a refused try's
   * flash are drawn shifted along with it, but what they say — legal or not, and why — is about the
   * state's cursor, where Enter would act. Absent, the state's cursor is drawn.
   */
  cursor?: Coord
  /** A **refused try** (`BuildState.refusedTry`): the footprint flashes where a placement was just tried
   *  and refused, while the live loop shows it (gate 5H; for the tuned `refusedCursorMs`). Presentation
   *  only. */
  refusedTry?: boolean
  /**
   * A **hand-off's flight** (owner, 2026-09-30, feedback F54): a menu row has just handed the keyboard
   * to the map, and something flies from where the row is on the menu to the cursor (F63) — the focus
   * arrow from a building's row, the see-through cursor from Explore Map's (F64). `progress` runs 0 to
   * 1, linear in time; the view eases it. The live loop supplies it (the "Focus arrow" Experiment times
   * both); absent — every still frame — nothing flies.
   */
  handoffFlight?: Readonly<{ progress: number }>
  /** The cursor is in the "on" half of its blink, after the flight lands (F54; the tuned
   *  `cursorBlinks`): drawn in a menu row's pressed look. Absent — every still frame — the plain cursor. */
  cursorBlink?: boolean
  /**
   * The menu turning into a card (owner, 2026-09-30, feedback F68; the "Card reveal" Experiment): the
   * live loop's clock on it, from the frame the panel first became a card. Absent — every still frame —
   * the finished card, exactly as it stands.
   */
  cardReveal?: CardReveal
  /**
   * The open popup's border breathing (owner, 2026-09-30, feedback F80): the live loop's clock on it and
   * the length of one breath. The live loop supplies it for the Battle Round screen alone, while the
   * "Battle Round pulse" Experiment is on and motion is not reduced; absent — every still frame — the
   * border is at rest.
   */
  popupBreath?: PopupBreath
  /**
   * Planned placements still animating, by ordinal, with how long ago each was placed (gate 5I). The
   * live loop supplies it; a still frame names whatever instant it wants to draw. Absent — every
   * test, every scripted playtest — each building is drawn finished. A clock whose ordinal is no
   * longer planned (undone, removed) draws nothing: the plan decides what stands, the clock only how.
   */
  placing?: readonly PlacementClock[]
  /** Buildings that just left the plan, with how long ago each went (feedback F33): their sparks. The
   *  live loop supplies it; absent — every still frame — nothing is drawn for a removal. */
  removing?: readonly RemovalClock[]
  /** The numbers the live loop timed `placing` and `removing` by, so their tracks are drawn as the loop
   *  scheduled them. Absent, the owner's tuned ones (`TUNING`). */
  placementTuning?: PlacementTuning
  /** The player's reduced-motion setting: a placement then shows its finished building at once. */
  reducedMotion?: boolean
  /**
   * A Nexus Pulse is on screen (gate 6A): what it is showing at this instant, worked out by the presenter
   * (`pulse-live.ts`). Present, the Grid shows the fight and the panel the forces and the ending, in this
   * same frame and under the same popups; absent — every Build Phase frame, and every test that never
   * starts a Pulse — the frame is the Build Phase's, exactly as it always was.
   */
  pulse?: PulseFrame
}>

/** A menu row's acknowledgement as the live loop shows it: the state's `ack` without its sequence
 *  number — which row, and whether it was **pressed** or **refused**. */
export type RowAck = Readonly<Pick<Ack, "kind" | "entry">>

/** The panel once the plan is committed with no Nexus Pulse to show (the session was given no way to
 *  start one, as in a test): what was committed. */
function drawCommittedPanel(cells: BandCell[], input: BuildCompositionInput): void {
  const { context, state, layout } = input
  const band = BANDS.chrome
  const column = layout.panelColumn
  const limit = layout.panelLimit
  const picked = state.nexusPick === null ? null : context.nexusDraft[state.nexusPick]
  text(cells, band, column, layout.panelRow, "BUILD COMMITTED", "chrome.label", { limit })
  if (picked !== undefined && picked !== null) {
    text(cells, band, column, layout.panelRow + 2, `Nexus: ${picked.name}`, "chrome.value", { limit })
  }
  const count = state.planned.length
  text(cells, band, column, layout.panelRow + 3, `${count} structure${count === 1 ? "" : "s"} planned`, "chrome.value", {
    limit,
  })
  text(cells, band, column, layout.panelRow + 5, "[esc] menu", "chrome.muted", { limit })
}

export function composeBuildFrame(
  given: BuildCompositionInput,
  capability: CapabilityMode,
): ReadonlyCellFrame {
  // A sliding view is drawn through the camera it has reached, not the one it is heading for: the
  // Grid, the preview, the cursor and the edge weights all move together.
  const input: BuildCompositionInput =
    given.camera === undefined ? given : { ...given, state: { ...given.state, camera: given.camera } }
  const pack: GlyphPack = input.glyphPack ?? "ascii"
  const cells: BandCell[] = []

  // A Nexus Pulse on screen replaces what the Build Phase drew on the Grid and in the panel with the fight
  // and its forces; the frame, the top and bottom bars, the cursor and every popup are the same code.
  if (input.pulse !== undefined) {
    const view = { camera: input.state.camera, viewport: input.state.viewport, layout: input.layout, grid: input.context.grid }
    drawTerrain(cells, view, pack)
    drawPulseEffects(cells, view, input.pulse, drawPulseEntities(cells, view, input.pulse))
    drawCursor(cells, input)
    drawChrome(cells, input, pack)
    drawFrameLight(cells, input.layout, input.pulse)
    drawTopBarAndBottomLine(cells, input, null)
    const panel: BandCell[] = []
    drawPulsePanel(panel, input.layout, input.pulse, input.state.pulseNumber)
    for (const cell of panel) if (cell.y <= input.layout.panelLastRow) cells.push(cell)
    drawPopup(cells, input, pack)
    return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
  }

  // What Enter would do at the cursor, derived once and read by the ghost, the bottom line and the
  // panel alike — the reducer's `place()` acts on the very same derivation.
  const preview = armedPreview(input.context, input.state)
  const animating = animatingPlacements(input)
  drawGrid(cells, input, pack, animating)
  drawEffects(cells, input, animating, capability)
  drawPreview(cells, input, preview)
  drawCursor(cells, input)
  drawRefusedTry(cells, input, preview)
  drawChrome(cells, input, pack)
  drawTopBarAndBottomLine(cells, input, preview)

  // The panel shows the menu, or a card — Explore Map's, or the armed building's — or the committed
  // summary. Clipped to the panel's own rows: on a terminal too short for the whole menu, a row that
  // does not fit is left off rather than drawn over the rule and the bottom bar.
  const panel: BandCell[] = []
  if (input.state.committed) drawCommittedPanel(panel, input)
  else if (cardShowing(input.state)) drawCard(panel, input, pack, capability)
  else drawPanel(panel, input, pack, capability)
  for (const cell of panel) if (cell.y <= input.layout.panelLastRow) cells.push(cell)
  // The hand-off crosses from the panel into the map, so it is drawn over both — and under any popup.
  drawHandoff(cells, input, pack, preview)
  drawPopup(cells, input, pack)

  return composeBands(input.layout.frame.width, input.layout.frame.height, cells)
}
