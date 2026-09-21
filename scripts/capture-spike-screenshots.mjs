// Real-terminal screenshots of the Build Phase spike — Milestone 5 gate 5A.
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

shoot(
  "spike-minimum",
  "80x24, the acceptance floor: a 48x16 window onto a 96x40 Grid. The footer names the visible range; the border marks the sides with more Grid",
)

shoot(
  "spike-maximum",
  "104x32, the largest viewport the game will ever show: 72x24 tiles. A bigger terminal than this buys margin, never more Grid",
  { cols: 104, rows: 32 },
)

shoot(
  "spike-wide-tiles",
  "128x24: the same 48x16 viewport at two terminal columns per tile, where a tile stops being squashed 2:1",
  { cols: 128, rows: 24 },
)

shoot(
  "spike-armed-preview",
  "A barracks armed with [1] and previewed at the cursor. The ghost is the structure's own glyphs, so what you see is what Enter places",
  {
    drive: () => {
      literal("1")
      for (let step = 0; step < 6; step += 1) key("Right")
      key("Down")
    },
    waitForText: "Armed",
  },
)

shoot(
  "spike-illegal",
  "The same barracks over rock: the preview turns to a block of x and the footer says why. Shape carries the refusal, so it survives monochrome",
  {
    drive: () => {
      literal("1")
      for (let step = 0; step < 10; step += 1) key("Left")
      for (let step = 0; step < 8; step += 1) key("Up")
      // Pressing Enter is what produces the refusal *message*; the preview alone only shows the
      // shape. Both are in the shot, which is the point: you can see it is wrong before you try.
      literal("\r")
    },
    waitForText: "rock at",
  },
)

shoot(
  "spike-scrolled",
  "Scrolled into the middle of the Grid with Shift+Arrow and PageDown - real modified-arrow bytes through tmux. All four borders now mark more Grid",
  {
    drive: () => {
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
      for (let step = 0; step < 12; step += 1) key("S-Right")
      for (let step = 0; step < 2; step += 1) key("PPage")
    },
    waitForText: "view x",
  },
)

shoot(
  "spike-mouse-place",
  "A real SGR mouse click placing a structure: the bytes a terminal actually sends, not a description of one",
  {
    drive: () => {
      literal("1")
      // Column 31, row 17 (1-based) is tile 30,14 at the opening camera — the same cell
      // `cellForTile` hands the tests, formatted the way src/build/mouse.ts's own
      // `formatMouseEvent` would.
      literal(`${ESC}[<0;31;17M`)
    },
    waitForText: "Placed",
  },
)

shoot(
  "spike-confirm-mode",
  "The click question, made observable: [t] flips between placing on the first click and confirming on a second. Both ship; Mario picks",
  {
    drive: () => {
      literal("t")
      literal("1")
      literal(`${ESC}[<0;31;17M`)
    },
    waitForText: "Click again",
  },
)

shoot(
  "spike-monochrome",
  "Monochrome is the floor, not the degraded mode: the same screen with every colour removed, including the edge markers and the preview",
  {
    args: "--capability monochrome",
    drive: () => {
      literal("1")
      for (let step = 0; step < 4; step += 1) key("S-Right")
    },
    waitForText: "Armed",
  },
)

shoot(
  "spike-resize-gate",
  "79x24, one column below the floor: playback gates rather than cropping the Grid, and says exactly what it needs",
  { cols: 79, rows: 24 },
)

rmSync(scratch, { recursive: true, force: true })
