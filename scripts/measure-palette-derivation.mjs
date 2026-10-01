// Would deriving the 16- and 256-colour tiers from each role's truecolor value reproduce the
// hand-authored table in src/view/roles.ts?
//
//   node scripts/measure-palette-derivation.mjs [--theme dark|light]
//
// Q25 (docs/milestones/open-questions.md) asked whether `rgb` should become the single source of truth and the
// other two tiers a nearest-match computation. This is the measurement that answered it, checked in
// rather than quoted, so the next session can re-run it instead of trusting a number in a document.
// It reads the real palette through `rgbFor` and `sgrFor`, so it cannot drift from the table it is
// measuring.
//
// The finding, as of 2026-08-24: the 256-colour tier derives cleanly (most roles land on the same or
// a near-identical entry), and the 16-colour tier does not — it sends `chrome.muted` back to the
// bright-black value an owner playtest already had removed, and collapses `player.a` and `player.b`
// onto the *same* grey. That is not a bad formula: the 16-colour palette has no desaturated entries,
// so nearest-match of any muted design colour is genuinely grey. OKLab does not rescue it, which
// `--oklab` will show.
//
// **Applied the same day, option A** (`roles.ts`): the 256-colour tier is now genuinely derived in
// production — `PALETTE` no longer hand-authors an `indexed` field at all, and `sgrFor`'s `color256`
// case reads a `DERIVED_256` table computed from `rgb` at module load. One consequence for reading
// this script's own output *now*: the "hand" value the `authored()` helper below reads back out of
// `sgrFor(role, "color256", theme)` is the derived value too, since there is no longer a separate
// hand-authored 256 column to compare it against — so the 256 column of this script's output is
// correctly, trivially "0/18 would change" post-application, not a sign the measurement stopped
// mattering. The **16-colour column stays live and worth re-running**: that tier is still hand-
// authored (see `roles.ts`'s own comment for why), and this script is still the reproducible check
// that deriving it would be wrong.

import { STYLE_ROLES, rgbFor, sgrFor, xterm256Rgb as xterm256 } from "../src/view/roles.ts"
import { PALETTE } from "./lib/terminal-capture.mjs"

/** xterm's usual renderings of the 16 ANSI colours, by SGR code, as RGB — read off the evidence
 *  pictures' own table rather than typed again. */
const XTERM16 = Object.fromEntries(
  Object.entries(PALETTE).map(([code, hex]) => [code, [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))]),
)

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
