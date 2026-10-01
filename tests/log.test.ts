// The structured logger and the Activity Logs' schema: typed events declared
// before they are logged, a bounded memory that drops the oldest, one text line per entry that reads
// back, filters as data.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  ACTIVITY_EVENTS,
  ACTIVITY_FILTERS,
  createLogger,
  entryProblems,
  filteredEntries,
  formatActivityExport,
  formatElapsed,
  formatLogLine,
  formatValue,
  parseLogLine,
} from "../src/log/index.ts"
import type { EventSchema, LogEntry } from "../src/log/index.ts"

const SCHEMA = {
  "door.opened": {
    defaultLevel: "info",
    description: "A door opened.",
    props: {
      door: { type: "string", description: "Which door." },
      floor: { type: "number", description: "On which floor." },
      locked: { type: "boolean", description: "Whether it had been locked.", optional: true },
    },
  },
  "door.creaked": { defaultLevel: "debug", description: "A door creaked.", props: {} },
} as const satisfies EventSchema

function clock(start = 1000): { now: () => number; advance: (ms: number) => void } {
  let time = start
  return { now: () => time, advance: (ms) => (time += ms) }
}

test("an entry carries a sequence number, the clock's time, the event's default level and its properties", () => {
  const time = clock()
  const log = createLogger({ name: "test", events: SCHEMA, capacity: 10, now: time.now })
  time.advance(250)
  log.log("door.opened", { door: "north", floor: 2 })
  log.log("door.creaked")
  assert.deepEqual(log.entries(), [
    { seq: 1, time: 1250, level: "info", event: "door.opened", props: { door: "north", floor: 2 } },
    { seq: 2, time: 1250, level: "debug", event: "door.creaked", props: {} },
  ])
  assert.equal(log.startedAt, 1000)
  assert.equal(log.lastSeq, 2)
})

test("a call may log at a level other than the event's default, and the level is not kept as a property", () => {
  const log = createLogger({ name: "test", events: SCHEMA, capacity: 10, now: () => 0 })
  log.log("door.opened", { door: "east", floor: null, level: "warn" })
  const [entry] = log.entries()
  assert.equal(entry?.level, "warn")
  assert.deepEqual(entry?.props, { door: "east", floor: null })
})

test("past its capacity the log drops the oldest entries and counts them; sequence numbers keep counting after a clear", () => {
  const log = createLogger({ name: "test", events: SCHEMA, capacity: 3, now: () => 0 })
  for (let floor = 1; floor <= 5; floor += 1) log.log("door.opened", { door: "d", floor })
  assert.deepEqual(log.entries().map((entry) => entry.props["floor"]), [3, 4, 5])
  assert.equal(log.dropped, 2)
  log.clear()
  assert.deepEqual(log.entries(), [])
  assert.equal(log.dropped, 0)
  log.log("door.creaked")
  assert.equal(log.entries()[0]?.seq, 6)
})

test("logging never throws — not for a clock that fails, nor for a listener that does", () => {
  const failing = createLogger({
    name: "test",
    events: SCHEMA,
    capacity: 3,
    now: (() => {
      let calls = 0
      return () => {
        calls += 1
        if (calls > 1) throw new Error("no clock")
        return 0
      }
    })(),
  })
  assert.doesNotThrow(() => failing.log("door.creaked"))
  assert.equal(failing.entries().length, 0)

  const log = createLogger({ name: "test", events: SCHEMA, capacity: 3, now: () => 0 })
  const heard: LogEntry[] = []
  log.subscribe(() => {
    throw new Error("listener")
  })
  const stop = log.subscribe((entry) => heard.push(entry))
  assert.doesNotThrow(() => log.log("door.creaked"))
  stop()
  log.log("door.creaked")
  assert.equal(heard.length, 1)
  assert.equal(log.entries().length, 2)
})

test("an entry is checked against its schema: undeclared events and properties, wrong types, missing ones", () => {
  const entry = (event: string, props: LogEntry["props"]): LogEntry => ({ seq: 1, time: 0, level: "info", event, props })
  assert.deepEqual(entryProblems(SCHEMA, entry("door.opened", { door: "n", floor: 1 })), [])
  assert.deepEqual(entryProblems(SCHEMA, entry("door.opened", { door: "n", floor: null, locked: true })), [])
  assert.deepEqual(entryProblems(SCHEMA, entry("door.slammed", {})), ["door.slammed is not a declared event"])
  assert.deepEqual(entryProblems(SCHEMA, entry("door.opened", { door: 3, floor: 1, colour: "red" })), [
    "door.opened.door should be a string",
    "door.opened.colour is not a declared property",
  ])
  assert.deepEqual(entryProblems(SCHEMA, entry("door.opened", { door: "n" })), ["door.opened.floor is missing"])
})

test("a line reads back exactly — including text that would otherwise read as a number, a boolean, null, or several words", () => {
  const props = { plain: "Barracks", spaced: "Not enough credits.", quoted: 'say "hi"', numeric: "12", truth: "true", nothing: "null", empty: "", n: 7.5, yes: false, none: null }
  const line = formatLogLine({ seq: 1, time: 66_250, level: "info", event: "build.placed", props }, 1000)
  assert.equal(line.slice(0, 26), "01:05.250 info  build.plac")
  assert.deepEqual(parseLogLine(line), { elapsed: 65_250, level: "info", event: "build.placed", props })
  assert.equal(formatValue("Barracks"), "Barracks")
  assert.equal(formatValue("12"), '"12"')
  assert.equal(parseLogLine("Terminal Nexus activity logs"), null)
})

test("elapsed time reads as minutes, seconds and milliseconds, with hours past the first", () => {
  assert.equal(formatElapsed(0), "00:00.000")
  assert.equal(formatElapsed(61_005), "01:01.005")
  assert.equal(formatElapsed(3_723_004), "1:02:03.004")
  assert.equal(parseLogLine("1:02:03.004 warn  x")?.elapsed, 3_723_004)
})

test("a filter shows its level and above, only its events when it names them, newest first, up to a cut-off", () => {
  const log = createLogger({ name: "test", events: SCHEMA, capacity: 10, now: () => 0 })
  log.log("door.opened", { door: "a", floor: 1 })
  log.log("door.creaked")
  log.log("door.opened", { door: "b", floor: 1, level: "warn" })
  const entries = log.entries()
  const doors = (shown: readonly LogEntry[]): unknown[] => shown.map((entry) => entry.props["door"] ?? "creak")
  assert.deepEqual(doors(filteredEntries(entries, { name: "", question: "", level: "info" })), ["b", "a"])
  assert.deepEqual(doors(filteredEntries(entries, { name: "", question: "", level: "debug" })), ["b", "creak", "a"])
  assert.deepEqual(doors(filteredEntries(entries, { name: "", question: "", level: "warn" })), ["b"])
  assert.deepEqual(doors(filteredEntries(entries, { name: "", question: "", level: "debug", events: ["door.creaked"] })), ["creak"])
  assert.deepEqual(doors(filteredEntries(entries, { name: "", question: "", level: "debug" }, 2)), ["creak", "a"])
})

test("an export names its build, its filter and what it holds, then the filter's entries oldest first", () => {
  const log = createLogger({ name: "test", events: SCHEMA, capacity: 2, now: () => 0 })
  log.log("door.opened", { door: "a", floor: 1 })
  log.log("door.opened", { door: "b", floor: 2 })
  log.log("door.creaked")
  const text = formatActivityExport({
    entries: log.entries(),
    filter: { name: "Doors", question: "Which doors opened.", level: "info" },
    startedAt: log.startedAt,
    dropped: log.dropped,
    build: "abc1234",
  })
  assert.equal(
    text,
    [
      "Terminal Nexus activity logs",
      "build: abc1234 · started: 1970-01-01T00:00:00.000Z",
      "filter: Doors - Which doors opened.",
      "1 of 2 events, oldest first; 1 older ones were dropped",
      "",
      "00:00.000 info  door.opened door=b floor=2",
      "",
    ].join("\n"),
  )
})

test("every Activity Logs event says what it means, every property says what it holds, and every filter's events exist", () => {
  for (const [name, spec] of Object.entries(ACTIVITY_EVENTS as EventSchema)) {
    assert.match(name, /^[a-z]+(\.[a-z]+)?$/, `${name}: names are area.action, in lowercase`)
    assert.ok(spec.description.length > 10, `${name} has no description`)
    for (const [prop, propSpec] of Object.entries(spec.props)) {
      assert.ok(propSpec.description.length > 5, `${name}.${prop} has no description`)
    }
  }
  assert.ok(ACTIVITY_FILTERS.length > 0)
  for (const filter of ACTIVITY_FILTERS) {
    assert.ok(filter.question.length > 0, `filter ${filter.name} names no question`)
    for (const event of filter.events ?? []) assert.ok(event in ACTIVITY_EVENTS, `filter ${filter.name} names ${event}, which is not declared`)
  }
})
