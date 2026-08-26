// Illustration only — the real, shipped fx.blast.detonation recipe (src/view/effects/recipes.ts),
// driven at a radius bigger than anything on the bench today (every real detonation caps at radius 2,
// small enough that the sub-bursts it earns are subtle at real scale — see the real in-game capture
// "blast-sub-explosions" for that). This renders the same, real, unmodified recipe at radius 5 purely
// so the shape of the mechanism is easy to see; it is not a claim that a radius-5 detonation exists.
//
//   node scripts/prototype-sub-explosions-illustration.mjs

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { CHROMIUM } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = join(repoRoot, "evidence", "screenshots", "sub-explosions-illustration.png")

const { EFFECT_RECIPES, easeOut } = await import("../src/view/effects/recipes.ts")
const blast = EFFECT_RECIPES["fx.blast.detonation"]

const RADIUS = 5
const WIDTH = 27
const HEIGHT = 15
const origin = { x: Math.floor(WIDTH / 2), y: Math.floor(HEIGHT / 2) }
const instance = {
  recipe: "fx.blast.detonation", band: "effects", startMs: 0, durationMs: 1000,
  origin, family: "ravel", params: { radius: RADIUS },
}
const ctx = (timeMs) => ({ timeMs, cosmeticSeed: 0x0c05e7, tileWidth: 1, reducedMotion: false, capability: "truecolor" })

// Highlighting only, for legibility in this illustration - not a claim the real cells carry a
// distinguishing tag (they don't; a sub-burst cell and a main-ring cell both carry role "fx.blast",
// which is the whole point of the cheap-path shape). A cell is coloured as "main ring" here if it
// sits at exactly the main ring's own currently-expected Chebyshev distance, computed the same way
// the recipe itself computes `reach` - anything else non-origin is a sub-burst.
function expectedMainReach(radius, progress) {
  return Math.min(radius, Math.max(1, Math.round(easeOut(progress) * radius * 1.35)))
}

function frameHtml(progress) {
  const grid = Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => null))
  for (const cell of blast(instance, ctx(progress * 1000))) {
    if (cell.tile.x < 0 || cell.tile.x >= WIDTH || cell.tile.y < 0 || cell.tile.y >= HEIGHT) continue
    grid[cell.tile.y][cell.tile.x] = cell
  }
  const reach = expectedMainReach(RADIUS, progress)
  let html = ""
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const cell = grid[y][x]
      if (cell === null) {
        html += "."
        continue
      }
      const distance = Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y))
      const isOrigin = distance === 0
      const isMainRing = !isOrigin && distance === reach
      const colour = isOrigin ? "#ffd35c" : isMainRing ? "#f2842c" : "#5ad1ff"
      const glyph = cell.glyph === "" ? "?" : cell.glyph
      html += `<span style="color:${colour}">${glyph}</span>`
    }
    html += "\n"
  }
  return html
}

const SAMPLES = [0.15, 0.35, 0.55, 0.8]
const panels = SAMPLES.map((p) => {
  return `<div class="panel"><div class="cap">progress ${p.toFixed(2)}</div><div class="frame">${frameHtml(p)}</div></div>`
}).join("\n")

const html = `<!doctype html>
<meta charset="utf-8">
<title>Terminal Nexus — sub-explosions illustration (radius 5, NOT real content)</title>
<style>
  html, body { margin: 0; background: #17181c; font-family: "DejaVu Sans Mono", monospace; }
  .page { padding: 24px; width: 1200px; }
  h1 { color: #d0d0d0; font-size: 18px; margin: 0 0 4px; }
  .sub { color: #8a8f98; font-size: 12px; margin: 0 0 4px; line-height: 1.5; }
  .warn { color: #e85650; font-size: 12px; margin: 0 0 20px; font-weight: 700; }
  .row { display: flex; gap: 14px; }
  .panel { border: 1px solid #2a2c30; border-radius: 8px; padding: 10px; }
  .cap { color: #94a2ff; font-size: 11px; margin-bottom: 6px; }
  .frame { white-space: pre; font-size: 15px; line-height: 1.35; }
  .legend { color: #8a8f98; font-size: 11px; margin: 10px 0 18px; }
  .legend span { padding: 1px 6px; border-radius: 3px; margin-right: 14px; font-weight: 700; }
</style>
<div class="page">
  <h1>fx.blast.detonation — sub-explosions, illustrated at radius 5</h1>
  <div class="sub">The real, unmodified recipe (src/view/effects/recipes.ts), at a radius bigger than
  anything on the bench today, purely so the shape of the mechanism reads clearly. "?" marks a
  glyphless attribute cell (none occur here - fx.blast.detonation never emits one). Colour here is an
  illustration aid only - every cell below is really role "fx.blast", the same role either way.</div>
  <div class="warn">Illustration only - no unit in the game detonates at radius 5. The real in-game capture (blast-sub-explosions.png) is radius 2, this recipe's real ceiling today.</div>
  <div class="legend">
    <span style="color:#ffd35c">origin</span>
    <span style="color:#f2842c">main ring, at its own eased reach</span>
    <span style="color:#5ad1ff">sub-explosion cells</span>
  </div>
  <div class="row">${panels}</div>
</div>
`

mkdirSync(dirname(outputPath), { recursive: true })
const scratch = join(repoRoot, ".capture-tmp")
mkdirSync(scratch, { recursive: true })
const pagePath = join(scratch, "sub-explosions.html")
writeFileSync(pagePath, html, "utf8")

execFileSync(
  CHROMIUM,
  [
    "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=2", "--window-size=1240,620",
    `--screenshot=${outputPath}`, `file://${pagePath}`,
  ],
  { stdio: "pipe" },
)

console.log(outputPath)
