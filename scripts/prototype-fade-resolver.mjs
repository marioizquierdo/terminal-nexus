// Prototype only — NOT shipped. Q25's transparency half (specs/open-questions.md), the owner's own
// ask: "the color scheme needs to define transparency that would adapt the color to the backend
// color... make sure this architecture is part of the grid tech and the effects." That is a RULE
// amendment (engine.md 9.1 prints CellStyle's exact shape) and a recorded departure from craft rule 7
// in ascii-effects.md Section 3 ("Terminals have no alpha. Decay is not fade-out") — both need Mario
// and a canon bump, not a session's own judgement. This script exists to show what the amendment would
// buy, before asking for it, per the gate instructions: "prototype it far enough to show what it buys
// ... do not ship a new CellStyle field and ask afterwards."
//
//   node scripts/prototype-fade-resolver.mjs
//
// Nothing here touches src/view/frame.ts's real CellStyle, src/view/roles.ts's real sgrFor, or
// src/view/effects/composite.ts's real resolveLighting. The "today" half below drives the REAL
// EFFECT_RECIPES["fx.damage.flash"] and the REAL mergeEffectCells, so it is not a guess at current
// behaviour. The "prototype" half is a small, local, throwaway resolver — a single scalar `fade`
// (0 = the role's own colour, 1 = the theme's background) blended and quantized, exactly Q25's
// recommended shape (roles.ts stays "never a colour"; the cell would still carry a role and a number).
//
// A finding worth its own line, made while building this: EFFECT_RECIPES["fx.damage.flash"] used to
// set both `bold` and `inverse` unconditionally, which composite.ts's own lightWeight (1 base + 1 bold
// + 1 inverse = 3) already meets on a *single* flash — resolveLighting's inverse threshold is >= 3, so
// stacking had no visible effect at all for the one recipe the owner's quote was actually about. Fixed
// in recipes.ts as part of this pass (bold only; two or more flashes now escalate to inverse for real)
// so the "today" row below is honest rather than showing a mechanism that was silently dead.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ansiToHtml, CHROMIUM } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = join(repoRoot, "evidence", "screenshots", "prototype-fade-resolver.png")

const { BACKGROUND_RGB, sgrFor } = await import("../src/view/roles.ts")
const { EFFECT_RECIPES } = await import("../src/view/effects/recipes.ts")
const { mergeEffectCells } = await import("../src/view/effects/composite.ts")

const THEME = "dark"
const ROLE = "fx.flash"
const trueColorSgr = sgrFor(ROLE, "truecolor", THEME)
const [baseR, baseG, baseB] = trueColorSgr.length === 5 ? trueColorSgr.slice(2) : [255, 255, 255]
const bg = BACKGROUND_RGB[THEME]

// --- "Today": the real recipe, the real compositor, nothing invented -------------------------------

function todayAttributesFor(stackCount) {
  const instance = {
    recipe: "fx.damage.flash", band: "highlights", startMs: 0, durationMs: 66,
    origin: { x: 0, y: 0 }, family: "citizen", params: {},
  }
  const ctx = { timeMs: 10, cosmeticSeed: 1, tileWidth: 1, reducedMotion: false, capability: "truecolor" }
  const recipe = EFFECT_RECIPES["fx.damage.flash"]
  const sources = Array.from({ length: stackCount }, () => ({
    band: "highlights",
    cell: recipe(instance, ctx)[0],
  }))
  return mergeEffectCells(sources)[0]?.cell ?? {}
}

const ESC = String.fromCharCode(27)

/** The literal SGR sequence today's real sgrOf (frame.ts) would build for this attribute set. */
function ansiFor(attrs) {
  const parts = [38, 2, baseR, baseG, baseB]
  if (attrs.bold === true) parts.push(1)
  if (attrs.dim === true) parts.push(2)
  if (attrs.inverse === true) parts.push(7)
  return `${ESC}[${parts.join(";")}m`
}

// --- Prototype: one scalar, blended toward the theme background, then quantized --------------------

/** Q25's recommended shape, applied by the resolver: blend rgb toward BACKGROUND_RGB by `fade`. */
function resolveFadedRgb(rgb, fade) {
  const t = Math.max(0, Math.min(1, fade))
  return rgb.map((channel, index) => Math.round(channel + (bg[index] - channel) * t))
}

function ansiForFade(fade) {
  const [r, g, b] = resolveFadedRgb([baseR, baseG, baseB], fade)
  return `${ESC}[38;2;${r};${g};${b}m`
}

const RESET = `${ESC}[0m`
const GLYPH = "t" // a representative occupied cell - damageFlash is an attribute on a real glyph, never its own mark

// --- Row 1: stacking, N simultaneous flashes on one tile --------------------------------------------

const STACK_COUNTS = [1, 2, 3, 4, 6, 10]
const todayStackCells = STACK_COUNTS.map((n) => ansiFor(todayAttributesFor(n)) + GLYPH + RESET)
// A plausible mapping, not a tuned one - the point is that a continuum exists at all, not this curve.
// Capped at 0.6 rather than letting n=1 blend all the way to 0.9-toward-background: the dimmest
// reachable step should still read as "something is there", the same way today's dimmest reachable
// step (bold, not off) does.
const STACK_FADE_CAP = 0.6
const STACK_FADE_MAX_N = STACK_COUNTS[STACK_COUNTS.length - 1]
const prototypeStackCells = STACK_COUNTS.map(
  (n) => ansiForFade(STACK_FADE_CAP * (1 - (n - 1) / (STACK_FADE_MAX_N - 1))) + GLYPH + RESET,
)

// --- Row 2: decay over presentation time, one flash, no stacking ------------------------------------

const DECAY_STEPS = 6
const todayDecayCells = Array.from({ length: DECAY_STEPS }, (_unused, index) => {
  // damageFlash's own f(t) is genuinely constant for its whole window (ascii-effects.md rule 1 - a
  // pure function of time, which a flat pulse satisfies as well as a curve does): it is "on" for
  // FLASH_MS, then the instance is simply inactive. Two states, not six - "off" is plain default
  // text, the same as any tile the effect timeline has stopped returning cells for.
  const on = index < 2
  return on ? ansiFor({ bold: true }) + GLYPH + RESET : GLYPH
})
const prototypeDecayCells = Array.from({ length: DECAY_STEPS }, (_unused, index) => {
  const fade = index / (DECAY_STEPS - 1)
  return ansiForFade(fade) + GLYPH + RESET
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
<title>Terminal Nexus — fade resolver prototype (NOT shipped)</title>
<style>
  html, body { margin: 0; background: #17181c; font-family: "DejaVu Sans Mono", monospace; }
  .page { padding: 24px; width: 900px; }
  h1 { color: #d0d0d0; font-size: 18px; margin: 0 0 4px; }
  .sub { color: #8a8f98; font-size: 12px; margin: 0 0 4px; line-height: 1.5; }
  .warn { color: #e85650; font-size: 12px; margin: 0 0 20px; font-weight: 700; }
  .section { border: 1px solid #2a2c30; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; }
  .section h2 { color: #ecf0f5; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; }
  .row { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .label { color: #94a2ff; font-size: 12px; width: 230px; flex: none; }
  .note { color: #6e747c; font-size: 11px; font-weight: 400; margin-top: 2px; }
  .swatches span { font-size: 22px; padding: 0 3px; }
</style>
<div class="page">
  <h1>Fade resolver — prototype, not shipped</h1>
  <div class="sub">Q25's transparency half. "Today" drives the real fx.damage.flash recipe and the real
  compositor; "prototype" is one scalar (fade, 0-1) blended toward the theme background by a throwaway
  resolver that lives only in this script.</div>
  <div class="warn">CellStyle in src/view/frame.ts is unchanged. This is evidence for a canon amendment, not a preview of shipped code.</div>
  <div class="section">
    <h2>Stacking: N simultaneous damage flashes, one tile, one frame</h2>
    ${rowHtml("Today (bold / inverse)", `${STACK_COUNTS.join(", ")} flashes stacked - only 2 states reachable`, todayStackCells)}
    ${rowHtml("Prototype (continuous fade)", `fade = ${STACK_FADE_CAP} * (1 - (n-1)/${STACK_FADE_MAX_N - 1}) - ${STACK_COUNTS.length} distinct steps`, prototypeStackCells)}
  </div>
  <div class="section">
    <h2>Decay: one flash's own presentation window, over time</h2>
    ${rowHtml("Today (on, then gone)", "no attribute varies within FLASH_MS - a flat pulse, not a decay", todayDecayCells)}
    ${rowHtml("Prototype (fade over time)", `fade rising 0 -> 1 across ${DECAY_STEPS} sampled instants - "then dim slowly"`, prototypeDecayCells)}
  </div>
</div>
`

mkdirSync(dirname(outputPath), { recursive: true })
const scratch = join(repoRoot, ".capture-tmp")
mkdirSync(scratch, { recursive: true })
const pagePath = join(scratch, "prototype-fade.html")
writeFileSync(pagePath, html, "utf8")

execFileSync(
  CHROMIUM,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--window-size=980,780",
    `--screenshot=${outputPath}`,
    `file://${pagePath}`,
  ],
  { stdio: "pipe" },
)

console.log(outputPath)
