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
  stepPastEnd,
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
    name: "multicell-open",
    caption: "Small multicell skirmish, tick 0 - a 2x2 sentinel and a 2x1 flying corsair, escorted",
    scenario: "small-multicell-skirmish",
    tick: 0,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "multicell-death",
    caption: "Small multicell skirmish, tick 133 - the corsair and its slinger escort both down, mid-collapse",
    scenario: "small-multicell-skirmish",
    tick: 133,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "heavies-open",
    caption: "Heavies clash, tick 0 - a 3x3 colossus and a 5x2 leviathan among their 1-tile escorts",
    scenario: "heavies-clash",
    tick: 0,
    cols: 80,
    rows: 24,
  },
  {
    // The 2026-08-23 big-death choreography, tick by tick: heavies-clash's own leviathan dies at
    // tick 321 (5x2, deathRingOutset 3, so deathExtraTicks lands its collapse at ~12 ticks total -
    // the owner's own number). Five shots span that window rather than one: "an explosion that goes
    // from the middle towards the radius, then smaller explosions, and pieces being broken around,
    // ending up in multiple debris" is a sequence, and a sequence needs more than one frame to judge.
    name: "heavies-death-impact",
    caption: "Tick 321 - the leviathan dies: the interior ignites, the shockwave already a tile out",
    scenario: "heavies-clash",
    tick: 321,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    // heavies-clash's own Pulse ends at tick 321 - the same tick the leviathan dies, since that
    // blow is also the annihilation that ends the fight - so the footer's own tick readout freezes
    // there for good (clampTick, snapshot.ts) and afterTick drives the extra ticks directly rather
    // than through the readout (stepPastEnd's own comment). That freeze is correct, not a bug: the
    // effect's own presentation clock keeps advancing regardless, which is the entire point of a
    // death choreography long enough to outlast the blow that caused it.
    name: "heavies-death-shockwave",
    caption: "2 presentation ticks past the frozen 0321 footer - the shockwave reaches its full radius",
    scenario: "heavies-clash",
    tick: 323,
    afterTick: 321,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "heavies-death-flight",
    caption: "6 ticks past the frozen 0321 footer - pieces mid-arc, scattered irregularly, not a tidy ring",
    scenario: "heavies-clash",
    tick: 327,
    afterTick: 321,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "heavies-death-settle",
    caption: "12 ticks past the frozen 0321 footer - every piece landed, scattered around and beyond the 5x2 footprint",
    scenario: "heavies-clash",
    tick: 333,
    afterTick: 321,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    name: "heavies-death-monochrome",
    caption: "The same mid-flight instant at the acceptance floor - monochrome ASCII, no colour to lean on",
    scenario: "heavies-clash",
    tick: 327,
    afterTick: 321,
    cols: 80,
    rows: 24,
    capability: "monochrome",
  },
  {
    // Reduced motion needs neither afterTick nor a late tick to make its point: it holds every
    // piece already landed from the first instant (progressOf 0), which is exactly the comparison -
    // travel and the launch delay gone, causality (something this size died and left wreckage) kept.
    name: "heavies-death-reduced-motion",
    caption: "The death's very first instant with reduced motion - no travel, every piece already at rest",
    scenario: "heavies-clash",
    tick: 321,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
    reducedMotion: true,
  },
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
    // Q25 (specs/open-questions.md), option A: the 256-colour tier is now derived from rgb rather
    // than a fourth hand-authored column. Same real fight frame as "ravels-clash" above, at the
    // 256-colour tier specifically, captured once per formula (see the gate report for how the
    // "hand-authored" half was produced) so the owner can judge whether derived reads worse before
    // anything else is built on it.
    name: "palette-derivation-256",
    caption: "Tick 178, 256-colour tier - derived from rgb vs. the former hand-authored table",
    scenario: "citizens-versus-ravels",
    tick: 178,
    cols: 80,
    rows: 24,
    capability: "color256",
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
  {
    // Owner playtest, 2026-08-24: "the explosion can be improved, by expanding faster at first, and
    // then slowing down towards the end." B:wagon#20 (radius 2, the largest detonation in the game)
    // dies to a clean, isolated melee blow at tick 204 - no other blast the same tick, no ranged
    // flight hold, so its fx.blast.detonation instance starts exactly on tick 204's own boundary.
    // Two ticks later (166.7ms into its 380ms window, progress 0.4386) the eased and un-eased curves
    // disagree about the ring: round(0.4386*2*1.35)=1 under the old linear formula,
    // round(easeOut(0.4386)*2*1.35)=2 under the new one - one tick before the two curves converge
    // again at reach 2. Captured twice at the identical tick, once per formula (see the gate report
    // for how the "before" half was produced) rather than only described.
    name: "easing-blast-ring",
    caption: "Tick 206 - two ticks into B:wagon#20's radius-2 blast, ease-out vs. the old linear ramp",
    scenario: "citizens-versus-ravels",
    tick: 206,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    // Owner, 2026-08-24: "the explosions should also spawn smaller sub-explosions." Same B:wagon#20
    // blast as "easing-blast-ring" above, three ticks in rather than two - close enough to the main
    // ring to still read as one explosion, far enough that the hash-seeded sub-burst(s) have started.
    name: "blast-sub-explosions",
    caption: "Tick 207 - B:wagon#20's radius-2 blast, main ring plus its own hash-seeded sub-bursts",
    scenario: "citizens-versus-ravels",
    tick: 207,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },

  // --- Proving Grounds: the unit-design-architecture spike --------------------------------------
  {
    // targetLayers, the ground-air asymmetry rule shape: the grunt (bottom-left) never acquires a
    // target at all - it cannot reach the skyraider - while the flak trooper (top-left) trades fire
    // with it normally, no restriction of its own.
    name: "bench-sky-ground-asymmetry",
    caption: "Tick 50 - a flak trooper trades fire with the skyraider; the grunt beside it never even tries",
    scenario: "bench-sky-ground-asymmetry",
    tick: 50,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    // windup + splash: the crawler's first shot, landing on both clustered troopers at once.
    name: "bench-siegecrawler-windup",
    caption: "Tick 58 - the siege crawler's first shot after its windup, splash catching both troopers",
    scenario: "bench-siegecrawler-windup",
    tick: 58,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    // support/heal, mid-fight: the medic (rear) restores the front-line trooper while the grunt and
    // flak trooper (right) press the attack - the heal and the melee/ranged exchange in one frame.
    name: "bench-medic-support",
    caption: "Tick 48 - the medic heals its trooper mid-melee, the grunt and flak trooper still pressing",
    scenario: "bench-medic-support",
    tick: 48,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    // splitOnDeath: the instant the shard-giant falls, two spawnlings appear beside the wreck.
    name: "bench-shardgiant-split",
    caption: "Tick 33 - the shard-giant dies to focused fire and splits into two spawnlings on the spot",
    scenario: "bench-shardgiant-split",
    tick: 33,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
  },
  {
    // Pure composition: hog rider brawling the barracks while a trooper chases it, saboteur under
    // fire nearby, bomber inbound overhead - three designs built from targetLayers/air/detonation
    // with no new kernel code, all visible at once.
    name: "bench-hog-saboteur-bomber",
    caption: "Tick 49 - hog rider and saboteur ignore the troopers chasing them to keep working the barracks",
    scenario: "bench-hog-saboteur-bomber",
    tick: 49,
    cols: 80,
    rows: 24,
    capability: "truecolor",
    glyphs: "unicode",
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
    `scenarios/${shot.scenario}.map.json`,
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
  startWatch(
    repoRoot,
    SESSION,
    `scenarios/${shot.scenario}.map.json`,
    shot.cols,
    shot.rows,
    extraArgsFor(shot),
  )
  if (shot.afterTick === undefined) {
    stepToTick(repoRoot, SESSION, shot.tick)
  } else {
    // Past the Pulse's own last resolved tick: the footer readout freezes there for good (state and
    // positions have nothing further to show), but a long effect's own presentation clock does not -
    // see stepPastEnd's own comment.
    stepPastEnd(repoRoot, SESSION, shot.afterTick, shot.tick)
  }
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
