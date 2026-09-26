// Real-terminal screenshots of the Build Phase — Milestone 5.
//
//   node scripts/capture-spike-screenshots.mjs
//   node scripts/capture-spike-screenshots.mjs --only spike-minimum
//
// The same tmux -> capture-pane -e -> HTML -> headless Chromium pipeline the menu and `grid` shots
// already use (scripts/lib/terminal-capture.mjs). It matters more here than anywhere so far, for
// two reasons Gate 3A learned the hard way:
//
//   - a frame's *text* is what the tests assert on, and it says nothing about whether a screen full
//     of scrolling Grid is legible. Only a picture does.
//   - a fake stdin sends one logical key per event. A real terminal sends whatever it sends, when it
//     sends it — which is how Gate 3A found a live bug no unit test could reproduce. Every key below
//     goes in by its real tmux key name (`S-Right`, `NPage`) or as the literal bytes a terminal
//     emits, so the keyboard and mouse adapters are exercised against reality, not against a
//     description of it.
//
// Each shot names its own terminal size, because the size *is* the subject: 80x24 is the minimum
// viewport and the acceptance floor, 104x32 the maximum, 128x24 the two-columns-per-tile
// composition, and 79x24 the resize gate one column below the floor.

import { rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ESC, ansiToHtml, killSession, pane, renderPng, tmux, waitFor } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(repoRoot, "evidence", "screenshots")
const scratch = join(repoRoot, ".capture-tmp")
const SESSION = "terminal-nexus-spike-capture"

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null

function key(name) {
  tmux(repoRoot, ["send-keys", "-t", SESSION, name])
}

function literal(bytes) {
  tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", bytes])
}

function shoot(
  name,
  caption,
  { cols = 80, rows = 24, args = "--capability truecolor --theme dark", drive, waitForText } = {},
) {
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
  const colour = pane(repoRoot, SESSION, { colour: true })
  renderPng({
    html: ansiToHtml(colour, cols, rows),
    caption,
    cols,
    rows,
    scratchDir: scratch,
    targetPath: join(outputDirectory, `${name}.png`),
    background: "dark",
  })
  killSession(repoRoot, SESSION)
  console.log(`wrote ${name}.png`)
}

/** Open the Nexus Powers popup, pick its first power, and close it again with `n` — never with Esc:
 *  an Esc and the next key arriving in the same read are one Option+key sequence to the input
 *  splitter (`keysFromChunk`), and tmux can deliver two quick sends as one read. */
function pickFirstPower() {
  literal("n")
  literal("1")
  literal("n")
}

shoot(
  "build-idle",
  "The Build Phase opens on the menu, on the left: keyboard focus on the Nexus Powers entry at the top, its (1) the one pick still waiting. Nothing is forced open - the key help says focus is on the MENU",
  { waitForText: "RESOURCE" },
)

shoot(
  "spike-minimum",
  "80x24, the acceptance floor: the menu on the left, a 48x16 window onto a 96x40 Grid closed into its own rectangle on the right, the top and bottom bars across the whole width",
  { drive: pickFirstPower, waitForText: "MENU  up/down" },
)

shoot(
  "build-focus-grid",
  "Tab moves keyboard focus to the Grid: the key help now starts GRID and lists what arrows and Enter mean there, and the menu's highlight bar is gone",
  {
    drive: () => {
      pickFirstPower()
      key("Tab")
    },
    waitForText: "GRID  arrows move",
  },
)

shoot(
  "build-smart-cursor",
  "Down, down, Space: the Hatchery is armed from the menu and the cursor lands for you - one free tile east of the Grid Nexus, sharing its top row - so Space places it with no arrow key",
  {
    drive: () => {
      pickFirstPower()
      key("Down")
      key("Down")
      key("Space")
    },
    waitForText: "Hatchery selected",
  },
)

shoot(
  "build-menu-run",
  "The owner's own flow, Space four more times: place, arm again, place, arm again. Three barracks in a tidy line, aligned, one free tile between each, and focus back on the menu after every placement",
  {
    drive: () => {
      pickFirstPower()
      key("Down")
      for (let step = 0; step < 6; step += 1) key("Space")
    },
    waitForText: "10 of 130",
  },
)

shoot(
  "build-nexus-popup",
  "[n] opens the Nexus Powers popup over the Grid - the game's first overlay. Pick by digit, by Up/Down and Enter, or by a click; Esc closes it. A power may not be skipped, but only the commit says so",
  {
    drive: () => {
      literal("n")
      key("Down")
    },
    waitForText: "PICK ONE",
  },
)

shoot(
  "build-nexus-popup-picked",
  "104x32, after picking: nothing waiting, the pick listed as active with what it does, and the budget above the menu already counting it",
  {
    cols: 104,
    rows: 32,
    drive: () => {
      literal("n")
      literal("2")
    },
    waitForText: "Nothing waiting",
  },
)

shoot(
  "build-grid-edge",
  "Hard against the Grid's north-west corner: the top and left sides read heavy (===) because the map ends there, the bottom and right stay light because there is more Grid that way",
  {
    drive: () => {
      pickFirstPower()
      key("Tab")
      for (let step = 0; step < 5; step += 1) {
        key("S-Left")
        key("S-Up")
      }
    },
    waitForText: "cursor 0,0",
  },
)

shoot(
  "spike-maximum",
  "104x32, the largest viewport the game will ever show: 72x24 tiles. A bigger terminal than this buys margin, never more Grid",
  { cols: 104, rows: 32, drive: pickFirstPower, waitForText: "MENU  up/down" },
)

shoot(
  "spike-wide-tiles",
  "128x24: the same 48x16 viewport at two terminal columns per tile, where a tile stops being squashed 2:1",
  { cols: 128, rows: 24, drive: pickFirstPower, waitForText: "MENU  up/down" },
)

shoot(
  "spike-armed-preview",
  "The digit fast path: [1] arms Barracks from anywhere, moves focus to the Grid and leaves the cursor where it is; the preview shows at the cursor in its own glyphs - what you see is what Enter places",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 6; step += 1) key("Right")
      key("Down")
    },
    waitForText: "selected -",
  },
)

shoot(
  "spike-illegal",
  "The same barracks over rock, after pressing Enter: the preview is a grey block of x and the status line says why, naming the tile - in red, because a placement was tried and refused. Shape carries the refusal, so it survives monochrome",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 10; step += 1) key("Left")
      for (let step = 0; step < 8; step += 1) key("Up")
      // Only looking, the status line already says why, quietly; pressing Enter is what turns the
      // same sentence red — the acknowledgement that the attempt was received and refused.
      literal("\r")
    },
    waitForText: "rock in the way",
  },
)

shoot(
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
    waitForText: "view x",
  },
)

shoot(
  "spike-crater",
  "The north-east crater, 70 tiles east of where the cursor started - the part of the Grid that exists only because scrolling does",
  {
    drive: () => {
      pickFirstPower()
      key("Tab")
      for (let step = 0; step < 12; step += 1) key("S-Right")
      for (let step = 0; step < 2; step += 1) key("PPage")
    },
    waitForText: "view x",
  },
)

shoot(
  "spike-mouse-place",
  "Two real SGR mouse clicks placing a structure - the first arms the preview at the tile, the second confirms it (Q52): the bytes a terminal actually sends, not a description of one",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      // Column 62, row 13 (1-based) is tile 30,10 at the opening camera — the same cell
      // `cellForTile` hands the tests, formatted the way src/build/mouse.ts's own
      // `formatMouseEvent` would; 30 columns further right than before gate 5F moved the panel to
      // the left. The first click only moves the cursor there; the second, on the same tile, is what
      // actually places it. Chosen well inside the scroll margin: a first click near the Grid pane's
      // edge scrolls the map under the pointer, and a second click in the same place is then a first
      // click on the tile beside it (Q52's own finding).
      literal(`${ESC}[<0;62;13M`)
      literal(`${ESC}[<0;62;13M`)
    },
    waitForText: "planned at",
  },
)

shoot(
  "build-just-placed",
  "Right after a placement, still armed and the cursor still on it: the built structure shows through undisturbed rather than the illegal-preview block a fresh legality check would otherwise find here (2026-09-26 owner feedback) - pressing Enter again here does nothing until the cursor moves",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 6; step += 1) key("Right")
      key("Down")
      literal("\r") // place it
      literal("\r") // a repeated place on the same tile: a no-op, not a refusal
    },
    waitForText: "planned at",
  },
)

shoot(
  "build-spent-down",
  "Two barracks and a hatchery placed, 20 of 130 left: the rows that no longer fit are dimmed, and the status line says what the selected one would cost against what is left - affordability first, whatever the tile",
  {
    drive: () => {
      // The first Nexus power adds 30, so the budget is 130: two barracks (80) and a hatchery (30)
      // leave 20, which a barracks (40) no longer fits and the turret (15) still does.
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 6; step += 1) key("Right")
      key("Down")
      literal("\r")
      for (let step = 0; step < 4; step += 1) key("Right")
      literal("\r")
      literal("2") // arm Hatchery
      for (let step = 0; step < 4; step += 1) key("Right")
      literal("\r")
      for (let step = 0; step < 4; step += 1) key("Right") // clear of the hatchery, so it shows
      literal("1") // Barracks again: 40, with 20 left
    },
    waitForText: "costs 40, 20 left",
  },
)

shoot(
  "spike-monochrome",
  "Monochrome is the floor, not the degraded mode: the same screen with every colour removed, the light and heavy edges, the highlight bar and the preview included",
  {
    args: "--capability monochrome",
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 4; step += 1) key("S-Right")
    },
    waitForText: "selected -",
  },
)

shoot(
  "spike-resize-gate",
  "79x24, one column below the floor: playback gates rather than cropping the Grid, and says exactly what it needs",
  { cols: 79, rows: 24 },
)

shoot(
  "build-nexus-confirm",
  "Pressing [p] asks once, in plain yes-or-no terms, whether to end the Build Phase and start the Nexus Pulse",
  {
    drive: () => {
      pickFirstPower()
      literal("p") // ask to start the Nexus Pulse
    },
    waitForText: "START NEXUS PULSE",
  },
)

shoot(
  "build-nexus-committed",
  "Accepting the prompt commits the Build Phase: the panel names the Nexus power picked and how many structures were planned, and nothing more can change",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      for (let step = 0; step < 6; step += 1) key("Right")
      key("Down")
      literal("\r") // place it - still armed, cursor still on it, and it reads as built, not refused
      literal("p") // ask to start the Nexus Pulse
      literal("y") // accept
    },
    waitForText: "BUILD COMMITTED",
  },
)

rmSync(scratch, { recursive: true, force: true })
