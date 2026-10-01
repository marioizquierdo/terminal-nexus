// Log levels — one vocabulary for every log in the project: the Activity Logs (`src/log/activity.ts`)
// and `grid`'s battle report (`src/report/log.ts`, which prints them in capitals in its fixed columns).
//
//   error  something failed that the player saw, or that stopped something working
//   warn   something odd that did not stop anything — worth a look
//   info   what happened, at the level a person would retell it
//   debug  the detail behind it: every command, every key's move
//   trace  finer still — the battle report's per-tick detail
//
// A threshold includes itself and everything above it: `info` shows error, warn and info.

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace"

export const LOG_LEVELS: readonly LogLevel[] = ["error", "warn", "info", "debug", "trace"]

const RANK: Readonly<Record<LogLevel, number>> = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 }

/** Whether a line at `level` passes a threshold of `threshold`. */
export function includesLevel(threshold: LogLevel, level: LogLevel): boolean {
  return RANK[level] <= RANK[threshold]
}

/** A level from text, in any case — `--log-level debug`, `DEBUG`. */
export function parseLevel(value: string): LogLevel {
  const lower = value.toLowerCase()
  const found = LOG_LEVELS.find((level) => level === lower)
  if (found === undefined) {
    throw new Error(`unknown log level "${value}"; expected one of ${LOG_LEVELS.join(", ")}`)
  }
  return found
}
