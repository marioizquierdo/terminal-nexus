// Shared plumbing for driving `./bin/grid.ts watch` inside a real pseudo-terminal and turning
// what it drew into a PNG. Used by capture-screenshots.mjs (one chosen frame per shot) and
// capture-engagement.mjs (a run of consecutive frames around one engagement) — extracted here once a
// second script needed the identical pipeline, rather than kept as two copies to drift apart.
//
// The pipeline, and why each step is what it is:
//
//   tmux           a real PTY, so `process.stdout.isTTY` is true and the ANSI backend runs the same
//                  path a person gets. It is also drivable: pause, then step exactly N ticks or
//                  frames, so a screenshot lands where somebody chose rather than wherever the wall
//                  clock happened to reach.
//   capture-pane   `-e` keeps the escape sequences, so the capture carries colour, not just glyphs.
//   HTML           one span per styled run, on a terminal-dark page in DejaVu Sans Mono.
//   chromium       already present here for Playwright; used headless purely as a renderer.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export const CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
export const ESC = String.fromCharCode(27)

/** xterm's usual renderings of the 16 ANSI colours, matching the roles in src/view/roles.ts. */
export const PALETTE = {
  30: "#000000", 31: "#cd0000", 32: "#00cd00", 33: "#cdcd00",
  34: "#0000ee", 35: "#cd00cd", 36: "#00cdcd", 37: "#e5e5e5",
  90: "#7f7f7f", 91: "#ff0000", 92: "#00ff00", 93: "#ffff00",
  94: "#5c5cff", 95: "#ff00ff", 96: "#00ffff", 97: "#ffffff",
}
export const BACKGROUND = "#0c0c0c"
export const FOREGROUND = "#d0d0d0"

/** The xterm 256-colour palette: sixteen system colours, a 6x6x6 cube, then twenty-four greys. */
export function xterm256(index) {
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

export function tmux(repoRoot, args) {
  return execFileSync("tmux", args, { encoding: "utf8", cwd: repoRoot })
}

export function killSession(repoRoot, session) {
  try {
    tmux(repoRoot, ["kill-session", "-t", session])
  } catch {
    // No session to kill, which is the normal case.
  }
}

export function pane(repoRoot, session, { colour = false } = {}) {
  const args = ["capture-pane", "-t", session, "-p"]
  if (colour) args.splice(1, 0, "-e")
  return tmux(repoRoot, args)
}

function pause(seconds) {
  execFileSync("sleep", [String(seconds)])
}

export function waitFor(repoRoot, session, predicate, what, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let text = ""
    try {
      text = pane(repoRoot, session)
    } catch {
      throw new Error(`the session ended while waiting for ${what}`)
    }
    if (predicate(text)) return text
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
    pause(0.15)
  }
}

export function sendKeys(repoRoot, session, literal) {
  tmux(repoRoot, ["send-keys", "-t", session, "-l", literal])
}

/** The tick readout in the footer, e.g. "tick 0143/0480". */
export function tickOf(text) {
  const match = /tick (\d{4})\//.exec(text)
  return match === null ? null : Number(match[1])
}

/** Start `watch` (grid's default action) on a map, in its own session, at the given terminal size. */
export function startWatch(repoRoot, session, mapFile, cols, rows, extraArgs = []) {
  killSession(repoRoot, session)
  const command = ["./bin/grid.ts", mapFile, ...extraArgs].join(" ")
  tmux(repoRoot, ["new-session", "-d", "-s", session, "-x", String(cols), "-y", String(rows), command])
  waitFor(repoRoot, session, (text) => text.includes("TERMINAL NEXUS"), "the first frame")
  sendKeys(repoRoot, session, " ")
  waitFor(repoRoot, session, (text) => text.includes("[hold]"), "the paused indicator")
}

/** Step forward from wherever playback is paused to exactly `tick`, by whole ticks. */
export function stepToTick(repoRoot, session, tick) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const current = tickOf(pane(repoRoot, session))
    if (current === null) throw new Error("could not read the tick readout")
    const remaining = tick - current
    if (remaining <= 0) break
    sendKeys(repoRoot, session, ",".repeat(Math.min(remaining, 120)))
    pause(0.2)
  }
  const landed = tickOf(pane(repoRoot, session))
  if (landed !== tick) {
    throw new Error(`wanted tick ${tick}, the session is showing ${String(landed)}`)
  }
}

/**
 * Step to a presentation instant *past* a Pulse's own last resolved tick - deliberately reachable,
 * not a bug: `snapshot.ts` hands every recipe an unclamped `context.timeMs` even once `tick` and
 * every entity's own position have frozen on the final resolved state (`clampTick`), so an effect
 * long enough to outlast the deciding blow - this round's whole point - keeps animating on a frame
 * whose footer no longer changes. `stepToTick` cannot confirm arrival there, because the one signal
 * it reads (the footer's tick readout) is exactly the thing that stops moving; this steps to
 * `lastResolvedTick` with it (still verified), then sends the remaining ticks directly. That is safe
 * without a read-back because `Playback.apply`'s "step-tick" case (src/view/playback.ts) advances
 * presentation time by exactly one tick's worth per keypress, unconditionally, gate aside - counting
 * presses is exact, not a guess.
 */
export function stepPastEnd(repoRoot, session, lastResolvedTick, tick) {
  stepToTick(repoRoot, session, lastResolvedTick)
  const extra = tick - lastResolvedTick
  for (let sent = 0; sent < extra; sent += 120) {
    sendKeys(repoRoot, session, ",".repeat(Math.min(extra - sent, 120)))
    pause(0.05)
  }
  pause(0.2)
}

/** Turn one captured pane into HTML: a span per styled run, nothing else. */
export function ansiToHtml(text, cols, rows) {
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

function pageFor(html, caption, cols, rows, background) {
  const page = background === "light" ? "#e8e6e0" : "#17181c"
  const pre = background === "light" ? "#f2f0ea" : BACKGROUND
  const captionColor = background === "light" ? "#6b6660" : "#8a8f98"
  return `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: ${page}; }
  .frame { padding: 20px; display: inline-block; }
  pre {
    margin: 0;
    padding: 14px 16px;
    background: ${pre};
    color: ${FOREGROUND};
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 16px;
    line-height: 1.25;
    border-radius: 6px;
    white-space: pre;
  }
  .caption {
    margin: 10px 2px 0;
    color: ${captionColor};
    font-family: "DejaVu Sans Mono", monospace;
    font-size: 12px;
  }
</style>
<div class="frame"><pre>${html}</pre><div class="caption">${caption} &middot; ${cols}x${rows}</div></div>
`
}

/**
 * Render a captured-and-converted frame to a PNG at `targetPath`, via headless Chromium.
 * `background` is the page/pane backdrop the capture sits on - "dark" (default) or "light", to
 * match whichever `--theme` the session being captured was actually running. The ANSI capture
 * itself carries the theme's real colours already; this only affects the page around it, which a
 * light-theme capture would otherwise sit on the tool's own dark backdrop and read as broken.
 */
export function renderPng({ html, caption, cols, rows, scratchDir, targetPath, background = "dark" }) {
  mkdirSync(scratchDir, { recursive: true })
  const pagePath = join(scratchDir, `${Math.random().toString(36).slice(2)}.html`)
  writeFileSync(pagePath, pageFor(html, caption, cols, rows, background), "utf8")

  // DejaVu Sans Mono advances 0.602em, so the window is sized from the cell grid, not guessed.
  const width = Math.ceil(cols * 16 * 0.602) + 108
  const height = Math.ceil(rows * 16 * 1.25) + 160

  execFileSync(
    CHROMIUM,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      `--window-size=${width},${height}`,
      `--screenshot=${targetPath}`,
      `file://${pagePath}`,
    ],
    { stdio: "pipe" },
  )
  return targetPath
}
