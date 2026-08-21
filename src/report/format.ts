// The line grammar — milestone-1-spike-battle.md 3.3.
//
//   [tick] LEVEL kind subject [-> object] detail...
//
// Fixed columns, because that is what lets an agent assert on behaviour without parsing prose:
//
//   col  0  [0000]          six characters and a space
//   col  7  LEVEL           padded to five, and a space
//   col 13  kind            padded to eight, and a space
//   col 22  subject         padded to thirteen, and a space
//   col 36  -> object       "-> " then the object padded to fourteen, and a space
//   col 54  detail          free text, and the only part that may grow
//
// It grows by **adding kinds, never by reshaping columns** — every grep written against it today
// has to keep working when salvage, production, and capture arrive. Names are padded, never
// truncated: a truncated entity id would break the grep this format exists for, so an over-long id
// pushes its own line's detail right rather than losing characters.

import type { LogLevel } from "./levels.ts"

export const COLUMN_LEVEL = 7
export const COLUMN_KIND = 13
export const COLUMN_SUBJECT = 22
export const COLUMN_OBJECT = 36
export const COLUMN_DETAIL = 54

const SUBJECT_WIDTH = 13
const OBJECT_WIDTH = 14

export type LogLine = Readonly<{
  tick: number
  level: LogLevel
  kind: string
  subject: string
  object?: string
  detail: string
}>

export function formatLine(line: LogLine): string {
  const tick = `[${String(line.tick).padStart(4, "0")}] `
  const level = `${line.level.padEnd(5, " ")} `
  const kind = `${line.kind.padEnd(8, " ")} `
  const subject = `${line.subject.padEnd(SUBJECT_WIDTH, " ")} `
  const object =
    line.object === undefined ? "" : `-> ${line.object.padEnd(OBJECT_WIDTH, " ")} `
  return `${tick}${level}${kind}${subject}${object}${line.detail}`.trimEnd()
}

export function formatCoordinate(tile: Readonly<{ x: number; y: number }>): string {
  return `(${tile.x},${tile.y})`
}

/** One decimal place, so a score column stays the same width whatever the number. */
export function formatScore(score: number): string {
  return score.toFixed(1)
}
