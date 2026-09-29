// One step of a key script into a Build Phase session, through the real adapters: a key as the bytes
// a terminal sends, a click as the SGR press and release it reports, at the cell where the named tile
// is drawn right now. Shared by the scripted playtest (`./build.ts`) and the live screen's "start in
// this state" (`--keys`, `src/cli/spike.ts`), so a state reached by a script is the state a player
// reaches by the same keys.

import type { BuildLayout } from "../build/layout.ts"
import { cellForTile, tileAtCell } from "../build/layout.ts"
import { formatMouseEvent } from "../build/mouse.ts"
import type { BuildSession } from "../build/session.ts"
import type { BuildState } from "../build/state.ts"
import type { Coord } from "../grid/types.ts"
import type { PlaytestStep } from "./keys.ts"

/** How far apart a script's untimed steps arrive: far enough that every one is a press of its own, so
 *  the held-key ramp only runs where a script times its steps (`Right~30*12`). */
export const UNTIMED_GAP_MS = 1000

/** One step into the real adapters, on its own — never concatenated with the next one. Returns the
 *  bytes it sent. */
export function deliverStep(build: BuildSession, layout: BuildLayout, step: PlaytestStep, now: number): string {
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
