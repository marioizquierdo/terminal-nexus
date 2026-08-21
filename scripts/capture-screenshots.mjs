// Screenshot the Pulse Playground running on a real terminal.
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
// The pipeline, and why each step is what it is:
//
//   tmux           a real PTY, so `process.stdout.isTTY` is true and the ANSI backend runs the same
//                  path a person gets. It is also drivable: pause, then step exactly N ticks, so a
//                  screenshot lands on a tick somebody chose rather than whenever it was taken.
//   capture-pane   `-e` keeps the escape sequences, so the capture carries colour, not just glyphs.
//   HTML           one span per styled run, on a terminal-dark page in DejaVu Sans Mono.
//   chromium       already present here for Playwright; used headless purely as a renderer.

import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputDirectory = join(repoRoot, "evidence", "screenshots")
const scratch = join(repoRoot, ".capture-tmp")
const ESC = String.fromCharCode(27)

const CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
const SESSION = "nexus-capture"

/** xterm's usual renderings of the 16 ANSI colours, matching the roles in src/view/roles.ts. */
const PALETTE = {
  30: "#000000", 31: "#cd0000", 32: "#00cd00", 33: "#cdcd00",
  34: "#0000ee", 35: "#cd00cd", 36: "#00cdcd", 37: "#e5e5e5",
  90: "#7f7f7f", 91: "#ff0000", 92: "#00ff00", 93: "#ffff00",
  94: "#5c5cff", 95: "#ff00ff", 96: "#00ffff", 97: "#ffffff",
}
const BACKGROUND = "#0c0c0c"
const FOREGROUND = "#d0d0d0"

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
    caption: "Tick 404 - a 3x2 Grid Nexus goes down and ends the Pulse",
    scenario: "structure-destruction",
    tick: 404,
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
]

/** The xterm 256-colour palette: sixteen system colours, a 6x6x6 cube, then twenty-four greys. */
function xterm256(index) {
  if (index < 16) {
    const base = [
      "#000000", "#cd0000", "#00cd00", "#cdcd00", "#0000ee", "#cd00cd", "#00cdcd", "#e5e5e5",
      "#7f7f7f", "#ff0000", "#00ff00", "#ffff00", "#5c5cff", "#ff00ff", "#00ffff", "#ffffff",
    ]
    return base[index] ?? "#d0d0d0"
  }
  if (index < 232) {
    const step = [0, 95, 135, 175, 215, 255]
    const offset = index - 16
    const r = step[Math.floor(offset / 36)] ?? 0
    const g = step[Math.floor((offset % 36) / 6)] ?? 0
    const b = step[offset % 6] ?? 0
    return `rgb(${r},${g},${b})`
  }
  const grey = 8 + (index - 232) * 10
  return `rgb(${grey},${grey},${grey})`
}

function tmux(args) {
  return execFileSync("tmux", args, { encoding: "utf8", cwd: repoRoot })
}

function killSession() {
  try {
    tmux(["kill-session", "-t", SESSION])
  } catch {
    // No session to kill, which is the normal case.
  }
}

function pane() {
  return tmux(["capture-pane", "-t", SESSION, "-p"])
}

function pause(seconds) {
  execFileSync("sleep", [String(seconds)])
}

function waitFor(predicate, what, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ""
    try {
      text = pane()
    } catch {
      throw new Error(`the session ended while waiting for ${what}`)
    }
    if (predicate(text)) return text
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    pause(0.15)
  }
}

function tickOf(text) {
  const match = /tick (\d{4})\//.exec(text)
  return match === null ? null : Number(match[1])
}

function capture(shot) {
  killSession()
  const command = [
    "./bin/playground.ts",
    "watch",
    `scenarios/${shot.scenario}.ts`,
    "--capability",
    shot.capability ?? "color16",
    "--tile-width",
    String(shot.tileWidth ?? 1),
    "--glyphs",
    shot.glyphs ?? "ascii",
    ...(shot.effects === false ? ["--no-effects"] : []),
    ...(shot.reducedMotion === true ? ["--reduced-motion"] : []),
  ].join(" ")

  tmux([
    "new-session", "-d", "-s", SESSION,
    "-x", String(shot.cols), "-y", String(shot.rows),
    command,
  ])

  if (shot.expectGate === true) {
    waitFor((text) => text.includes("TERMINAL TOO SMALL"), "the resize gate")
  } else {
    waitFor((text) => text.includes("TERMINAL NEXUS"), "the first frame")
    // Pause, then step exactly to the wanted tick: a screenshot should land on a tick somebody
    // chose, not on whichever one the wall clock happened to reach.
    tmux(["send-keys", "-t", SESSION, "-l", " "])
    waitFor((text) => text.includes("[hold]"), "the paused indicator")

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const current = tickOf(pane())
      if (current === null) throw new Error("could not read the tick readout")
      const remaining = shot.tick - current
      if (remaining <= 0) break
      tmux(["send-keys", "-t", SESSION, "-l", ",".repeat(Math.min(remaining, 120))])
      pause(0.25)
    }
    const landed = tickOf(pane())
    if (landed !== shot.tick) {
      throw new Error(`wanted tick ${shot.tick}, the session is showing ${String(landed)}`)
    }
  }

  const captured = tmux(["capture-pane", "-t", SESSION, "-e", "-p"])
  tmux(["send-keys", "-t", SESSION, "-l", "q"])
  pause(0.3)
  killSession()
  return captured
}

/** Turn one captured pane into HTML: a span per styled run, nothing else. */
function ansiToHtml(text, cols, rows) {
  const escapeHtml = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const lines = text.split("\n").slice(0, rows)
  const rendered = lines.map((line) => {
    let style = { fg: null, bg: null, bold: false, dim: false, underline: false, inverse: false }
    let html = ""
    let plainLength = 0
    let open = false

    const openSpan = () => {
      const foreground = style.fg ?? FOREGROUND
      const background = style.bg
      const parts = [`color:${style.inverse ? (background ?? BACKGROUND) : foreground}`]
      if (style.inverse) parts.push(`background:${foreground}`)
      else if (background !== null) parts.push(`background:${background}`)
      if (style.bold) parts.push("font-weight:700")
      if (style.dim) parts.push("opacity:.55")
      if (style.underline) parts.push("text-decoration:underline")
      html += `<span style="${parts.join(";")}">`
      open = true
    }
    const closeSpan = () => {
      if (open) html += "</span>"
      open = false
    }
    const emit = (chunk) => {
      if (chunk === "") return
      if (!open) openSpan()
      html += escapeHtml(chunk)
      plainLength += chunk.length
    }

    const pattern = new RegExp(`${ESC}\\[([0-9;]*)m`, "g")
    let cursor = 0
    let match = pattern.exec(line)
    while (match !== null) {
      emit(line.slice(cursor, match.index))
      closeSpan()
      const codes = (match[1] === "" ? "0" : match[1]).split(";").map(Number)
      for (let index = 0; index < codes.length; index += 1) {
        const code = codes[index]
        if (code === 0) {
          style = { fg: null, bg: null, bold: false, dim: false, underline: false, inverse: false }
        } else if (code === 1) style.bold = true
        else if (code === 2) style.dim = true
        else if (code === 4) style.underline = true
        else if (code === 7) style.inverse = true
        else if (code === 22) { style.bold = false; style.dim = false }
        else if (code === 24) style.underline = false
        else if (code === 27) style.inverse = false
        else if (code === 39) style.fg = null
        else if (code === 49) style.bg = null
        else if (code === 38 || code === 48) {
          // Extended colour: `38;5;n` picks from the 256 palette, `38;2;r;g;b` is exact. Parsing
          // these as a run of independent codes is how a truecolor frame turns into magenta soup.
          const mode = codes[index + 1]
          if (mode === 5) {
            const colour = xterm256(codes[index + 2] ?? 0)
            if (code === 38) style.fg = colour
            else style.bg = colour
            index += 2
          } else if (mode === 2) {
            const colour = `rgb(${codes[index + 2] ?? 0},${codes[index + 3] ?? 0},${codes[index + 4] ?? 0})`
            if (code === 38) style.fg = colour
            else style.bg = colour
            index += 4
          }
        } else if (PALETTE[code] !== undefined) style.fg = PALETTE[code]
        else if (PALETTE[code - 10] !== undefined) style.bg = PALETTE[code - 10]
      }
      cursor = match.index + match[0].length
      match = pattern.exec(line)
    }
    emit(line.slice(cursor))
    closeSpan()

    // Pad every row to the full width: a terminal has no ragged right edge.
    return html + escapeHtml(" ".repeat(Math.max(0, cols - plainLength)))
  })

  while (rendered.length < rows) rendered.push("")
  return rendered.join("\n")
}

function pageFor(html, shot) {
  return `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: #17181c; }
  .frame { padding: 20px; display: inline-block; }
  pre {
    margin: 0;
    padding: 14px 16px;
    background: ${BACKGROUND};
    color: ${FOREGROUND};
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 16px;
    line-height: 1.25;
    border-radius: 6px;
    white-space: pre;
  }
  .caption {
    margin: 10px 2px 0;
    color: #8a8f98;
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 12px;
  }
</style>
<div class="frame"><pre>${html}</pre><div class="caption">${shot.caption} &middot; ${shot.cols}x${shot.rows}</div></div>
`
}

function screenshot(shot, html) {
  mkdirSync(scratch, { recursive: true })
  mkdirSync(outputDirectory, { recursive: true })
  const pagePath = join(scratch, `${shot.name}.html`)
  writeFileSync(pagePath, pageFor(html, shot), "utf8")

  // DejaVu Sans Mono advances 0.602em, so the window is sized from the cell grid, not guessed.
  const width = Math.ceil(shot.cols * 16 * 0.602) + 108
  const height = Math.ceil(shot.rows * 16 * 1.25) + 160
  const target = join(outputDirectory, `${shot.name}.png`)

  execFileSync(
    CHROMIUM,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      `--window-size=${width},${height}`,
      `--screenshot=${target}`,
      `file://${pagePath}`,
    ],
    { stdio: "pipe" },
  )
  return target
}

const onlyIndex = process.argv.indexOf("--only")
const only = onlyIndex === -1 ? null : process.argv[onlyIndex + 1]

try {
  for (const shot of shots) {
    if (only !== null && shot.name !== only) continue
    const captured = capture(shot)
    const html = ansiToHtml(captured, shot.cols, shot.rows)
    const file = screenshot(shot, html)
    console.log(`${file}  (${shot.cols}x${shot.rows}, tick ${shot.tick})`)
  }
} finally {
  killSession()
  rmSync(scratch, { recursive: true, force: true })
}
