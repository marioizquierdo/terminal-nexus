// Notes from a playtest (docs/system-design/skirmish-saves.md, notes; DEVELOPMENT.md, the feedback loop): the `!` key,
// on every screen, saves one typed line with the moment itself — a note is the moment, not a paragraph describing how
// to reach it. On a Build Phase that is the round as its Build Phase opened (a Skirmish's save, or a story mission's
// route at its round), every named command pressed since with its time, the settings and Experiments, the screen as
// text, the line and the last Activity Logs events; on the title menu, the screen's route, its text and the line.
//
// `--note <file>` opens it again at its moment, in the game and in the scripted playtest: the round opened as it
// opened, the commands replayed at their times (`BuildSession.replay`). A note is not the replay format: no content
// locks and no version checks — only the game that wrote it promises to replay it.
//
// Pure: the shell reads the clock, composes the screen and writes the file (`./note-files.ts` in a terminal; the browser
// page copies the text).

import type { BuildContext } from "../build/state.ts"
import { exportText } from "../build/state.ts"
import type { BuildCommand } from "../build/types.ts"
import type { LogEntry } from "../log/index.ts"
import { formatLogLine } from "../log/index.ts"
import type { Profiles, SaveFile } from "../skirmish/save.ts"
import { readSave, saveText } from "../skirmish/save.ts"
import type { NoteMoment, PressedCommand } from "../view/build-session.ts"
import type { Destination, LevelDestination } from "./route.ts"
import { parseRoute } from "./route.ts"
import { isSkirmish, saveOfRound, skirmishLevel } from "./skirmish-play.ts"

/** What a screen is handed to write a note: the sentence the note popup says about where, and the writer (a file in a
 *  terminal, `./note-files.ts`; the clipboard on the browser page). */
export type Noter = Readonly<{ destination: string; write: (text: string) => Readonly<{ ok: boolean; text: string }> }>

/** What a note file says it is. */
export const NOTE_FORMAT = "terminal-nexus.note/1"

/** How many of the last Activity Logs events a note keeps. */
export const NOTE_EVENTS = 40

/** A note file. */
export type NoteFile = Readonly<{
  format: typeof NOTE_FORMAT
  /** The line typed. */
  line: string
  /** When it was written, as the shell's clock said (ISO 8601), and the build that wrote it. */
  written?: string
  build?: string
  /** Where it was: a story mission's round, a Skirmish's route, a title menu screen. */
  at: string
  /** A Skirmish's round as its Build Phase opened, the plan laid then included: what the note opens. */
  save?: SaveFile
  /** The settings and Experiments it was played with, as the game exports them (`--settings`). */
  settings?: string
  /** Every named command pressed since the round opened, with its time in milliseconds after. */
  pressed: readonly PressedCommand[]
  /** How long after the round opened the note was made. */
  noteAt: number
  /** The screen as `!` found it, as text. */
  screen: string
  /** The last Activity Logs events, oldest first, as the Activity logs window exports them. */
  activity: readonly string[]
}>

/** What the shell adds to a moment: the clock, the build, the screen drawn as text, and the log. */
export type NoteExtras = Readonly<{ written?: string; build?: string; screen: string; activity: readonly LogEntry[]; startedAt: number }>

/** The route a Build Phase round is at: a Skirmish's own (its seed or its file), or a story mission's at its round. */
export function roundRoute(context: BuildContext, level: Readonly<{ id: string; route?: string }>): string {
  if (level.route !== undefined) return level.route
  return `story?mission=${level.id}${context.round === undefined || context.round.number === 1 ? "" : `&round=${context.round.number}`}`
}

/** **A Build Phase's note**: the moment, as a note file. */
export function noteOf(moment: NoteMoment, level: Readonly<{ id: string; route?: string }>, extras: NoteExtras): NoteFile {
  const { opened } = moment
  const skirmish = isSkirmish(opened.context)
  return {
    format: NOTE_FORMAT,
    line: moment.line,
    ...(extras.written === undefined ? {} : { written: extras.written }),
    ...(extras.build === undefined ? {} : { build: extras.build }),
    at: roundRoute(opened.context, level),
    ...(skirmish ? { save: saveOfRound(opened.context, opened.state) } : {}),
    settings: exportText(opened.context, opened.state),
    pressed: moment.pressed,
    noteAt: moment.at,
    screen: extras.screen,
    activity: extras.activity.slice(-NOTE_EVENTS).map((entry) => formatLogLine(entry, extras.startedAt)),
  }
}

/** **A title menu screen's note**: where it was, the screen as text and the line; nothing to replay. */
export function titleNoteOf(line: string, at: string, extras: NoteExtras): NoteFile {
  return {
    format: NOTE_FORMAT,
    line,
    ...(extras.written === undefined ? {} : { written: extras.written }),
    ...(extras.build === undefined ? {} : { build: extras.build }),
    at,
    pressed: [],
    noteAt: 0,
    screen: extras.screen,
    activity: extras.activity.slice(-NOTE_EVENTS).map((entry) => formatLogLine(entry, extras.startedAt)),
  }
}

/** A note as text a person reads and pastes: indented, each command and event on its own line, the screen as lines. */
export function noteText(note: NoteFile): string {
  const { save, screen, pressed, activity, ...rest } = note
  const lines = [
    "{",
    ...Object.entries(rest).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
    `  "pressed": [${pressed.length === 0 ? "]," : ""}`,
    ...(pressed.length === 0 ? [] : [...pressed.map((entry, index) => `    ${JSON.stringify(entry)}${index === pressed.length - 1 ? "" : ","}`), "  ],"]),
    `  "screen": [`,
    ...screen.split("\n").map((row, index, all) => `    ${JSON.stringify(row)}${index === all.length - 1 ? "" : ","}`),
    "  ],",
    `  "activity": [${activity.length === 0 ? "]" : ""}`,
    ...(activity.length === 0 ? [] : [...activity.map((line, index) => `    ${JSON.stringify(line)}${index === activity.length - 1 ? "" : ","}`), "  ]"]),
  ]
  if (save === undefined) return `${lines.join("\n")}\n}\n`
  const saved = saveText(save).trimEnd().split("\n").map((row, index) => (index === 0 ? row : `  ${row}`)).join("\n")
  return `${lines.join("\n")},\n  "save": ${saved}\n}\n`
}

/** A note read from text, and every problem with it at once. The screen may be given as lines or as one text. */
export function readNote(text: string, profiles?: Profiles): Readonly<{ note: NoteFile | null; problems: readonly string[] }> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return { note: null, problems: [`not JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return { note: null, problems: ["a note is a JSON object"] }
  const record = value as Record<string, unknown>
  const problems: string[] = []
  if (record["format"] !== NOTE_FORMAT) problems.push(`format: "${NOTE_FORMAT}", not ${JSON.stringify(record["format"])}`)
  if (typeof record["line"] !== "string") problems.push("line: the line typed")
  if (typeof record["at"] !== "string") problems.push("at: the route the note was made at")
  const pressed = record["pressed"]
  if (!Array.isArray(pressed) || !pressed.every((entry) => entry !== null && typeof entry === "object" && typeof (entry as PressedCommand).at === "number" && typeof (entry as PressedCommand).command?.kind === "string")) {
    problems.push("pressed: a list of { at, command }, the commands pressed since the round opened")
  }
  if (typeof record["noteAt"] !== "number") problems.push("noteAt: how long after the round opened the note was made")
  let save: SaveFile | undefined
  if (record["save"] !== undefined) {
    const read = readSave(JSON.stringify(record["save"]), profiles)
    if (read.save === null) problems.push(...read.problems.map((problem) => `save.${problem}`))
    else save = read.save
  }
  if (problems.length > 0) return { note: null, problems }
  const screen = record["screen"]
  const activity = record["activity"]
  return {
    note: {
      ...(record as unknown as NoteFile),
      ...(save === undefined ? {} : { save }),
      screen: Array.isArray(screen) ? screen.join("\n") : typeof screen === "string" ? screen : "",
      activity: Array.isArray(activity) ? activity.map(String) : [],
    },
    problems,
  }
}

/** Where a note opens: a Build Phase (a Skirmish's save, a mission at its round) with what to replay on it, or a title
 *  menu screen. Throws for a route that is no place in the game. */
export type NoteOpening =
  | Readonly<{ kind: "level"; at: LevelDestination; pressed: readonly PressedCommand[]; until: number }>
  | Readonly<{ kind: "title"; at: Extract<Destination, { kind: "title" }> }>

export function noteOpening(note: NoteFile, options: Readonly<{ profiles?: Profiles; newSeed?: () => number }> = {}): NoteOpening {
  if (note.save !== undefined) {
    const file = note.at.startsWith("skirmish?load=") ? decodeURIComponent(note.at.slice("skirmish?load=".length)) : undefined
    const level = skirmishLevel(note.save, { ...(file === undefined ? {} : { file }), route: note.at }, { ...options })
    return { kind: "level", at: { kind: "level", level, round: 1 }, pressed: note.pressed, until: note.noteAt }
  }
  const destination = parseRoute(note.at)
  if (destination.kind === "title") return { kind: "title", at: destination }
  if (destination.kind === "skirmish") throw new Error(`the note at ${note.at} carries no save to open`)
  return { kind: "level", at: destination, pressed: note.pressed, until: note.noteAt }
}

/** The commands a note replays, as named commands: for a person reading it, the kinds in order. */
export const pressedKinds = (note: NoteFile): readonly BuildCommand["kind"][] => note.pressed.map((entry) => entry.command.kind)
