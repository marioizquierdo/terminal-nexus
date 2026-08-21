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
  /** An SGR foreground code from the 16-colour set. */
  ansi: number
  /** An xterm-256 palette index. */
  indexed: number
  /** Exact colour, for truecolor. */
  rgb: readonly [number, number, number]
}>

/**
 * One table per theme, three tiers each. The 256 and truecolor entries are not "more of the same
 * colour": they are where the factions' own palettes get to show up — Citizen rust and gunmetal
 * against Ravel neon and acid, from `terminal-nexus-lore.md` Section 8 — while the 16-colour tier
 * keeps the two sides as far apart as eight colours allow. This `dark` table is the reference: the
 * one the lore and every screenshot so far were designed against, and the one to extend first when
 * a role needs a stronger identity.
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
 */
const PALETTE: Readonly<Record<Theme, Record<StyleRole, Swatch>>> = {
  dark: {
    "chrome.frame": { ansi: 90, indexed: 240, rgb: [88, 96, 105] },
    "chrome.title": { ansi: 97, indexed: 255, rgb: [236, 240, 245] },
    "chrome.label": { ansi: 37, indexed: 245, rgb: [148, 156, 166] },
    "chrome.value": { ansi: 37, indexed: 252, rgb: [206, 213, 221] },
    "chrome.muted": { ansi: 37, indexed: 243, rgb: [150, 158, 168] },
    "terrain.plain": { ansi: 90, indexed: 238, rgb: [72, 78, 86] },
    "terrain.rock": { ansi: 37, indexed: 244, rgb: [128, 132, 138] },
    "terrain.deposit": { ansi: 33, indexed: 178, rgb: [198, 160, 40] },
    // Citizen rust orange against Ravel bioluminescent cyan-green: the two Energy palettes the lore
    // gives the factions that Milestone 4 will pair.
    "player.a": { ansi: 33, indexed: 173, rgb: [201, 118, 68] },
    "player.b": { ansi: 92, indexed: 84, rgb: [104, 226, 132] },
    "item.salvage": { ansi: 32, indexed: 108, rgb: [124, 158, 118] },
    "notice.gate": { ansi: 91, indexed: 203, rgb: [232, 86, 76] },
    "fx.trail": { ansi: 90, indexed: 242, rgb: [110, 116, 124] },
    "fx.kinetic": { ansi: 37, indexed: 251, rgb: [198, 202, 208] },
    "fx.blast": { ansi: 91, indexed: 208, rgb: [242, 132, 44] },
    "fx.debris": { ansi: 90, indexed: 246, rgb: [148, 142, 132] },
    "fx.critical": { ansi: 93, indexed: 214, rgb: [244, 178, 44] },
    "fx.flash": { ansi: 97, indexed: 231, rgb: [255, 255, 255] },
  },
  // A second, independent table rather than a formula on the dark one (invert-and-clamp reliably
  // ruins exactly the saturated faction colours that matter most) - every entry chosen by hand
  // against BACKGROUND_RGB.light, keeping each role's hue identity but moving its lightness to the
  // other end. Same structure as `dark`, so a future third theme is a table, not a redesign.
  light: {
    "chrome.frame": { ansi: 90, indexed: 246, rgb: [150, 146, 140] },
    "chrome.title": { ansi: 30, indexed: 234, rgb: [28, 26, 24] },
    "chrome.label": { ansi: 30, indexed: 240, rgb: [90, 86, 80] },
    "chrome.value": { ansi: 30, indexed: 236, rgb: [48, 44, 40] },
    "chrome.muted": { ansi: 30, indexed: 242, rgb: [110, 104, 96] },
    "terrain.plain": { ansi: 90, indexed: 250, rgb: [196, 192, 184] },
    "terrain.rock": { ansi: 30, indexed: 238, rgb: [70, 66, 60] },
    "terrain.deposit": { ansi: 33, indexed: 136, rgb: [168, 124, 24] },
    "player.a": { ansi: 31, indexed: 166, rgb: [176, 84, 36] },
    "player.b": { ansi: 32, indexed: 28, rgb: [36, 132, 76] },
    "item.salvage": { ansi: 32, indexed: 65, rgb: [80, 120, 72] },
    "notice.gate": { ansi: 31, indexed: 160, rgb: [176, 32, 24] },
    "fx.trail": { ansi: 90, indexed: 248, rgb: [150, 144, 136] },
    "fx.kinetic": { ansi: 30, indexed: 238, rgb: [64, 60, 56] },
    "fx.blast": { ansi: 31, indexed: 166, rgb: [184, 84, 16] },
    "fx.debris": { ansi: 90, indexed: 242, rgb: [120, 110, 96] },
    "fx.critical": { ansi: 33, indexed: 130, rgb: [168, 110, 8] },
    "fx.flash": { ansi: 30, indexed: 16, rgb: [8, 8, 8] },
  },
}

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
      return [38, 5, swatch.indexed]
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
