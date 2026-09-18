// What a player can change from the Settings screen (milestone-03-game-menu.md, Gate 3B) — the same
// four things `grid` already takes as command-line flags, exposed as a menu instead. No stdin, no
// file access, no menu/view import here: this is the value shape and how each one cycles, nothing
// about how it's shown or saved.

import type { CapabilityMode, Theme } from "../view/roles.ts"
import { CAPABILITY_MODES, THEMES } from "../view/roles.ts"
import type { GlyphPack } from "../view/theme.ts"
import { GLYPH_PACKS } from "../view/theme.ts"

export type Settings = Readonly<{
  capability: CapabilityMode
  theme: Theme
  glyphPack: GlyphPack
  reducedMotion: boolean
}>

/**
 * What a brand-new player (or a corrupt/missing settings file — see `store.ts`) starts with.
 * `color16` rather than `grid`'s own `detectCapability()` guess: a saved file is an explicit choice
 * once made, but *before* any choice exists, a fixed, honest baseline is simpler to reason about and
 * to test than probing `COLORTERM`/`TERM` from inside a settings default. `terminalNexus.ts` still
 * applies that same detection when nothing has been saved yet — see its own comment.
 */
export const DEFAULT_SETTINGS: Settings = {
  capability: "color16",
  theme: "dark",
  glyphPack: "ascii",
  reducedMotion: false,
}

function cycle<T>(all: readonly T[], current: T): T {
  const index = all.indexOf(current)
  return all[(index + 1) % all.length] as T
}

export function nextCapability(current: CapabilityMode): CapabilityMode {
  return cycle(CAPABILITY_MODES, current)
}

export function nextTheme(current: Theme): Theme {
  return cycle(THEMES, current)
}

export function nextGlyphPack(current: GlyphPack): GlyphPack {
  return cycle(GLYPH_PACKS, current)
}

export function toggleReducedMotion(current: boolean): boolean {
  return !current
}
