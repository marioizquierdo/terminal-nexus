// Would deriving the 16- and 256-colour tiers from each role's truecolor value reproduce the
// hand-authored table in src/view/roles.ts?
//
//   node scripts/measure-palette-derivation.mjs [--theme dark|light]
//
// Q25 (specs/open-questions.md) asks whether `rgb` should become the single source of truth and the
// other two tiers a nearest-match computation. This is the measurement behind that question's answer,
// checked in rather than quoted, so the next session can re-run it instead of trusting a number in a
// document. It reads the real palette through `rgbFor` and `sgrFor`, so it cannot drift from the
// table it is measuring.
//
// The finding, as of 2026-08-24: the 256-colour tier derives cleanly (most roles land on the same or
// a near-identical entry), and the 16-colour tier does not — it sends `chrome.muted` back to the
// bright-black value an owner playtest already had removed, and collapses `player.a` and `player.b`
// onto the *same* grey. That is not a bad formula: the 16-colour palette has no desaturated entries,
// so nearest-match of any muted design colour is genuinely grey. OKLab does not rescue it, which
// `--oklab` will show.

import { STYLE_ROLES, rgbFor, sgrFor } from "../src/view/roles.ts"

/** xterm's usual renderings of the 16 ANSI colours — the same table scripts/lib/terminal-capture.mjs uses. */
const XTERM16 = {
  30: [0, 0, 0], 31: [205, 0, 0], 32: [0, 205, 0], 33: [205, 205, 0],
  34: [0, 0, 238], 35: [205, 0, 205], 36: [0, 205, 205], 37: [229, 229, 229],
  90: [127, 127, 127], 91: [255, 0, 0], 92: [0, 255, 0], 93: [255, 255, 0],
  94: [92, 92, 255], 95: [255, 0, 255], 96: [0, 255, 255], 97: [255, 255, 255],
}

/** The xterm 256 palette above the system colours: a 6x6x6 cube, then 24 greys. */
const CUBE = [0, 95, 135, 175, 215, 255]
function xterm256(index) {
  if (index < 232) {
    const offset = index - 16
    return [CUBE[Math.floor(offset / 36)], CUBE[Math.floor((offset % 36) / 6)], CUBE[offset % 6]]
  }
  const grey = 8 + (index - 232) * 10
  return [grey, grey, grey]
}

const srgbToLinear = (u) => (u / 255 <= 0.04045 ? u / 255 / 12.92 : ((u / 255 + 0.055) / 1.055) ** 2.4)

function oklab([R, G, B]) {
  const r = srgbToLinear(R), g = srgbToLinear(G), b = srgbToLinear(B)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

const useOklab = process.argv.includes("--oklab")
const themeIndex = process.argv.indexOf("--theme")
const theme = themeIndex === -1 ? "dark" : (process.argv[themeIndex + 1] ?? "dark")

function distance(a, b) {
  if (!useOklab) return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  const [x, y, z] = oklab(a), [p, q, r] = oklab(b)
  return (x - p) ** 2 + (y - q) ** 2 + (z - r) ** 2
}

function nearest(rgb, candidates) {
  let best = null
  let bestDistance = Infinity
  for (const [code, value] of candidates) {
    const d = distance(rgb, value)
    if (d < bestDistance) {
      bestDistance = d
      best = code
    }
  }
  return best
}

const ansiCandidates = Object.entries(XTERM16).map(([code, rgb]) => [Number(code), rgb])
const indexedCandidates = Array.from({ length: 240 }, (_unused, i) => [i + 16, xterm256(i + 16)])

/** The hand-authored value each tier currently ships, read back out of sgrFor rather than re-typed. */
function authored(role) {
  const ansi = sgrFor(role, "color16", theme)[0]
  const indexed = sgrFor(role, "color256", theme)[2]
  return { ansi, indexed }
}

let ansiDiffer = 0
let indexedDiffer = 0
let indexedClose = 0
const rows = []
for (const role of STYLE_ROLES) {
  const rgb = rgbFor(role, "truecolor", theme)
  const hand = authored(role)
  const derivedAnsi = nearest(rgb, ansiCandidates)
  const derivedIndexed = nearest(rgb, indexedCandidates)
  const handRgb = xterm256(hand.indexed)
  const derivedRgb = xterm256(derivedIndexed)
  const delta = Math.round(Math.hypot(handRgb[0] - derivedRgb[0], handRgb[1] - derivedRgb[1], handRgb[2] - derivedRgb[2]))
  if (derivedAnsi !== hand.ansi) ansiDiffer += 1
  if (derivedIndexed !== hand.indexed) indexedDiffer += 1
  if (delta <= 12) indexedClose += 1
  rows.push({ role, rgb, hand, derivedAnsi, derivedIndexed, delta })
}

console.log(`theme ${theme}, metric ${useOklab ? "oklab" : "srgb-euclidean"}\n`)
console.log("role                 rgb               ansi hand/derived   256 hand/derived  delta")
for (const r of rows) {
  const ansiCell = `${String(r.hand.ansi).padStart(3)} -> ${String(r.derivedAnsi).padEnd(3)}${r.derivedAnsi === r.hand.ansi ? "  " : " *"}`
  const idxCell = `${String(r.hand.indexed).padStart(3)} -> ${String(r.derivedIndexed).padEnd(3)}${r.derivedIndexed === r.hand.indexed ? "  " : " *"}`
  console.log(r.role.padEnd(20), JSON.stringify(r.rgb).padEnd(17), ansiCell.padEnd(16), idxCell.padEnd(17), r.delta)
}
console.log(`\n16-colour : ${ansiDiffer}/${rows.length} roles would change`)
console.log(`256-colour: ${indexedDiffer}/${rows.length} would change, ${indexedClose}/${rows.length} land within 12 RGB units`)
console.log("\n* marks a role where deriving disagrees with the hand-authored table.")
