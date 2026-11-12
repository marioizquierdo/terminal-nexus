// Where a terminal writes a playtest note (`!`, `./notes.ts`): `notes/` beside the settings file, each note a file of its
// own named by when it was made. Kept apart from `./notes.ts`, which the browser page reads too and which therefore
// names no file system.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { defaultSettingsPath } from "../settings/index.ts"
import type { Noter } from "./notes.ts"
import { shownPath } from "./skirmish-files.ts"

/** The folder notes are written into: `notes/` beside the settings file. */
export function notesFolder(): string {
  return join(dirname(defaultSettingsPath()), "notes")
}

/** A note's file name from when it was made: `note-20261112-153012.note.json`. */
export function noteFileName(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0")
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `note-${day}-${time}.note.json`
}

/** A terminal's note writer, into `folder`, named by `now`; a second note in the same second gets a number. */
export function terminalNoter(
  folder: string = notesFolder(),
  now: () => Date = () => new Date(),
  write: (path: string, text: string) => void = (path, text) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text, { encoding: "utf8", flag: "wx" })
  },
): Noter {
  return {
    destination: `Saved in ${shownPath(folder)}/; --note <file> opens it again here.`,
    write(text) {
      const name = noteFileName(now())
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const path = join(folder, attempt === 0 ? name : name.replace(".note.json", `-${attempt + 1}.note.json`))
        try {
          write(path, text)
          return { ok: true, text: `Note saved to ${shownPath(path)}.` }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") continue
          return { ok: false, text: `Note not saved: ${error instanceof Error ? error.message : String(error)}` }
        }
      }
      return { ok: false, text: "Note not saved: too many notes this second." }
    },
  }
}
