// The testing saves (docs/system-design/skirmish-saves.md, docs/system-design/testing-ground.md): the Skirmish saves in
// `skirmish-testing/` that open on a Battle Round written by hand, each a rule, a unit, a kind of ground or a showcase
// the engine is checked against. Found by id, read as any save is (`readSave`, every problem at once), and turned into
// the opening the kernel starts from (`openingOf`, `./start.ts`), so `grid`, a trial, the measurement and every test
// open exactly the Battle Round the file writes.

import { existsSync, readdirSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { BattleOpening } from "./opening/types.ts"
import { readSave } from "./save.ts"
import { openingOf } from "./start.ts"

export class TestingSaveError extends Error {}

export const SAVE_FILE_SUFFIX = ".save.json"

/** The testing saves' folder: `skirmish-testing/` at the repository's root, wherever the command is run from. */
export const TESTING_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../skirmish-testing")

/**
 * Every testing save, as `{ id, path, folder }`, sorted by id: the `.save.json` files anywhere under
 * `skirmish-testing/`, one folder per purpose (rules, units, movement, engage, showcase —
 * docs/system-design/testing-ground.md). A save's id is its file name, unique across the folders, so a save moves
 * between folders without anything that names it changing.
 */
export function testingSaveCatalog(root: string = TESTING_ROOT): readonly Readonly<{ id: string; path: string; folder: string }>[] {
  const found: { id: string; path: string; folder: string }[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith(SAVE_FILE_SUFFIX)) {
        found.push({ id: entry.name.slice(0, -SAVE_FILE_SUFFIX.length), path, folder: relative(root, directory) })
      }
    }
  }
  if (existsSync(root)) walk(root)
  return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * `path` may name the file exactly, omit the `.save.json` suffix, or be a testing save's bare id —
 * `grid skirmish-testing/rules/ravel-cascade.save.json`, `grid skirmish-testing/rules/ravel-cascade` and
 * `grid ravel-cascade` all resolve to the same file. A path whose file is not there falls back to its last part as an
 * id, so a path naming another folder still finds it.
 */
export function resolveTestingSave(path: string): string {
  const direct = resolve(path)
  if (existsSync(direct)) return direct
  const withSuffix = path.endsWith(SAVE_FILE_SUFFIX) ? direct : resolve(`${path}${SAVE_FILE_SUFFIX}`)
  if (existsSync(withSuffix)) return withSuffix
  const id = basename(path).replace(/\.save\.json$/, "")
  const listed = testingSaveCatalog().find((entry) => entry.id === id)
  if (listed !== undefined) return listed.path
  throw new TestingSaveError(`no save file at "${direct}"${withSuffix === direct ? "" : ` or "${withSuffix}"`}, and no testing save with the id "${id}"`)
}

/** The opening a testing save's text writes, or every problem with it, at once. */
export function openingOfText(text: string, where: string): BattleOpening {
  const { save, problems } = readSave(text)
  if (save === null) throw new TestingSaveError(`${where}:\n  ${problems.join("\n  ")}`)
  if (save.start === undefined) throw new TestingSaveError(`${where}: not a testing save: it has no start, so it opens on a Build Phase (skirmish --load)`)
  return openingOf(save)
}

/** The opening of the testing save at `path` (a path, or an id: `resolveTestingSave`). */
export async function loadTestingSave(path: string): Promise<BattleOpening> {
  const resolved = resolveTestingSave(path)
  return openingOfText(await readFile(resolved, "utf8"), resolved)
}
