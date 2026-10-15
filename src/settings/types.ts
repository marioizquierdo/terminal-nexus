// What a player can change from the Settings screen — the same
// four things `grid` already takes as command-line flags, exposed as a menu instead. No stdin, no
// file access, no menu/view import here: this is the value shape and how each one cycles, nothing
// about how it's shown or saved.

import type { ColorDepth, GlyphPack, Theme } from "../terminal/display.ts"
import { COLOR_DEPTHS, GLYPH_PACKS, THEMES } from "../terminal/display.ts"

export type Settings = Readonly<{
  colors: ColorDepth
  theme: Theme
  glyphPack: GlyphPack
  reducedMotion: boolean
}>

/**
 * What a brand-new player (or a corrupt/missing settings file — see `store.ts`) starts with.
 * Monochrome rather than `grid`'s own `detectColorDepth()` guess: a saved file is an explicit choice
 * once made, but *before* any choice exists, a fixed, honest baseline is simpler to reason about and
 * to test than probing `COLORTERM`/`TERM` from inside a settings default, and monochrome is the floor
 * that draws right on any terminal. `terminal-nexus.ts` still applies that same detection when nothing
 * has been saved yet — see its own comment. A file saved while a sixteen-colour depth existed names a
 * value that no longer is one, so it reads as this default.
 */
export const DEFAULT_SETTINGS: Settings = {
  colors: "monochrome",
  theme: "dark",
  glyphPack: "ascii",
  reducedMotion: false,
}

function cycle<T>(all: readonly T[], current: T): T {
  const index = all.indexOf(current)
  return all[(index + 1) % all.length] as T
}

export function nextColorDepth(current: ColorDepth): ColorDepth {
  return cycle(COLOR_DEPTHS, current)
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

// Where settings are kept is the caller's choice: a file in the home directory for the terminal game
// (`store.ts`), browser storage for the playtest page (`src/web/host.ts`). The shape and the
// forgiving parse are shared here, where nothing touches a disk.

export type SettingsStore = Readonly<{
  /**
   * `null` means nothing has ever been saved — no file, or a file that is not even valid JSON —
   * which is the caller's cue to apply its own first-run guess (the way `grid` picks a colour depth
   * from the terminal itself) rather than a fixed baseline. Never rejects and never throws: a file
   * that exists and is a genuine object but has a field missing, of the wrong type, or left over from
   * an older or newer version of the game still comes back as real `Settings`, with only that one
   * field falling back to `DEFAULT_SETTINGS` (see `parseSettings`) — a saved preference is not
   * discarded wholesale over one bad field.
   */
  load(): Promise<Settings | null>
  /** Creates the containing folder if it does not exist yet, then writes the whole file. */
  save(settings: Settings): Promise<void>
}>

function isOneOf<T extends string>(all: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (all as readonly string[]).includes(value)
}

/**
 * Builds a legal `Settings` from whatever JSON was on disk, one field at a time — a saved file
 * missing a field entirely (an older version of the game), carrying a field this version no longer
 * recognises (a newer one), or holding a field of the wrong type (hand-edited, or truncated) still
 * yields every *other* field it got right, rather than falling back to `DEFAULT_SETTINGS` wholesale.
 */
export function parseSettings(value: unknown): Settings {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  // A file saved before the setting was named for what it does calls it `capability`; the choice is kept.
  const saved = record["colors"] ?? record["capability"]
  const colors: ColorDepth = isOneOf(COLOR_DEPTHS, saved) ? saved : DEFAULT_SETTINGS.colors
  const theme: Theme = isOneOf(THEMES, record["theme"]) ? record["theme"] : DEFAULT_SETTINGS.theme
  const glyphPack: GlyphPack = isOneOf(GLYPH_PACKS, record["glyphPack"])
    ? record["glyphPack"]
    : DEFAULT_SETTINGS.glyphPack
  const reducedMotion =
    typeof record["reducedMotion"] === "boolean" ? record["reducedMotion"] : DEFAULT_SETTINGS.reducedMotion
  return { colors, theme, glyphPack, reducedMotion }
}
