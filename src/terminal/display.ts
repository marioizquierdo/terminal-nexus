// The three choices a player makes about how the terminal is drawn on: what colour it can show
// (the colour depth), whether its background is dark or light (the theme), and which glyph pack
// (ASCII or Unicode) the field and frame use. Plain vocabulary and its parsers, shared by the saved
// settings, the Build Phase's settings list and the command line, and below the view: the view reads
// these, they read nothing of the view.

/**
 * How much colour the screen is drawn with. Three depths, and no sixteen-colour one: the sixteen
 * ANSI colours are whatever the player's terminal theme says they are, which the game cannot know and
 * cannot mix, so a tier built on them would be a second hand-authored palette to playtest. Monochrome
 * is the floor (no colour code at all, so the terminal's own colours show); 256 colours and truecolor
 * come from one palette.
 */
export type ColorDepth = "monochrome" | "color256" | "truecolor"

export const COLOR_DEPTHS: readonly ColorDepth[] = ["monochrome", "color256", "truecolor"]

export function parseColorDepth(value: string): ColorDepth {
  const found = COLOR_DEPTHS.find((mode) => mode === value)
  if (found === undefined) {
    throw new Error(`unknown colour depth "${value}"; expected one of ${COLOR_DEPTHS.join(", ")}`)
  }
  return found
}

/**
 * Which look the game paints: its own background and the palette set against it. The game paints the
 * background itself at 256 colours and in millions (`src/view/roles.ts`), so a theme is a choice of look and has
 * nothing to do with the terminal's own colours: dark on a white terminal and light on a black one both
 * work. (It once had to match the terminal, when the terminal's background showed through; an owner
 * playtest found the dark theme's chrome text nearly invisible on a light one.) Monochrome leaves the
 * terminal's colours alone, so a theme means nothing there. `dark` is the default — it is the palette the
 * lore and every screenshot so far were designed against. The door stays open for a real themes/modding
 * system later without anything here needing to change shape, only to grow more entries.
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
