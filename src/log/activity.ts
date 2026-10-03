// The Activity Logs — what the player did, what the game answered, and what went wrong, recorded so a
// playtester can open **Activity logs** in the game menu, pick a filter and export what it shows into a
// pull request comment. It is the second half of the feedback loop the Experiments
// started (`src/build/all-settings.ts`): an Experiment asks "which feels right?"; a log answers "what
// happened when it felt wrong?".
//
// **For an agent preparing a demo**, this file is the place to start:
//
// - **Every event is declared here first**, with its default level, what it means, and each property's
//   type and meaning. `activity.log(event, props)` accepts only what is declared (`src/log/logger.ts`).
//   Add an event for the interaction you want feedback on, log it where it happens (never from the
//   kernel or the match layer, which may not reach this folder), and default it to `debug` when it is
//   chatty.
// - **Add a filter for your question** at the top of `ACTIVITY_FILTERS` — the window opens on the
//   first — naming the question in words a playtester reads ("Tap speed-up: how far each tap moved").
//   Then ask in the pull request: "play it, open Esc → Activity logs, export, paste it here".
// - **Remove both once the question is answered**, as an Experiment is removed — unless the event has
//   earned a place as part of the game's ordinary record.
//
// The global `activity` logger lives as long as the program; the Build Phase, the title menu and the
// shells log into it, and the browser playtest page shares it across screens.

import type { EventSchema, LogEntry, LogFilter, Logger } from "./logger.ts"
import { createLogger, matchesFilter } from "./logger.ts"
import { formatLogLine } from "./text.ts"

/** Every event the Activity Logs record. Names are `area.action`; see the header for adding one. */
export const ACTIVITY_EVENTS = {
  "session.start": {
    defaultLevel: "info",
    description: "A screen started: which one, from which build, where, and at what size.",
    props: {
      screen: { type: "string", description: "Which screen: menu (the title menu) or build (the Build Phase)." },
      build: { type: "string", description: "The commit the game was built from, '+changes' when it had local edits.", optional: true },
      host: { type: "string", description: "Where it runs: terminal or web (the browser playtest page)." },
      columns: { type: "number", description: "The terminal's width in columns." },
      rows: { type: "number", description: "The terminal's height in rows." },
      colours: { type: "string", description: "The colour depth drawn with, as --capability names it: truecolor, color256, color16 or monochrome." },
    },
  },
  "session.resize": {
    defaultLevel: "debug",
    description: "The terminal changed size.",
    props: {
      columns: { type: "number", description: "The new width in columns." },
      rows: { type: "number", description: "The new height in rows." },
    },
  },
  "session.error": {
    defaultLevel: "error",
    description: "Something failed that the player may have seen, or that stopped something working.",
    props: {
      where: { type: "string", description: "What was being done: render, save, export, start-keys (a --keys script), pulse (starting one), page (the browser playtest page)." },
      message: { type: "string", description: "The error's own message." },
    },
  },
  "menu.select": {
    defaultLevel: "info",
    description: "A row picked on the title menu or one of its screens.",
    props: {
      screen: { type: "string", description: "The screen the row is on: top, settings, campaign, about." },
      item: { type: "string", description: "The row's id: campaign, settings, about, exit, back, ..." },
    },
  },
  "build.command": {
    defaultLevel: "debug",
    description: "A command the Build Phase received — from the keyboard, the mouse or a driver — and the bottom line's answer.",
    props: {
      command: { type: "string", description: "The command's kind: arm, click-tile, highlight, activate, cancel, ..." },
      answer: { type: "string", description: "What the bottom line said after it, if anything.", optional: true },
    },
  },
  "build.refused": {
    defaultLevel: "info",
    description: "The Build Phase refused something the player tried, and said why.",
    props: {
      command: { type: "string", description: "The command's kind." },
      reason: { type: "string", description: "What the bottom line said." },
      x: { type: "number", description: "The tile it was about, if any: column.", optional: true },
      y: { type: "number", description: "The tile it was about, if any: row.", optional: true },
    },
  },
  "build.placed": {
    defaultLevel: "info",
    description: "A building was placed on the plan.",
    props: {
      building: { type: "string", description: "The building's name." },
      x: { type: "number", description: "Its tile: column." },
      y: { type: "number", description: "Its tile: row." },
      credits: { type: "number", description: "Credits left to spend after it." },
    },
  },
  "build.removed": {
    defaultLevel: "info",
    description: "A planned building was taken off the plan.",
    props: {
      building: { type: "string", description: "The building's name." },
      x: { type: "number", description: "Its tile: column." },
      y: { type: "number", description: "Its tile: row." },
      credits: { type: "number", description: "Credits left to spend after it." },
    },
  },
  "popup.open": {
    defaultLevel: "info",
    description: "A popup opened over the Build Phase.",
    props: {
      popup: { type: "string", description: "Which: nexus-powers, battle-round, game-menu, settings, export, controls, activity-logs, message, dialog." },
    },
  },
  "setting.change": {
    defaultLevel: "info",
    description: "A setting was changed in Settings.",
    props: {
      setting: { type: "string", description: "The setting's name, as an export writes it." },
      value: { type: "string", description: "Its new value, as Settings shows it." },
      tier: { type: "string", description: "player (saved) or experiment (for playtests)." },
    },
  },
  "pulse.start": {
    defaultLevel: "info",
    description: "The Nexus Pulse started.",
    props: {
      round: { type: "number", description: "Which Battle Round." },
      buildings: { type: "number", description: "How many buildings the plan placed." },
    },
  },
  "pulse.end": {
    defaultLevel: "info",
    description: "The Nexus Pulse ended and its result stands.",
    props: {
      result: { type: "string", description: "won, lost, drawn or timed out." },
      reason: { type: "string", description: "Why, as the result line says it." },
    },
  },
  "pulse.trained": {
    defaultLevel: "info",
    description: "What the Barracks trained in the Nexus Pulse just ended, and what came of them (step 6C).",
    props: {
      round: { type: "number", description: "Which Battle Round." },
      buildings: { type: "number", description: "How many of the player's buildings trained this round." },
      trained: { type: "number", description: "How many troopers they trained." },
      first: { type: "number", description: "The second of the round the first one was trained at.", optional: true },
      home: { type: "number", description: "How many of those trained came home alive at the end." },
      ended: { type: "number", description: "The second the round's fighting stopped: a round ends early once the raid's units are all dead, or the Nexus falls." },
    },
  },
  export: {
    defaultLevel: "info",
    description: "The player exported settings or activity logs.",
    props: {
      kind: { type: "string", description: "settings or activity." },
      events: { type: "number", description: "How many events an activity export held.", optional: true },
    },
  },
  "dialog.line": {
    defaultLevel: "info",
    description: "A line of a round's opening scene was shown in the dialog at the bottom of the map.",
    props: {
      round: { type: "number", description: "Which round's Build Phase the scene opened." },
      line: { type: "number", description: "Which line of the scene, from 1." },
      of: { type: "number", description: "How many lines the scene has." },
      speaker: { type: "string", description: "Who says it, as the dialog names them: game for the game's own voice." },
    },
  },
  "dialog.skip": {
    defaultLevel: "info",
    description: "The rest of a scene was skipped — Esc, x or a right click — with lines still unread.",
    props: {
      round: { type: "number", description: "Which round's Build Phase the scene opened." },
      line: { type: "number", description: "The line on screen when it was skipped, from 1." },
      of: { type: "number", description: "How many lines the scene has." },
    },
  },
  "move.step": {
    defaultLevel: "debug",
    description: "How far one cursor key moved the map cursor or a list's highlight, and why.",
    props: {
      key: { type: "string", description: "The direction: up, down, left, right." },
      move: { type: "string", description: "The motion rule's call: tap, hold, jump or release." },
      tiles: { type: "number", description: "How many tiles (or rows) the motion rule moved it — at a list's end, what it would have moved. A held key's repeats that move nothing are not logged." },
    },
  },
} as const satisfies EventSchema

export type ActivityEvent = keyof typeof ACTIVITY_EVENTS

/** Where a screen runs, as `session.start` says it: a terminal, or the browser playtest page. */
export type HostName = "terminal" | "web"

/** How many entries the Activity Logs keep before the oldest are dropped: a long playtest's worth of
 *  info and debug, a megabyte or so. */
export const ACTIVITY_CAPACITY = 5000

/** An Activity Logs of its own — a scripted playtest's on the script's clock, a test's — shaped exactly
 *  like the game's. */
export function createActivityLog(now?: () => number, capacity = ACTIVITY_CAPACITY): Logger<typeof ACTIVITY_EVENTS> {
  return createLogger({ name: "activity", events: ACTIVITY_EVENTS, capacity, ...(now === undefined ? {} : { now }) })
}

/** The game's activity log. */
export const activity = createActivityLog()

export type ActivityLog = typeof activity

/**
 * The filters the Activity logs window offers, Left and Right stepping between them. **It opens on the
 * first**: an agent asking for feedback on one interaction puts its own filter here, at the top, for the
 * pull request that asks.
 */
export const ACTIVITY_FILTERS: readonly LogFilter[] = [
  {
    name: "Interactions",
    question: "What you did and what the game answered: buildings placed and refused, popups, settings, the Pulse, errors.",
    level: "info",
  },
  { name: "Problems", question: "Only errors and warnings.", level: "warn" },
  { name: "Everything", question: "Every event recorded, down to each command and each key's move.", level: "debug" },
  // Step 6C's question, last rather than first: the window's tests walk the first three by position, and
  // Left from the first filter reaches this one in a single key. Remove it once the pace is settled.
  {
    name: "Barracks",
    question: "What each round's Barracks trained, how many came home, and when the fighting stopped.",
    level: "info",
    events: ["pulse.start", "pulse.trained", "pulse.end", "setting.change"],
  },
  // The Commander round's question — was the intro read? — last for the same reason. Remove it once answered.
  {
    name: "Intro",
    question: "Whether the lines a round opens with were read: each line the dialog showed, and where the rest was skipped.",
    level: "info",
    events: ["dialog.line", "dialog.skip", "pulse.start"],
  },
]

/** The entries a filter shows, newest first, up to and including sequence number `upTo`. */
export function filteredEntries(entries: readonly LogEntry[], filter: LogFilter, upTo = Number.POSITIVE_INFINITY): readonly LogEntry[] {
  return entries.filter((entry) => entry.seq <= upTo && matchesFilter(filter, entry)).reverse()
}

/** What an Activity logs export says at its top. */
export const ACTIVITY_EXPORT_TITLE = "Terminal Nexus activity logs"

/**
 * An export: a header — the build, the filter and its question, how many events it holds and how many
 * the log has dropped — then the filter's entries, **oldest first** so it reads as a story, one line
 * each (`src/log/text.ts`). What a playtester pastes into a pull request comment.
 */
export function formatActivityExport(
  options: Readonly<{ entries: readonly LogEntry[]; filter: LogFilter; startedAt: number; dropped?: number; build?: string }>,
): string {
  const shown = [...filteredEntries(options.entries, options.filter)].reverse()
  const dropped = options.dropped ?? 0
  const lines = [
    ACTIVITY_EXPORT_TITLE,
    `build: ${options.build ?? "unknown"} · started: ${new Date(options.startedAt).toISOString()}`,
    `filter: ${options.filter.name} - ${options.filter.question}`,
    `${shown.length} of ${options.entries.length} events, oldest first${dropped > 0 ? `; ${dropped} older ones were dropped` : ""}`,
    "",
    ...shown.map((entry) => formatLogLine(entry, options.startedAt)),
  ]
  return `${lines.join("\n")}\n`
}
