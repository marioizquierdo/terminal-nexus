// Screenshot `grid` (the Pulse Playground's tool) running on a real terminal.
//
//   node scripts/capture-screenshots.mjs
//   node scripts/capture-screenshots.mjs --only mirror-open
//
// Why this exists: `snapshotAt` gives a frame as text, which is what tests assert on, but it says
// nothing about how the composition *looks* — spacing, density, where the eye goes, whether colour
// helps or clutters. This drives the real binary inside a real pseudo-terminal (tmux), captures
// what the terminal actually holds, and renders it to a PNG through the browser already installed
// in this environment. It is an evidence and design tool, not part of the game.
//
// The capture pipeline itself lives in scripts/lib/terminal-capture.mjs, shared with
// capture-engagement.mjs — this file is just the list of shots and how each one is driven to its
// tick.

import { rmSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  ansiToHtml,
  killSession,
  pane,
  renderPng,
  sendKeys,
  startWatch,
  stepToTick,
  tmux,
  waitFor,
} from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(repoRoot, "evidence", "screenshots")
const scratch = join(repoRoot, ".capture-tmp")
const SESSION = "nexus-capture"

const shots = [
  {
    name: "mirror-open",
    caption: "Tick 0 - both squads placed, nothing has moved",
    scenario: "citizen-mirror-skirmish",
    tick: 0,
    cols: 80,
    rows: 24,
  },
  {
    name: "mirror-first-shots",
    caption: "Tick 112 - the marksmen open fire at range five",
    scenario: "citizen-mirror-skirmish",
    tick: 112,
    cols: 80,
    rows: 24,
  },
  {
    name: "mirror-melee",
    caption: "Tick 160 - troopers in contact, first salvage on the ground",
    scenario: "citizen-mirror-skirmish",
    tick: 160,
    cols: 80,
    rows: 24,
  },
  {
    name: "mirror-monochrome",
    caption: "Tick 160 in monochrome - the acceptance floor",
    scenario: "citizen-mirror-skirmish",
    tick: 160,
    cols: 80,
    rows: 24,
    capability: "monochrome",
  },
  {
    name: "mirror-wide",
    caption: "Tick 160 at two columns per tile, 128 columns",
    scenario: "citizen-mirror-skirmish",
    tick: 160,
    cols: 128,
    rows: 24,
    tileWidth: 2,
  },
  {
    name: "nexus-falls",
    caption: "Tick 361 - a 3x2 Grid Nexus goes down and ends the Pulse",
    scenario: "structure-destruction",
    tick: 361,
    cols: 80,
    rows: 24,
  },
  {
    name: "hauler-gap",
    caption: "Tick 120 - the 3x1 hauler threading a three-tile gap",
    scenario: "hauler-three-tile-gap",
    tick: 120,
    cols: 80,
    rows: 24,
  },
  {
    name: "resize-gate",
    caption: "A 64x18 terminal - below the composition, so playback freezes behind the gate",
    scenario: "citizen-mirror-skirmish",
    tick: 0,
    cols: 64,
    rows: 18,
    expectGate: true,
  },
  {
    name: "ravels-clash",
    caption: "Citizens meet Ravels in the ruined middle - truecolor, Unicode pack, effects on",
    scenario: "citizens-versus-ravels",
    tick: 178,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "ravels-clash-no-effects",
    caption: "The same instant with effects off - the comparison the gate is judged on",
    scenario: "citizens-versus-ravels",
    tick: 178,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
    effects: false,
  },
  {
    name: "ravels-clash-wide",
    caption: "The same fight at two columns per tile - 128 columns, tiles read square",
    scenario: "citizens-versus-ravels",
    tick: 178,
    cols: 128,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
    tileWidth: 2,
  },
  {
    name: "cascade-blast",
    caption: "The worst frame first - nine fuel wagons and five troopers, one tick",
    scenario: "ravel-cascade",
    tick: 48,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "cascade-monochrome",
    caption: "The same cascade at the acceptance floor - monochrome ASCII, reduced motion",
    scenario: "ravel-cascade",
    tick: 48,
    cols: 80,
    rows: 24,
    capability: "monochrome",
    reducedMotion: true,
  },
  {
    name: "mirror-light-theme",
    caption: "Tick 160 on a light terminal background - --theme light",
    scenario: "citizen-mirror-skirmish",
    tick: 160,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    theme: "light",
  },
]

function extraArgsFor(shot) {
  return [
    "--capability",
    shot.capability ?? "color16",
    "--theme",
    shot.theme ?? "dark",
    "--tile-width",
    String(shot.tileWidth ?? 1),
    "--glyphs",
    shot.glyphs ?? "ascii",
    ...(shot.effects === false ? ["--no-effects"] : []),
    ...(shot.reducedMotion === true ? ["--reduced-motion"] : []),
  ]
}

/** The gate fixture never reaches the normal paused-playback flow, so it gets its own tiny driver. */
function captureGate(shot) {
  killSession(repoRoot, SESSION)
  const command = [
    "./bin/grid.ts",
    "watch",
    `scenarios/${shot.scenario}.ts`,
    ...extraArgsFor(shot),
  ].join(" ")
  tmux(repoRoot, [
    "new-session", "-d", "-s", SESSION,
    "-x", String(shot.cols), "-y", String(shot.rows),
    command,
  ])
  waitFor(repoRoot, SESSION, (text) => text.includes("TERMINAL TOO SMALL"), "the resize gate")
  const captured = pane(repoRoot, SESSION, { colour: true })
  sendKeys(repoRoot, SESSION, "q")
  killSession(repoRoot, SESSION)
  return captured
}

function capture(shot) {
  if (shot.expectGate === true) return captureGate(shot)
  startWatch(repoRoot, SESSION, `scenarios/${shot.scenario}.ts`, shot.cols, shot.rows, extraArgsFor(shot))
  stepToTick(repoRoot, SESSION, shot.tick)
  const captured = pane(repoRoot, SESSION, { colour: true })
  sendKeys(repoRoot, SESSION, "q")
  killSession(repoRoot, SESSION)
  return captured
}

const onlyIndex = process.argv.indexOf("--only")
const only = onlyIndex === -1 ? null : process.argv[onlyIndex + 1]

try {
  for (const shot of shots) {
    if (only !== null && shot.name !== only) continue
    const captured = capture(shot)
    const html = ansiToHtml(captured, shot.cols, shot.rows)
    const file = renderPng({
      html,
      caption: shot.caption,
      cols: shot.cols,
      rows: shot.rows,
      scratchDir: scratch,
      targetPath: join(outputDirectory, `${shot.name}.png`),
      background: shot.theme ?? "dark",
    })
    console.log(`${file}  (${shot.cols}x${shot.rows}, tick ${shot.tick})`)
  }
} finally {
  killSession(repoRoot, SESSION)
  rmSync(scratch, { recursive: true, force: true })
}
