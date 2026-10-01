// A structured logger — the one shape every log in the project shares, so all logging stays coherent
// and standard.
//
// **Events are declared before they are logged.** A logger is built over a schema: each event's name,
// its default level, a sentence on what it means, and its properties — each with a type and a sentence
// of its own. The schema is the documentation: an agent reading `src/log/activity.ts` knows every event
// the game can record and what each field means, and TypeScript refuses a call that logs an undeclared
// event or a property of the wrong type.
//
//     activity.log("build.placed", { building: "Barracks", x: 12, y: 7, credits: 90 })
//     activity.log("build.placed", { ..., level: "debug" })   // a level other than the event's default
//
// An entry is a sequence number, a timestamp, a level, the event's name and its properties — plain
// JSON values only (string, number, boolean, null). Entries are kept in memory, at most `capacity` of
// them: past that the oldest are dropped, and `dropped` counts them.
//
// **The clock is injected** (`now`, `Date.now` unless a test passes its own), so this module names no
// clock of its own choosing and a test reads exact times. **Nothing the rules decide may depend on a
// log**: the kernel and the match layer never import this folder (`tests/architecture.test.ts`), and a
// log is only ever read to be shown or exported.

import type { LogLevel } from "./levels.ts"
import { includesLevel } from "./levels.ts"

/** A property's declared type. Any property may also be `null`: known to be absent. */
export type PropType = "string" | "number" | "boolean"

/** A property's value: one of JSON's plain values. */
export type PropValue = string | number | boolean | null

export type PropSpec = Readonly<{
  type: PropType
  /** What the value is, in a sentence — for the next agent, who reads the schema rather than the code. */
  description: string
  /** May be left out of a call. */
  optional?: boolean
}>

export type EventSpec = Readonly<{
  /** The level an entry gets unless the call names another (`props.level`). */
  defaultLevel: LogLevel
  /** What the event means, in a sentence. */
  description: string
  props: Readonly<Record<string, PropSpec>>
}>

/** Every event a logger accepts, keyed by its name (`area.action`: `build.placed`, `session.error`). */
export type EventSchema = Readonly<Record<string, EventSpec>>

type ValueOf<T extends PropType> = T extends "string" ? string : T extends "number" ? number : boolean

type PropsOf<P extends Readonly<Record<string, PropSpec>>> = {
  -readonly [K in keyof P as P[K]["optional"] extends true ? never : K]: ValueOf<P[K]["type"]> | null
} & {
  -readonly [K in keyof P as P[K]["optional"] extends true ? K : never]?: ValueOf<P[K]["type"]> | null
}

/** What a call to `log` passes for one event: its declared properties, and optionally a level. */
export type EventProps<S extends EventSpec> = PropsOf<S["props"]> & { level?: LogLevel }

/** One recorded event. `time` is the logger's clock (milliseconds); `seq` counts up from 1 and is never
 *  reused, even after `clear`, so it names an entry for as long as the logger lives. */
export type LogEntry = Readonly<{
  seq: number
  time: number
  level: LogLevel
  event: string
  props: Readonly<Record<string, PropValue>>
}>

/**
 * A way to look at a log: a name, the question it answers, a threshold, and optionally only some
 * events. Data, so an agent preparing a demo adds one for the interaction it wants feedback on —
 * "Tap speed-up: debug, only `move.step`" — and a playtester picks it and exports what it shows.
 */
export type LogFilter = Readonly<{
  name: string
  /** What the filter is for, in a sentence the player reads. */
  question: string
  level: LogLevel
  events?: readonly string[]
}>

export function matchesFilter(filter: LogFilter, entry: LogEntry): boolean {
  return includesLevel(filter.level, entry.level) && (filter.events === undefined || filter.events.includes(entry.event))
}

export type LoggerOptions<Schema extends EventSchema> = Readonly<{
  /** Which log this is — "activity" — named at the top of an export. */
  name: string
  events: Schema
  /** How many entries are kept; past it the oldest are dropped. */
  capacity: number
  /** The clock, in milliseconds. `Date.now` unless a test passes its own. */
  now?: () => number
}>

export class Logger<Schema extends EventSchema> {
  readonly name: string
  readonly events: Schema
  readonly capacity: number
  /** When the logger started, on its clock — what an entry's time is shown relative to. */
  readonly startedAt: number
  private readonly now: () => number
  /** A ring: once full, `start` is the oldest entry and each new one overwrites it. */
  private buffer: LogEntry[] = []
  private start = 0
  private nextSeq = 1
  private droppedCount = 0
  private readonly listeners = new Set<(entry: LogEntry) => void>()

  constructor(options: LoggerOptions<Schema>) {
    this.name = options.name
    this.events = options.events
    this.capacity = Math.max(1, Math.floor(options.capacity))
    this.now = options.now ?? Date.now
    this.startedAt = this.now()
  }

  /** Records one event. Never throws: a log that could break the game would not be worth having. */
  log<E extends keyof Schema & string>(
    event: E,
    ...rest: object extends EventProps<Schema[E]> ? [props?: EventProps<Schema[E]>] : [props: EventProps<Schema[E]>]
  ): void {
    try {
      const { level, ...values } = (rest[0] ?? {}) as Readonly<Record<string, unknown>> & { level?: LogLevel }
      const entry: LogEntry = {
        seq: this.nextSeq,
        time: this.now(),
        level: level ?? this.events[event]?.defaultLevel ?? "info",
        event,
        props: plainValues(values),
      }
      this.nextSeq += 1
      this.push(entry)
      for (const listener of this.listeners) {
        try {
          listener(entry)
        } catch {
          // A listener's failure is its own; the entry is recorded either way.
        }
      }
    } catch {
      // A clock that throws: nothing recorded, nothing broken.
    }
  }

  /** Every entry kept, oldest first. */
  entries(): readonly LogEntry[] {
    return [...this.buffer.slice(this.start), ...this.buffer.slice(0, this.start)]
  }

  /** How many entries were dropped to keep within `capacity`. */
  get dropped(): number {
    return this.droppedCount
  }

  /** The newest entry's sequence number, or 0 before any. */
  get lastSeq(): number {
    return this.nextSeq - 1
  }

  /** Forgets every entry kept. Sequence numbers keep counting. */
  clear(): void {
    this.buffer = []
    this.start = 0
    this.droppedCount = 0
  }

  /** Calls `listener` with every entry from now on — a file, a live panel. Returns the unsubscribe. */
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private push(entry: LogEntry): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(entry)
      return
    }
    this.buffer[this.start] = entry
    this.start = (this.start + 1) % this.capacity
    this.droppedCount += 1
  }
}

export function createLogger<Schema extends EventSchema>(options: LoggerOptions<Schema>): Logger<Schema> {
  return new Logger(options)
}

/** Only JSON's plain values survive into an entry: `undefined` is left out, anything else is text. */
function plainValues(values: Readonly<Record<string, unknown>>): Readonly<Record<string, PropValue>> {
  const kept: Record<string, PropValue> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue
    kept[key] = value === null || typeof value === "string" || typeof value === "boolean" ? value
      : typeof value === "number" ? (Number.isFinite(value) ? value : String(value))
      : String(value)
  }
  return kept
}

/**
 * What is wrong with an entry against a schema — an event it does not declare, a property it does not
 * declare, a value of the wrong type, a required property missing — or nothing. Tests run it over
 * everything a playtest logged, so the schema stays the truth about what the game records.
 */
export function entryProblems(schema: EventSchema, entry: LogEntry): readonly string[] {
  const spec = schema[entry.event]
  if (spec === undefined) return [`${entry.event} is not a declared event`]
  const problems: string[] = []
  for (const [name, value] of Object.entries(entry.props)) {
    const prop = spec.props[name]
    if (prop === undefined) problems.push(`${entry.event}.${name} is not a declared property`)
    else if (value !== null && typeof value !== prop.type) problems.push(`${entry.event}.${name} should be a ${prop.type}`)
  }
  for (const [name, prop] of Object.entries(spec.props)) {
    if (prop.optional !== true && !(name in entry.props)) problems.push(`${entry.event}.${name} is missing`)
  }
  return problems
}
