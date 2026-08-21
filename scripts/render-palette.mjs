// Render a reference sheet of the whole style-role palette, both themes side by side, as a PNG.
//
//   node scripts/render-palette.mjs
//
// Why this exists: the palette lives in src/view/roles.ts as data, which is right for the engine
// but wrong for judging it — nobody designs a colour scheme by reading RGB triples. This imports
// the real table (so the sheet can never drift from what the game actually draws) and lays it out
// as swatches, one row per role, dark and light theme side by side, at all three colour tiers.
//
// Expensive to regenerate relative to a text edit, cheap relative to a real screenshot capture (no
// tmux, no scenario, no simulation) — regenerate whenever roles.ts's PALETTE changes.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { CHROMIUM } from "./lib/terminal-capture.mjs"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = join(repoRoot, "evidence", "screenshots", "palette-reference.png")

const { STYLE_ROLES, THEMES, rgbFor, sgrFor } = await import("../src/view/roles.ts")

function rgbCss([r, g, b]) {
  return `rgb(${r},${g},${b})`
}

/** The 256-index and the 16-colour ANSI code, read straight off sgrFor's own output. */
function tierCodes(role, theme) {
  const indexed = sgrFor(role, "color256", theme)
  const ansi = sgrFor(role, "color16", theme)
  return {
    indexed: indexed[2] ?? "-",
    ansi: ansi[0] ?? "-",
  }
}

function themeBlock(theme) {
  const bg = theme === "light" ? "#f2f0ea" : "#0c0c0c"
  const fg = theme === "light" ? "#1c1a18" : "#d0d0d0"
  const border = theme === "light" ? "#c8c4ba" : "#2a2c30"
  const rows = STYLE_ROLES.map((role) => {
    const rgb = rgbFor(role, "truecolor", theme)
    const { indexed, ansi } = tierCodes(role, theme)
    return `<tr>
      <td class="role">${role}</td>
      <td><div class="swatch" style="background:${rgbCss(rgb)}"></div></td>
      <td class="value">ansi ${ansi}</td>
      <td class="value">256:${indexed}</td>
      <td class="value">rgb(${rgb[0]},${rgb[1]},${rgb[2]})</td>
    </tr>`
  }).join("\n")
  return `<div class="theme" style="background:${bg};color:${fg};border-color:${border}">
    <h2>${theme}</h2>
    <table>${rows}</table>
  </div>`
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Terminal Nexus — style role palette</title>
<style>
  html, body { margin: 0; background: #17181c; font-family: "DejaVu Sans Mono", monospace; }
  .page { padding: 24px; }
  h1 { color: #d0d0d0; font-size: 18px; margin: 0 0 4px; }
  .sub { color: #8a8f98; font-size: 12px; margin: 0 0 20px; }
  .row { display: flex; gap: 20px; }
  .theme { border: 1px solid; border-radius: 8px; padding: 16px 20px; }
  .theme h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 10px; }
  table { border-collapse: collapse; }
  td { padding: 3px 8px 3px 0; font-size: 13px; vertical-align: middle; }
  .role { font-weight: 700; white-space: nowrap; }
  .value { opacity: 0.75; white-space: nowrap; }
  .swatch { width: 42px; height: 16px; border-radius: 3px; border: 1px solid rgba(128,128,128,0.4); }
</style>
<div class="page">
  <h1>Terminal Nexus — style role palette (the reference: src/view/roles.ts)</h1>
  <div class="sub">Every StyleRole, both themes, read directly from the live table — truecolor swatch, 16-colour ANSI code, 256-colour index.</div>
  <div class="row">
    ${THEMES.map(themeBlock).join("\n")}
  </div>
</div>
`

mkdirSync(dirname(outputPath), { recursive: true })
const scratch = join(repoRoot, ".capture-tmp")
mkdirSync(scratch, { recursive: true })
const pagePath = join(scratch, "palette.html")
writeFileSync(pagePath, html, "utf8")

execFileSync(
  CHROMIUM,
  [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=2",
    "--window-size=980,720",
    `--screenshot=${outputPath}`,
    `file://${pagePath}`,
  ],
  { stdio: "pipe" },
)

console.log(outputPath)
