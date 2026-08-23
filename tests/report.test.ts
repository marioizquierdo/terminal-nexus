// The report — milestone-1-spike-battle.md 3.3 and 3.9.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  COLUMN_DETAIL,
  COLUMN_KIND,
  COLUMN_LEVEL,
  COLUMN_OBJECT,
  COLUMN_SUBJECT,
  buildLog,
  formatLine,
  formatSummary,
  parseLevel,
  replayEvents,
  summarize,
} from "../src/report/index.ts"
import { reportInputOf, resolveScenario, scenarioFiles } from "./helpers.ts"

/** The exact lines printed in milestone-1-spike-battle.md 3.3. */
const SPEC_LINES: ReadonlyArray<readonly [Parameters<typeof formatLine>[0], string]> = [
  [
    { tick: 0, level: "INFO", kind: "spawn", subject: "A:trooper#1", detail: "at (2,1)" },
    "[0000] INFO  spawn    A:trooper#1   at (2,1)",
  ],
  [
    {
      tick: 18,
      level: "INFO",
      kind: "engage",
      subject: "A:trooper#1",
      object: "B:marksman#9",
      detail: "dist 5  score 5.0",
    },
    "[0018] INFO  engage   A:trooper#1   -> B:marksman#9   dist 5  score 5.0",
  ],
  [
    {
      tick: 21,
      level: "INFO",
      kind: "attack",
      subject: "B:marksman#9",
      object: "A:trooper#1",
      detail: "ranged dmg 6  hp 40->34",
    },
    "[0021] INFO  attack   B:marksman#9  -> A:trooper#1    ranged dmg 6  hp 40->34",
  ],
  [
    {
      tick: 56,
      level: "INFO",
      kind: "death",
      subject: "B:marksman#9",
      detail: "at (13,7)  by A:trooper#1",
    },
    "[0056] INFO  death    B:marksman#9  at (13,7)  by A:trooper#1",
  ],
  [
    {
      tick: 71,
      level: "WARN",
      kind: "stuck",
      subject: "A:worker#4",
      detail: "at (3,9)  no legal step for 24 ticks",
    },
    "[0071] WARN  stuck    A:worker#4    at (3,9)  no legal step for 24 ticks",
  ],
]

test("the line grammar reproduces the milestone's own sample lines", () => {
  for (const [line, expected] of SPEC_LINES) {
    assert.equal(formatLine(line), expected)
  }
})

test("the columns are fixed, so a grep written today keeps working", async () => {
  const resolved = await resolveScenario("citizen-mirror-skirmish.map.json")
  const lines = buildLog(reportInputOf(resolved), "DEBUG")
  assert.ok(lines.length > 50)
  for (const line of lines) {
    assert.match(line.slice(0, 7), /^\[\d{4}\] $/, `bad tick column: ${line}`)
    assert.match(
      line.slice(COLUMN_LEVEL, COLUMN_KIND),
      /^(ERROR|WARN |INFO |DEBUG|TRACE) $/,
      `bad level column: ${line}`,
    )
    assert.match(line.slice(COLUMN_KIND, COLUMN_SUBJECT), /^[a-z]+ *$/, `bad kind column: ${line}`)
    assert.match(
      line.slice(COLUMN_SUBJECT, COLUMN_OBJECT),
      /^\S.* $|^\S+$/,
      `bad subject column: ${line}`,
    )
    if (line.length > COLUMN_OBJECT && line.slice(COLUMN_OBJECT, COLUMN_OBJECT + 3) === "-> ") {
      assert.ok(line.length > COLUMN_DETAIL - 1, `object line lost its detail column: ${line}`)
    }
  }
})

test("levels filter as documented, and INFO is the default story", async () => {
  const resolved = await resolveScenario("melee-kill.map.json")
  const input = reportInputOf(resolved)
  const counts = new Map<string, number>()
  for (const level of ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"] as const) {
    counts.set(level, buildLog(input, level).length)
  }
  const error = counts.get("ERROR") ?? 0
  const warn = counts.get("WARN") ?? 0
  const info = counts.get("INFO") ?? 0
  const debug = counts.get("DEBUG") ?? 0
  const trace = counts.get("TRACE") ?? 0
  assert.ok(error <= warn && warn <= info && info < debug && debug < trace)
  assert.equal(error, 0, "a clean run produced ERROR lines")

  const infoKinds = new Set(buildLog(input, "INFO").map((line) => line.slice(13, 21).trim()))
  assert.deepEqual([...infoKinds].sort(), ["attack", "death", "engage", "report", "spawn", "victory"])
})

test("the INFO log tells the story an agent can assert on", async () => {
  const resolved = await resolveScenario("melee-kill.map.json")
  const lines = buildLog(reportInputOf(resolved), "INFO")
  assert.equal(lines.filter((line) => line.includes(" spawn ")).length, 3)
  assert.ok(lines.some((line) => /INFO  engage +A:trooper#1 +-> B:trooper#2/.test(line)))
  assert.ok(lines.some((line) => /INFO  attack +A:trooper#1 +-> B:trooper#2 +melee  dmg 7/.test(line)))
  assert.ok(lines.some((line) => /INFO  death +B:trooper#2/.test(line)))
  assert.ok(lines.some((line) => /INFO  victory +A +reason: annihilation/.test(line)))
})

test("the report can rebuild the whole cast from the events alone", async () => {
  // The honesty check behind "src/report derives everything from the event stream and the final
  // state": if the events are complete, replaying them reproduces the kernel's own final state.
  for (const name of scenarioFiles()) {
    const resolved = await resolveScenario(name)
    const replay = replayEvents(resolved.run.events)
    const survivors = [...replay.entities.values()]
      .filter((entity) => entity.alive)
      .sort((a, b) => a.ordinal - b.ordinal)

    assert.deepEqual(
      survivors.map((entity) => ({ id: entity.id, hp: entity.hp, at: entity.anchor })),
      resolved.run.finalState.entities.map((entity) => ({
        id: entity.id,
        hp: entity.hp,
        at: entity.anchor,
      })),
      `${name}: the events do not add up to the final state`,
    )
  }
})

test("the summary reports what the milestone's example reports", async () => {
  const resolved = await resolveScenario("melee-kill.map.json")
  const summary = summarize(reportInputOf(resolved))
  const text = formatSummary(summary)
  assert.match(text, /^scenario   melee-kill$/m)
  assert.match(text, /^seed       0x0000A001$/m)
  assert.match(text, /^ticks      \d+ of 180 \(ended early: annihilation\)$/m)
  assert.match(text, /^outcome    A wins$/m)
  assert.match(text, /^losses     A: 0 of 2    B: 1 of 1$/m)
  assert.match(text, /^state      sha256:[0-9a-f]{16}    events  sha256:[0-9a-f]{16}$/m)
})

test("an unknown log level is refused rather than guessed at", () => {
  assert.throws(() => parseLevel("chatty"), /unknown log level/)
  assert.equal(parseLevel("debug"), "DEBUG")
})

test("the stuck warning fires for an actor that cannot make progress", async () => {
  const resolved = await resolveScenario("hauler-two-tile-gap.map.json")
  const lines = buildLog(reportInputOf(resolved), "WARN")
  assert.ok(
    lines.some((line) => /WARN  stuck    A:hauler#1/.test(line)),
    "the hauler circling in front of a wall it cannot pass was never reported",
  )
})
