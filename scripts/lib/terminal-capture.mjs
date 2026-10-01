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
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import pngjs from "pngjs"
import { DIM_ALPHA } from "../../src/view/backends/canvas.ts"
import { xterm256Rgb } from "../../src/view/roles.ts"

/**
 * Where the headless Chromium is: `CHROMIUM_PATH` if set, else the newest `chromium-<revision>/chrome-linux/chrome`
 * under `PLAYWRIGHT_BROWSERS_PATH` or `/opt/pw-browsers`. Every script that renders a page calls this one
 * function; it throws, naming both ways to say where Chromium is, when it finds none.
 */
export function chromiumPath() {
  const fromEnvironment = process.env.CHROMIUM_PATH
  if (fromEnvironment) {
    if (existsSync(fromEnvironment)) return fromEnvironment
    throw new Error(`CHROMIUM_PATH is set to ${fromEnvironment}, which does not exist`)
  }
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers"
  let found = []
  try {
    found = readdirSync(root)
      .map((name) => ({ name, revision: /^chromium-(\d+)$/.exec(name)?.[1] }))
      .filter((entry) => entry.revision !== undefined)
      .sort((a, b) => Number(b.revision) - Number(a.revision))
      .map((entry) => join(root, entry.name, "chrome-linux", "chrome"))
      .filter((candidate) => existsSync(candidate))
  } catch {
    // an unreadable or missing folder is the same as an empty one: the error below says where we looked
  }
  if (found.length > 0) return found[0]
  throw new Error(
    `no Chromium found: set CHROMIUM_PATH to a chrome executable, or put one at ` +
      `${join(root, "chromium-<revision>", "chrome-linux", "chrome")} ` +
      `(the folder is $PLAYWRIGHT_BROWSERS_PATH, default /opt/pw-browsers; \`npx playwright install chromium\` makes one)`,
  )
}
export const ESC = String.fromCharCode(27)

/** xterm's usual renderings of the 16 ANSI colours, by SGR foreground code (30-37, then the bright
 *  90-97) — the one copy of this table. */
export const PALETTE = {
  30: "#000000", 31: "#cd0000", 32: "#00cd00", 33: "#cdcd00",
  34: "#0000ee", 35: "#cd00cd", 36: "#00cdcd", 37: "#e5e5e5",
  90: "#7f7f7f", 91: "#ff0000", 92: "#00ff00", 93: "#ffff00",
  94: "#5c5cff", 95: "#ff00ff", 96: "#00ffff", 97: "#ffffff",
}
export const BACKGROUND = "#0c0c0c"
export const FOREGROUND = "#d0d0d0"
/** The light-background terminal's defaults: what reverse video swaps with, and uncoloured text. */
const LIGHT_BACKGROUND = "#f2f0ea"
const LIGHT_FOREGROUND = "#1c1a18"

/** The xterm 256-colour palette as CSS: the sixteen system colours (`PALETTE`, indices 0-7 and 8-15),
 *  then the cube and the greys as the game's own colour table reads them (`xterm256Rgb`). */
export function xterm256(index) {
  if (index < 16) return PALETTE[index < 8 ? 30 + index : 82 + index] ?? FOREGROUND
  const [r, g, b] = xterm256Rgb(index)
  return `rgb(${r},${g},${b})`
}

export function tmux(repoRoot, args) {
  return execFileSync("tmux", args, { encoding: "utf8", cwd: repoRoot })
}

export function killSession(repoRoot, session) {
  try {
    execFileSync("tmux", ["kill-session", "-t", session], { cwd: repoRoot, stdio: "ignore" })
  } catch {
    // No session to kill, which is the normal case.
  }
}

export function pane(repoRoot, session, { colour = false } = {}) {
  const args = ["capture-pane", "-t", session, "-p"]
  // `-N` keeps trailing spaces: without it tmux drops the inverse-video blanks at the end of a line,
  // which is exactly what the map's solid edge along the bottom of the Grid is (found when
  // a live shot reached the Grid's south edge and its solid bar was missing from the picture only).
  if (colour) args.splice(1, 0, "-e", "-N")
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

/** How long to leave between two sends. tmux can hand two quick sends to the app as one read, and
 *  one read holding an Esc and the next key is a single Option+key sequence to `keysFromChunk` — a
 *  real terminal's rule, and a real way for a screenshot script to press a different key than it
 *  meant. A short pause after every send keeps each one its own read. */
export const KEY_PAUSE_SECONDS = 0.05

export function sendKeys(repoRoot, session, literal) {
  tmux(repoRoot, ["send-keys", "-t", session, "-l", literal])
  pause(KEY_PAUSE_SECONDS)
}

/** One key by its tmux name (`Down`, `S-Left`, `NPage`), paced like `sendKeys`. */
export function sendKey(repoRoot, session, name) {
  tmux(repoRoot, ["send-keys", "-t", session, name])
  pause(KEY_PAUSE_SECONDS)
}

/**
 * The pane with colour, once it has stopped changing: two captures ~200 ms apart that agree. Call it
 * after `waitFor` has seen the text the shot is about. That text appearing only proves the app got
 * *at least* that far — a later key may still be on its way, which is how a shot once came out with
 * a popup still open: its "1 active" line was drawn before the key that closes the popup was.
 */
export function settledPane(repoRoot, session, { intervalSeconds = 0.2, timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let previous = pane(repoRoot, session, { colour: true })
  for (;;) {
    pause(intervalSeconds)
    const current = pane(repoRoot, session, { colour: true })
    if (current === previous) return current
    if (Date.now() > deadline) throw new Error("the pane never stopped changing")
    previous = current
  }
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
 * without a read-back because `Playback.apply`'s "step-tick" case (src/terminal/playback.ts) advances
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

/** How much of a faint glyph's own colour is left, as a whole percentage for CSS. */
const FAINT_PERCENT = Math.round(DIM_ALPHA * 100)

/** Turn one captured pane into HTML: a span per styled run, nothing else. `theme` is the terminal's
 *  own background: reverse video swaps a cell's colour with it, so on a light terminal a reversed
 *  cell's text is light, not the dark default (it was drawn dark-on-dark before 2026-09-27). */
export function ansiToHtml(text, cols, rows, theme = "dark") {
  const defaultBackground = theme === "light" ? LIGHT_BACKGROUND : BACKGROUND
  const defaultForeground = theme === "light" ? LIGHT_FOREGROUND : FOREGROUND
  const escapeHtml = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const lines = text.split("\n").slice(0, rows)
  // The style carries over from one line to the next, as it does in a terminal: tmux's
  // `capture-pane -e` sets a colour once and lets it run on, so a style reset at every line start
  // drew the first cell of such a line (usually the frame's left border) in the default colour.
  let style = { fg: null, bg: null, bold: false, dim: false, underline: false, inverse: false }
  const rendered = lines.map((line) => {
    let html = ""
    let plainLength = 0
    let open = false

    const openSpan = () => {
      const foreground = style.fg ?? defaultForeground
      const background = style.bg
      const text = style.inverse ? (background ?? defaultBackground) : foreground
      const behind = style.inverse ? foreground : (background ?? defaultBackground)
      // Faint fades the glyph toward what is behind it, as a terminal does — never the cell's
      // background, which a whole-span opacity also faded, drawing every dim inverse cell too pale.
      // By as much as the browser page's canvas fades it (`DIM_ALPHA`).
      const parts = [`color:${style.dim ? `color-mix(in srgb, ${text} ${FAINT_PERCENT}%, ${behind})` : text}`]
      if (style.inverse) parts.push(`background:${foreground}`)
      else if (background !== null) parts.push(`background:${background}`)
      if (style.bold) parts.push("font-weight:700")
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
  const pre = background === "light" ? LIGHT_BACKGROUND : BACKGROUND
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
    color: ${background === "light" ? LIGHT_FOREGROUND : FOREGROUND};
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

/** The marker a rendered image carries, followed by a hash of the page it was rendered from. */
const SOURCE_MARKER = "terminal-nexus-source"

/** A hash of everything that decides what an image looks like, so an unchanged shot is recognised
 *  without rendering it again. */
export function sourceHash(...parts) {
  const hash = createHash("sha256")
  for (const part of parts) hash.update(String(part)).update("\u0000")
  return hash.digest("hex").slice(0, 32)
}

/** Whether the image at `path` was rendered from exactly this source. */
export function isUnchanged(path, hash) {
  if (!existsSync(path)) return false
  return readFileSync(path).includes(Buffer.from(`${SOURCE_MARKER}\u0000${hash}`, "latin1"))
}

function samePixels(first, second) {
  try {
    const a = pngjs.PNG.sync.read(first)
    const b = pngjs.PNG.sync.read(second)
    return a.width === b.width && a.height === b.height && Buffer.compare(a.data, b.data) === 0
  } catch {
    return false
  }
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** The PNG with a `tEXt` chunk carrying the source hash, inserted just before `IEND`. */
export function stampPng(png, hash) {
  const body = Buffer.concat([Buffer.from("tEXt", "latin1"), Buffer.from(`${SOURCE_MARKER}\u0000${hash}`, "latin1")])
  const chunk = Buffer.alloc(body.length + 8)
  chunk.writeUInt32BE(body.length - 4, 0)
  body.copy(chunk, 4)
  chunk.writeUInt32BE(crc32(body), body.length + 4)
  const iend = png.length - 12
  return Buffer.concat([png.subarray(0, iend), chunk, png.subarray(iend)])
}

/** The GIF with a comment extension carrying the source hash, inserted just before the trailer. */
export function stampGif(gif, hash) {
  const text = Buffer.from(`${SOURCE_MARKER}\u0000${hash}`, "latin1")
  const block = Buffer.concat([Buffer.from([0x21, 0xfe, text.length]), text, Buffer.from([0])])
  return Buffer.concat([gif.subarray(0, gif.length - 1), block, gif.subarray(gif.length - 1)])
}

/** Forces every image to be rendered and written again, unchanged or not. */
export const FORCE_RENDER = process.argv.includes("--force") || process.env.TN_CAPTURE_FORCE === "1"

/**
 * Render a captured-and-converted frame to a PNG at `targetPath`, via headless Chromium.
 * `background` is the page/pane backdrop the capture sits on - "dark" (default) or "light", to
 * match whichever `--theme` the session being captured was actually running. The ANSI capture
 * itself carries the theme's real colours already; this only affects the page around it, which a
 * light-theme capture would otherwise sit on the tool's own dark backdrop and read as broken.
 *
 * **An unchanged shot is not rewritten.** The PNG carries a hash of the page it was rendered from;
 * when the file at `targetPath` already carries the same hash, nothing is rendered and nothing is
 * written, so regenerating every screenshot leaves the ones that did not change byte-for-byte alone
 * instead of adding a fresh copy of each to the repository's history. `--force` (or
 * `TN_CAPTURE_FORCE=1`) renders them all anyway, for when Chromium or the font is what changed.
 * Returns `targetPath`; `renderPngIfChanged` also says whether it wrote.
 */
export function renderPng(options) {
  return renderPngIfChanged(options).path
}

export function renderPngIfChanged({
  html,
  caption,
  cols,
  rows,
  scratchDir,
  targetPath,
  background = "dark",
  scale = 2,
}) {
  const page = pageFor(html, caption, cols, rows, background)
  const hash = sourceHash(page, scale)
  if (!FORCE_RENDER && isUnchanged(targetPath, hash)) return { path: targetPath, written: false }

  mkdirSync(scratchDir, { recursive: true })
  const pagePath = join(scratchDir, `${Math.random().toString(36).slice(2)}.html`)
  writeFileSync(pagePath, page, "utf8")

  // DejaVu Sans Mono advances 0.602em, so the window is sized from the cell grid, not guessed.
  const width = Math.ceil(cols * 16 * 0.602) + 108
  const height = Math.ceil(rows * 16 * 1.25) + 160

  const shotPath = join(scratchDir, `${Math.random().toString(36).slice(2)}.png`)
  execFileSync(
    chromiumPath(),
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      `--force-device-scale-factor=${scale}`,
      `--window-size=${width},${height}`,
      `--screenshot=${shotPath}`,
      `file://${pagePath}`,
    ],
    { stdio: "pipe" },
  )
  const rendered = readFileSync(shotPath)
  // An image from before images carried a hash can still be the same picture: compare pixels, and
  // leave an identical one alone rather than rewrite it only to add the hash.
  if (!FORCE_RENDER && existsSync(targetPath) && samePixels(readFileSync(targetPath), rendered)) {
    return { path: targetPath, written: false }
  }
  writeFileSync(targetPath, stampPng(rendered, hash))
  return { path: targetPath, written: true }
}
