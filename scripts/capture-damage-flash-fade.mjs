// Evidence for Q25's transparency amendment (engine.md 9.1, canon 2.8), shipped — this supersedes
// scripts/prototype-fade-resolver.mjs, which drove a throwaway local resolver to show what the
// amendment would buy before asking for it. Every cell below comes from the real, checked-in
// pipeline: EFFECT_RECIPES["fx.damage.flash"] (src/view/effects/recipes.ts), the real
// mergeEffectCells (src/view/effects/composite.ts), and the real sgrFor with its fade parameter
// (src/view/roles.ts). Nothing here is a resolver of its own.
//
//   node scripts/capture-damage-flash-fade.mjs
//
// "Before" is not git-stashed history: damageFlash's own reduced-motion branch is byte-identical to
// the recipe's whole behaviour before this amendment existed (recipes.ts's own comment on why), so
// calling the real recipe with reducedMotion:true is a live, real "before" reference rather than a
// guess at one.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ansiToHtml, CHROMIUM } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = join(repoRoot, "evidence", "screenshots", "damage-flash-fade.png")

const { sgrFor } = await import("../src/view/roles.ts")
const { EFFECT_RECIPES } = await import("../src/view/effects/recipes.ts")
const { mergeEffectCells } = await import("../src/view/effects/composite.ts")

const THEME = "dark"
const CAPABILITY = "truecolor"
const recipe = EFFECT_RECIPES["fx.damage.flash"]
const FLASH_MS = 66

function instanceAt(startMs) {
  return {
    recipe: "fx.damage.flash",
    band: "highlights",
    startMs,
    durationMs: FLASH_MS,
    origin: { x: 0, y: 0 },
    family: "citizen",
    params: {},
  }
}

const ESC = String.fromCharCode(27)
const RESET = `${ESC}[0m`
const GLYPH = "t" // a representative occupied cell - damageFlash is an attribute on a real glyph

/** The literal SGR sequence frame.ts's real sgrOf would build for this resolved cell. */
function ansiFor(cell) {
  const parts = [...sgrFor(cell.role, CAPABILITY, THEME, cell.fade ?? 0)]
  if (cell.bold === true) parts.push(1)
  if (cell.dim === true) parts.push(2)
  if (cell.inverse === true) parts.push(7)
  return parts.length === 0 ? GLYPH : `${ESC}[${parts.join(";")}m${GLYPH}${RESET}`
}

// --- Row 1: before - a flat pulse, no attribute varies within the flash's own window --------------

const BEFORE_STEPS = 6
const beforeCells = Array.from({ length: BEFORE_STEPS }, (_unused, index) => {
  const timeMs = (index / (BEFORE_STEPS - 1)) * FLASH_MS
  const ctx = { timeMs, cosmeticSeed: 1, tileWidth: 1, reducedMotion: true, capability: CAPABILITY }
  const cell = recipe(instanceAt(0), ctx)[0]
  return ansiFor(cell)
})

// --- Row 2: after - the same window, fade now carries real decay across it -------------------------

const AFTER_STEPS = 6
const afterCells = Array.from({ length: AFTER_STEPS }, (_unused, index) => {
  const timeMs = (index / (AFTER_STEPS - 1)) * FLASH_MS
  const ctx = { timeMs, cosmeticSeed: 1, tileWidth: 1, reducedMotion: false, capability: CAPABILITY }
  const cell = recipe(instanceAt(0), ctx)[0]
  return ansiFor(cell)
})

// --- Row 3: stacking, through the real compositor - N simultaneous flashes, one instant, one tile ---

const STACK_COUNTS = [1, 2, 3, 4, 6, 10]
const STACK_TIME_MS = 30 // partway through the window, so a solo flash's own fade is neither 0 nor 1
const stackCells = STACK_COUNTS.map((n) => {
  const ctx = {
    timeMs: STACK_TIME_MS,
    cosmeticSeed: 1,
    tileWidth: 1,
    reducedMotion: false,
    capability: CAPABILITY,
  }
  const sources = Array.from({ length: n }, () => ({
    band: "highlights",
    cell: recipe(instanceAt(0), ctx)[0],
  }))
  return ansiFor(mergeEffectCells(sources)[0]?.cell ?? {})
})

// --- Render, through the same ansiToHtml pipeline every real screenshot uses -----------------------

function rowHtml(label, note, cells) {
  const text = cells.join(" ")
  const html = ansiToHtml(text, cells.length * 2, 1)
  return `<div class="row">
    <div class="label">${label}<div class="note">${note}</div></div>
    <div class="swatches">${html}</div>
  </div>`
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Terminal Nexus — fx.damage.flash, real fade, shipped</title>
<style>
  html, body { margin: 0; background: #17181c; font-family: "DejaVu Sans Mono", monospace; }
  .page { padding: 24px; width: 900px; }
  h1 { color: #d0d0d0; font-size: 18px; margin: 0 0 4px; }
  .sub { color: #8a8f98; font-size: 12px; margin: 0 0 20px; line-height: 1.5; }
  .section { border: 1px solid #2a2c30; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; }
  .section h2 { color: #ecf0f5; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; }
  .row { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .label { color: #94a2ff; font-size: 12px; width: 230px; flex: none; }
  .note { color: #6e747c; font-size: 11px; font-weight: 400; margin-top: 2px; }
  .swatches span { font-size: 22px; padding: 0 3px; }
</style>
<div class="page">
  <h1>fx.damage.flash — real fade, shipped</h1>
  <div class="sub">Every cell below comes from the checked-in recipe, compositor and sgrFor - no
  throwaway resolver (supersedes scripts/prototype-fade-resolver.mjs). "Before" is the recipe's own
  reduced-motion branch, kept byte-identical to its whole pre-amendment behaviour.</div>
  <div class="section">
    <h2>Decay: one flash's own presentation window, over time</h2>
    ${rowHtml("Before (reduced motion)", "flat pulse - no attribute varies within FLASH_MS", beforeCells)}
    ${rowHtml("After (real fade)", "fade rising 0 -> 1 across the same 66ms window - \"then dim slowly\"", afterCells)}
  </div>
  <div class="section">
    <h2>Stacking: N simultaneous flashes, one tile, one frame, through the real compositor</h2>
    ${rowHtml("After (real fade)", `${STACK_COUNTS.join(", ")} flashes stacked at the same partway instant - more reads brighter`, stackCells)}
  </div>
</div>
`

mkdirSync(dirname(outputPath), { recursive: true })
const scratch = join(repoRoot, ".capture-tmp")
mkdirSync(scratch, { recursive: true })
const pagePath = join(scratch, "damage-flash-fade.html")
writeFileSync(pagePath, html, "utf8")

execFileSync(
  CHROMIUM,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--window-size=980,620",
    `--screenshot=${outputPath}`,
    `file://${pagePath}`,
  ],
  { stdio: "pipe" },
)

console.log(outputPath)
