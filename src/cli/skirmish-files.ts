// The files a Skirmish reads and writes in a terminal: a save or a plan file read (`readGameFile`), and Save game's
// writer (`skirmishSaver`), into the saves folder beside the settings. Kept apart from `./skirmish-open.ts`, which the
// browser page reads too and which therefore names no file system.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { homedir, userInfo } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import type { BuildContext, BuildState } from "../build/state.ts"
import type { Profiles } from "../skirmish/save.ts"
import { readSave, saveText } from "../skirmish/save.ts"
import { DEFAULT_PLAYER_NAME } from "../skirmish/setup.ts"
import type { SaveEntry } from "./title-screens.ts"
import { defaultSettingsPath } from "../settings/index.ts"
import { positionOf, saveOfRound } from "./skirmish-play.ts"

/** A file's text; a folder (`.` included) means the `build.json` in it, as the `skirmish` command reads a plan. */
export function readGameFile(path: string): string {
  const file = existsSync(path) && statSync(path).isDirectory() ? join(path, "build.json") : path
  return readFileSync(file, "utf8")
}

/** The folder Save game writes a name without a folder of its own into: `saves/` beside the settings file. */
export function savesFolder(): string {
  return join(dirname(defaultSettingsPath()), "saves")
}

/** Where the example saves the game ships are: `saves/` at the repository's root. */
export const EXAMPLE_SAVES_DIR = new URL("../../saves/", import.meta.url).pathname

/** The name a `Player` slot shows in a terminal: the account's user name (`marioiz`), or `player`. */
export function terminalPlayerName(): string {
  try {
    const name = userInfo().username.trim()
    return /^[A-Za-z0-9._-]{1,24}$/u.test(name) ? name : DEFAULT_PLAYER_NAME
  } catch {
    return DEFAULT_PLAYER_NAME
  }
}

/**
 * **The saves Load game lists**: the player's own in the saves folder (`folder`), newest first, then the examples the
 * game ships in `saves/`, by name. Each is read and checked as the game would load it (`readSave`), so one that cannot
 * be loaded says why on the list rather than when opened. A testing save is listed, and refused when opened.
 */
export function listSaves(profiles: Profiles, folder: string = savesFolder(), examples: string = EXAMPLE_SAVES_DIR): readonly SaveEntry[] {
  const read = (dir: string): readonly Readonly<{ path: string; at: number }>[] => {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json") && name !== "save.schema.json")
      .map((name) => join(dir, name))
      .filter((path) => statSync(path).isFile())
      .map((path) => ({ path, at: statSync(path).mtimeMs }))
  }
  const mine = [...read(folder)].sort((a, b) => b.at - a.at || a.path.localeCompare(b.path))
  const shipped = [...read(examples)].sort((a, b) => a.path.localeCompare(b.path))
  const entry = (path: string, shown: string): SaveEntry => {
    let text: string
    try {
      text = readFileSync(path, "utf8")
    } catch (error) {
      return { path, shown, save: null, problem: error instanceof Error ? error.message : String(error) }
    }
    const { save, problems } = readSave(text, profiles)
    return save === null ? { path, shown, save: null, problem: problems[0] ?? "not a save" } : { path, shown, save }
  }
  const fromHere = (path: string): string => {
    const near = relative(process.cwd(), path)
    return near.startsWith("..") || isAbsolute(near) ? shownPath(path) : near
  }
  return [...mine.map(({ path }) => entry(path, shownPath(path))), ...shipped.filter(({ path }) => !mine.some((own) => own.path === path)).map(({ path }) => entry(path, fromHere(path)))]
}

/** A path as a person reads it: the home folder as `~`. */
export function shownPath(path: string): string {
  const home = homedir()
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

/**
 * Where a name typed into Save game is written: a name with a folder (`tmp/mine`, `~/x`, `/abs/x`) where it says,
 * from the working folder; a bare name under `folder`. `.save.json` is added unless it ends in `.json`.
 */
export function savePath(name: string, folder: string): string {
  const trimmed = name.trim()
  const file = trimmed.endsWith(".json") ? trimmed : `${trimmed}.save.json`
  if (file.startsWith("~/")) return join(homedir(), file.slice(2))
  if (isAbsolute(file)) return file
  return file.includes("/") ? resolve(file) : join(folder, file)
}

/** What Save game answers: whether it wrote, the bottom line's words, and the round as it now stands. */
export type SaveAnswer = Readonly<{ ok: boolean; text: string; context?: BuildContext }>

/**
 * What a session is handed to save (`BuildSessionOptions.onSave`), writing into `folder`, and the sentence Save game
 * says about where. `write` is `writeFileSync`, making the folder, unless a test injects its own. A save written makes
 * the round that file's: Save game offers its name again, and so does every later round of the battle.
 */
export function skirmishSaver(
  folder: string,
  write: (path: string, text: string) => void = (path, text) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text, "utf8")
  },
): Readonly<{ destination: string; onSave: (context: BuildContext, state: BuildState, name: string) => SaveAnswer }> {
  return {
    destination: `A name alone is saved in ${shownPath(folder)}/; give a folder to save elsewhere (tmp/mine).`,
    onSave(context, state, name) {
      const path = savePath(name, folder)
      try {
        write(path, saveText(saveOfRound(context, state)))
      } catch (error) {
        return { ok: false, text: `Not saved: ${error instanceof Error ? error.message : String(error)}` }
      }
      const shown = name.includes("/") || name.startsWith("~") ? (name.endsWith(".json") ? name : `${name}.save.json`) : shownPath(path)
      const position = { ...positionOf(context), file: shown }
      return { ok: true, text: `Saved to ${shown}.`, context: { ...context, mode: position, saveName: shown } }
    },
  }
}
