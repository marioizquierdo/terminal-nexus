// Reading and writing the settings file — a small local file, separate from any future save or
// campaign-progress format (milestone-03-game-menu.md, Gate 3B). Deliberately not a step towards
// that later save system: it remembers four display choices, nothing about a player's progress.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { CAPABILITY_MODES } from "../view/roles.ts"
import type { CapabilityMode, Theme } from "../view/roles.ts"
import { THEMES } from "../view/roles.ts"
import { GLYPH_PACKS } from "../view/theme.ts"
import type { GlyphPack } from "../view/theme.ts"
import { DEFAULT_SETTINGS } from "./types.ts"
import type { Settings } from "./types.ts"

/** `~/.terminal-nexus/settings.json` — a dotfolder in the home directory, the same convention many
 *  command-line tools use for their own small local config. Not read by `grid`, which stays
 *  flags-only; this is `terminal-nexus`'s own file. */
export function defaultSettingsPath(): string {
  return join(homedir(), ".terminal-nexus", "settings.json")
}

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
  const capability: CapabilityMode = isOneOf(CAPABILITY_MODES, record["capability"])
    ? record["capability"]
    : DEFAULT_SETTINGS.capability
  const theme: Theme = isOneOf(THEMES, record["theme"]) ? record["theme"] : DEFAULT_SETTINGS.theme
  const glyphPack: GlyphPack = isOneOf(GLYPH_PACKS, record["glyphPack"])
    ? record["glyphPack"]
    : DEFAULT_SETTINGS.glyphPack
  const reducedMotion =
    typeof record["reducedMotion"] === "boolean" ? record["reducedMotion"] : DEFAULT_SETTINGS.reducedMotion
  return { capability, theme, glyphPack, reducedMotion }
}

export function createSettingsStore(filePath: string): SettingsStore {
  return {
    async load(): Promise<Settings | null> {
      let raw: string
      try {
        raw = await readFile(filePath, "utf8")
      } catch {
        return null // no file yet - a genuinely fresh install
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return null // not valid JSON at all - nothing usable was ever really saved
      }
      // `typeof [] === "object"` in JavaScript, so an array needs its own check: it is valid JSON
      // and passes the `object`/non-null test, but it is not a settings object either.
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
      return parseSettings(parsed)
    },
    async save(settings: Settings): Promise<void> {
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, `${JSON.stringify(settings, null, 2)}\n`, "utf8")
    },
  }
}
