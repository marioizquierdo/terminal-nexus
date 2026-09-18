// One real screenshot of `terminal-nexus`'s top-level menu — Milestone 3 gate 3A evidence. Not a
// blocking human check for this gate (see evidence/gate-3a-report.md Section 1), but the project's
// own habit is a screenshot for every gate, and the pipeline already exists for `grid`
// (capture-screenshots.mjs): tmux (a real PTY, so the ANSI backend takes the same path a person
// gets) -> capture-pane -e -> HTML -> headless Chromium.
//
//   node scripts/capture-menu-screenshot.mjs

import { rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ESC, ansiToHtml, killSession, pane, renderPng, tmux, waitFor } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(repoRoot, "evidence", "screenshots")
const scratch = join(repoRoot, ".capture-tmp")
const SESSION = "terminal-nexus-capture"
const COLS = 80
const ROWS = 24

function shoot(
  name,
  caption,
  { args = "--capability truecolor --theme dark", drive, waitForText, background = "dark" } = {},
) {
  killSession(repoRoot, SESSION)
  tmux(repoRoot, [
    "new-session",
    "-d",
    "-s",
    SESSION,
    "-x",
    String(COLS),
    "-y",
    String(ROWS),
    `./bin/terminal-nexus.ts ${args}`,
  ])
  waitFor(repoRoot, SESSION, (text) => text.includes("TERMINAL NEXUS"), "the first frame")
  if (drive !== undefined) drive()
  // `send-keys` returns as soon as the bytes are injected into the pty, not once the app has
  // reacted to them — a plain navigation redraw is fast enough that this was never visible, but a
  // settings row that cycles a value, writes it to a real file, and re-renders needs to actually be
  // waited for, or the capture below can land a beat early and show the screen mid-change.
  if (waitForText !== undefined) {
    waitFor(repoRoot, SESSION, (text) => text.includes(waitForText), `"${waitForText}" to appear`)
  }
  const colour = pane(repoRoot, SESSION, { colour: true })
  const html = ansiToHtml(colour, COLS, ROWS)
  renderPng({
    html,
    caption,
    cols: COLS,
    rows: ROWS,
    scratchDir: scratch,
    targetPath: join(outputDirectory, `${name}.png`),
    // Matches the page wrapper to whichever theme this shot actually demonstrates — the same thing
    // capture-screenshots.mjs does for grid's own light-theme shots. The light theme's palette is
    // designed to sit on a light terminal background; without this, its own text renders nearly
    // invisibly against a page still assuming a dark one.
    background,
  })
  killSession(repoRoot, SESSION)
}

shoot("menu-top-level", "terminal-nexus's top-level menu, Gate 3A - Campaign highlighted at launch")

shoot(
  "menu-monochrome",
  "Monochrome is the floor, not the degraded mode - the same screen with --capability monochrome",
  {
    args: "--capability monochrome",
    drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "Down"]),
  },
)

shoot(
  "menu-highlight-moved",
  "Arrow-down twice, driven by real terminal key names through tmux: the highlight moves to Settings",
  { drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "Down", "Down"]) },
)

shoot(
  "menu-stub-notice",
  "Pressing 2 (Challenge): an honest stub notice, not a dead end",
  { drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", "2"]) },
)

shoot(
  "menu-mouse-click",
  "A real raw SGR mouse click at Settings' own rendered cell - the mouse adapter, not a description of one",
  {
    // The exact bytes a left click at column 8, row 11 (1-based terminal coordinates) sends —
    // MENU_LAYOUT's column 4 / row 10 (0-based) for item index 2, Settings — formatted the same way
    // src/menu/mouse.ts's own formatMouseClick would.
    drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", `${ESC}[<0;8;11M`]),
  },
)

// Gate 3B — the Settings screen.
shoot("settings-screen", "Settings, reached by its own hotkey - four choices and a way back", {
  drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", "3"]),
  waitForText: "Colour depth: truecolor",
})

shoot(
  "settings-light-theme",
  "Cycling Background to light takes effect on the very next frame, no restart, no flicker",
  {
    drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", "32"]), // 3 = Settings, 2 = Background
    waitForText: "Background: light",
    background: "light",
  },
)

shoot(
  "settings-back-to-top",
  "Pressing Back (or Esc) returns to exactly where the player was, still highlighting Settings",
  {
    drive: () => tmux(repoRoot, ["send-keys", "-t", SESSION, "-l", "35"]), // 3 = Settings, 5 = Back
    waitForText: "top-level menu",
  },
)

rmSync(scratch, { recursive: true, force: true })
console.log(`wrote ${join(outputDirectory, "menu-top-level.png")} and seven more`)
