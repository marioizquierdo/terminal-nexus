// A resolved Pulse drawn the way the game draws it: the Build Phase screen's Battle Round
// (`composeBuildFrame` with the presenter's `PulseFrame`, `src/view/pulse-live.ts`), at any presentation
// instant, for any timeline — a sandbox's, a hand-built one. What the tests that hold a rule about the
// picture of a fight (effects never replace a glyph, monochrome stays whole, burning ground shows, two
// backends paint the same cells, the browser draws what Node draws, a frame stays inside its budget) draw.
//
// No Node import: `tests/web-helpers.ts` bundles this for a browser.

import { testBase } from "./starter-fixture.ts"
import type { Camera } from "../src/build/camera.ts"
import { buildLayout, cellForTile } from "../src/build/layout.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { createBuildState, withoutScene } from "../src/build/state.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import type { Coord } from "../src/engine/geometry/types.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import type { ColorDepth } from "../src/view/roles.ts"
import { DEFAULT_PRESENTATION } from "../src/view/snapshot.ts"
import type { PresentationOptions, PulseTimeline } from "../src/view/snapshot.ts"

export type BattleRoundScreen = Readonly<{
  layout: BuildLayout
  /** The north-west tile in view. */
  camera: Camera
  presenter: PulsePresenter
  /** The whole screen at a presentation instant, in milliseconds from the Pulse's start. `reducedMotion` overrides the
   *  presentation's own, as the player's setting does mid-Pulse. */
  frameAt(timeMs: number, colors: ColorDepth, reducedMotion?: boolean): ReadonlyCellFrame
  /** The screen cell a tile is drawn on. */
  cellOf(tile: Coord): Coord
}>

export type BattleRoundOptions = Readonly<{
  presentation?: PresentationOptions
  /** The terminal it is drawn on: the 80 x 24 floor unless given. */
  terminal?: Readonly<{ columns: number; rows: number }>
  /** The tile the view is centred near (clamped to the battlefield): the north-west corner unless given. */
  look?: Coord
  /** How many times faster a settled round plays (`src/view/fast-forward.ts`): 1 unless given, so a frame seeks to
   *  exactly the instant asked for. */
  fastForwardSpeed?: number
}>

/**
 * The Battle Round's screen for a timeline: the starter level's chrome (its scene left out) around this timeline's
 * battlefield, the plan committed, the keyboard off the map so no cursor covers a tile (every tile then shows what the fight
 * draws there).
 */
export function battleRoundScreen(timeline: PulseTimeline, options: BattleRoundOptions = {}): BattleRoundScreen {
  const presentation = options.presentation ?? DEFAULT_PRESENTATION
  const context: BuildContext = { ...withoutScene(testBase()), terrain: timeline.terrain, registry: timeline.registry }
  const layout = buildLayout(options.terminal ?? { columns: 80, rows: 24 }, timeline.terrain)
  const opened = createBuildState(context, options.look ?? { x: 0, y: 0 }, layout.viewport)
  const state: BuildState = { ...opened, committed: true }
  const last = timeline.states[timeline.states.length - 1]
  if (last === undefined) throw new Error("timeline holds no states")
  const presenter = new PulsePresenter({ timeline, regroup: { state: last, paths: [], ticks: 0 }, nexus: null }, presentation, { fastForwardSpeed: options.fastForwardSpeed ?? 1 })
  // Seeking is from the top every time, by exactly `timeMs`: playback time is then `timeMs` to the bit, so a frame on a
  // tick boundary is the frame on that boundary.
  const seek = (timeMs: number): void => {
    presenter.apply("restart")
    presenter.advance(0)
    presenter.advance(timeMs)
  }
  return {
    layout,
    camera: state.camera,
    presenter,
    frameAt(timeMs, colors, reducedMotion = presentation.reducedMotion) {
      seek(timeMs)
      const pulse = presenter.frame({ colors, reducedMotion, view: { camera: state.camera, viewport: state.viewport } })
      return composeBuildFrame({ context, state, layout, glyphPack: presentation.glyphPack, reducedMotion, pulse }, colors)
    },
    cellOf: (tile) => cellForTile(layout, state.camera, tile),
  }
}
