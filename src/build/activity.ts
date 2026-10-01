// The Activity logs window, as the Build Phase sees it: a plain scrolling list of what was recorded,
// newest first, with a filter and an export. The log itself lives outside the reducer (`src/log/activity.ts`): the session and the shells record into
// it; nothing here ever writes to one.
//
// **The reducer reads the log for this window only**, through a read-only source in its context
// (`BuildContext.activity`), and for two things: when the window opens it keeps a copy of the entries
// (`BuildState.activityFrozen`), so the list holds still while it is read — every key pressed in the
// window is logged too, and would otherwise push the rows down under the player, or, once the log is full,
// drop its oldest rows from under them (the interface rule: don't move things under the player); and it
// counts the list's rows, so Up and Down stop at its ends. What a filter shows is the frozen entries,
// newest first; an export is the same entries, oldest first, so it reads as a story.
//
// **For an agent preparing a demo**: the events and the filters are data in `src/log/activity.ts` — add
// your event and your filter there (the window opens on the first filter); nothing in this file changes.

import { footprintCentre } from "../grid/coords.ts"
import type { LogEntry, LogFilter } from "../log/logger.ts"
import type { LogLevel } from "../log/levels.ts"
import { ACTIVITY_EVENTS, ACTIVITY_FILTERS, filteredEntries, formatActivityExport } from "../log/activity.ts"
import { formatLogLine, formatProps } from "../log/text.ts"
import type { Coord } from "../grid/types.ts"
import type { BuildContext, BuildState } from "./state.ts"
import type { PopupMessage } from "./types.ts"

/**
 * What the window reads of a log — a `Logger` is one (`src/log/logger.ts`). Read-only on purpose: the
 * reducer may look, never record.
 */
export type ActivitySource = Readonly<{
  entries(): readonly LogEntry[]
  readonly startedAt: number
  readonly dropped: number
  readonly lastSeq: number
}>

/** The window's rows the keyboard can be on, in order: the filter, the export, then each entry. */
export const ACTIVITY_FILTER_ROW = 0
export const ACTIVITY_EXPORT_ROW = 1
export const ACTIVITY_FIRST_ENTRY_ROW = 2

/** How many lines the window keeps under its list for what the highlighted row is for — what an entry's
 *  event means and every detail of it — so the popup keeps its height whichever row is highlighted. */
export const ACTIVITY_NOTE_LINES = 5

/** What the list says when the filter shows nothing. */
export const ACTIVITY_EMPTY = "Nothing recorded for this filter yet."

/** The filter the window shows now: `BuildState.activityFilter` into `ACTIVITY_FILTERS`. */
export function activityFilter(state: Pick<BuildState, "activityFilter">): LogFilter {
  return ACTIVITY_FILTERS[state.activityFilter] ?? (ACTIVITY_FILTERS[0] as LogFilter)
}

/** One Left (`-1`) or Right (`+1`) on the filter: a choice, so it comes round at both ends. */
export function stepActivityFilter(index: number, step: -1 | 1): number {
  const count = ACTIVITY_FILTERS.length
  return (((index + step) % count) + count) % count
}

/** The entries the window copied from the log when it opened. */
export function frozenEntries(state: Pick<BuildState, "activityFrozen">): readonly LogEntry[] {
  return state.activityFrozen
}

/** The entries the window lists: the frozen ones the filter shows, newest first. */
export function shownEntries(state: Pick<BuildState, "activityFrozen" | "activityFilter">): readonly LogEntry[] {
  const frozen = frozenEntries(state)
  let byFilter = SHOWN.get(frozen)
  if (byFilter === undefined) {
    byFilter = new Map()
    SHOWN.set(frozen, byFilter)
  }
  const filter = activityFilter(state)
  let shown = byFilter.get(filter)
  if (shown === undefined) {
    shown = filteredEntries(frozen, filter)
    byFilter.set(filter, shown)
  }
  return shown
}

/** What each frozen copy shows through each filter, worked out once: the window is redrawn every frame
 *  while its border breathes, and a full log is thousands of entries. Keyed by the copy itself, so a
 *  window opened again starts fresh and an old copy is forgotten with it. */
const SHOWN = new WeakMap<readonly LogEntry[], Map<LogFilter, readonly LogEntry[]>>()

/** How many rows the keyboard can be on in the window: the filter, the export, and every entry shown. */
export function activityRowCount(state: Pick<BuildState, "activityFrozen" | "activityFilter">): number {
  return ACTIVITY_FIRST_ENTRY_ROW + shownEntries(state).length
}

/** When the log started, on its own clock — what every line's time counts from. */
export function activityStartedAt(context: Pick<BuildContext, "activity">): number {
  return context.activity?.startedAt ?? 0
}

/** One entry as the window and the export write it (`src/log/text.ts`): the same line in both. Each
 *  entry's line is written once and remembered — entries never change. */
export function activityLine(context: Pick<BuildContext, "activity">, entry: LogEntry): string {
  let line = LINES.get(entry)
  if (line === undefined) {
    line = formatLogLine(entry, activityStartedAt(context))
    LINES.set(entry, line)
  }
  return line
}

const LINES = new WeakMap<LogEntry, string>()

/** Whether an entry is detail rather than story — drawn quieter, so what happened stands out. */
export function isDetail(level: LogLevel): boolean {
  return level === "debug" || level === "trace"
}

/** What an entry's event means, from the schema — the window's detail view says it under the line. */
export function eventDescription(event: string): string {
  return (ACTIVITY_EVENTS as Readonly<Record<string, Readonly<{ description: string }>>>)[event]?.description ?? ""
}

/**
 * The detail under the list for a highlighted entry: what its event means, then every property in full —
 * the part a list row cuts short. Its time, level and name are already at the start of its row, which
 * stays in view while highlighted, so the note spends its lines on what the row cannot show.
 */
export function activityDetail(entry: LogEntry): string {
  const props = formatProps(entry.props)
  return props === "" ? eventDescription(entry.event) : `${eventDescription(entry.event)}\n${props}`
}

/** What the export row is for, with how many events it would hold now. */
export function exportNote(count: number): string {
  return `Copies the ${eventsWord(count)} this filter shows, oldest first, to paste into a pull request comment.`
}

function eventsWord(count: number): string {
  return `${count} ${count === 1 ? "event" : "events"}`
}

/** The export's text: the filter's frozen entries, oldest first, under a header naming the build, the
 *  filter and how many the log dropped (`formatActivityExport`). What the session hands the shell. */
export function activityExportText(context: Pick<BuildContext, "activity" | "buildId">, state: Pick<BuildState, "activityFrozen" | "activityFilter">): string {
  return formatActivityExport({
    entries: frozenEntries(state),
    filter: activityFilter(state),
    startedAt: activityStartedAt(context),
    dropped: context.activity?.dropped ?? 0,
    ...(context.buildId === undefined ? {} : { build: context.buildId }),
  })
}

/** The message popup an export answers with: how many events, from which filter, and where they went. */
export function activityExportMessage(count: number, filter: LogFilter, destination?: string): PopupMessage {
  const where = destination ?? "Nothing was copied: this screen has nowhere to send it."
  return { title: "LOGS EXPORTED", text: `${eventsWord(count)} from the ${filter.name} filter. ${where}` }
}

/** The bottom line's answer to an export. */
export function activityExportStatus(count: number): string {
  return `Activity logs exported: ${eventsWord(count)} - paste them into the pull request.`
}

/** The bottom line's answer to a new filter. */
export function activityFilterStatus(filter: LogFilter, count: number): string {
  return `Filter: ${filter.name} - ${eventsWord(count)}.`
}

/** The tile a structure is said to stand on in a log line: its centre, where the cursor points at it
 *  (`footprintCentre`) — the tile a player clicked, and a script's `click:X,Y` names. */
export function loggedTile(anchor: Coord, footprint: readonly Coord[]): Coord {
  const centre = footprintCentre(footprint)
  return { x: anchor.x + centre.x, y: anchor.y + centre.y }
}
