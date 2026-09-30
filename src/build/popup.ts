// The Build Phase's popups — one shape for all of them: the Nexus powers, the Battle Round
// confirmation, the game menu (Settings, Controls, Restart, Quit), Settings with its Experiments, the
// export, a message, and the Controls and hotkeys page (feedback F60). Extracted when there were three real uses (AGENTS.md: "extract a framework only after two
// real uses reveal the boundary"); Debug Mode, the fourth — Settings since the owner's 2026-09-28
// direction — added the one row the first three had no use for: a setting whose value Left and Right
// change. The message (feedback F34, 2026-09-29) is the shape with nothing to choose: a title and text.
//
// A popup is **data**: a title and a list of rows, some of them options that name the command a click
// on them sends, and at most one run of rows that scrolls. `popupSpec` derives it from the state;
// `placePopup` puts it on the frame; `popupHitAt` answers what a click at a frame cell means. The
// composer draws from the same placed spec the mouse adapter hit-tests against, so a click can never
// land on a row the frame did not draw there — the same guarantee `layout.ts` gives the side panel.
//
// **Esc is not in a popup** (feedback F37): the top bar's right end says what Esc does — "close [esc]"
// while a popup is open — and is its click target, so a popup's own border carries only its title and,
// beside a list that overflows, its scroll bar.

import { EXPERIMENT_FIELDS, experimentSpec, formatExperimentValue } from "./experiments.ts"
import type { BuildLayout } from "./layout.ts"
import { START_KEY } from "./layout.ts"
import { CONTROLS_TITLE, controlsPage } from "./help.ts"
import {
  CONTROLS_DESCRIPTION,
  GAME_MENU_ROWS,
  PLAYER_FIELDS,
  RESTART_DESCRIPTION,
  SETTINGS_EXPORT_ROW,
  SETTINGS_ORDER,
  formatPlayerValue,
  playerRow,
  playerSpec,
  settingsRowAt,
} from "./settings.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { exportText, nexusPowers } from "./state.ts"
import type { BuildCommand, PopupMessage } from "./types.ts"

export type PopupRow =
  | Readonly<{ kind: "blank" }>
  | Readonly<{ kind: "heading"; text: string }>
  /** A line of text. `code` marks a line of the settings export: drawn as it is, except that a
   *  `# comment` at its end is left off when the whole line does not fit; `highlighted` is the
   *  export's own highlight, which Up/Down move to scroll it. */
  | Readonly<{ kind: "text"; text: string; muted?: boolean; strong?: boolean; code?: boolean; highlighted?: boolean }>
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
   * A setting: its name and its value between `<` and `>` (feedback F34: no "now"/"restart" column —
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
   *  without, in as many as the text needs (a message). */
  | Readonly<{ kind: "note"; text: string; lines?: number }>
  /** A line across the popup, border to border: what is above it is apart from what is below — in
   *  Settings, the list from what its highlighted row is for (feedback F35). */
  | Readonly<{ kind: "rule" }>
  /** A line of the Controls page (feedback F60): the keys, in the hotkey's colour, in a column of their
   *  own (`CONTROLS_KEYS_WIDTH`), and what they do beside them. One line, so it scrolls like a line of
   *  the export, with the same highlight Up/Down move. */
  | Readonly<{ kind: "keys"; keys: string; text: string; highlighted?: boolean }>

/**
 * A popup's one run of one-line rows that scrolls when the popup is taller than the Grid pane can
 * hold (gate 5H — Settings and the export). **A popup has at most one** (owner, 2026-09-29, feedback
 * F36: "We can safely allow only one scrolling section on the whole popup"), so the scroll bar has
 * one place to be: the right border beside it. `from` and `to` (exclusive) index `rows`; `highlight`
 * is the row the keyboard is on, which is always kept in view; `select` is the command that highlights
 * the scrolling row at `index` (0 is `rows[from]`) — what a click on the scroll bar sends.
 */
export type PopupScroll = Readonly<{
  from: number
  to: number
  highlight: number
  select: (index: number) => BuildCommand
}>

export type PopupSpec = Readonly<{ title: string; rows: readonly PopupRow[]; scroll?: PopupScroll }>

/** How many lines the Settings popup keeps under its list, below a line across the popup, for what
 *  the highlighted row is for. Every question fits in this many at the narrowest popup (a test holds
 *  them to it); the rows the list's "more" lines and its two fixed rows took went to the list itself
 *  (feedback F35). */
export const SETTINGS_NOTE_LINES = 3

/** The Settings popup's two section headings, drawn in its list. */
export const SETTINGS_HEADING = "YOUR SETTINGS - saved"
export const EXPERIMENTS_HEADING = "EXPERIMENTS - for playtests, not saved"
export const EXPORT_QUESTION =
  "Shows every setting and experiment as text, and copies it, to paste into a pull request comment."

/**
 * The Settings popup (owner, 2026-09-28; laid out again from his feedback F35, 2026-09-29): its
 * position in the list beside the title — "(3/28)" — then the player's own settings, then, clearly
 * apart, the Experiments, each with the question it serves, and Export settings as the list's last
 * row; then a line across the popup, and under it what the highlighted row is for. The list scrolls;
 * its two headings scroll with it.
 */
function settingsSpec(state: BuildState): PopupSpec {
  const rows: PopupRow[] = []
  const from = rows.length
  /** Where each row id sits in `rows`, so the window can follow the highlight. */
  const lineOf = new Map<number, number>()
  const select = (row: number): BuildCommand => ({ kind: "settings-select", row })
  rows.push({ kind: "heading", text: SETTINGS_HEADING })
  for (const spec of PLAYER_FIELDS) {
    const row = playerRow(spec.field)
    lineOf.set(row, rows.length)
    rows.push({
      kind: "setting",
      label: spec.label,
      value: formatPlayerValue(state.settings, spec.field),
      highlighted: row === state.popupHighlight,
      decrease: { kind: "setting-adjust", field: spec.field, step: -1 },
      increase: { kind: "setting-adjust", field: spec.field, step: 1 },
      select: select(row),
    })
  }
  rows.push({ kind: "heading", text: EXPERIMENTS_HEADING })
  EXPERIMENT_FIELDS.forEach((spec, row) => {
    lineOf.set(row, rows.length)
    rows.push({
      kind: "setting",
      label: spec.label,
      value: formatExperimentValue(state.experiments, spec.field),
      highlighted: row === state.popupHighlight,
      decrease: { kind: "experiment-adjust", field: spec.field, step: -1 },
      increase: { kind: "experiment-adjust", field: spec.field, step: 1 },
      select: select(row),
    })
  })
  lineOf.set(SETTINGS_EXPORT_ROW, rows.length)
  rows.push({
    kind: "option",
    hotkey: "e",
    label: "Export settings",
    command: { kind: "export-settings" },
    highlighted: state.popupHighlight === SETTINGS_EXPORT_ROW,
  })
  const to = rows.length
  const highlighted = settingsRowAt(state.popupHighlight)
  const note =
    highlighted === null || highlighted.kind === "export"
      ? EXPORT_QUESTION
      : highlighted.kind === "player"
        ? playerSpec(highlighted.field).question
        : experimentSpec(highlighted.field).question
  rows.push({ kind: "rule" }, { kind: "note", text: note, lines: SETTINGS_NOTE_LINES })
  const line = lineOf.get(state.popupHighlight) ?? to - 1
  // A heading directly above the highlighted row is kept in view with it where the window allows: the
  // first setting of each section opens with its heading showing.
  const highlight = rows[line - 1]?.kind === "heading" ? line - 1 : line
  // A click on the scroll bar highlights the row it brings into view; a heading there selects the row
  // under it.
  const selectLine = (index: number): BuildCommand => {
    const at = from + index
    const entry = rows[at]?.kind === "heading" ? rows[at + 1] : rows[at]
    if (entry?.kind === "setting") return entry.select
    return entry?.kind === "option" ? select(SETTINGS_EXPORT_ROW) : select(state.popupHighlight)
  }
  const position = Math.max(0, SETTINGS_ORDER.indexOf(state.popupHighlight)) + 1
  return {
    title: `SETTINGS (${position}/${SETTINGS_ORDER.length})`,
    rows,
    scroll: { from, to, highlight, select: selectLine },
  }
}

/** The game menu: Settings, Controls and hotkeys, Restart, Quit (owner, 2026-09-28; Restart since
 *  feedback F34, Controls since F60). Every row is an option, and the highlight is `GAME_MENU_ROWS`'s
 *  index. No row goes back to the game (F73): Esc, `x`, the top bar's `close [esc]` and a click outside
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
 *  row (feedback F73): Esc and `x` go back, as the top bar's `close [esc]` says. */
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
    scroll: { from, to, highlight: from + state.popupHighlight, select: (line) => ({ kind: "export-select", line }) },
  }
}

/**
 * The Controls and hotkeys page (owner, 2026-09-30, feedback F60): the table in `src/build/help.ts`,
 * each section's heading then its lines, a blank line between sections — one scrolling list, the
 * export's kind: a highlight Up/Down (and the wheel) move over the key lines, the headings scrolling
 * with them and never highlighted, the scroll bar in the right border. Nothing to choose, so no option
 * rows: Esc goes back, as the top bar's `close [esc]` says.
 */
function controlsSpec(state: BuildState): PopupSpec {
  const rows: PopupRow[] = []
  /** Where each key line sits in `rows` — what `popupHighlight` indexes. */
  const lineRows: number[] = []
  controlsPage().forEach((section, index) => {
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
    return { kind: "controls-select", line: position }
  }
  return { title: CONTROLS_TITLE, rows, scroll: { from: 0, to: rows.length, highlight, select } }
}

/**
 * A message popup: a title and its text, wrapped to the popup's width in as many lines as it needs,
 * and nothing to choose. It holds the keyboard like any popup; Esc (or `x`, or a right click) and a
 * click outside it close it, and nothing else does (feedback F34).
 */
export function messageSpec(message: PopupMessage): PopupSpec {
  return { title: message.title, rows: [{ kind: "blank" }, { kind: "note", text: message.text }] }
}

/** What the Battle Round confirmation announces when a mission has nothing of its own to say. */
export const DEFAULT_ROUND_TEXT = "Activate Nexus. Collect Resources. Spawn Units."

/** What the confirmation says for round `round`: the mission's own text for it, or the default. */
export function roundAnnouncement(context: BuildContext, round: number): string {
  return context.roundText?.[round] ?? DEFAULT_ROUND_TEXT
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
        rows.push({ kind: "heading", text: "PICK ONE - needed before the Pulse" })
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
      // A confirmation screen, not a question (owner, 2026-09-29, feedback F49-F50): the round's title,
      // what it announces, and the one row, `[s] Start`, highlighted because it is what Enter, Space and
      // `s` do. Esc goes back, as from every popup.
      return {
        title: `Battle Round ${state.pulseNumber}`,
        rows: [
          { kind: "blank" },
          ...sentences(roundAnnouncement(context, state.pulseNumber)).map((text): PopupRow => ({ kind: "note", text })),
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
    default:
      return null
  }
}

/** One row of a placed popup: its frame row, and the spec row it draws. A note's rows each carry
 *  their own wrapped line of it in `text`. */
export type PlacedRow = Readonly<{ row: number; spec: PopupRow; secondLine: boolean; text?: string }>

/**
 * The scroll bar in a popup's right border, beside its scrolling rows, while they overflow (feedback
 * F36): an up symbol on the first of those rows, a down symbol on the last, and between them a track
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

/** Wider than the gate 5F popup (owner, 2026-09-27: "the popup probably larger too"), never wider than
 *  the Grid pane it sits over, less a column for its shadow. */
const POPUP_WIDTH = 52

/** Splits text into lines of at most `limit` glyphs, breaking between words — never inside one, unless
 *  a single word is longer than the whole line. */
export function wrapWords(value: string, limit: number): readonly string[] {
  const lines: string[] = []
  let current = ""
  for (const word of value.split(" ").filter((part) => part !== "")) {
    const grown = current === "" ? word : `${current} ${word}`
    if (grown.length <= limit || current === "") current = grown
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== "") lines.push(current)
  return lines
}

/** The rows one spec row takes, as the text each of them draws (a note's wrapped lines). */
function linesOf(entry: PopupRow, textLimit: number): readonly (string | undefined)[] {
  if (entry.kind === "option" && entry.description !== undefined) return [undefined, undefined]
  if (entry.kind === "note") {
    const wrapped = wrapWords(entry.text, textLimit)
    return Array.from({ length: entry.lines ?? Math.max(1, wrapped.length) }, (_, index) => wrapped[index] ?? "")
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
  // pane; a list that would not is scrolled to fit (gate 5H).
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
  // Border, the rows, a blank row of padding, border.
  const height = lines + 3
  const left = layout.gridBox.left + 1 + Math.floor((paneWidth - width - 1) / 2)
  const top = Math.max(layout.offset.row + 1, layout.gridBox.top + 1 + Math.floor((paneHeight - height - 1) / 2))
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
 *  click outside a popup closes it and moves focus to where it landed (owner, 2026-09-27). */
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
  if (column < placed.textColumn || column >= placed.textColumn + placed.textLimit) return { kind: "none" }
  const hit = placed.rows.find((candidate) => candidate.row === row)
  if (hit !== undefined && hit.spec.kind === "option") return { kind: "command", command: hit.spec.command }
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
 * can hit it (the browser playtest page).
 */
export function settingColumns(placed: PlacedPopup): Readonly<{
  labelLimit: number
  valueFrom: number
  valueMiddle: number
  valueTo: number
}> {
  const valueTo = placed.textColumn + placed.textLimit - 1
  const valueFrom = valueTo - VALUE_WIDTH + 1
  return {
    labelLimit: valueFrom - 1 - placed.textColumn,
    valueFrom,
    valueMiddle: valueFrom + VALUE_WIDTH / 2,
    valueTo,
  }
}
