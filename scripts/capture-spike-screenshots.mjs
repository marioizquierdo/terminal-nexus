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
import { composeBuildFrame } from "../src/view/build.ts"
import { BuildAnimation, FRAME_MS } from "../src/view/build-live.ts"
import { cellForTile } from "../src/build/layout.ts"
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

/** Open the Nexus Powers popup and pick its first power, which closes it. */
const PICK_FIRST_POWER = "n 1"

// --- In-process shots ----------------------------------------------------------------------------

/** `present`: what the live screen adds between keys (gate 5H) — a refused-placement flash, say —
 *  composed onto the last frame, since a key script alone never shows a moment in time. */
function scripted(name, caption, { keys, expect, cols = 80, rows = 24, capability = "truecolor", theme = "dark", present }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ steps: parseKeyScript(keys), columns: cols, rows, capability })
  const last = run.frames[run.frames.length - 1]
  const text = frameToText(last.frame)
  if (!text.includes(expect)) {
    throw new Error(`${name}: expected "${expect}" on screen after "${keys}", got:\n${text}`)
  }
  const frame =
    present === undefined
      ? last.frame
      : composeBuildFrame({ context: run.context, state: last.state, layout: run.layout, ...present }, capability)
  report(
    renderFramePng({
      frame,
      capability,
      theme,
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

/**
 * The view sliding and the cursor gliding (gate 5H, and the owner's 2026-09-28 playtest), frame by
 * frame as the live screen draws them: `before` sets the scene, `move` is one more key, and the GIF
 * is every frame `BuildAnimation` gives between the two cameras and cursors
 * at the live loop's own frame interval — the same function, fed a clock that steps instead of waits.
 */
function slideGif(name, { before, move, cols = 80, rows = 24, capability = "truecolor" }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ steps: parseKeyScript(`${before} ${move}`), columns: cols, rows, capability })
  const from = run.frames[run.frames.length - 2]
  const to = run.frames[run.frames.length - 1]
  const animation = new BuildAnimation()
  animation.frame(from.state, 0)
  const shots = [{ frame: from.frame, caption: "before", delayMs: 900 }]
  for (let now = 1; ; now += FRAME_MS) {
    const live = animation.frame(to.state, now)
    const frame = composeBuildFrame(
      { context: run.context, state: to.state, layout: run.layout, camera: live.camera, cursor: live.cursor },
      capability,
    )
    const done = live.busyUntil === null
    shots.push({ frame, caption: `${move}: ${now - 1} ms`, delayMs: done ? 2500 : 250 })
    if (done) break
  }
  report(renderFramesGif({ shots, capability, targetPath: join(outputDirectory, `${name}.gif`), scratchDir: scratch }))
}

/**
 * A building going up (gate 5I), frame by frame as the live screen draws it: `before` sets the scene
 * (and any Debug Mode flags, by keys), `place` is the key that places, and the GIF is every `stepMs`
 * of what `BuildAnimation` gives from that moment until nothing is moving — the same function the live
 * loop calls, fed a clock that steps instead of waits. Each frame is shown for `showMs`, so a GIF can
 * run slower than life and say so in its caption. `stillAtMs` makes one PNG of that instant instead.
 */
function placementGif(
  name,
  { before, place, expect, cols = 80, rows = 24, capability = "truecolor", theme = "dark", reducedMotion = false, stepMs = 50, showMs = 100, stillAtMs, caption },
) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ steps: parseKeyScript(`${before} ${place}`), columns: cols, rows, capability })
  const from = run.frames[run.frames.length - 2]
  const to = run.frames[run.frames.length - 1]
  if (!frameToText(to.frame).includes(expect)) {
    throw new Error(`${name}: expected "${expect}" on screen after "${before} ${place}", got:\n${frameToText(to.frame)}`)
  }
  const options = { reducedMotion }
  const compose = (state, live) =>
    composeBuildFrame(
      {
        context: run.context,
        state,
        layout: run.layout,
        camera: live.camera,
        cursor: live.cursor,
        reducedMotion,
        ...(live.placing === undefined ? {} : { placing: live.placing }),
        ...(live.flash === undefined ? {} : { flash: live.flash }),
      },
      capability,
    )
  const animation = new BuildAnimation()
  const opening = animation.frame(from.state, 0, options)
  const shots = [{ frame: compose(from.state, opening), caption: `before: ${before}`, delayMs: 1000 }]
  const speed = showMs === stepMs ? "" : ` (shown at ${Math.round((stepMs / showMs) * 100)}% speed)`
  for (let now = 1; ; now += stepMs) {
    const live = animation.frame(to.state, now, options)
    const frame = compose(to.state, live)
    if (stillAtMs !== undefined && now - 1 >= stillAtMs) {
      report(renderFramePng({ frame, capability, theme, caption, targetPath: join(outputDirectory, `${name}.png`), scratchDir: scratch }))
      return
    }
    const done = live.busyUntil === null
    shots.push({ frame, caption: `${place}: ${now - 1} ms after placing${done ? ", settled" : speed}`, delayMs: done ? 2500 : showMs })
    if (done) break
  }
  report(renderFramesGif({ shots, capability, theme, targetPath: join(outputDirectory, `${name}.gif`), scratchDir: scratch }))
}

/**
 * The same placement as a contact sheet: a window of the Grid around the building at each of
 * `timesMs` after placing, side by side with the time over each — the whole run in one still, which a
 * phone shows without playing anything. The window is `span` tiles either side of the placement.
 */
function placementSheet(name, { before, place, expect, timesMs, capability = "truecolor", theme = "dark", caption, span = { x: 5, y: 3 } }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ steps: parseKeyScript(`${before} ${place}`), capability })
  const to = run.frames[run.frames.length - 1]
  if (!frameToText(to.frame).includes(expect)) throw new Error(`${name}: expected "${expect}" after "${before} ${place}"`)
  const placement = to.state.planned[to.state.planned.length - 1]
  const definition = run.context.registry.get(placement.contentId)
  const extent = definition.footprint.reduce((size, o) => ({ w: Math.max(size.w, o.x + 1), h: Math.max(size.h, o.y + 1) }), { w: 0, h: 0 })
  const origin = cellForTile(run.layout, to.state.camera, placement.anchor)
  const panelWidth = extent.w + span.x * 2
  const panelHeight = extent.h + span.y * 2
  const gap = 2
  const width = timesMs.length * (panelWidth + gap) + gap
  const height = panelHeight + 3
  const cells = new Array(width * height).fill({ glyph: " ", style: {} })
  const write = (x, y, cell) => {
    if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = cell
  }
  timesMs.forEach((elapsedMs, index) => {
    const frame = composeBuildFrame(
      { context: run.context, state: to.state, layout: run.layout, placing: [{ ordinal: placement.ordinal, elapsedMs }] },
      capability,
    )
    const left = gap + index * (panelWidth + gap)
    const label = `${elapsedMs} ms`
    ;[...label].forEach((glyph, offset) => write(left + offset, 0, { glyph, style: { fgRole: "chrome.title", bold: true } }))
    for (let y = 0; y < panelHeight; y += 1) {
      for (let x = 0; x < panelWidth; x += 1) {
        const source = frame.cells[(origin.y - span.y + y) * frame.width + (origin.x - span.x + x)]
        if (source !== undefined) write(left + x, 2 + y, source)
      }
    }
  })
  report(
    renderFramePng({
      frame: { width, height, cells },
      capability,
      theme,
      caption,
      targetPath: join(outputDirectory, `${name}.png`),
      scratchDir: scratch,
    }),
  )
}

// Gate 5I: placement juice. Each placement is armed from the menu, where the cursor lands for you
// beside the Grid Nexus, and placed with Space.

// The owner's defaults (2026-09-29): 300 ms of frames, then 250 ms of light and sparks.
const SHEET_TIMES = [0, 100, 200, 300, 400, 500, 600]

placementSheet("build-place-sheet-barracks", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  timesMs: SHEET_TIMES,
  caption: "A Barracks at the defaults: footings, walls, roof beam, then finished, lit and throwing sparks",
})

placementSheet("build-place-sheet-hatchery", {
  before: `${PICK_FIRST_POWER} Down*2 Space`,
  place: "Space",
  expect: "Hatchery placed",
  timesMs: SHEET_TIMES,
  caption: "A Hatchery is grown, not built: seeds, a swelling sac, the peak splitting, then lit",
})

placementSheet("build-place-sheet-turret", {
  before: `${PICK_FIRST_POWER} Down*3 Space`,
  place: "Space",
  expect: "Turret placed",
  timesMs: SHEET_TIMES,
  caption: "A one-tile Turret rises in place - dot, stack, mast - then the alarm mark, lit",
})

placementSheet("build-place-sheet-rainbow", {
  before: `${PICK_FIRST_POWER} d Down Right Down Right Esc Down Space`,
  place: "Space",
  expect: "Barracks placed",
  timesMs: SHEET_TIMES,
  caption: "Lighting: rainbow, Particles: many - the theme's own hues sweep across it and fade",
})

placementSheet("build-place-sheet-light", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  timesMs: SHEET_TIMES,
  theme: "light",
  caption: "The light theme: the flash pulls toward its darkest ink, then settles",
})

placementSheet("build-place-sheet-16", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  timesMs: SHEET_TIMES,
  capability: "color16",
  caption: "16 colours: no blend, so the light is a step - bright white, then its own colour",
})

placementSheet("build-place-sheet-monochrome", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  timesMs: SHEET_TIMES,
  capability: "monochrome",
  caption: "Monochrome: no colour to light, so the plain scaffold turning bold carries it",
})

placementGif("build-place-barracks", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
})

placementGif("build-place-hatchery", {
  before: `${PICK_FIRST_POWER} Down*2 Space`,
  place: "Space",
  expect: "Hatchery placed",
})

placementGif("build-place-turret", {
  before: `${PICK_FIRST_POWER} Down*3 Space`,
  place: "Space",
  expect: "Turret placed",
})

placementGif("build-place-barracks-light", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  theme: "light",
})

placementGif("build-place-barracks-16", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  capability: "color16",
})

placementGif("build-place-barracks-monochrome", {
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  capability: "monochrome",
})

placementGif("build-place-rainbow", {
  // Debug Mode's Lighting set to rainbow and Particles to many, then a Barracks.
  before: `${PICK_FIRST_POWER} d Down Right Down Right Esc Down Space`,
  place: "Space",
  expect: "Barracks placed",
})

placementGif("build-place-reduced-motion", {
  // Reduced motion: the finished Barracks at once, no frames and no light, and the sparks become a
  // still mark at its four corners for the glow.
  before: `${PICK_FIRST_POWER} Down Space`,
  place: "Space",
  expect: "Barracks placed",
  reducedMotion: true,
  stillAtMs: 100,
  caption: "Reduced motion, 100 ms after placing: finished at once, unlit, a still mark at the four corners",
})

scriptedGif("build-hatchery-run", {
  // The owner's own flow from the opening screen: highlight the Hatchery, arm it from the menu (the
  // cursor lands for you), place it, arm it again, place it again — no arrow key on the Grid at all.
  keys: "Down*3 Space*4",
  expect: "Hatchery placed (resources: 40)",
})

scripted(
  "spike-minimum",
  "80x24, the acceptance floor: the menu on the left, a 49x16 window onto a 96x40 Grid closed into its own rectangle, and the map's own fence where the map ends - on the west, the menu's divider is that edge",
  { keys: PICK_FIRST_POWER, expect: "MENU  up/down" },
)

scripted(
  "build-focus-grid",
  "Tab (or [e] Explore Map) moves the keyboard to the Grid with nothing armed: the menu gives way to the EXPLORE MAP panel, which follows the cursor, and the cursor is the one highlight on screen",
  { keys: `${PICK_FIRST_POWER} Tab`, expect: "EXPLORE MAP  arrows move" },
)

scripted(
  "build-info-panel",
  "Explore Map with the cursor on a building: its own glyphs, its name and what it is for, and its numbers, under the EXPLORE MAP header. [esc] top right brings the menu back",
  { keys: `${PICK_FIRST_POWER} Tab Up*2`, expect: "Citizen Nexus" },
)

scripted(
  "build-smart-cursor",
  "Down twice and Space: the Hatchery is armed from the menu and the cursor lands for you - one free tile east of the Grid Nexus, sharing its top row. The armed row is marked with > and its name underlined; the cursor is the one highlight",
  { keys: `${PICK_FIRST_POWER} Down*2 Space`, expect: "Hatchery selected" },
)

scripted(
  "build-menu-run",
  "The owner's own flow: Space arms, Space places and returns the keyboard to the menu, again and again. Three barracks in a tidy line, one free tile between each, drawn at full strength",
  { keys: `${PICK_FIRST_POWER} Down Space*6`, expect: "10 of 130" },
)

scripted(
  "build-nexus-popup",
  "[n] opens the Nexus popup: a solid border with its title in it, and a shadow, so it cannot be missed. The top bar's right end now says close [esc] - the one place Esc is named - and a click outside the popup closes it and brings the keyboard to wherever the click landed",
  { keys: "n Down", expect: "PICK ONE" },
)

scripted(
  "build-nexus-popup-picked",
  "104x32, reopened after a pick (the pick itself closes it): nothing waiting, the pick listed as active with what it does, and the budget above the menu already counting it",
  { keys: "n 2 n", expect: "Nothing waiting", cols: 104, rows: 32 },
)

scripted(
  "build-exit-question",
  "Esc on the menu opens the game menu: [s] Settings, [r] Restart, [q] Quit, and Esc back to the game. A stray q opens it too rather than losing a plan; menu [esc] at the right of the top bar is the click",
  { keys: `${PICK_FIRST_POWER} Esc`, expect: "Back to the game" },
)

scripted(
  "build-grid-edge",
  "Hard against the Grid's north-west corner: the top and left sides are the map's own edge - this map's fence, in the quieter edge colour - because the map ends there, the bottom and right stay thin because there is more map that way",
  { keys: `${PICK_FIRST_POWER} Tab S-Left*5 S-Up*5`, expect: "cursor 0,0" },
)

scripted(
  "spike-maximum",
  "104x32, the largest viewport the game will ever show: 72x24 tiles. A bigger terminal than this buys margin, never more Grid",
  { keys: PICK_FIRST_POWER, expect: "MENU  up/down", cols: 104, rows: 32 },
)

scripted(
  "spike-wide-tiles",
  "128x24: a 48x16 viewport at two terminal columns per tile, where a tile stops being squashed 2:1",
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
  "The north-east crater, 64 tiles east of where the cursor started - the part of the Grid that exists only because scrolling does",
  { keys: `${PICK_FIRST_POWER} Tab S-Right*8 PgUp`, expect: "view x" },
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

// Settings (owner, 2026-09-28): the game menu's [s], the player's own settings first, then the
// Experiments — Debug Mode's flags — which [d] opens straight at.

scripted(
  "build-settings",
  "Settings from the game menu: the player's own settings, saved, then - apart - the Experiments, not saved, and Export settings last. The title says where the highlight is in the list, the right border is the list's scroll bar, and what the highlighted row is for is written under a line below it",
  { keys: "Esc s", expect: "YOUR SETTINGS - saved" },
)

scripted(
  "build-settings-export",
  "[e] Export settings: every setting and experiment as text, changed experiments first with the default each replaced - copied to the clipboard and a file, to paste into a pull request",
  { keys: "d Right Down Right e", expect: "# Changed experiments" },
)

scripted(
  "build-debug-80x24",
  "[d] opens Settings at its Experiments: each with its value between < and >, and nothing else on the row. The question the highlighted one serves is written under the list",
  { keys: "d", expect: "EXPERIMENTS - for playtests, not saved" },
)

// The experiments' order: gate 5I's placement juice first, then gate 5H's movement numbers (Scroll
// margin is four Downs in), then gate 5G's. From the player's first setting (Esc s), Up comes round to
// Export, the list's last row, then the last experiments: Up*2 is "Refused flicker", Up*3 "Pressed
// flash", Up*4 "Opens on", Up*5 "Smart cursor". (The map-edge Experiments were settled by the owner's
// playtest of 2026-09-29 and deleted; the restart is the game menu's [r] since feedback F34.)

scripted(
  "build-debug-104x32",
  "Right twice on Scroll margin: 25% of the view becomes 35%, the status line says so, and the position readout names the margin now in force",
  { keys: "d Down*4 Right Right", cols: 104, rows: 32, expect: "margin 35%" },
)

scripted(
  "build-debug-light",
  "The light theme: \"Opens on\" only takes effect after a restart - the status line says so, and closing Settings says it once more in a message; the game menu's [r] Restart starts the Build Phase over keeping every flag",
  { keys: "Esc s Up*4 Right", theme: "light", expect: "applies after a restart" },
)

scripted(
  "build-debug-restarted-on-map",
  "After the game menu's [r] Restart: the Build Phase starts over with the keyboard on the map, exploring - one of the two answers to where the screen should open",
  { keys: "Esc s Up*4 Right Esc Esc r", expect: "Build Phase restarted with these settings." },
)

scriptedGif("build-debug-smart-cursor", {
  // Smart cursor off, then the owner's own flow: the cursor stays where it was instead of jumping.
  keys: "Esc s Up*5 Right Esc Esc Down Down Space",
  expect: "Barracks selected",
})

// Gate 5H: movement feel.

scripted(
  "build-debug-scrolled",
  "Settings scroll: the settings and the experiments do not fit at 80x24, so the list moves with the highlight, the title says where it is - SETTINGS (11/30) - and the right border is a scroll bar with a thumb. A click on its upper or lower half, or the wheel, scrolls it too",
  { keys: "d Down*6", expect: "SETTINGS (11/" },
)

scripted(
  "build-esc-back",
  "The top bar's right end says what Esc does right now: back [esc] on the map (here Explore Map), menu [esc] on the menu, close [esc] over a popup - and a click on it is Esc",
  { keys: "e", expect: "back [esc]" },
)

scriptedGif("build-held-arrow", {
  // A tap, the terminal's repeat delay (150 ms here, inside the owner's 150 ms hold window; a longer
  // delay loses only the first repeat), then auto-repeats 30 ms apart: one tile, then two a press from
  // the first repeat, then four once the run is 300 ms old. Then Left, straight after: a different
  // arrow starts again at one, then two. Shift+Down: a jump of twelve.
  keys: "e Right Right~150 Right~30*14 Left~30 Left~30*3 S-Down",
  expect: "cursor 52,25",
  delayMs: 450,
})

scriptedGif("build-armed-click-still", {
  // Armed, a click near the edge moves the cursor and the preview there and does not scroll the view,
  // so the second click on the same spot lands on the same tile and places (Q58).
  keys: `${PICK_FIRST_POWER} 1 click:43,10 click:43,10`,
  expect: "Barracks placed",
})

scriptedGif("build-explore-edge-click", {
  // Exploring, a click near an edge scrolls the view, further the nearer the edge: two columns in, a
  // long way; eight columns in, a little; in the middle, not at all (feedback F6).
  keys: `${PICK_FIRST_POWER} e click@76,10 click@70,10 click@55,10`,
  expect: "EXPLORE",
  delayMs: 1200,
})

scripted(
  "build-refused-flash",
  "Enter on rock: the whole footprint flashes solid for 150 ms as the status line says why, so an eye on the map sees it did not build",
  { keys: `${PICK_FIRST_POWER} 1 Up*8 Left*10 Enter`, expect: "Cannot build here", present: { refusedFlash: true } },
)

slideGif("build-view-slide", {
  // Shift+Right: the view slides to put the cursor in the middle, over 150 ms and a few frames, fast
  // at first and settling at the end — every frame the live screen draws, as it draws them.
  before: `${PICK_FIRST_POWER} e S-Right*2`,
  move: "S-Right",
})

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
/** In tmux, `n` then `1` — the pick closes the popup (Q60), so no Esc: see `KEY_PAUSE_SECONDS`. */
const pickFirstPower = () => {
  literal("n")
  literal("1")
}

live(
  "build-idle",
  "The Build Phase opens on the menu, on the left: the keyboard on [e] Explore Map at the top, [n] Nexus under it with its (1), the one pick still waiting. No cursor on the Grid while the menu has the keyboard",
  { waitForText: "RESOURCE" },
)

live(
  "spike-scrolled",
  "Scrolled into the middle of the Grid with Shift+Arrow and PageDown - real modified-arrow bytes through tmux. All four borders now mark more Grid",
  {
    drive: () => {
      pickFirstPower()
      key("Tab")
      // A twelve-tile jump since gate 5J (five until 5H, then eight): two east and one south, from
      // 18,13, still leave more Grid on every side. tmux's pause between keys is longer than the jump
      // repeat limit, so no jump is dropped.
      key("S-Right")
      key("NPage")
      key("S-Right")
    },
    waitForText: "cursor 42,25",
  },
)

live(
  "spike-mouse-place",
  "Two real SGR mouse clicks placing a structure - the first arms the preview at the tile, the second confirms it (Q52): the bytes a terminal actually sends, not a description of one",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks
      // Column 61, row 12 (1-based) is tile 30,10 at the opening camera — the same cell
      // `cellForTile` hands the tests, formatted the way src/build/mouse.ts's own
      // `formatMouseEvent` would. The first click only moves the cursor there; the second, on the
      // same tile, is what actually places it. Chosen well inside the scroll margin: a first click
      // near the Grid pane's edge scrolls the map under the pointer, and a second click in the same
      // place is then a first click on the tile beside it (Q52's own finding).
      literal(`${ESC}[<0;61;12M`)
      literal(`${ESC}[<0;61;12M`)
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
      // Two twelve-tile jumps (gate 5J), with a key between them so the second is not a held
      // Shift's repeat inside the jump limit.
      key("S-Right")
      key("Down")
      key("S-Right")
    },
    waitForText: "cursor 42,14",
  },
)

live(
  "spike-resize-gate",
  "79x24, one column below the floor: playback gates rather than cropping the Grid, and says exactly what it needs",
  { cols: 79, rows: 24 },
)

rmSync(scratch, { recursive: true, force: true })
