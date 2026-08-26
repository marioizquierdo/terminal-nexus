// The style role vocabulary and the render tiers that resolve it — engine.md 9.1 and 9.6.
//
// A role is never a colour. `fgRole: "player.a"` is what a cell carries; which colour that becomes
// is the capability mode's business, and that is what makes monochrome a setting rather than a
// rewrite. Every tier shows the same Pulse with the same information: **monochrome is the floor,
// not the degraded mode** (milestone-1-spike-battle.md 4.2), and the higher tiers buy fidelity, not
// facts. Colour never carries ownership, target, danger, or health alone — sides are told apart by
// letter case, factions by glyph family, terrain by shape, salvage by its own character.

export const STYLE_ROLES = [
  "chrome.frame",
  "chrome.title",
  "chrome.label",
  "chrome.value",
  "chrome.muted",
  "terrain.plain",
  "terrain.rock",
  "terrain.deposit",
  "player.a",
  "player.b",
  "item.salvage",
  "notice.gate",
  // Effect roles. Kinetic and blast are the two weapon languages: Citizens fire rounds, Ravels set
  // things off, and craft rule 2 in ascii-effects.md says those must not share a look.
  "fx.trail",
  "fx.kinetic",
  "fx.blast",
  "fx.debris",
  "fx.critical",
  "fx.flash",
] as const

export type StyleRole = (typeof STYLE_ROLES)[number]

export type CapabilityMode = "monochrome" | "color16" | "color256" | "truecolor"

export const CAPABILITY_MODES: readonly CapabilityMode[] = [
  "monochrome",
  "color16",
  "color256",
  "truecolor",
]

export function parseCapability(value: string): CapabilityMode {
  const found = CAPABILITY_MODES.find((mode) => mode === value)
  if (found === undefined) {
    throw new Error(`unknown capability "${value}"; expected one of ${CAPABILITY_MODES.join(", ")}`)
  }
  return found
}

/**
 * Which background the palette assumes — engine.md 9.1's open question, answered minimally
 * (owner playtest: on a light terminal background, the dark theme's chrome text was nearly
 * invisible). Two fixed themes rather than a background probe: querying a terminal's actual
 * background colour (OSC 11) is unreliable across emulators and is real complexity for a Gate that
 * asked to start simple. `dark` is the default — it is the palette the lore and every screenshot so
 * far were designed against — and `light` is one explicit flag away. The door stays open for a real
 * themes/modding system later without anything here needing to change shape, only to grow more
 * entries.
 */
export type Theme = "dark" | "light"

export const THEMES: readonly Theme[] = ["dark", "light"]

export const DEFAULT_THEME: Theme = "dark"

export function parseTheme(value: string): Theme {
  const found = THEMES.find((theme) => theme === value)
  if (found === undefined) {
    throw new Error(`unknown theme "${value}"; expected one of ${THEMES.join(", ")}`)
  }
  return found
}

/** The frame's own background, for a backend that paints one explicitly (OpenTUI) rather than
 * leaving the terminal's ambient background to show through (direct ANSI). */
export const BACKGROUND_RGB: Readonly<Record<Theme, readonly [number, number, number]>> = {
  dark: [10, 10, 12],
  light: [242, 240, 234],
}

type Swatch = Readonly<{
  /** An SGR foreground code from the 16-colour set — hand-authored; see the PALETTE comment below
   *  for why this tier alone stays a table rather than a computation. */
  ansi: number
  /** Exact colour, for truecolor — the single source of truth every other tier derives from
   *  (`sgrFor`'s `color256` case; `color16` stays independent, see below). */
  rgb: readonly [number, number, number]
}>

/**
 * One table per theme, two tiers hand-authored each — `ansi` and `rgb`. The 256-colour tier is no
 * longer a third hand-authored column: it is *derived* from `rgb` (`nearestIndexed`, below), Q25's
 * option A (`specs/open-questions.md`). `rgb` is where the factions' own palettes get to show up —
 * Citizen rust and gunmetal against Ravel neon and acid, from `terminal-nexus-lore.md` Section 8 —
 * while the 16-colour tier keeps the two sides as far apart as eight colours allow. This `dark` table
 * is the reference: the one the lore and every screenshot so far were designed against, and the one
 * to extend first when a role needs a stronger identity.
 *
 * **Why 256 derives and 16 does not** (measured, not guessed — `node
 * scripts/measure-palette-derivation.mjs`, dated 2026-08-24): nearest-match by squared RGB distance
 * against the real xterm-256 cube reproduces the hand-authored 256 table cleanly — most roles land on
 * the same entry or within a dozen RGB units of it. The same search against the sixteen ANSI colours
 * does not: it sends `chrome.muted` back to ANSI 90, the exact "bright black" value an owner playtest
 * already had removed (see the two-fixes comment below, still true and still why `chrome.muted` sits
 * on 37 rather than 90), and it collapses `player.a` and `player.b` onto the *same* grey — Q21's
 * contrast complaint made maximally worse, at the one tier with the least room to fix it. A
 * perceptual metric (OKLab) does not rescue it, because the cause is structural rather than a bad
 * formula: the sixteen ANSI colours have no desaturated entries, only eight hues, eight brights, and
 * greys, so nearest-match of any deliberately muted design colour lands on grey — grey genuinely
 * *is* the nearest colour. The sixteen hand-authored `ansi` values below are not approximating `rgb`
 * badly; they are answering a different question — *which of eight hues keeps these things apart* —
 * which is exactly the distinguishability job the two fixes below already tuned them for. Deriving 16
 * would reintroduce both fixed bugs and is not done.
 *
 * Two fixes folded in alongside the theme split, both owner playtest findings against this same
 * table:
 *
 *   - `chrome.muted` and `chrome.label` moved off ANSI 90 ("bright black") onto 37 ("white") at the
 *     16-colour tier. Every `chrome.muted` cell in compose.ts is *also* drawn with the `dim` SGR
 *     attribute (border, footer, panel labels — grep it), so the role's own colour was compounding
 *     with a second darkening on top of it; combined with bright-black being one of the least
 *     consistently themed of the sixteen codes across real terminals, that is what read as "can't
 *     barely see the help text" on the owner's own setup. `chrome.muted` is also brighter now at
 *     every tier, chosen to still read clearly after `dim` softens it.
 *   - `player.a` and `player.b`'s ANSI-16 codes did not match the hue the comment (and the 256/true
 *     colour entries either side of them) already committed to: 96 is bright cyan, not the rust
 *     orange Citizens are everywhere else, and 93 is bright yellow, not Ravel green. Corrected to 33
 *     (the closest base-16 approximation of an amber/rust) and 92 (bright green).
 *
 * A third fix, 2026-08-24 (Q21, `specs/open-questions.md`): `player.a`/`player.b`'s **light-theme**
 * `rgb` retuned by lightness only — hue and saturation unchanged, rust stays rust, green stays green.
 * Measured WCAG contrast against each other was 1.08:1 (dark theme's 2.08:1 is a smaller gap, left
 * alone per the recommendation): both sides clear the 3:1 floor against the background individually,
 * but sit at almost identical brightness next to *each other*, a real problem for red-green colour
 * blindness given the palette's hue choice. A light background structurally limits the fix to mostly
 * one direction: lightening a dark foreground role toward a bright background immediately costs that
 * role its own contrast against the background, while darkening one has no such penalty and buys
 * contrast against *both* the background and the other role at once — which is why `player.b` (Ravel
 * green) moved much further than `player.a` here. New pair: 3.55:1 and 11.47:1 against the light
 * background, 3.23:1 against each other. Dark theme's `player.a`/`player.b` are untouched.
 */
const PALETTE: Readonly<Record<Theme, Record<StyleRole, Swatch>>> = {
  dark: {
    "chrome.frame": { ansi: 90, rgb: [88, 96, 105] },
    "chrome.title": { ansi: 97, rgb: [236, 240, 245] },
    "chrome.label": { ansi: 37, rgb: [148, 156, 166] },
    "chrome.value": { ansi: 37, rgb: [206, 213, 221] },
    "chrome.muted": { ansi: 37, rgb: [150, 158, 168] },
    "terrain.plain": { ansi: 90, rgb: [72, 78, 86] },
    "terrain.rock": { ansi: 37, rgb: [128, 132, 138] },
    "terrain.deposit": { ansi: 33, rgb: [198, 160, 40] },
    // Citizen rust orange against Ravel bioluminescent cyan-green: the two Energy palettes the lore
    // gives the factions that Milestone 4 will pair.
    "player.a": { ansi: 33, rgb: [201, 118, 68] },
    "player.b": { ansi: 92, rgb: [104, 226, 132] },
    "item.salvage": { ansi: 32, rgb: [124, 158, 118] },
    "notice.gate": { ansi: 91, rgb: [232, 86, 76] },
    "fx.trail": { ansi: 90, rgb: [110, 116, 124] },
    "fx.kinetic": { ansi: 37, rgb: [198, 202, 208] },
    "fx.blast": { ansi: 91, rgb: [242, 132, 44] },
    "fx.debris": { ansi: 90, rgb: [148, 142, 132] },
    "fx.critical": { ansi: 93, rgb: [244, 178, 44] },
    "fx.flash": { ansi: 97, rgb: [255, 255, 255] },
  },
  // A second, independent table rather than a formula on the dark one (invert-and-clamp reliably
  // ruins exactly the saturated faction colours that matter most) - every entry chosen by hand
  // against BACKGROUND_RGB.light, keeping each role's hue identity but moving its lightness to the
  // other end. Same structure as `dark`, so a future third theme is a table, not a redesign.
  light: {
    "chrome.frame": { ansi: 90, rgb: [150, 146, 140] },
    "chrome.title": { ansi: 30, rgb: [28, 26, 24] },
    "chrome.label": { ansi: 30, rgb: [90, 86, 80] },
    "chrome.value": { ansi: 30, rgb: [48, 44, 40] },
    "chrome.muted": { ansi: 30, rgb: [110, 104, 96] },
    "terrain.plain": { ansi: 90, rgb: [196, 192, 184] },
    "terrain.rock": { ansi: 30, rgb: [70, 66, 60] },
    "terrain.deposit": { ansi: 33, rgb: [168, 124, 24] },
    // Q21, 2026-08-24: lightness-only retune (hue and saturation unchanged) so the two sides clear a
    // real mutual-contrast floor rather than only each individually clearing it against the
    // background - see the PALETTE doc comment above for the measurement and why the two roles moved
    // by such different amounts.
    "player.a": { ansi: 31, rgb: [201, 96, 41] },
    "player.b": { ansi: 32, rgb: [15, 56, 32] },
    "item.salvage": { ansi: 32, rgb: [80, 120, 72] },
    "notice.gate": { ansi: 31, rgb: [176, 32, 24] },
    "fx.trail": { ansi: 90, rgb: [150, 144, 136] },
    "fx.kinetic": { ansi: 30, rgb: [64, 60, 56] },
    "fx.blast": { ansi: 31, rgb: [184, 84, 16] },
    "fx.debris": { ansi: 90, rgb: [120, 110, 96] },
    "fx.critical": { ansi: 33, rgb: [168, 110, 8] },
    "fx.flash": { ansi: 30, rgb: [8, 8, 8] },
  },
}

/**
 * The xterm 256-colour palette above the 16 system colours: a 6x6x6 colour cube (indices 16-231),
 * then a 24-step greyscale ramp (232-255). The same construction `scripts/lib/terminal-capture.mjs`
 * and `scripts/measure-palette-derivation.mjs` already use to turn an index back into RGB — production
 * code duplicates rather than imports it, since `src/` does not depend on `scripts/`.
 */
const XTERM_CUBE_STEPS: readonly number[] = [0, 95, 135, 175, 215, 255]

function xterm256Rgb(index: number): readonly [number, number, number] {
  if (index < 232) {
    const offset = index - 16
    const r = XTERM_CUBE_STEPS[Math.floor(offset / 36)] ?? 0
    const g = XTERM_CUBE_STEPS[Math.floor((offset % 36) / 6)] ?? 0
    const b = XTERM_CUBE_STEPS[offset % 6] ?? 0
    return [r, g, b]
  }
  const grey = 8 + (index - 232) * 10
  return [grey, grey, grey]
}

/**
 * The 256-colour index whose xterm rendering is nearest an RGB value, by squared distance — Q25's
 * "process the colour, then a final pass turns it into the tier," for real. Searches only the cube
 * and greyscale range (16-255): the sixteen system colours are the hand-authored `ansi` tier's own
 * job, not this one's. Cheap enough to call once per role per theme at module load (18 x 2 x 240
 * candidates) rather than needing its own cache beyond `DERIVED_256` below.
 */
function nearestIndexed(rgb: readonly [number, number, number]): number {
  let best = 16
  let bestDistance = Infinity
  for (let index = 16; index <= 255; index += 1) {
    const candidate = xterm256Rgb(index)
    const dr = rgb[0] - candidate[0]
    const dg = rgb[1] - candidate[1]
    const db = rgb[2] - candidate[2]
    const distance = dr * dr + dg * dg + db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/**
 * The 256-colour tier, derived once from each role's own `rgb` rather than hand-authored (Q25,
 * option A). Computed at module load and read as a plain lookup at render time — the same cost a
 * hand-authored field used to be, and the reason this is precomputed rather than called from
 * `sgrFor` directly on every cell of every frame.
 */
const DERIVED_256: Readonly<Record<Theme, Record<StyleRole, number>>> = (() => {
  const result = {} as Record<Theme, Record<StyleRole, number>>
  for (const theme of THEMES) {
    const byRole = {} as Record<StyleRole, number>
    for (const role of STYLE_ROLES) {
      byRole[role] = nearestIndexed(PALETTE[theme][role].rgb)
    }
    result[theme] = byRole
  }
  return result
})()

/**
 * SGR parameters for a role at a tier. Monochrome returns nothing at all — not a grey, *nothing* —
 * so that a monochrome frame provably contains no colour code. `theme` defaults to `DEFAULT_THEME`
 * so every existing caller that has not been taught about themes yet keeps today's look exactly.
 */
export function sgrFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
): readonly number[] {
  if (role === undefined || capability === "monochrome") return []
  const swatch = PALETTE[theme][role]
  if (swatch === undefined) return []
  switch (capability) {
    case "color16":
      return [swatch.ansi]
    case "color256":
      return [38, 5, DERIVED_256[theme][role]]
    case "truecolor":
      return [38, 2, swatch.rgb[0], swatch.rgb[1], swatch.rgb[2]]
    default:
      return []
  }
}

/** Background variants of the same swatch, for the rare cell that needs one. */
export function sgrBackgroundFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
): readonly number[] {
  const foreground = sgrFor(role, capability, theme)
  if (foreground.length === 0) return []
  if (capability === "color16") return [(foreground[0] ?? 37) + 10]
  return [foreground[0] === 38 ? 48 : 48, ...foreground.slice(1)]
}

/** The same roles as RGB, for a backend that takes colours rather than SGR parameters. */
export function rgbFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
): readonly [number, number, number] {
  if (capability === "monochrome" || role === undefined) return [214, 218, 224]
  const swatch = PALETTE[theme][role]
  return swatch === undefined ? [214, 218, 224] : swatch.rgb
}
