// The Build Phase's popups — one shape for all of them: the Nexus powers, the Battle Round
// confirmation, the game menu (Settings, Controls, Activity logs, Restart, Quit), Settings with its
// Experiments, the export, a message, the Controls and hotkeys page, and the Activity logs window.
// Extracted when there were three real uses (AGENTS.md: "extract a framework only after two real uses
// reveal the boundary"); Settings, the fourth, added the one row the first three had no use for: a
// setting whose value Left and Right change. The message is the shape with nothing to choose: a title
// and text.
//
// A popup is **data**: a title and a list of rows, some of them options that name the command a click
// on them sends, and at most one run of rows that scrolls. `popupSpec` derives it from the state;
// `placePopup` puts it on the frame; `popupHitAt` answers what a click at a frame cell means. The
// composer draws from the same placed spec the mouse adapter hit-tests against, so a click can never
// land on a row the frame did not draw there — the same guarantee `layout.ts` gives the side panel.
//
// **Esc is not in a popup**: the top bar's right end says what Esc does — "close [esc]"
// while a popup is open — and is its click target, so a popup's own border carries only its title and,
// beside a list that overflows, its scroll bar.

import { wrapWords } from "../terminal/wrap-words.ts"
import type { Section } from "./all-settings.ts"
import { SECTIONS, SHOWN_SETTINGS, setting, shownSetting } from "./all-settings.ts"
import type { BuildLayout } from "./layout.ts"
import { START_KEY } from "./layout.ts"
import { CONTROLS_TITLE, controlsPage } from "./help.ts"
import { ACTIVITY_DESCRIPTION, CONTROLS_DESCRIPTION, GAME_MENU_ROWS, RESTART_DESCRIPTION, SETTINGS_ROWS, sectionOfRow } from "./settings.ts"
import { ACTIVITY_FILTERS } from "../log/activity.ts"
import { commanderName } from "../content/cards.ts"
import {
  ACTIVITY_EMPTY,
  ACTIVITY_EXPORT_ROW,
  ACTIVITY_FILTER_ROW,
  ACTIVITY_FIRST_ENTRY_ROW,
  ACTIVITY_NOTE_LINES,
  activityDetail,
  activityFilter,
  activityLine,
  exportNote,
  isDetail,
  shownEntries,
} from "./activity.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { exportText, nexusPowers } from "./state.ts"
import type { BuildCommand, DialogLine, PopupMessage } from "./types.ts"

export type PopupRow =
  | Readonly<{ kind: "blank" }>
  | Readonly<{ kind: "heading"; text: string }>
  /** A line of text. `code` marks a line of the settings export: drawn as it is, except that a
   *  `# comment` at its end is left off when the whole line does not fit; `highlighted` is the
   *  export's own highlight, which Up/Down move to scroll it. `select`, when given, is what a click on
   *  the line sends — an Activity logs entry's, which highlights it so its detail shows (on a phone a
   *  tap is the way to read a line the list cuts short). */
  | Readonly<{
      kind: "text"
      text: string
      muted?: boolean
      strong?: boolean
      code?: boolean
      highlighted?: boolean
      select?: BuildCommand
    }>
  /** A choice: its hotkey and label, what clicking it sends, and whether the keyboard is on it. An
   *  option with a description takes a second row for it, and either row is its click target. */
  | Readonly<{
      kind: "option"
      hotkey: string
      label: string
      command: BuildCommand
      highlighted?: boolean
      description?: string
    }>
  /**
   * A setting: its name and its value between `<` and `>` (no "now"/"restart" column —
   * a setting that only applies after a restart says so in a message when Settings closes). Left and
   * Right change the value; a click on the left half of the value is Left, on the right half is Right,
   * and anywhere else on the row highlights it.
   */
  | Readonly<{
      kind: "setting"
      label: string
      value: string
      highlighted: boolean
      decrease: BuildCommand
      increase: BuildCommand
      select: BuildCommand
    }>
  /** Text wrapped at words to the popup's width. With `lines`, in exactly that many lines, so the
   *  popup keeps its height whichever text it holds — a line that does not fit is dropped, never cut;
   *  without, in as many as the text needs (a message), or as the longest of `room` needs — the texts it
   *  keeps room for, so the dialog keeps its height as it reads on through a scene. */
  | Readonly<{ kind: "note"; text: string; lines?: number; room?: readonly string[] }>
  /** A line across the popup, border to border: what is above it is apart from what is below — in
   *  Settings, the list from what its highlighted row is for. */
  | Readonly<{ kind: "rule" }>
  /** A line of the Controls page: the keys, in the hotkey's colour, in a column of their
   *  own (`CONTROLS_KEYS_WIDTH`), and what they do beside them. One line, so it scrolls like a line of
   *  the export, with the same highlight Up/Down move. */
  | Readonly<{ kind: "keys"; keys: string; text: string; highlighted?: boolean }>

/**
 * A popup's one run of one-line rows that scrolls when the popup is taller than the Grid pane can
 * hold (Settings and the export). **A popup has at most one** (the owner: "We can safely allow only
 * one scrolling section on the whole popup"), so the scroll bar has
 * one place to be: the right border beside it. `from` and `to` (exclusive) index `rows`; `highlight`
 * is the row the keyboard is on, which is always kept in view; `select` is the command that highlights
 * the scrolling row at `index` (0 is `rows[from]`) — what a click on the scroll bar sends.
 *
 * `fill` makes the list take all the room the pane has, blank below its last row when it is short, so
 * the popup's height — and every row above the list — stays put however long the list is: the Activity
 * logs window, whose list changes length with its filter, and whose Filter row a mouse player clicks
 * again and again (the interface rule: don't move things under the player).
 */
export type PopupScroll = Readonly<{
  from: number
  to: number
  highlight: number
  select: (index: number) => BuildCommand
  fill?: boolean
}>

/** A popup as data. `valueWidth` widens its setting rows' `< value >` box past the usual twelve columns
 *  (`VALUE_WIDTH`), for values longer than a number and its unit — the Activity logs window's filter
 *  names. `dock` puts it at the bottom of the map rather than in its middle, with no padding row: the
 *  dialog, which sits under what it talks about. `click` is what a left click sends wherever it lands,
 *  on the popup or off it: a popup that is read rather than chosen from (the dialog reads on). */
export type PopupSpec = Readonly<{
  title: string
  rows: readonly PopupRow[]
  scroll?: PopupScroll
  valueWidth?: number
  dock?: "bottom"
  click?: BuildCommand
}>

/** How many lines the Settings popup keeps under its list, below a line across the popup, for what
 *  the highlighted row is for. Every question fits in this many at the narrowest popup (a test holds
 *  them to it); the rows the list's "more" lines and its two fixed rows took went to the list itself
 *  itself. */
export const SETTINGS_NOTE_LINES = 3

export const EXPORT_QUESTION =
  "Shows every setting and experiment as text, and copies it, to paste into a pull request comment."

/**
 * A Settings section's heading: its title, and what its rows are — "saved" for the player's own,
 * "experiments" for rows that are for playtests and never saved — so the owner can tell them apart when
 * a section holds only one kind, and a section holding both says so.
 */
export function sectionHeading(section: Section): string {
  const title = SECTIONS.find((entry) => entry.section === section)?.title ?? section.toUpperCase()
  const tiers = new Set(SHOWN_SETTINGS.filter((spec) => spec.section === section).map((spec) => spec.tier))
  const kind = tiers.size > 1 ? "saved and experiments" : tiers.has("player") ? "saved" : "experiments"
  return `${title} - ${kind}`
}

/**
 * The Settings popup: its position among the rows the keyboard can be on beside the title —
 * "(3/18)" — then each section under its heading, a blank line between sections (the Controls page's
 * shape), each row with the question it serves, and Export settings apart as the list's last row; then a
 * line across the popup, and under it what the highlighted row is for. The list scrolls; its headings
 * and blank lines scroll with it and are never highlighted, so Up and Down step over them.
 */
function settingsSpec(state: BuildState): PopupSpec {
  const rows: PopupRow[] = []
  /** The popup row each Settings row is drawn on, so the window can follow the highlight and a click on
   *  the scroll bar can name the row it brings into view. */
  const lineOf: number[] = []
  const select = (row: number): BuildCommand => ({ kind: "select-row", row })
  SETTINGS_ROWS.forEach((entry, row) => {
    const section = sectionOfRow(row)
    if (row === 0 || section !== sectionOfRow(row - 1)) {
      if (row > 0) rows.push({ kind: "blank" })
      if (section !== null) rows.push({ kind: "heading", text: sectionHeading(section) })
    }
    lineOf.push(rows.length)
    const highlighted = row === state.popupHighlight
    if (entry.kind === "export") {
      rows.push({ kind: "option", hotkey: "e", label: "Export settings", command: { kind: "export-settings" }, highlighted })
      return
    }
    const spec = shownSetting(entry.field)
    rows.push({
      kind: "setting",
      label: spec.label,
      value: spec.format(setting(state, entry.field)),
      decrease: { kind: "setting-adjust", field: entry.field, step: -1 },
      increase: { kind: "setting-adjust", field: entry.field, step: 1 },
      highlighted,
      select: select(row),
    })
  })
  const to = rows.length
  const highlighted = SETTINGS_ROWS[state.popupHighlight]
  const note = highlighted === undefined || highlighted.kind === "export" ? EXPORT_QUESTION : shownSetting(highlighted.field).question
  rows.push({ kind: "rule" }, { kind: "note", text: note, lines: SETTINGS_NOTE_LINES })
  const line = lineOf[state.popupHighlight] ?? to - 1
  // A heading directly above the highlighted row is kept in view with it where the window allows: the
  // first setting of each section opens with its heading showing.
  const highlight = rows[line - 1]?.kind === "heading" ? line - 1 : line
  // A click on the scroll bar highlights the row it brings into view; a heading there selects the row
  // under it.
  const selectLine = (index: number): BuildCommand => {
    const row = lineOf.findIndex((drawn) => drawn >= index)
    return select(row < 0 ? state.popupHighlight : row)
  }
  return {
    title: `SETTINGS (${state.popupHighlight + 1}/${SETTINGS_ROWS.length})`,
    rows,
    scroll: { from: 0, to, highlight, select: selectLine },
  }
}

/** The game menu: Settings, Controls and hotkeys, Activity logs, Restart, Quit. Every row is an option, and the highlight is `GAME_MENU_ROWS`'s
 *  index. No row goes back to the game: Esc, `x`, the top bar's `close [esc]` and a click outside
 *  do, as for every popup. */
function menuSpec(state: BuildState): PopupSpec {
  const on = (row: (typeof GAME_MENU_ROWS)[number]): boolean => GAME_MENU_ROWS[state.popupHighlight] === row
  return {
    title: "MENU",
    rows: [
      { kind: "blank" },
      {
        kind: "option",
        hotkey: "s",
        label: "Settings",
        command: { kind: "open-settings", section: "settings" },
        highlighted: on("settings"),
        description: "Colours, experiments, export",
      },
      {
        kind: "option",
        hotkey: "c",
        label: "Controls and hotkeys",
        command: { kind: "open-controls" },
        highlighted: on("controls"),
        description: CONTROLS_DESCRIPTION,
      },
      {
        kind: "option",
        hotkey: "a",
        label: "Activity logs",
        command: { kind: "open-activity-logs" },
        highlighted: on("activity"),
        description: ACTIVITY_DESCRIPTION,
      },
      {
        kind: "option",
        hotkey: "r",
        label: "Restart",
        command: { kind: "restart" },
        highlighted: on("restart"),
        description: RESTART_DESCRIPTION,
      },
      {
        kind: "option",
        hotkey: "q",
        label: "Quit",
        command: { kind: "quit" },
        highlighted: on("quit"),
        description: "The plan is not saved.",
      },
    ],
  }
}

/** The export: where the text also went, then the text itself — a list of its lines with a highlight
 *  Up/Down move, like every other list here, so it scrolls the same way. No `[esc] Back to Settings`
 *  row: Esc and `x` go back, as the top bar's `close [esc]` says. */
function exportSpec(context: BuildContext, state: BuildState): PopupSpec {
  const rows: PopupRow[] = []
  if (context.exportDestination !== undefined) rows.push({ kind: "note", text: context.exportDestination, lines: 3 })
  const from = rows.length
  exportText(context, state)
    .trimEnd()
    .split("\n")
    .forEach((line, index) => {
      rows.push({ kind: "text", text: line, code: true, ...(index === state.popupHighlight ? { highlighted: true } : {}) })
    })
  const to = rows.length
  return {
    title: "EXPORT SETTINGS",
    rows,
    scroll: { from, to, highlight: from + state.popupHighlight, select: (line) => ({ kind: "select-row", row: line }) },
  }
}

/**
 * The Controls and hotkeys page: the table in `src/build/help.ts`,
 * each section's heading then its lines, a blank line between sections — one scrolling list, the
 * export's kind: a highlight Up/Down (and the wheel) move over the key lines, the headings scrolling
 * with them and never highlighted, the scroll bar in the right border. Nothing to choose, so no option
 * rows: Esc goes back, as the top bar's `close [esc]` says.
 */
function controlsSpec(state: BuildState): PopupSpec {
  const rows: PopupRow[] = []
  /** Where each key line sits in `rows` — what `popupHighlight` indexes. */
  const lineRows: number[] = []
  controlsPage(setting(state, "jumpStep")).forEach((section, index) => {
    if (index > 0) rows.push({ kind: "blank" })
    rows.push({ kind: "heading", text: section.heading })
    for (const line of section.lines) {
      const highlighted = lineRows.length === state.popupHighlight
      lineRows.push(rows.length)
      rows.push({ kind: "keys", keys: line.keys, text: line.text, ...(highlighted ? { highlighted: true } : {}) })
    }
  })
  const line = lineRows[state.popupHighlight] ?? lineRows[0] ?? 0
  // A section's heading is kept in view with its first line, as Settings keeps its headings.
  const highlight = rows[line - 1]?.kind === "heading" ? line - 1 : line
  // A click on the scroll bar highlights the key line at the row it brings into view, or the one above
  // it when that row is a heading or a blank.
  const select = (index: number): BuildCommand => {
    let position = 0
    lineRows.forEach((row, candidate) => {
      if (row <= index) position = candidate
    })
    return { kind: "select-row", row: position }
  }
  return { title: CONTROLS_TITLE, rows, scroll: { from: 0, to: rows.length, highlight, select } }
}

/**
 * The Activity logs window, in the one popup shape: its position beside the title, as Settings has; a Filter row whose
 * value Left and Right step through `ACTIVITY_FILTERS`; `[e] Export logs`; below a line, the one
 * scrolling list — the entries the filter shows, newest first, a line each, cut at the popup's edge,
 * detail quieter and warnings and errors bold; and below another line what the highlighted row is for:
 * the filter's question, what the export would hold, or an entry's whole line and what its event means
 * (from the schema), in a fixed number of lines so the popup keeps its height. The list is the entries
 * frozen when the window opened (`src/build/activity.ts`).
 */
function activitySpec(context: BuildContext, state: BuildState): PopupSpec {
  const filter = activityFilter(state)
  const entries = shownEntries(state)
  const highlight = state.popupHighlight
  const select = (row: number): BuildCommand => ({ kind: "select-row", row })
  const rows: PopupRow[] = [
    {
      kind: "setting",
      label: "Filter",
      value: filter.name,
      highlighted: highlight === ACTIVITY_FILTER_ROW,
      decrease: { kind: "activity-filter", step: -1 },
      increase: { kind: "activity-filter", step: 1 },
      select: select(ACTIVITY_FILTER_ROW),
    },
    {
      kind: "option",
      hotkey: "e",
      label: "Export logs",
      command: { kind: "export-activity" },
      highlighted: highlight === ACTIVITY_EXPORT_ROW,
    },
    { kind: "rule" },
  ]
  const from = rows.length
  if (entries.length === 0) rows.push({ kind: "text", text: ACTIVITY_EMPTY, muted: true })
  entries.forEach((entry, index) => {
    const row = ACTIVITY_FIRST_ENTRY_ROW + index
    rows.push({
      kind: "text",
      text: activityLine(context, entry),
      ...(isDetail(entry.level) ? { muted: true } : {}),
      ...(entry.level === "error" || entry.level === "warn" ? { strong: true } : {}),
      ...(row === highlight ? { highlighted: true } : {}),
      select: select(row),
    })
  })
  const to = rows.length
  const entry = entries[highlight - ACTIVITY_FIRST_ENTRY_ROW]
  const note =
    highlight === ACTIVITY_FILTER_ROW
      ? filter.question
      : highlight === ACTIVITY_EXPORT_ROW
        ? exportNote(entries.length)
        : entry === undefined
          ? ""
          : activityDetail(entry)
  rows.push({ kind: "rule" }, { kind: "note", text: note, lines: ACTIVITY_NOTE_LINES })
  return {
    title: `ACTIVITY LOGS (${highlight + 1}/${ACTIVITY_FIRST_ENTRY_ROW + entries.length})`,
    rows,
    scroll: {
      from,
      to,
      // On the filter or the export the window shows the newest entries; in the list it follows the
      // highlight. A click on the scroll bar highlights the entry it brings into view.
      highlight: from + Math.max(0, highlight - ACTIVITY_FIRST_ENTRY_ROW),
      select: (index) => select(ACTIVITY_FIRST_ENTRY_ROW + index),
      // The list changes length with the filter; the Filter row above it must not move under the mouse.
      fill: true,
    },
    // Room in the value box for the longest filter's name: an agent names a filter for its question.
    valueWidth: Math.max(VALUE_WIDTH, ...ACTIVITY_FILTERS.map((option) => option.name.length + 4)),
  }
}

/**
 * A message popup: a title and its text, wrapped to the popup's width in as many lines as it needs,
 * and nothing to choose. It holds the keyboard like any popup; Esc (or `x`, or a right click) and a
 * click outside it close it, and nothing else does.
 */
export function messageSpec(message: PopupMessage): PopupSpec {
  return { title: message.title, rows: [{ kind: "blank" }, { kind: "note", text: message.text }] }
}

/** The dialog's title for a line: its speaker's name, as a script writes it, or nothing for the game's
 *  own voice. The view colours it in the speaker's side and puts their glyph before it
 *  (`src/view/build-dialog.ts`). */
export function speakerTitle(line: DialogLine): string {
  return line.speaker === null ? "" : line.speaker.toUpperCase()
}

/**
 * **The dialog**: the line on screen, under its speaker's name, wrapped in as many lines as the scene's
 * longest line takes — so the box keeps its height as it reads on — docked at the bottom of the map, where
 * it sits under what it talks about. Nothing to choose: Enter, Space or a click anywhere reads on, and
 * Esc skips the rest, as it closes every popup. `null` with no line to show.
 */
export function dialogSpec(context: BuildContext, state: BuildState): PopupSpec | null {
  const scene = context.scene ?? []
  const line = state.dialog === null ? undefined : scene[state.dialog.line]
  if (line === undefined) return null
  return {
    title: speakerTitle(line),
    rows: [{ kind: "note", text: line.text, room: scene.map((each) => each.text) }],
    dock: "bottom",
    click: { kind: "dialog-next" },
  }
}

/** What the Battle Round confirmation announces when a mission has nothing of its own to say. */
export const DEFAULT_ROUND_TEXT = "Activate Nexus. Collect Resources. Spawn Units."

/** What the confirmation says for round `round`: the mission's own text for it, or the default. */
export function roundAnnouncement(context: BuildContext, round: number): string {
  return context.roundText?.[round] ?? DEFAULT_ROUND_TEXT
}

/** "Vasse is out this round." for each of the player's Commanders sitting this round out. */
function absentCommanders(context: BuildContext): string[] {
  return (context.absent ?? [])
    .filter((absence) => absence.player === "A")
    .map((absence) => `${commanderName(absence.contentId)} is out this round.`)
}

/** An announcement's sentences, each its own line on the screen: short orders read as a list, and the
 *  popup is only 40 glyphs wide at the floor, where a sentence that wrapped would leave one word alone. */
function sentences(text: string): readonly string[] {
  return text.split(/(?<=[.!?])\s+/u).filter((sentence) => sentence !== "")
}

/** The popup the state has open, as data, or `null`. */
export function popupSpec(context: BuildContext, state: BuildState): PopupSpec | null {
  switch (state.popup) {
    case "nexus-powers": {
      const powers = nexusPowers(context, state)
      const rows: PopupRow[] = [{ kind: "blank" }]
      if (powers.pending.length > 0) {
        rows.push({ kind: "heading", text: "PICK ONE - needed before the battle" })
        powers.pending.forEach(({ index, option }, position) => {
          rows.push({
            kind: "option",
            hotkey: option.hotkey,
            label: option.name,
            command: { kind: "pick-nexus", index },
            highlighted: position === state.popupHighlight,
            description: option.description,
          })
        })
      } else {
        rows.push({ kind: "heading", text: "PICK" }, { kind: "text", text: "Nothing waiting.", muted: true })
      }
      rows.push({ kind: "blank" }, { kind: "heading", text: "ACTIVE" })
      if (powers.active.length === 0) rows.push({ kind: "text", text: "None yet.", muted: true })
      for (const option of powers.active) {
        rows.push({ kind: "text", text: option.name, strong: true })
        rows.push({ kind: "text", text: `    ${option.description}`, muted: true })
      }
      return { title: "NEXUS POWERS", rows }
    }
    case "battle-round":
      // A confirmation screen, not a question: the round's title,
      // what it announces (and that the Commander is out, when she is), and the one row, `[s] Start`,
      // highlighted because it is what Enter, Space and `s` do. Esc goes back, as from every popup.
      return {
        title: `Battle Round ${state.pulseNumber}`,
        rows: [
          { kind: "blank" },
          ...sentences(roundAnnouncement(context, state.pulseNumber)).map((text): PopupRow => ({ kind: "note", text })),
          ...absentCommanders(context).map((text): PopupRow => ({ kind: "note", text })),
          { kind: "blank" },
          { kind: "option", hotkey: START_KEY, label: "Start", command: { kind: "start-pulse" }, highlighted: true },
        ],
      }
    case "game-menu":
      return menuSpec(state)
    case "settings":
      return settingsSpec(state)
    case "export":
      return exportSpec(context, state)
    case "message":
      return state.message === null ? null : messageSpec(state.message)
    case "controls":
      return controlsSpec(state)
    case "activity-logs":
      return activitySpec(context, state)
    case "dialog":
      return dialogSpec(context, state)
    default:
      return null
  }
}

/** One row of a placed popup: its frame row, and the spec row it draws. A note's rows each carry
 *  their own wrapped line of it in `text`. */
export type PlacedRow = Readonly<{ row: number; spec: PopupRow; secondLine: boolean; text?: string }>

/**
 * The scroll bar in a popup's right border, beside its scrolling rows, while they overflow:
 * an up symbol on the first of those rows, a down symbol on the last, and between them a track
 * with a thumb showing which part of the list is in view. A click on its upper half scrolls up, on its
 * lower half down. `thumbTop`..`thumbBottom` (inclusive) is empty (`thumbTop > thumbBottom`) when the
 * bar has no room between its two symbols.
 */
export type ScrollBar = Readonly<{ column: number; top: number; bottom: number; thumbTop: number; thumbBottom: number }>

export type PlacedPopup = Readonly<{
  spec: PopupSpec
  /** The border's own rectangle, inclusive. The shadow falls one cell right of it and one below. */
  box: Readonly<{ left: number; top: number; right: number; bottom: number }>
  textColumn: number
  textLimit: number
  rows: readonly PlacedRow[]
  /** The scrolling list's window, or `null` for a popup with no list that scrolls. */
  window: ScrollWindow | null
  /** The scroll bar, or `null` while nothing is scrolled out of view. */
  scrollBar: ScrollBar | null
}>

/** Wider than the first popup was (the owner: "the popup probably larger too"), never wider than
 *  the Grid pane it sits over, less a column for its shadow. */
const POPUP_WIDTH = 52

// Splitting text at words lives with the drawing helpers (`src/view/draw.ts`), where the title menu and
// the Pulse read it without reaching the Build Phase; it is re-exported here for the popups' own callers.
export { wrapWords } from "../terminal/wrap-words.ts"

/** The rows one spec row takes, as the text each of them draws (a note's wrapped lines). */
function linesOf(entry: PopupRow, textLimit: number): readonly (string | undefined)[] {
  if (entry.kind === "option" && entry.description !== undefined) return [undefined, undefined]
  if (entry.kind === "note") {
    // A line break starts a new paragraph on a line of its own: an Activity logs entry's line, then
    // what its event means.
    const wrapped = entry.text.split("\n").flatMap((paragraph) => wrapWords(paragraph, textLimit))
    const room = (entry.room ?? []).map((text) => wrapWords(text, textLimit).length)
    return Array.from({ length: entry.lines ?? Math.max(1, wrapped.length, ...room) }, (_, index) => wrapped[index] ?? "")
  }
  return [undefined]
}

/** Which of a scrolling list's rows are on screen: `offset` rows hidden above, then `visible` rows. */
export type ScrollWindow = Readonly<{ offset: number; visible: number; count: number }>

/**
 * The window a scrolling list shows when only `visible` of its `count` rows fit: the highlighted row
 * kept in the middle while it can be, and the window pinned at either end of the list. Derived from
 * the highlight alone, so it needs no state of its own — the reducer does not know how tall the
 * popup is, and does not need to.
 */
export function scrollWindow(count: number, visible: number, highlight: number): ScrollWindow {
  const shown = Math.max(1, Math.min(count, visible))
  const offset = Math.min(Math.max(0, highlight - Math.floor((shown - 1) / 2)), count - shown)
  return { offset, visible: shown, count }
}

/** The scroll bar beside frame rows `top`..`bottom`, for this window — or `null` when nothing is
 *  hidden. The thumb's length is the share of the list in view, and its place the share above it. */
function scrollBarFor(column: number, top: number, bottom: number, window: ScrollWindow): ScrollBar | null {
  if (window.visible >= window.count) return null
  const track = bottom - top - 1
  if (track <= 0) return { column, top, bottom, thumbTop: top + 1, thumbBottom: top }
  const size = Math.min(track, Math.max(1, Math.round((track * window.visible) / window.count)))
  const start = Math.round(((track - size) * window.offset) / (window.count - window.visible))
  return { column, top, bottom, thumbTop: top + 1 + start, thumbBottom: top + start + size }
}

export function placePopup(layout: BuildLayout, spec: PopupSpec): PlacedPopup {
  const paneWidth = layout.gridBox.right - layout.gridBox.left - 1
  const paneHeight = layout.paneBottom - layout.gridBox.top - 1
  const width = Math.min(POPUP_WIDTH, Math.max(24, paneWidth - 3))
  const textLimit = width - 4
  const allLines = spec.rows.reduce((count, row) => count + linesOf(row, textLimit).length, 0)
  // The border, the rows, a blank row of padding, the border, and a row of shadow must fit the Grid
  // pane; a list that would not is scrolled to fit.
  const room = paneHeight - 4
  const scroll = spec.scroll
  const window =
    scroll === undefined
      ? null
      : scrollWindow(scroll.to - scroll.from, scroll.to - scroll.from - Math.max(0, allLines - room), scroll.highlight - scroll.from)
  const shown = (index: number): boolean => {
    if (scroll === undefined || window === null || index < scroll.from || index >= scroll.to) return true
    const position = index - scroll.from
    return position >= window.offset && position < window.offset + window.visible
  }
  const lines = spec.rows.reduce((count, row, index) => count + (shown(index) ? linesOf(row, textLimit).length : 0), 0)
  // A list that fills the room is followed by blank lines up to it, so the popup keeps its height.
  const fill = scroll?.fill === true ? Math.max(0, room - lines) : 0
  // Border, the rows, a blank row of padding, border — or, docked, the rows straight between the borders.
  const docked = spec.dock === "bottom"
  const height = lines + fill + (docked ? 2 : 3)
  const left = layout.gridBox.left + 1 + Math.floor((paneWidth - width - 1) / 2)
  // Docked at the bottom of the map, its shadow on the map's last row and the bottom line clear below it.
  const top = docked
    ? Math.max(layout.gridBox.top + 1, layout.paneBottom - 1 - height)
    : Math.max(layout.offset.row + 1, layout.gridBox.top + 1 + Math.floor((paneHeight - height - 1) / 2))
  const right = left + width - 1
  const placed: PlacedRow[] = []
  let row = top + 1
  /** The frame rows the scrolling section is drawn on, first and last. */
  const section: number[] = []
  for (const [index, entry] of spec.rows.entries()) {
    if (!shown(index)) continue
    const inSection = scroll !== undefined && index >= scroll.from && index < scroll.to
    for (const [line, text] of linesOf(entry, textLimit).entries()) {
      if (inSection) section.push(row)
      placed.push({ row, spec: entry, secondLine: line > 0, ...(text === undefined ? {} : { text }) })
      row += 1
    }
    if (scroll !== undefined && index === scroll.to - 1) row += fill
  }
  const first = section[0]
  const last = section[section.length - 1]
  return {
    spec,
    box: { left, top, right, bottom: top + height - 1 },
    textColumn: left + 2,
    textLimit,
    rows: placed,
    window,
    scrollBar: window === null || first === undefined || last === undefined ? null : scrollBarFor(right, first, last, window),
  }
}

/** What a click at a frame cell means with this popup open. `outside` is the caller's to act on: a
 *  click outside a popup closes it and moves focus to where it landed. */
export type PopupHit =
  | Readonly<{ kind: "outside" }>
  | Readonly<{ kind: "command"; command: BuildCommand }>
  | Readonly<{ kind: "none" }>

/**
 * What a click on the scroll bar at frame row `row` sends: on its upper half (the up symbol's side),
 * the row just above the window, and on its lower half the row just below it — highlighted, which
 * brings it into view, as the wheel would a line at a time. Nothing when the list already shows its
 * own end that way.
 */
function scrollBarCommand(placed: PlacedPopup, row: number): BuildCommand | null {
  const { scrollBar: bar, window } = placed
  const scroll = placed.spec.scroll
  if (bar === null || window === null || scroll === undefined) return null
  const up = (row - bar.top) * 2 < bar.bottom - bar.top + 1
  if (up) return window.offset === 0 ? null : scroll.select(window.offset - 1)
  const below = window.offset + window.visible
  return below >= window.count ? null : scroll.select(below)
}

export function popupHitAt(placed: PlacedPopup, column: number, row: number): PopupHit {
  const { box, scrollBar: bar } = placed
  if (column < box.left || column > box.right || row < box.top || row > box.bottom) return { kind: "outside" }
  if (bar !== null && column === bar.column && row >= bar.top && row <= bar.bottom) {
    const command = scrollBarCommand(placed, row)
    return command === null ? { kind: "none" } : { kind: "command", command }
  }
  // A popup that is read rather than chosen from answers a click anywhere on it the same way.
  if (placed.spec.click !== undefined) return { kind: "command", command: placed.spec.click }
  if (column < placed.textColumn || column >= placed.textColumn + placed.textLimit) return { kind: "none" }
  const hit = placed.rows.find((candidate) => candidate.row === row)
  if (hit !== undefined && hit.spec.kind === "option") return { kind: "command", command: hit.spec.command }
  if (hit !== undefined && hit.spec.kind === "text" && hit.spec.select !== undefined) return { kind: "command", command: hit.spec.select }
  if (hit !== undefined && hit.spec.kind === "setting") {
    const columns = settingColumns(placed)
    if (column >= columns.valueFrom && column < columns.valueMiddle) return { kind: "command", command: hit.spec.decrease }
    if (column >= columns.valueMiddle && column <= columns.valueTo) return { kind: "command", command: hit.spec.increase }
    return { kind: "command", command: hit.spec.select }
  }
  return { kind: "none" }
}

/** `<`, a space, eight glyphs of value, a space, `>` — room for "140 ms" or "8 tiles". */
const VALUE_WIDTH = 12

/**
 * Where a setting row's parts sit — its name and its `< value >` box, the box against the row's right
 * end — as frame columns, the same for every setting row in a popup. Read by the composer to draw them
 * and by `popupHitAt` to hit-test them. The value box is split down the middle: the left half is the
 * decrease target and the right half the increase one, each six columns wide, so a finger on a phone
 * can hit it (the browser playtest page). A popup may widen the box for longer values
 * (`PopupSpec.valueWidth`), never so far that its rows' names lose their first eight columns.
 */
export function settingColumns(placed: PlacedPopup): Readonly<{
  labelLimit: number
  valueFrom: number
  valueMiddle: number
  valueTo: number
}> {
  const width = Math.max(VALUE_WIDTH, Math.min(placed.spec.valueWidth ?? VALUE_WIDTH, placed.textLimit - 8))
  const valueTo = placed.textColumn + placed.textLimit - 1
  const valueFrom = valueTo - width + 1
  return {
    labelLimit: valueFrom - 1 - placed.textColumn,
    valueFrom,
    valueMiddle: valueFrom + Math.floor(width / 2),
    valueTo,
  }
}
