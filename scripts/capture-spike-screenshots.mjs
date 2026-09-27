// Screenshots of the Build Phase — Milestone 5.
//
//   node scripts/capture-spike-screenshots.mjs
//   node scripts/capture-spike-screenshots.mjs --only spike-minimum
//   node scripts/capture-spike-screenshots.mjs --out .playtest/shots   # somewhere other than evidence/
//   node scripts/capture-spike-screenshots.mjs --force                  # re-render even unchanged ones
//
// Two ways in, on purpose.
//
// **Most shots are composed in-process** (`scripted`, below): a key script goes through the real
// keyboard and mouse adapters exactly as `scripts/playtest.mjs` does it, and the picture is of the
// frame the engine's own composer produced after the last key. There is no terminal to wait for, so
// there is no capture race — a shot cannot come out one key early, which one did last round: waiting
// for "1 active" matched before the key that closes the popup had been drawn. Each shot also names a
// piece of text its frame must contain, and fails loudly if it does not.
//
// **A few stay on a real terminal** (`live`, below), because what they prove is the terminal path
// itself: the program starting up, the resize gate, real Shift+Arrow and PageDown bytes as tmux
// sends them, real SGR mouse clicks, and the `--capability monochrome` flag end to end. Those go
// through tmux -> capture-pane -e -> HTML -> headless Chromium (scripts/lib/terminal-capture.mjs),
// sending one key per tmux call with a short pause, then waiting for the pane to stop changing
// before it is photographed.
//
// Either way, a shot whose content did not change is not rewritten (see `renderPng`), so running
// this after a change touches only the pictures that change actually shows.
//
// Each shot names its own terminal size, because the size *is* the subject: 80x24 is the minimum
// viewport and the acceptance floor, 104x32 the maximum, 128x24 the two-columns-per-tile
// composition, and 79x24 the resize gate one column below the floor.

import { mkdirSync, rmSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { renderFramePng, renderFramesGif } from "./lib/frame-capture.mjs"
import {
  ESC,
  ansiToHtml,
  killSession,
  renderPngIfChanged,
  sendKey,
  sendKeys,
  settledPane,
  tmux,
  waitFor,
} from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const argument = (flag) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : null)
const outputDirectory = resolve(repoRoot, argument("--out") ?? join("evidence", "screenshots"))
const scratch = join(repoRoot, ".capture-tmp")
const SESSION = "terminal-nexus-spike-capture"
const only = argument("--only")

mkdirSync(outputDirectory, { recursive: true })

const report = (result) =>
  console.log(`${result.written ? "wrote" : "unchanged"} ${relative(repoRoot, result.path)}`)

/** Open the Nexus Powers popup, pick its first power, and close it again. */
const PICK_FIRST_POWER = "n 1 n"

// --- In-process shots ----------------------------------------------------------------------------

function scripted(name, caption, { keys, expect, cols = 80, rows = 24, capability = "truecolor" }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ steps: parseKeyScript(keys), columns: cols, rows, capability })
  const last = run.frames[run.frames.length - 1]
  const text = frameToText(last.frame)
  if (!text.includes(expect)) {
    throw new Error(`${name}: expected "${expect}" on screen after "${keys}", got:\n${text}`)
  }
  report(
    renderFramePng({
      frame: last.frame,
      capability,
      caption,
      targetPath: join(outputDirectory, `${name}.png`),
      scratchDir: scratch,
    }),
  )
}

/** A whole key script as an animated GIF, one frame per key. */
function scriptedGif(name, { keys, expect, cols = 80, rows = 24, capability = "truecolor", delayMs = 900, holdMs = 2500 }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ steps: parseKeyScript(keys), columns: cols, rows, capability })
  const lastIndex = run.frames.length - 1
  if (!frameToText(run.frames[lastIndex].frame).includes(expect)) {
    throw new Error(`${name}: expected "${expect}" on screen after "${keys}"`)
  }
  const result = renderFramesGif({
    shots: run.frames.map((frame) => ({
      frame: frame.frame,
      caption: frame.index === 0 ? "as it opens" : `step ${frame.index} of ${lastIndex}: ${frame.label}`,
      delayMs: frame.index === lastIndex ? holdMs : delayMs,
    })),
    capability,
    targetPath: join(outputDirectory, `${name}.gif`),
    scratchDir: scratch,
  })
  report(result)
}

scriptedGif("build-hatchery-run", {
  // The owner's own flow from the opening screen: highlight the Hatchery, arm it from the menu (the
  // cursor lands for you), place it, arm it again, place it again — no arrow key on the Grid at all.
  keys: "Down*3 Space*4",
  expect: "Hatchery placed (resources: 40)",
})

scripted(
  "spike-minimum",
  "80x24, the acceptance floor: the menu on the left, a 48x16 window onto a 96x40 Grid closed into its own rectangle, a solid bar on each side where the map ends",
  { keys: PICK_FIRST_POWER, expect: "MENU  up/down" },
)

scripted(
  "build-focus-grid",
  "Tab (or [e] Explore) moves the keyboard to the Grid with nothing armed: the key help says EXPLORE, no menu row is marked, and the cursor is the one highlight on screen",
  { keys: `${PICK_FIRST_POWER} Tab`, expect: "EXPLORE  arrows move" },
)

scripted(
  "build-info-panel",
  "Exploring, Enter on a building swaps the menu for its information: its own glyphs, its name and what it is for, and its numbers. [esc] top right brings the menu back",
  { keys: `${PICK_FIRST_POWER} Tab Up*2 Enter`, expect: "Citizen Nexus" },
)

scripted(
  "build-smart-cursor",
  "Down three times and Space: the Hatchery is armed from the menu and the cursor lands for you - one free tile east of the Grid Nexus, sharing its top row. The armed row and the cursor are the only two highlights",
  { keys: `${PICK_FIRST_POWER} Down*3 Space`, expect: "Hatchery selected" },
)

scripted(
  "build-menu-run",
  "The owner's own flow: Space arms, Space places and returns the keyboard to the menu, again and again. Three barracks in a tidy line, one free tile between each, drawn at full strength",
  { keys: `${PICK_FIRST_POWER} Down*2 Space*6`, expect: "10 of 130" },
)

scripted(
  "build-nexus-popup",
  "[n] opens the Nexus popup: a solid border, [esc] in its corner, and a shadow, so it cannot be missed. A click outside it closes it and brings the keyboard to wherever the click landed",
  { keys: "n Down", expect: "PICK ONE" },
)

scripted(
  "build-nexus-popup-picked",
  "104x32, after picking: nothing waiting, the pick listed as active with what it does, and the budget above the menu already counting it",
  { keys: "n 2", expect: "Nothing waiting", cols: 104, rows: 32 },
)

scripted(
  "build-exit-question",
  "Esc on the menu asks before leaving: [q] quits, Esc or x keeps playing. A stray q asks the same question rather than losing a plan",
  { keys: `${PICK_FIRST_POWER} Esc`, expect: "EXIT THE GAME?" },
)

scripted(
  "build-grid-edge",
  "Hard against the Grid's north-west corner: the top and left sides are solid bars because the map ends there, the bottom and right stay thin because there is more map that way",
  { keys: `${PICK_FIRST_POWER} Tab S-Left*5 S-Up*5`, expect: "cursor 0,0" },
)

scripted(
  "spike-maximum",
  "104x32, the largest viewport the game will ever show: 72x24 tiles. A bigger terminal than this buys margin, never more Grid",
  { keys: PICK_FIRST_POWER, expect: "MENU  up/down", cols: 104, rows: 32 },
)

scripted(
  "spike-wide-tiles",
  "128x24: the same 48x16 viewport at two terminal columns per tile, where a tile stops being squashed 2:1",
  { keys: PICK_FIRST_POWER, expect: "MENU  up/down", cols: 128, rows: 24 },
)

scripted(
  "spike-armed-preview",
  "The digit fast path: [1] arms Barracks from anywhere and leaves the cursor where it is; the preview shows at the cursor in its own glyphs - what you see is what Enter places",
  { keys: `${PICK_FIRST_POWER} 1 Right*6 Down`, expect: "selected -" },
)

scripted(
  "spike-illegal",
  "The same barracks over rock, after pressing Enter: the preview is a grey block of x and the status line says why, naming the tile - in red, because a placement was tried and refused",
  { keys: `${PICK_FIRST_POWER} 1 Left*10 Up*8 Enter`, expect: "rock in the way" },
)

scripted(
  "spike-crater",
  "The north-east crater, 70 tiles east of where the cursor started - the part of the Grid that exists only because scrolling does",
  { keys: `${PICK_FIRST_POWER} Tab S-Right*12 PgUp*2`, expect: "view x" },
)

scripted(
  "build-just-placed",
  "Right after a placement: the building is drawn in full, the keyboard is back on the menu on the same row, and the status line says what is left and how to take it back",
  { keys: `${PICK_FIRST_POWER} 1 Right*6 Down Enter`, expect: "Barracks placed (resources: 90) - [u] undo" },
)

scripted(
  "build-spent-down",
  "Two barracks and a hatchery placed, 20 of 130 left: the rows that no longer fit are dimmed, and pressing [1] anyway is refused at the menu with the cost - affordability first, before any tile",
  {
    keys: `${PICK_FIRST_POWER} 1 Right*6 Down Enter 1 Right*4 Enter 2 Right*4 Enter 1`,
    expect: "costs 40, 20 left",
  },
)

scripted(
  "build-nexus-confirm",
  "Pressing [p] asks once, in a popup, whether to end the Build Phase and start the Nexus Pulse",
  { keys: `${PICK_FIRST_POWER} p`, expect: "START THE NEXUS PULSE?" },
)

scripted(
  "build-nexus-committed",
  "Accepting the prompt commits the Build Phase: the panel names the Nexus power picked and how many structures were planned, and nothing more can change",
  { keys: `${PICK_FIRST_POWER} 1 Right*6 Down Enter p y`, expect: "BUILD COMMITTED" },
)

// --- Real-terminal shots -------------------------------------------------------------------------

function live(name, caption, { cols = 80, rows = 24, args = "--capability truecolor --theme dark", drive, waitForText } = {}) {
  if (only !== null && only !== name) return
  killSession(repoRoot, SESSION)
  tmux(repoRoot, [
    "new-session",
    "-d",
    "-s",
    SESSION,
    "-x",
    String(cols),
    "-y",
    String(rows),
    `./bin/terminal-nexus.ts --spike ${args}`,
  ])
  waitFor(
    repoRoot,
    SESSION,
    (text) => text.includes("TERMINAL NEXUS") || text.includes("TERMINAL TOO SMALL"),
    "the first frame",
  )
  if (drive !== undefined) drive()
  if (waitForText !== undefined) {
    waitFor(repoRoot, SESSION, (text) => text.includes(waitForText), `"${waitForText}" to appear`)
  }
  // The text appearing proves the app got at least that far; a still pane proves it got no further.
  const colour = settledPane(repoRoot, SESSION)
  report(
    renderPngIfChanged({
      html: ansiToHtml(colour, cols, rows),
      caption,
      cols,
      rows,
      scratchDir: scratch,
      targetPath: join(outputDirectory, `${name}.png`),
      background: "dark",
    }),
  )
  killSession(repoRoot, SESSION)
}

const key = (name) => sendKey(repoRoot, SESSION, name)
const literal = (bytes) => sendKeys(repoRoot, SESSION, bytes)
/** In tmux, `n`, `1`, `n` — never Esc to close: see `KEY_PAUSE_SECONDS`. */
const pickFirstPower = () => {
  literal("n")
  literal("1")
  literal("n")
}

live(
  "build-idle",
  "The Build Phase opens on the menu, on the left: the keyboard on [n] Nexus at the top, its (1) the one pick still waiting, [e] Explore under it. No cursor on the Grid while the menu has the keyboard",
  { waitForText: "RESOURCE" },
)

live(
  "spike-scrolled",
  "Scrolled into the middle of the Grid with Shift+Arrow and PageDown - real modified-arrow bytes through tmux. All four borders now mark more Grid",
  {
    drive: () => {
      pickFirstPower()
      key("Tab")
      for (let step = 0; step < 4; step += 1) {
        key("S-Right")
        key("NPage")
      }
    },
    waitForText: "cursor 38,33",
  },
)

live(
  "spike-mouse-place",
  "Two real SGR mouse clicks placing a structure - the first arms the preview at the tile, the second confirms it (Q52): the bytes a terminal actually sends, not a description of one",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      // Column 62, row 13 (1-based) is tile 30,10 at the opening camera — the same cell
      // `cellForTile` hands the tests, formatted the way src/build/mouse.ts's own
      // `formatMouseEvent` would. The first click only moves the cursor there; the second, on the
      // same tile, is what actually places it. Chosen well inside the scroll margin: a first click
      // near the Grid pane's edge scrolls the map under the pointer, and a second click in the same
      // place is then a first click on the tile beside it (Q52's own finding).
      literal(`${ESC}[<0;62;13M`)
      literal(`${ESC}[<0;62;13M`)
    },
    waitForText: "Barracks placed",
  },
)

live(
  "spike-monochrome",
  "Monochrome is the floor, not the degraded mode: the same screen with every colour removed, the light and heavy edges, the highlight bar and the preview included",
  {
    args: "--capability monochrome",
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 4; step += 1) key("S-Right")
    },
    waitForText: "cursor 38,13",
  },
)

live(
  "spike-resize-gate",
  "79x24, one column below the floor: playback gates rather than cropping the Grid, and says exactly what it needs",
  { cols: 79, rows: 24 },
)

rmSync(scratch, { recursive: true, force: true })
