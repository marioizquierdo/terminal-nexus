// What "the browser page runs the terminal's code" has to mean, as one function: resolve a real
// Pulse, draw its frames, play a Build Phase and a menu by their real key bytes, and fingerprint all
// of it. `tests/web.test.ts` runs this once under Node and once bundled for a browser inside a sandbox
// with no Node features at all, and the two answers must be identical.

import { buildTimeline } from "../src/cli/timeline.ts"
import { starterContext } from "../src/cli/starter.ts"
import { TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { loadScenario } from "../src/scenario/load.ts"
import type { ScenarioDefinition } from "../src/scenario/types.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { buildLayout } from "../src/build/layout.ts"
import { MenuSession } from "../src/title-menu/session.ts"
import { keyBytes } from "../src/playtest/keys.ts"
import { sha256Hex } from "../src/state/sha256.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToAnsi } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { MENU_LAYOUT, composeMenuFrame } from "../src/view/menu.ts"
import { DEFAULT_PRESENTATION, createView } from "../src/view/snapshot.ts"

export type Sameness = Readonly<{
  stateHash: string
  eventsHash: string
  pulseFrames: readonly string[]
  buildFrames: readonly string[]
  menuFrames: readonly string[]
}>

const BUILD_SCRIPT = ["n", "Enter", "1", "Right", "Right", "Enter", "Down", "Down", "Space", "Tab", "S-Left", "q"]
const MENU_SCRIPT = ["Down", "Down", "Enter", "Up", "3"]

/** Colour and style included: a frame is fingerprinted as the exact ANSI text the terminal gets. */
const print = (frame: ReadonlyCellFrame): string => sha256Hex(frameToAnsi(frame, "truecolor", "dark"))

export function sameness(scenario: ScenarioDefinition): Sameness {
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const timeline = buildTimeline(scenario, loaded.state, loaded.registry, scenario.pulseTicks, scenario.seed)
  const view = createView(timeline, DEFAULT_PRESENTATION)
  const pulseFrames: string[] = []
  for (let time = 0; time <= view.durationMs; time += Math.max(1, Math.floor(view.durationMs / 40))) {
    pulseFrames.push(print(view.composeAt(time, "truecolor", { paused: false, speed: 1 })))
  }

  const context = starterContext()
  const layout = buildLayout({ columns: 80, rows: 24 }, context.grid)
  const build = new BuildSession({ context, cursor: STARTER_START_CURSOR, viewport: layout.viewport })
  const buildFrames = [print(composeBuildFrame({ context, state: build.state, layout }, "truecolor"))]
  for (const name of BUILD_SCRIPT) {
    build.handleData(keyBytes(name), layout)
    buildFrames.push(print(composeBuildFrame({ context, state: build.state, layout }, "truecolor")))
  }

  const menu = new MenuSession({ items: TOP_LEVEL_ITEMS, onActivate: () => {}, onQuit: () => {} })
  const menuFrames = [print(composeMenuFrame({ state: menu.state, notice: null }, "truecolor"))]
  for (const name of MENU_SCRIPT) {
    menu.handleData(keyBytes(name), MENU_LAYOUT)
    menuFrames.push(print(composeMenuFrame({ state: menu.state, notice: null }, "truecolor")))
  }

  return { stateHash: timeline.stateHash, eventsHash: timeline.eventsHash, pulseFrames, buildFrames, menuFrames }
}

// The bundled copy reports through a global, since a sandboxed script has no module to export from.
;(globalThis as { __terminalNexusSameness?: typeof sameness }).__terminalNexusSameness = sameness
