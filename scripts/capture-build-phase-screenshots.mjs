// Screenshots of the Build Phase and the Battle Round that ends it.
//
//   node scripts/capture-build-phase-screenshots.mjs
//   node scripts/capture-build-phase-screenshots.mjs --only build-idle
//   node scripts/capture-build-phase-screenshots.mjs --out .playtest/shots   # somewhere other than .playtest/screenshots/
//   node scripts/capture-build-phase-screenshots.mjs --force                  # re-render even unchanged ones
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
// viewport and the acceptance floor, 104x30 the maximum, 128x24 a wide terminal (a tile is one column
// at every size, so it shows the maximum's width and centres it), and 79x24 the resize gate one column
// below the floor.

import { mkdirSync, rmSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { frameToText } from "../src/view/frame.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { BuildAnimation, FRAME_MS, livePresentation, popupBorderEffect } from "../src/view/build-live.ts"
import { openingLengthMs } from "../src/view/build-popup.ts"
import { cellForTile } from "../src/build/layout.ts"
import { SETTINGS_ROWS } from "../src/build/settings.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
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
const outputDirectory = resolve(repoRoot, argument("--out") ?? join(".playtest", "screenshots"))
const scratch = join(repoRoot, ".capture-tmp")
const SESSION = "terminal-nexus-capture"
const only = argument("--only")

mkdirSync(outputDirectory, { recursive: true })

const report = (result) =>
  console.log(`${result.written ? "wrote" : "unchanged"} ${relative(repoRoot, result.path)}`)

/** Open the Nexus Powers popup and pick its first power, which closes it. */
const PICK_FIRST_POWER = "n 1"

// --- In-process shots ----------------------------------------------------------------------------

/** `present`: what the live screen adds between keys — a refused-placement flash, say —
 *  composed onto the last frame, since a key script alone never shows a moment in time.
 *  `experiments`: Experiments to open with instead of the defaults.
 *  A `wait~MS` step in `keys` lets a Battle Round on screen run that long on the script's own clock.
 *  `capability` and `theme` are the player's settings in the playtest as well as the picture's, so a
 *  screen that shows them (Settings) says what the picture is. */
function scripted(name, caption, { keys, expect, cols = 80, rows = 24, capability = "truecolor", theme = "dark", present, experiments }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ scenes: false,
    steps: parseKeyScript(keys),
    columns: cols,
    rows,
    settings: { ...DEFAULT_SETTINGS, capability, theme },
    ...(experiments === undefined ? {} : { experiments }),
  })
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
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript(keys), columns: cols, rows, capability })
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
 * The Battle Round's ending as the live screen draws it: `plan` commits a build and starts
 * the Battle Round, then the GIF is the screen every `stepMs` from `fromMs` to `toMs` on the battle's own
 * clock, shown for as long as it lasted — the timer's flashing and the light round the border, the
 * cease-fire, the walk home and the result, in real time. A Pulse's screen is a pure function of that clock, so a script that waits
 * gets exactly what a player who watched gets.
 */
function pulseGif(name, { plan, fromMs, toMs, stepMs = 250, expect, experiments, cols = 80, rows = 24, capability = "truecolor", scale = 1 }) {
  if (only !== null && only !== name) return
  const planSteps = parseKeyScript(plan).length
  const waits = Array.from({ length: Math.round((toMs - fromMs) / stepMs) }, () => `wait~${stepMs}`)
  const run = runBuildPlaytest({ scenes: false,
    steps: parseKeyScript([plan, `wait~${fromMs}`, ...waits].join(" ")),
    columns: cols,
    rows,
    capability,
    ...(experiments === undefined ? {} : { experiments }),
  })
  const frames = run.frames.slice(planSteps + 1)
  const lastIndex = frames.length - 1
  if (!frameToText(frames[lastIndex].frame).includes(expect)) {
    throw new Error(`${name}: expected "${expect}" ${toMs} ms into the Battle Round, got:\n${frameToText(frames[lastIndex].frame)}`)
  }
  report(
    renderFramesGif({
      shots: frames.map((frame, index) => ({
        frame: frame.frame,
        caption: `${((fromMs + index * stepMs) / 1000).toFixed(2)} s into the Battle Round`,
        delayMs: index === lastIndex ? 3000 : stepMs,
      })),
      capability,
      targetPath: join(outputDirectory, `${name}.gif`),
      scratchDir: scratch,
      scale,
    }),
  )
}

/**
 * A `BuildAnimation` that drew `state` long enough ago for everything on it to have finished — the
 * scene before a key as a player who has been looking at it sees it. A fresh one would take a hand-off
 * or a flash already in `state` for one that just began, and play it again over the key's own frames.
 */
function settledAnimation(state, options = {}) {
  const animation = new BuildAnimation()
  animation.frame(state, -60_000, options)
  return animation
}

/**
 * The view sliding and the cursor gliding (from Mario's 2026-09-28 playtest), frame by
 * frame as the live screen draws them: `before` sets the scene, `move` is one more key, and the GIF
 * is every frame `BuildAnimation` gives between the two cameras and cursors
 * at the live loop's own frame interval — the same function, fed a clock that steps instead of waits.
 */
function slideGif(name, { before, move, cols = 80, rows = 24, capability = "truecolor" }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript(`${before} ${move}`), columns: cols, rows, capability })
  const from = run.frames[run.frames.length - 2]
  const to = run.frames[run.frames.length - 1]
  const animation = settledAnimation(from.state)
  animation.frame(from.state, 0)
  const shots = [{ frame: from.frame, caption: "before", delayMs: 900 }]
  for (let now = 1; ; now += FRAME_MS) {
    const live = animation.frame(to.state, now)
    const frame = composeBuildFrame({ context: run.context, state: to.state, layout: run.layout, ...livePresentation(live) }, capability)
    const done = live.busyUntil === null
    shots.push({ frame, caption: `${move}: ${now - 1} ms`, delayMs: done ? 2500 : 250 })
    if (done) break
  }
  report(renderFramesGif({ shots, capability, targetPath: join(outputDirectory, `${name}.gif`), scratchDir: scratch }))
}

/**
 * A building going up, frame by frame as the live screen draws it: `before` sets the scene
 * (by keys), `place` is the key that places, and the GIF is every `stepMs`
 * of what `BuildAnimation` gives from that moment until nothing is moving — the same function the live
 * loop calls, fed a clock that steps instead of waits. Each frame is shown for `showMs`, so a GIF can
 * run slower than life and say so in its caption. `stillAtMs` makes one PNG of that instant instead.
 */
function placementGif(
  name,
  { before, place, expect, cols = 80, rows = 24, capability = "truecolor", theme = "dark", reducedMotion = false, stepMs = 50, showMs = 100, stillAtMs, caption },
) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ scenes: false,
    steps: parseKeyScript(`${before} ${place}`),
    columns: cols,
    rows,
    settings: { ...DEFAULT_SETTINGS, capability, theme, reducedMotion },
  })
  const from = run.frames[run.frames.length - 2]
  const to = run.frames[run.frames.length - 1]
  if (!frameToText(to.frame).includes(expect)) {
    throw new Error(`${name}: expected "${expect}" on screen after "${before} ${place}", got:\n${frameToText(to.frame)}`)
  }
  const options = { reducedMotion }
  const compose = (state, live) =>
    composeBuildFrame({ context: run.context, state, layout: run.layout, reducedMotion, ...livePresentation(live) }, capability)
  const animation = settledAnimation(from.state, options)
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
 * A menu row handing the keyboard to the map (the menu-to-map handoff): the screen
 * before `hand`, then every `stepMs` after it until nothing moves — the row's pressed flash, the menu
 * turning into a card, the focus arrow flying from the row's place on the menu to the cursor (a
 * see-through cursor from Explore Map's), and the cursor's blinks when it lands — each shown for
 * `showMs`, so the GIF plays in slow motion and says so.
 */
function handoffGif(name, { before, hand, expect, cols = 80, rows = 24, capability = "truecolor", theme = "dark", glyphPack = "ascii", stepMs = 20, showMs = 100 }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ scenes: false,
    steps: parseKeyScript(`${before} ${hand}`),
    columns: cols,
    rows,
    settings: { ...DEFAULT_SETTINGS, capability, theme, glyphPack },
  })
  const from = run.frames[run.frames.length - 2]
  const to = run.frames[run.frames.length - 1]
  if (!frameToText(to.frame).includes(expect)) {
    throw new Error(`${name}: expected "${expect}" on screen after "${before} ${hand}", got:\n${frameToText(to.frame)}`)
  }
  const compose = (state, live) =>
    composeBuildFrame(
      {
        context: run.context,
        state,
        layout: run.layout,
        glyphPack,
        ...livePresentation(live),
      },
      capability,
    )
  const animation = settledAnimation(from.state)
  const opening = animation.frame(from.state, 0)
  const shots = [{ frame: compose(from.state, opening), caption: `before: ${before}`, delayMs: 1200 }]
  const speed = Math.round((stepMs / showMs) * 100)
  for (let now = 1; ; now += stepMs) {
    const live = animation.frame(to.state, now)
    const done = live.busyUntil === null
    shots.push({
      frame: compose(to.state, live),
      caption: `${hand}: ${now - 1} ms after the key${done ? ", settled" : ` (shown at ${speed}% speed)`}`,
      delayMs: done ? 2500 : showMs,
    })
    if (done) break
  }
  report(renderFramesGif({ shots, capability, theme, targetPath: join(outputDirectory, `${name}.gif`), scratchDir: scratch }))
}

/**
 * A popup opening: `keys` ends with the key that opens it, and the GIF is what
 * `BuildAnimation` gives from that moment — its opening, if the popup has one (the Battle Round screen's
 * double flash, every `flashStepMs`), then one whole breath of its border (the "Popup pulse"
 * Experiment's length, every `stepMs`), in real time and looping.
 */
function popupGif(name, { keys, expect, cols = 80, rows = 24, capability = "truecolor", theme = "dark", glyphPack = "ascii", stepMs = 100, flashStepMs = 30 }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript(keys), columns: cols, rows, settings: { ...DEFAULT_SETTINGS, capability, theme, glyphPack } })
  const from = run.frames[run.frames.length - 2]
  const to = run.frames[run.frames.length - 1]
  if (!frameToText(to.frame).includes(expect)) throw new Error(`${name}: expected "${expect}" after "${keys}", got:\n${frameToText(to.frame)}`)
  const options = { capability }
  const animation = settledAnimation(from.state, options)
  const effect = popupBorderEffect(to.state, false, capability)
  const openingMs = effect === null ? 0 : openingLengthMs(effect)
  const breathMs = to.state.experiments.popupPulseMs
  const shots = []
  const shoot = (now, caption, delayMs) => {
    const live = animation.frame(to.state, now, options)
    const frame = composeBuildFrame({ context: run.context, state: to.state, layout: run.layout, glyphPack, ...livePresentation(live) }, capability)
    shots.push({ frame, caption, delayMs })
  }
  for (let now = 0; now < openingMs; now += flashStepMs) shoot(now, `opening flash: ${now} ms of ${openingMs} ms`, flashStepMs)
  for (let at = 0; at < breathMs; at += stepMs) shoot(openingMs + at, `then the breath: ${at} ms of ${breathMs} ms`, stepMs)
  report(renderFramesGif({ shots, capability, theme, targetPath: join(outputDirectory, `${name}.gif`), scratchDir: scratch, scale: 1 }))
}

/**
 * The same placement as a contact sheet: a window of the Grid around the building at each of
 * `timesMs` after placing, side by side with the time over each — the whole run in one still, which a
 * phone shows without playing anything. The window is `span` tiles either side of the placement.
 */
function placementSheet(name, { before, place, expect, timesMs, capability = "truecolor", theme = "dark", caption, span = { x: 5, y: 3 } }) {
  if (only !== null && only !== name) return
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript(`${before} ${place}`), settings: { ...DEFAULT_SETTINGS, capability, theme } })
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

// Placement juice. Each placement is armed from the menu — the cursor opens on the Grid
// Nexus, where nothing fits, so arming moves it to the nearest spot with a free tile around it, a
// free column to its right — and placed with Space.

// Mario's numbers (his settings export, 2026-09-30): 300 ms of frames, then 400 ms of light and sparks.
const SHEET_TIMES = [0, 100, 200, 300, 450, 600, 700]

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
  // Mario's own flow from the opening screen: highlight the Hatchery, arm it from the menu (the
  // cursor, on the Grid Nexus, moves to the nearest good spot), place it, arm it again (the cursor, now
  // on the first, moves a free tile away from it), place it again — no arrow key on the Grid at all.
  keys: "Down*3 Space*4",
  expect: "Hatchery placed (resources: 40)",
})

scripted(
  "spike-minimum",
  "80x24, the acceptance floor: the menu on the left - Explore Map, Nexus, the credits with the map's resource symbol, one list - a 49x18 window onto a 96x40 Grid closed into its own rectangle, the map's own fence where the map ends, and one line of help at the bottom",
  { keys: PICK_FIRST_POWER, expect: "* 130" },
)

scripted(
  "build-focus-grid",
  "Tab moves the keyboard to the map in plain navigation: nothing armed, the cursor the one highlight on screen, and the menu still drawn beside the map, so a click can arm from it. The bottom line says what works here",
  { keys: `${PICK_FIRST_POWER} Tab`, expect: "Arrows move the cursor" },
)

scripted(
  "build-info-panel",
  "[e] Explore Map (which first steps the cursor off the Grid Nexus onto clear ground), then Left back onto the Nexus: the row turns active - [e] Explore Map > - with a line under it, then the building's own glyphs, its name, what it is for and its numbers. x, e or Esc goes back",
  { keys: `${PICK_FIRST_POWER} e Left*3`, expect: "Citizen Nexus" },
)

scripted(
  "build-smart-cursor",
  "Down twice and Space: the Hatchery is armed from the menu and the panel becomes its card, under [2] Hatchery >. The cursor was on the Grid Nexus, where it cannot go, so it moves to the nearest spot that leaves a free tile around it - a free column to its right",
  { keys: `${PICK_FIRST_POWER} Down*2 Space`, expect: "[2] Hatchery" },
)

scripted(
  "build-menu-run",
  "Mario's own flow: Space arms, Space places and returns the keyboard to the menu, again and again. Each Barracks is armed where the last one left the cursor, and moves a few tiles to the right, a free column away - three in a row",
  { keys: `${PICK_FIRST_POWER} Down Space*6`, expect: "* 10" },
)

scripted(
  "build-nexus-popup",
  "[n] opens the Nexus Pulse popup: a solid border with its title in it, and a shadow, so it cannot be missed. The top bar's right end now says close [esc] - the one place Esc is named - and a click outside the popup closes it and brings the keyboard to wherever the click landed",
  { keys: "n Down", expect: "PICK ONE" },
)

scripted(
  "build-nexus-popup-picked",
  "104x30, reopened after a pick (the pick itself closes it): nothing waiting, the pick listed as active with what it does, and the credits above the buildings already counting it",
  { keys: "n 2 n", expect: "Nothing waiting", cols: 104, rows: 32 },
)

scripted(
  "build-exit-question",
  "Esc on the menu opens the game menu: [s] Settings, [c] Controls and hotkeys, [r] Restart, [q] Quit - no Back row: Esc, x or a click outside closes it. A stray q opens it too rather than losing a plan; menu [esc] at the right of the top bar is the click. x on the menu never opens it",
  { keys: `${PICK_FIRST_POWER} Esc`, expect: "Controls and hotkeys" },
)

scripted(
  "build-grid-edge",
  "Hard against the Grid's north-west corner: the top and left sides are the map's own edge - this map's fence, in the quieter edge colour - because the map ends there, the bottom and right stay thin because there is more map that way",
  { keys: `${PICK_FIRST_POWER} Tab S-Left*5 S-Up*5`, expect: "Arrows move the cursor" },
)

scripted(
  "spike-maximum",
  "104x30, the largest viewport the game will ever show: 72x24 tiles. A bigger terminal than this buys margin, never more Grid",
  { keys: PICK_FIRST_POWER, expect: "* 130", cols: 104, rows: 30 },
)

scripted(
  "spike-wide-terminal",
  "128x24: a wide terminal draws a tile one column wide too - 72x18 tiles, the columns to spare spent on centring",
  { keys: PICK_FIRST_POWER, expect: "* 130", cols: 128, rows: 24 },
)

scripted(
  "spike-armed-preview",
  "The digit fast path: [1] arms Barracks from anywhere - at the cursor when it fits there, else the nearest good spot - and the preview shows at the cursor in its own glyphs: what you see is what Enter places",
  { keys: `${PICK_FIRST_POWER} 1 Right*6 Down*4`, expect: "Place the Barracks" },
)

scripted(
  "spike-illegal",
  "The same barracks over rock, after pressing Enter: the preview is a grey block of x and the bottom line says why, naming the tile - in red, because a placement was tried and refused",
  // At a build range of 8, so the Nexus's own range reaches the row under the north-west wall, four rows up.
  { keys: `${PICK_FIRST_POWER} 1 click:19,5 Enter`, expect: "rock in the way", experiments: { buildRange: 8 } },
)

scripted(
  "spike-crater",
  "The north-east crater, 64 tiles east of where the cursor started - the part of the Grid that exists only because scrolling does",
  { keys: `${PICK_FIRST_POWER} Tab S-Right*8 PgUp`, expect: "Arrows move the cursor" },
)

scripted(
  "build-just-placed",
  "Right after a placement: the building is drawn in full, the keyboard is back on the menu on the same row, and the bottom line says what is left and how to take it back",
  { keys: `${PICK_FIRST_POWER} 1 Right*6 Down*4 Enter`, expect: "Barracks placed (resources: 90) - [u] undo" },
)

scripted(
  "build-spent-down",
  "Two barracks and a hatchery placed, 20 of 130 left: the rows that no longer fit are dimmed, and pressing [1] anyway is refused at the menu with the cost - affordability first, before any tile",
  {
    keys: `${PICK_FIRST_POWER} 1 Right*6 Down*4 Enter 1 Enter 2 Enter 1`,
    expect: "costs 40, 20 left",
  },
)

scripted(
  "build-card",
  "[1] arms the Barracks: the menu gives way to its card - [1] Barracks > on top, its own row moved up to be the title, then the card: its title and subtitle beside the icon, a few words more, its cost, health and size. The bottom line says how to place it",
  { keys: `${PICK_FIRST_POWER} 1`, expect: "Trains troopers" },
)

scripted(
  "build-menu-hint",
  "The menu, one list: Explore Map, Nexus, the credits with the map's resource symbol in the cost column, the buildings, Start Battle Round last. With the Hatchery highlighted the bottom line says what it does and what it costs",
  { keys: `${PICK_FIRST_POWER} Down*2`, expect: "Hatchery - Spawns swarmers" },
)

scripted(
  "build-controls",
  "Esc, then [c]: Controls and hotkeys, every key and click by where you are - the menu, the map, placing, Explore Map, popups, the mouse, the Battle Round. Up and Down scroll it; ? opens it from anywhere",
  { keys: `${PICK_FIRST_POWER} Esc c`, expect: "CONTROLS AND HOTKEYS" },
)

handoffGif("build-focus-arrow", {
  // [1] from the menu arms the Barracks: the other rows fade, the row slides up and the card types in,
  // while the arrow leaves from where the row was on the menu for the cursor beside the Grid Nexus, and
  // the cursor blinks twice where it lands.
  before: PICK_FIRST_POWER,
  hand: "1",
  expect: "Trains troopers",
})

handoffGif("build-focus-arrow-far", {
  // The cursor far from the menu (moved on the map, then the keyboard back on the menu with Tab):
  // Explore Map sends a see-through copy of the cursor across most of the map to reach it.
  // Unicode glyphs.
  before: `${PICK_FIRST_POWER} Tab S-Right*2 Down*5 Tab`,
  hand: "e",
  expect: "[e] Explore Map",
  glyphPack: "unicode",
})

scripted(
  "build-start-row",
  "Start Battle Round is the menu's last row: Down reaches it and stops there, PageDown (or Shift+Down, or End) jumps to it, Enter presses it",
  { keys: `${PICK_FIRST_POWER} PgDn`, expect: "[s] Start Battle Round" },
)

scripted(
  "build-nexus-confirm",
  "Start Battle Round opens Battle Round 1: what it announces, and one row, [s] Start. Esc goes back",
  { keys: `${PICK_FIRST_POWER} s`, expect: "Battle Round 1" },
)

popupGif("build-battle-round-opening", { keys: `${PICK_FIRST_POWER} s`, expect: "Battle Round 1", glyphPack: "unicode" })

// The early Battle Round shots (`pulse-start`, `pulse-fight` and the rest) were taken against a placeholder Pulse that
// PERIMETER's raid replaced; they are no longer made. The shots that follow are on PERIMETER.

// A round, keys only: the Reserve Fund (30 more credits), buildings by digit and two clicks on their
// tile, then [s] and [s] to start. The strong plan holds PERIMETER; nothing built loses it in round 3.
const ROUND_1_STRONG = "n 1 3 click:24,8 click:24,8 3 click:25,7 click:25,7 2 click:20,13 click:20,13 s s"
const ROUND_2_STRONG = "n 1 3 click:27,8 click:27,8 s s"
const ROUND_3_STRONG = "n 1 3 click:20,8 click:20,8 s s"
const NOTHING_BUILT = "n 1 s s"
// Long enough for any round to reach its result (a round is at most 30 seconds, and the ending about 2).
const TO_RESULT = "wait~20000 wait~20000"
const STRONG_TO_ROUND_2 = `${ROUND_1_STRONG} ${TO_RESULT} Enter`
const STRONG_TO_ROUND_3 = `${STRONG_TO_ROUND_2} ${ROUND_2_STRONG} ${TO_RESULT} Enter`

scripted(
  "mission-round-1",
  "PERIMETER, round 1 of 3: the raid at the ridge, a trail round it to the Barracks it goes for first, and the panel saying how many, of what, from where and when",
  { keys: "n 1", expect: "goes for your Barracks" },
)

scripted(
  "mission-incoming-card",
  "Explore Map over an incoming runner of the raid: what it is, when it arrives, and what it means to do",
  { keys: "n 1 e click:41,0", expect: "Probe the line at the" },
)

scripted(
  "mission-round-1-result",
  "Round 1's result: the fight's own headline, then where the mission stands, and [enter] Next round where Pause was",
  { keys: `${ROUND_1_STRONG} ${TO_RESULT}`, expect: "Next round" },
)

scripted(
  "mission-round-2",
  "Build Phase 2: the Turrets and the Hatchery stand, the survivors are home, the credits not spent carry over, and the second round's raid waits at the ridge",
  { keys: STRONG_TO_ROUND_2, expect: "round 2 of 3" },
)

scripted(
  "mission-battle-round-2",
  "Round 2's Battle Round screen, in the mission's own words",
  { keys: `${STRONG_TO_ROUND_2} n 1 s`, expect: "Battle Round 2" },
)

scripted(
  "mission-complete",
  "Round 3 held: MISSION COMPLETE, the perimeter held - and [enter] Play again",
  { keys: `${STRONG_TO_ROUND_3} ${ROUND_3_STRONG} ${TO_RESULT}`, expect: "MISSION COMPLETE" },
)

scripted(
  "mission-failed",
  "Nothing built: the Nexus falls in round 3 - MISSION FAILED, and why",
  { keys: `${NOTHING_BUILT} ${TO_RESULT} Enter ${NOTHING_BUILT} ${TO_RESULT} Enter ${NOTHING_BUILT} ${TO_RESULT}`, expect: "MISSION FAILED" },
)

scripted(
  "mission-experiments",
  "d over a Battle Round opens Settings at the mission's Experiments, Next round first",
  { keys: `${ROUND_1_STRONG} wait~3000 d`, expect: "Next round" },
)

scriptedGif("mission-next-round", {
  // A round's result, then Enter: the next round's Build Phase, on what the last one left.
  keys: `${ROUND_1_STRONG} ${TO_RESULT} Enter`,
  expect: "round 2 of 3",
  delayMs: 700,
})

// Settings (Mario, 2026-09-28): the game menu's [s] — the player's own settings first, then the
// Experiments, which [d] opens straight at.

scripted(
  "build-settings",
  "Settings from the game menu: sections with a blank line before each - Display (the player's own, saved), then Keyboard navigation, Effects and the mission (Experiments, not saved) - and Export settings apart at the end. The title says where the highlight is in the list, the right border is the list's scroll bar, and what the highlighted row is for is written under a line below it",
  { keys: "Esc s", expect: "DISPLAY - saved" },
)

scripted(
  "build-settings-export",
  "[e] Export settings: every setting and experiment as text, changed experiments first with the default each replaced (here the focus arrow and the card reveal) - copied to the clipboard and a file, to paste into a pull request",
  { keys: "d e", expect: "holdWindowMs = 250", experiments: { holdWindowMs: 250, popupPulseMs: 1200 } },
)

scripted(
  "build-debug-80x24",
  "[d] opens Settings at its Experiments: each with its value between < and >, and nothing else on the row. The question the highlighted one serves is written under the list",
  { keys: "d", expect: "KEYBOARD NAVIGATION - experiments" },
)

// Settings is in sections: Display (saved), Keyboard navigation (the hold window first,
// where [d] opens), Effects (the popup pulse and the Battle Round flash), the mission, then
// Export settings apart at the end. Headings and blank lines are never rows.

scripted(
  "build-debug-104x30",
  "Right twice on Hold window, the first Experiment: 200 ms becomes 350 ms, and the bottom line says so",
  { keys: "d Right Right", cols: 104, rows: 32, expect: "Hold window: 350 ms" },
)

scripted(
  "build-debug-light",
  "The light theme: [d] opens Settings at its Experiments, each with its value between < and >, the question the highlighted one serves written underneath",
  { keys: "d", theme: "light", expect: "KEYBOARD NAVIGATION" },
)

scriptedGif("build-arm-at-cursor", {
  // Mario's own flow: on the map, find a spot and press 1 — the Barracks is armed
  // right there; Enter places it and the keyboard stays on the map; 1 again, with the cursor on the new
  // one, moves it a few tiles right, a free column away; Enter; Esc goes from the map to the menu.
  keys: `${PICK_FIRST_POWER} Tab Right*8 Down*6 1 Enter 1 Enter Esc`,
  expect: "[enter] to place one",
})

// Movement feel.

const SETTINGS_AT_END = `SETTINGS (${SETTINGS_ROWS.length}/${SETTINGS_ROWS.length})`

scripted(
  "build-debug-scrolled",
  `Settings scroll: the settings and the experiments do not quite fit at 80x24, so the list moves with the highlight, the title says where it is - ${SETTINGS_AT_END}, Export settings - and the right border is a scroll bar with a thumb. A click on its upper or lower half, or the wheel, scrolls it too`,
  { keys: "d End", expect: SETTINGS_AT_END },
)

scripted(
  "build-esc-back",
  "The top bar's right end says what Esc does right now: back [esc] on the map (here Explore Map), menu [esc] on the menu, close [esc] over a popup - and a click on it is Esc",
  { keys: "e", expect: "back [esc]" },
)

scriptedGif("build-held-arrow", {
  // A tap, the terminal's repeat delay (150 ms here, inside the 200 ms hold window), then auto-repeats
  // 30 ms apart: a held key moves at the game's own pace, one tile every 60 ms, so every other repeat
  // moves nothing (Mario's third playtest round). Then Left, straight after: a hold of its own. Shift+Down:
  // a jump of ten. (Explore Map, from the menu, first moves the cursor to clear ground by the Nexus.)
  keys: "e Right Right~150 Right~30*14 Left~30 Left~30*3 S-Down",
  expect: "27,20",
  delayMs: 450,
})

scriptedGif("build-explore-edge-click", {
  // Exploring, a click near an edge scrolls the view, further the nearer the edge: two columns in, a
  // long way; eight columns in, a little; in the middle, not at all.
  keys: `${PICK_FIRST_POWER} e click@76,10 click@70,10 click@55,10`,
  expect: "[e] Explore Map",
  delayMs: 1200,
})

scripted(
  "build-refused-flash",
  "Enter on rock: the whole footprint flashes solid for 150 ms as the status line says why, so an eye on the map sees it did not build",
  { keys: `${PICK_FIRST_POWER} 1 Up*5 Left*14 Enter`, expect: "Cannot build here", present: { refusedTry: true } },
)

slideGif("build-view-slide", {
  // Shift+Right: the cursor jumps and drags the view at the scroll margin; the view slides there over
  // the tuned view slide, a few frames, fast at first and settling at the end, and the cursor glides —
  // every frame the live screen draws, as it draws them.
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
    // `--keys Esc`: past round 1's intro before the first frame, so these shots open where they always did.
    `./bin/terminal-nexus.ts --at 'campaign?level=vasse-test-1' --keys Esc ${args}`,
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
/** In tmux, `n` then `1` — the pick closes the popup, so no Esc: see `KEY_PAUSE_SECONDS`. */
const pickFirstPower = () => {
  literal("n")
  literal("1")
}

live(
  "build-idle",
  "The Build Phase opens on the menu, on the left: the keyboard on [e] Explore Map, [n] Nexus under it with its (1), the one pick still waiting, then the credits, and the bottom line saying what Explore Map is for. No cursor on the Grid while the menu has the keyboard",
  { waitForText: "Explore Map" },
)

live(
  "spike-scrolled",
  "Scrolled into the middle of the Grid with Shift+Arrow and PageDown - real modified-arrow bytes through tmux. All four borders now mark more Grid",
  {
    drive: () => {
      pickFirstPower()
      key("Tab")
      // A ten-tile jump since Mario's settings export of 2026-09-30 (it was five, then eight, then
      // twelve): two east and one south, from 18,10 on the Grid Nexus, still leave more Grid on every
      // side. tmux's pause between keys is longer than the jump repeat limit, so no jump is dropped.
      key("S-Right")
      key("NPage")
      key("S-Right")
    },
    // The position readout is gone; every key above is sent before this wait, and the
    // capture then waits for a still pane, so plain navigation's hint is enough.
    waitForText: "Arrows move the cursor",
  },
)

live(
  "spike-mouse-place",
  "Two real SGR mouse clicks placing a structure - the first arms the preview at the tile, the second confirms it: the bytes a terminal actually sends, not a description of one",
  {
    drive: () => {
      pickFirstPower()
      literal("1") // arm Barracks: off the Grid Nexus, where the cursor opens, to 22,10 beside it
      // Column 61, row 14 (1-based) is tile 30,10 at the opening camera — the same cell
      // `cellForTile` hands the tests, formatted the way src/build/mouse.ts's own
      // `formatMouseEvent` would. The first click only moves the cursor there; the second, on the
      // same tile, is what actually places it. Chosen well inside the scroll margin: a first click
      // near the Grid pane's edge scrolls the map under the pointer, and a second click in the same
      // place is then a first click on the tile beside it.
      literal(`${ESC}[<0;61;14M`)
      literal(`${ESC}[<0;61;14M`)
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
      // Two ten-tile jumps (the tuned jump), with a key between them so the second is not a held
      // Shift's repeat inside the jump limit.
      key("S-Right")
      key("Down")
      key("S-Right")
    },
    waitForText: "Place the Barracks",
  },
)

live(
  "spike-resize-gate",
  "79x24, one column below the floor: playback gates rather than cropping the Grid, and says exactly what it needs",
  { cols: 79, rows: 24 },
)

rmSync(scratch, { recursive: true, force: true })
