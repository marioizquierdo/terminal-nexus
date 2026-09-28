// A scripted playtest of the Build Phase: the `--spike` screen, driven by a key script through the
// real adapters, with every step's frame kept. No terminal, no clock, no capture race — the frames are
// composed in-process by the very function the live screen presents (`composeBuildFrame`), so step N's
// frame is exactly what a player would see after pressing step N's key.
//
// `scripts/playtest.mjs` wraps this with a command line and turns frames into text, PNGs and a GIF.
// Another screen (the main menu, a `grid` battle) would get a sibling of this file with the same
// shape: take steps, return frames.

import { SPIKE_START_CURSOR } from "../build/catalog.ts"
import { isGated } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { buildLayout, cellForTile, tileAtCell } from "../build/layout.ts"
import { formatMouseEvent } from "../build/mouse.ts"
import { BuildSession } from "../build/session.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { spikeContext } from "../cli/spike.ts"
import type { Coord } from "../grid/types.ts"
import { composeBuildFrame } from "../view/build.ts"
import type { ReadonlyCellFrame } from "../view/frame.ts"
import type { CapabilityMode } from "../view/roles.ts"
import type { GlyphPack } from "../view/theme.ts"
import type { MoveKind } from "../build/motion.ts"
import type { PlaytestStep } from "./keys.ts"

export type BuildPlaytestOptions = Readonly<{
  steps: readonly PlaytestStep[]
  /** The terminal size. The acceptance floor, 80 x 24, unless said otherwise. */
  columns?: number
  rows?: number
  capability?: CapabilityMode
  glyphPack?: GlyphPack
  context?: BuildContext
  cursor?: Coord
}>

export type PlaytestFrame = Readonly<{
  /** 0 is the screen as it opens, before any key; step N is the screen after the Nth step. */
  index: number
  /** The step's own name from the script, or "start". */
  label: string
  /** The exact bytes delivered for this step — what a terminal would have sent. */
  bytes: string
  state: BuildState
  frame: ReadonlyCellFrame
  /** The kind of move the last timed cursor key made — tap, hold, fast or jump — or `null` before
   *  any. */
  moveKind: MoveKind | null
}>

export type BuildPlaytest = Readonly<{
  context: BuildContext
  layout: BuildLayout
  frames: readonly PlaytestFrame[]
  /** Set when the script left the screen (`q`, or Esc with nothing armed); the steps after that one
   *  were not run, because there is no screen left for them to reach. */
  ended: Readonly<{ by: "quit"; atStep: number; skipped: number }> | null
}>

/** How far apart two steps are when a script does not say: longer than any key-repeat delay. */
export const UNTIMED_GAP_MS = 1000

export function runBuildPlaytest(options: BuildPlaytestOptions): BuildPlaytest {
  const context = options.context ?? spikeContext()
  const capability = options.capability ?? "truecolor"
  const glyphPack = options.glyphPack ?? "ascii"
  const terminal = { columns: options.columns ?? 80, rows: options.rows ?? 24 }
  // Below the floor the live screen shows its "terminal too small" notice instead of this one, so
  // a playtest there would be of a different screen.
  if (isGated(terminal, context.grid)) {
    throw new Error(`${terminal.columns}x${terminal.rows} is below the Build Phase's 80x24 floor`)
  }
  const layout = buildLayout(terminal, context.grid)

  let leftBy: "quit" | null = null
  const build = new BuildSession({
    context,
    cursor: options.cursor ?? SPIKE_START_CURSOR,
    viewport: layout.viewport,
    onQuit: () => {
      leftBy = "quit"
    },
  })

  const compose = (): ReadonlyCellFrame =>
    composeBuildFrame({ context, state: build.state, layout, glyphPack }, capability)

  const frames: PlaytestFrame[] = [{ index: 0, label: "start", bytes: "", state: build.state, frame: compose(), moveKind: null }]
  let ended: BuildPlaytest["ended"] = null

  // A clock of the script's own: each step arrives `afterMs` after the one before, or a second after it
  // when the script does not say — long enough that every untimed key is a press of its own, so the
  // held-key ramp (gate 5H) only ever runs where a script asks for it (`Right~30*12`).
  let clock = 0
  for (const [position, step] of options.steps.entries()) {
    clock += step.afterMs ?? UNTIMED_GAP_MS
    const bytes = deliver(build, layout, step, clock)
    frames.push({ index: position + 1, label: step.label, bytes, state: build.state, frame: compose(), moveKind: build.moveKind })
    if (leftBy !== null) {
      ended = { by: leftBy, atStep: position + 1, skipped: options.steps.length - position - 1 }
      break
    }
  }

  return { context, layout, frames, ended }
}

/** One step into the real adapters, on its own — never concatenated with the next one. Returns the
 *  bytes it sent. */
function deliver(build: BuildSession, layout: BuildLayout, step: PlaytestStep, now: number): string {
  if (step.kind === "key") {
    build.handleData(step.bytes, layout, { now })
    return step.bytes
  }
  const cell = mouseCell(build.state, layout, step)
  // A terminal reports a press and then a release. The release does nothing today, but sending it is
  // what makes this the real sequence rather than half of it.
  const press = formatMouseEvent(step.button, cell.x + 1, cell.y + 1)
  const release = `${press.slice(0, -1)}m`
  build.handleData(press, layout, { now })
  if (step.button < 64) build.handleData(release, layout, { now })
  return step.button < 64 ? press + release : press
}

function mouseCell(state: BuildState, layout: BuildLayout, step: Extract<PlaytestStep, { kind: "mouse" }>): Coord {
  const { target } = step
  if (target.kind === "cell") {
    if (target.column >= layout.frame.width || target.row >= layout.frame.height) {
      throw new Error(`"${step.label}": cell ${target.column},${target.row} is off a ${layout.frame.width}x${layout.frame.height} screen`)
    }
    return { x: target.column, y: target.row }
  }
  const cell = cellForTile(layout, state.camera, target.tile)
  const back = tileAtCell(layout, state.camera, cell.x, cell.y)
  if (back === null || back.x !== target.tile.x || back.y !== target.tile.y) {
    throw new Error(
      `"${step.label}": tile ${target.tile.x},${target.tile.y} is not on screen (the view starts at ${state.camera.x},${state.camera.y}); move the cursor there first`,
    )
  }
  return cell
}
