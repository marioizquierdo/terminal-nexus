// A log as text — one line per entry, the same in the Activity logs window, in an export pasted into a
// pull request, and in a test:
//
//     01:05.250 info  build.placed building=Barracks x=12 y=7 credits=90
//     01:06.900 info  build.refused command=click-tile reason="Not enough credits." x=14 y=7
//
// The time is since the logger started (minutes, seconds, milliseconds); then the level, the event and
// its properties as `name=value`. A text value is written bare when it reads back as the same text, and
// in JSON's quotes otherwise (a space, a quote, an `=`, or text that would read as a number, a boolean or
// null). `parseLogLine` reads a line back, so an agent — or a test — can work from a pasted export.

import type { LogLevel } from "./levels.ts"
import { LOG_LEVELS } from "./levels.ts"
import type { LogEntry, PropValue } from "./logger.ts"

/** Milliseconds since the logger started, as `mm:ss.mmm` — `h:mm:ss.mmm` past the first hour. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms))
  const millis = total % 1000
  const seconds = Math.floor(total / 1000) % 60
  const minutes = Math.floor(total / 60_000) % 60
  const hours = Math.floor(total / 3_600_000)
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
  return hours > 0 ? `${hours}:${clock}` : clock
}

function readsAsSomethingElse(text: string): boolean {
  return text === "" || text === "true" || text === "false" || text === "null" || Number.isFinite(Number(text))
}

export function formatValue(value: PropValue): string {
  if (typeof value !== "string") return String(value)
  return /^[^\s"=]+$/u.test(value) && !readsAsSomethingElse(value) ? value : JSON.stringify(value)
}

export function formatProps(props: Readonly<Record<string, PropValue>>): string {
  return Object.entries(props)
    .map(([name, value]) => `${name}=${formatValue(value)}`)
    .join(" ")
}

/** One entry as a line, its time relative to `startedAt`. */
export function formatLogLine(entry: LogEntry, startedAt: number): string {
  const props = formatProps(entry.props)
  return `${formatElapsed(entry.time - startedAt)} ${entry.level.padEnd(5)} ${entry.event}${props === "" ? "" : ` ${props}`}`
}

export type ParsedLogLine = Readonly<{ elapsed: number; level: LogLevel; event: string; props: Readonly<Record<string, PropValue>> }>

/** A line `formatLogLine` wrote, read back — or `null` for a line that is not one (a header, a blank). */
export function parseLogLine(line: string): ParsedLogLine | null {
  const match = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3}) (\w+)\s+(\S+)(?: (.*))?$/u.exec(line.trimEnd())
  if (match === null) return null
  const [, hours, minutes, seconds, millis, level, event, rest] = match
  if (!LOG_LEVELS.includes(level as LogLevel) || event === undefined) return null
  const elapsed = Number(hours ?? 0) * 3_600_000 + Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(millis)
  const props: Record<string, PropValue> = {}
  const pattern = /(\w[\w.-]*)=("(?:[^"\\]|\\.)*"|\S+)/gu
  for (const [, name, raw] of (rest ?? "").matchAll(pattern)) {
    if (name === undefined || raw === undefined) continue
    props[name] = raw.startsWith('"') ? (JSON.parse(raw) as string)
      : raw === "true" ? true
      : raw === "false" ? false
      : raw === "null" ? null
      : Number.isFinite(Number(raw)) ? Number(raw)
      : raw
  }
  return { elapsed, level: level as LogLevel, event, props }
}
