// The three choices a player makes about how the terminal is drawn on: what colour it can show
// (the capability mode), whether its background is dark or light (the theme), and which glyph pack
// (ASCII or Unicode) the field and frame use. Plain vocabulary and its parsers, shared by the saved
// settings, the Build Phase's settings list and the command line, and below the view: the view reads
// these, they read nothing of the view.

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
 * Which background the palette assumes — an open question in the design, answered minimally
 * (owner playtest: on a light terminal background, the dark theme's chrome text was nearly
 * invisible). Two fixed themes rather than a background probe: querying a terminal's actual
 * background colour (OSC 11) is unreliable across emulators and is real complexity for a first version
 * that was asked to start simple. `dark` is the default — it is the palette the lore and every screenshot so
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

/**
 * Glyph packs — the design allows an optional Unicode pack alongside the ASCII
 * baseline. The pack changes the **field and the frame**, never the actors: units are letters
 * because case carries ownership and the shape families carry faction (`presentation.md`,
 * the lore document), and that system is not improved by prettier symbols.
 *
 * ASCII stays the default and the acceptance target. Everything here is one cell wide.
 */
export type GlyphPack = "ascii" | "unicode"

export const GLYPH_PACKS: readonly GlyphPack[] = ["ascii", "unicode"]

export function parseGlyphPack(value: string): GlyphPack {
  const found = GLYPH_PACKS.find((pack) => pack === value)
  if (found === undefined) {
    throw new Error(`unknown glyph pack "${value}"; expected one of ${GLYPH_PACKS.join(", ")}`)
  }
  return found
}
