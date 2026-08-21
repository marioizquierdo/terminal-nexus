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

type Swatch = Readonly<{
  /** An SGR foreground code from the 16-colour set. */
  ansi: number
  /** An xterm-256 palette index. */
  indexed: number
  /** Exact colour, for truecolor. */
  rgb: readonly [number, number, number]
}>

/**
 * One table, three tiers. The 256 and truecolor entries are not "more of the same colour": they are
 * where the factions' own palettes get to show up — Citizen rust and gunmetal against Ravel neon
 * and acid, from `terminal-nexus-lore.md` Section 8 — while the 16-colour tier keeps the two sides
 * as far apart as eight colours allow.
 */
const PALETTE: Readonly<Record<StyleRole, Swatch>> = {
  "chrome.frame": { ansi: 90, indexed: 240, rgb: [88, 96, 105] },
  "chrome.title": { ansi: 97, indexed: 255, rgb: [236, 240, 245] },
  "chrome.label": { ansi: 90, indexed: 245, rgb: [138, 146, 155] },
  "chrome.value": { ansi: 37, indexed: 252, rgb: [206, 213, 221] },
  "chrome.muted": { ansi: 90, indexed: 240, rgb: [104, 112, 122] },
  "terrain.plain": { ansi: 90, indexed: 238, rgb: [72, 78, 86] },
  "terrain.rock": { ansi: 37, indexed: 244, rgb: [128, 132, 138] },
  "terrain.deposit": { ansi: 33, indexed: 178, rgb: [198, 160, 40] },
  // Citizen rust orange against Ravel bioluminescent cyan-green: the two Energy palettes the lore
  // gives the factions that Milestone 4 will pair.
  "player.a": { ansi: 96, indexed: 173, rgb: [201, 118, 68] },
  "player.b": { ansi: 93, indexed: 84, rgb: [104, 226, 132] },
  "item.salvage": { ansi: 32, indexed: 108, rgb: [124, 158, 118] },
  "notice.gate": { ansi: 91, indexed: 203, rgb: [232, 86, 76] },
  "fx.trail": { ansi: 90, indexed: 242, rgb: [110, 116, 124] },
  "fx.kinetic": { ansi: 37, indexed: 251, rgb: [198, 202, 208] },
  "fx.blast": { ansi: 91, indexed: 208, rgb: [242, 132, 44] },
  "fx.debris": { ansi: 90, indexed: 246, rgb: [148, 142, 132] },
  "fx.critical": { ansi: 93, indexed: 214, rgb: [244, 178, 44] },
  "fx.flash": { ansi: 97, indexed: 231, rgb: [255, 255, 255] },
}

/**
 * SGR parameters for a role at a tier. Monochrome returns nothing at all — not a grey, *nothing* —
 * so that a monochrome frame provably contains no colour code.
 */
export function sgrFor(role: StyleRole | undefined, capability: CapabilityMode): readonly number[] {
  if (role === undefined || capability === "monochrome") return []
  const swatch = PALETTE[role]
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
): readonly number[] {
  const foreground = sgrFor(role, capability)
  if (foreground.length === 0) return []
  if (capability === "color16") return [(foreground[0] ?? 37) + 10]
  return [foreground[0] === 38 ? 48 : 48, ...foreground.slice(1)]
}

/** The same roles as RGB, for a backend that takes colours rather than SGR parameters. */
export function rgbFor(
  role: StyleRole | undefined,
  capability: CapabilityMode,
): readonly [number, number, number] {
  if (capability === "monochrome" || role === undefined) return [214, 218, 224]
  const swatch = PALETTE[role]
  return swatch === undefined ? [214, 218, 224] : swatch.rgb
}
