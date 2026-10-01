// The Activity logs window, as the Build Phase sees it (owner, 2026-10-01, feedback F91: "The menu should
// have a new option for 'activity logs' that opens a scrolling window with logs in reverse chronological
// order. This screen will be ugly, but it should have simple filtering mechanism and an export button").
// The log itself lives outside the reducer (`src/log/activity.ts`): the session and the shells record into
// it; nothing here ever writes to one.
//
// **The reducer reads the log for this window only**, through a read-only source in its context
// (`BuildContext.activity`), and for two things: when the window opens it notes the newest sequence
// number (`BuildState.activityUpTo`), so the list holds still while it is read — every key pressed in the
// window is logged too, and would otherwise push the rows down under the player ("don't move things under
// the player"); and it counts the list's rows, so Up and Down stop at its ends. What a filter shows is
// the frozen entries, newest first; an export is the same entries, oldest first, so it reads as a story.
//
// **For an agent preparing a demo**: the events and the filters are data in `src/log/activity.ts` — add
// your event and your filter there (the window opens on the first filter); nothing in this file changes.

import { footprintCentre } from "../grid/coords.ts"
import type { LogEntry, LogFilter } from "../log/logger.ts"
import type { LogLevel } from "../log/levels.ts"
import { ACTIVITY_EVENTS, ACTIVITY_FILTERS, filteredEntries, formatActivityExport } from "../log/activity.ts"
import { formatLogLine } from "../log/text.ts"
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

/** How many lines the window keeps under its list for what the highlighted row is for — an entry's full
 *  line and what its event means — so the popup keeps its height whichever row is highlighted. */
export const ACTIVITY_NOTE_LINES = 4

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

/** Every entry the log kept, up to where the window froze it when it opened. */
export function frozenEntries(context: Pick<BuildContext, "activity">, state: Pick<BuildState, "activityUpTo">): readonly LogEntry[] {
  return (context.activity?.entries() ?? []).filter((entry) => entry.seq <= state.activityUpTo)
}

/** The entries the window lists: the frozen ones the filter shows, newest first. */
export function shownEntries(
  context: Pick<BuildContext, "activity">,
  state: Pick<BuildState, "activityUpTo" | "activityFilter">,
): readonly LogEntry[] {
  return filteredEntries(frozenEntries(context, state), activityFilter(state))
}

/** How many rows the keyboard can be on in the window: the filter, the export, and every entry shown. */
export function activityRowCount(
  context: Pick<BuildContext, "activity">,
  state: Pick<BuildState, "activityUpTo" | "activityFilter">,
): number {
  return ACTIVITY_FIRST_ENTRY_ROW + shownEntries(context, state).length
}

/** When the log started, on its own clock — what every line's time counts from. */
export function activityStartedAt(context: Pick<BuildContext, "activity">): number {
  return context.activity?.startedAt ?? 0
}

/** One entry as the window and the export write it (`src/log/text.ts`): the same line in both. */
export function activityLine(context: Pick<BuildContext, "activity">, entry: LogEntry): string {
  return formatLogLine(entry, activityStartedAt(context))
}

/** Whether an entry is detail rather than story — drawn quieter, so what happened stands out. */
export function isDetail(level: LogLevel): boolean {
  return level === "debug" || level === "trace"
}

/** What an entry's event means, from the schema — the window's detail view says it under the line. */
export function eventDescription(event: string): string {
  return (ACTIVITY_EVENTS as Readonly<Record<string, Readonly<{ description: string }>>>)[event]?.description ?? ""
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
export function activityExportText(context: Pick<BuildContext, "activity" | "buildId">, state: Pick<BuildState, "activityUpTo" | "activityFilter">): string {
  return formatActivityExport({
    entries: frozenEntries(context, state),
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
