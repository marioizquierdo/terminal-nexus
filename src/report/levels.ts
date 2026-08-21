// Log levels — milestone-1-spike-battle.md 3.3. Default INFO.

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE"

export const LOG_LEVELS: readonly LogLevel[] = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"]

const RANK: Readonly<Record<LogLevel, number>> = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
}

export function includesLevel(configured: LogLevel, line: LogLevel): boolean {
  return RANK[line] <= RANK[configured]
}

export function parseLevel(value: string): LogLevel {
  const upper = value.toUpperCase()
  const found = LOG_LEVELS.find((level) => level === upper)
  if (found === undefined) {
    throw new Error(`unknown log level "${value}"; expected one of ${LOG_LEVELS.join(", ")}`)
  }
  return found
}
