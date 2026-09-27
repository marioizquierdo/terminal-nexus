// Reading and writing the settings file — a small local file, separate from any future save or
// campaign-progress format (milestone-03-game-menu.md, Gate 3B). Deliberately not a step towards
// that later save system: it remembers four display choices, nothing about a player's progress.

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { parseSettings } from "./types.ts"
import type { Settings, SettingsStore } from "./types.ts"

/** `~/.terminal-nexus/settings.json` — a dotfolder in the home directory, the same convention many
 *  command-line tools use for their own small local config. Not read by `grid`, which stays
 *  flags-only; this is `terminal-nexus`'s own file. */
export function defaultSettingsPath(): string {
  return join(homedir(), ".terminal-nexus", "settings.json")
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
