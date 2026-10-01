// One real screenshot of `terminal-nexus`'s top-level menu, first made for the menu's first report
// (docs/history/reports/2026-09-13-menu.md). Not a blocking human check, but the project's
// own habit is a screenshot for every screen, and the pipeline already exists for `grid`
// (capture-screenshots.mjs): tmux (a real PTY, so the ANSI backend takes the same path a person
// gets) -> capture-pane -e -> HTML -> headless Chromium.
//
//   node scripts/capture-menu-screenshot.mjs

import { rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
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
const outputDirectory = join(repoRoot, "docs", "screenshots")
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
  // The text appearing proves the app got at least that far; a still pane proves it got no further.
  const colour = settledPane(repoRoot, SESSION)
  const html = ansiToHtml(colour, COLS, ROWS)
  const result = renderPngIfChanged({
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
  console.log(`${result.written ? "wrote" : "unchanged"} ${name}.png`)
  killSession(repoRoot, SESSION)
}

shoot("menu-top-level", "terminal-nexus's top-level menu - Campaign highlighted at launch")

shoot(
  "menu-monochrome",
  "Monochrome is the floor, not the degraded mode - the same screen with --capability monochrome",
  {
    args: "--capability monochrome",
    drive: () => sendKey(repoRoot, SESSION, "Down"),
  },
)

shoot(
  "menu-highlight-moved",
  "Arrow-down twice, driven by real terminal key names through tmux: the highlight moves to Settings",
  { drive: () => {
    sendKey(repoRoot, SESSION, "Down")
    sendKey(repoRoot, SESSION, "Down")
  } },
)

shoot(
  "menu-stub-notice",
  "Pressing 2 (Challenge, shown dimmed): an honest stub notice, not a dead end",
  { drive: () => sendKeys(repoRoot, SESSION, "2") },
)

shoot(
  "menu-challenge-dimmed",
  "Challenge already says why it's dimmed before it's even pressed; highlighting it is still plain inverse video",
  { drive: () => sendKey(repoRoot, SESSION, "Down") },
)

shoot(
  "menu-mouse-click",
  "A real raw SGR mouse click at Settings' own rendered cell - the mouse adapter, not a description of one",
  {
    // The exact bytes a left click at column 8, row 11 (1-based terminal coordinates) sends —
    // MENU_LAYOUT's column 4 / row 10 (0-based) for item index 2, Settings — formatted the same way
    // src/menu/mouse.ts's own formatMouseClick would.
    drive: () => sendKeys(repoRoot, SESSION, `${ESC}[<0;8;11M`),
  },
)

// The Settings screen.
shoot("settings-screen", "Settings, reached by its own hotkey - four choices and a way back", {
  drive: () => sendKeys(repoRoot, SESSION, "3"),
  waitForText: "Colour depth: truecolor",
})

shoot(
  "settings-light-theme",
  "Cycling Background to light takes effect on the very next frame, no restart, no flicker",
  {
    drive: () => {
      sendKeys(repoRoot, SESSION, "3") // 3 = Settings
      sendKeys(repoRoot, SESSION, "2") // 2 = Background
    },
    waitForText: "Background: light",
    background: "light",
  },
)

shoot(
  "settings-back-to-top",
  "Pressing Back (or Esc) returns to exactly where the player was, still highlighting Settings",
  {
    // "top-level menu" is already on screen before either key is sent (it's the very first frame's
    // own subtitle too), so waiting for it to reappear only means something once we've first
    // confirmed we actually left it — sending Back before that would make the eventual
    // `waitForText` below pass immediately without ever having waited on anything.
    drive: () => {
      sendKeys(repoRoot, SESSION, "3") // 3 = Settings
      waitFor(repoRoot, SESSION, (text) => text.includes("Colour depth"), "the Settings screen")
      sendKeys(repoRoot, SESSION, "5") // 5 = Back
    },
    waitForText: "top-level menu",
  },
)

// Campaign's own placeholder screen.
shoot("campaign-screen", "Campaign, reached by its own hotkey - a real screen, not a notice pinned to the menu behind it", {
  drive: () => sendKeys(repoRoot, SESSION, "1"),
  waitForText: "Campaign is not built yet",
})

shoot(
  "campaign-back-to-top",
  "Pressing Back (or Esc) returns to the top-level menu, still highlighting Campaign",
  {
    // Same reasoning as settings-back-to-top's own comment: "top-level menu" is on screen from the
    // very first frame, so the eventual wait below only means something once we've first confirmed
    // we actually left it.
    drive: () => {
      sendKeys(repoRoot, SESSION, "1") // 1 = Campaign
      waitFor(repoRoot, SESSION, (text) => text.includes("Campaign is not built yet"), "the Campaign screen")
      sendKeys(repoRoot, SESSION, "1") // 1 = Back, Campaign screen's only row
    },
    waitForText: "top-level menu",
  },
)

rmSync(scratch, { recursive: true, force: true })
console.log(`wrote ${join(outputDirectory, "menu-top-level.png")} and ten more`)
