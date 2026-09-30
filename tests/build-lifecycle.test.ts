// `runSpike`'s lifecycle — engine.md 10.1's RULE, applied to the Build Phase screen. The same fake
// stdin/stdout pattern `tests/menu-session.test.ts` and `tests/lifecycle.test.ts` already use, and
// the same non-negotiables: one idempotent disposer reached from `q`, an interrupt byte, Esc with
// nothing armed, SIGINT and SIGTERM alike; raw mode, the alternate screen and mouse reporting all
// left off on every one of those paths.
//
// What is new here, and what the menu never had to answer: this screen's frame *changes size* with
// the terminal, so resizing is not only a gate question but a redraw question.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { TUNING } from "../src/build/tuning.ts"
import { runSpike } from "../src/cli/spike.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../src/menu/mouse.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings } from "../src/settings/index.ts"
import { DEFENCE_KEYS, PROBE_PULSE } from "./pulse-helpers.ts"

const ESC = String.fromCharCode(27)

/** The title row's clock, whatever styling sits between the words and the time. */
const timerAt = (write: string): string | undefined => new RegExp(`NEXUS PULSE 1(?:${ESC}\\[[0-9;]*m)* +(\\d:\\d\\d)`).exec(write)?.[1]

const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "monochrome" }

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  /** Only the most recent write. The cumulative `written` can never prove something is *absent*
   *  from the current frame, which is exactly what the resize checks below need. */
  lastWrite = ""
  write(text: string): boolean {
    this.written += text
    this.lastWrite = text
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
  raw = false
  resumed = false
  paused = false
  setRawMode(value: boolean): this {
    this.raw = value
    return this
  }
  resume(): this {
    this.resumed = true
    this.paused = false
    return this
  }
  pause(): this {
    this.paused = true
    return this
  }
}

/** Long enough for a lone Esc's timeout (a tuned value) to run out, and for the frame timer's last frame
 *  after it. */
const AFTER_ESC_TIMEOUT_MS = TUNING.escTimeoutMs + 100

async function spikeSession(
  end: (stdin: FakeStdin, stdout: FakeStdout) => void,
  settleMs = 30,
): Promise<{ stdout: FakeStdout; stdin: FakeStdin; exits: number[] }> {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []

  const session = runSpike({
    settings: TEST_SETTINGS,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 30))
  end(stdin, stdout)
  await new Promise((resolve) => setTimeout(resolve, settleMs))
  void session
  return { stdout, stdin, exits }
}

test("launching enters the alternate screen, raw mode, and turns mouse reporting on", async () => {
  const { stdout, stdin } = await spikeSession(() => {})
  assert.ok(stdout.written.includes(`${ESC}[?1049h`), "never entered the alternate screen")
  assert.ok(stdout.written.includes(`${ESC}[?25l`), "never hid the cursor")
  assert.equal(stdin.raw, true, "never entered raw mode")
  assert.ok(stdout.written.includes(MOUSE_REPORTING_ON), "never turned mouse reporting on")
  assert.ok(stdout.written.includes("Explore Map"), "never drew a first frame")
})

test("q then q, an interrupt byte, and Esc then q all reach the one disposer", async () => {
  // q and Esc ask "Exit the game?" first (owner, 2026-09-27) — its [q] is what leaves; Ctrl+C leaves
  // outright. Each arrives as its own read, the way a person's separate key presses do.
  for (const [name, reads] of [
    ["q q", [Buffer.from("q"), Buffer.from("q")]],
    ["an interrupt byte", [Buffer.from([3])]],
    ["esc q", [Buffer.from(ESC), Buffer.from("q")]],
  ] as const) {
    const { stdout, stdin, exits } = await spikeSession((input) => {
      for (const read of reads) input.emit("data", read)
    })
    assert.deepEqual(exits, [0], `${name} did not end the session`)
    assert.equal(stdin.raw, false, `${name} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(`${ESC}[?1049l`), `${name} did not leave the alternate screen`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${name} left mouse reporting on`)
  }
})

test("a lone q or Esc only asks — it never leaves the screen by itself", async () => {
  // engine.md 9.7: Esc "never quits the game by itself"; since the exit question, neither does q —
  // both open the game menu (Settings, Quit) now.
  for (const key of ["q", ESC]) {
    const { stdout, exits } = await spikeSession((input) => {
      input.emit("data", Buffer.from(key))
    }, AFTER_ESC_TIMEOUT_MS)
    assert.deepEqual(exits, [], `${JSON.stringify(key)} left without asking`)
    assert.ok(stdout.lastWrite.includes("Controls and hotkeys"), "the game menu was not drawn")
  }
})

test("Esc with something armed disarms instead of leaving", async () => {
  const { stdout, exits } = await spikeSession((input) => {
    input.emit("data", Buffer.from("1"))
    input.emit("data", Buffer.from(ESC))
  }, AFTER_ESC_TIMEOUT_MS)
  assert.deepEqual(exits, [], "Esc quit while a structure was armed")
  assert.ok(stdout.lastWrite.includes("Cancelled"), "Esc did not disarm")
})

test("a lone Esc waits a moment for the rest of a key: Esc then [A in the next read is one Up arrow", async () => {
  // Gate 5H: an arrow split across two reads (a slow link) used to arrive as Esc and then two stray
  // characters. Within the timeout the two reads are joined and are the one key they always were.
  const { stdout, exits } = await spikeSession((input) => {
    input.emit("data", Buffer.from("e")) // explore, so the arrow moves the map cursor
    input.emit("data", Buffer.from(ESC))
    input.emit("data", Buffer.from("[A"))
  }, AFTER_ESC_TIMEOUT_MS)
  assert.deepEqual(exits, [])
  assert.ok(!stdout.lastWrite.includes("Controls and hotkeys"), "the split arrow was read as Esc")
  // Explore Map put the cursor on clear ground, a free column right of the Nexus (21,10 — feedback
  // F66), and the arrow moved it up one tile: the Explore Map card names the tile (the footer's
  // position readout said it until feedback F59 took the readout out).
  assert.match(stdout.lastWrite, /Open ground/, "the cursor is not on open ground")
  assert.match(stdout.lastWrite, /21,9/, "the split arrow did not move the cursor up one tile")
})

test("a right click never leaves the screen", async () => {
  const { exits } = await spikeSession((input) => {
    input.emit("data", Buffer.from(`${ESC}[<2;10;10M`))
  })
  assert.deepEqual(exits, [], "a right click ended the session")
})

test("SIGINT and SIGTERM reach the same disposer", async () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const { stdout, stdin, exits } = await spikeSession(() => {
      process.emit(signal)
    })
    assert.deepEqual(exits, [0], `${signal} did not end the session`)
    assert.equal(stdin.raw, false, `${signal} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${signal} left mouse reporting on`)
  }
})

test("below the floor the screen gates, and resizing back above it restores the Grid", async () => {
  const { stdout } = await spikeSession((input, output) => {
    output.columns = 79
    output.emit("resize")
    assert.ok(output.lastWrite.includes("TERMINAL TOO SMALL"), "79 columns did not gate")
    assert.ok(
      !output.lastWrite.includes("Explore Map"),
      "the gated frame still drew the Build Phase behind it",
    )
    // Keys do nothing while gated — there is no screen to act on.
    input.emit("data", Buffer.from("1"))
    assert.ok(output.lastWrite.includes("TERMINAL TOO SMALL"), "a key redrew past the gate")
    output.columns = 80
    output.emit("resize")
  })
  assert.ok(stdout.lastWrite.includes("Explore Map"), "resizing back did not restore the screen")
  // The frame's top border is as wide as the composition, 31 columns plus the viewport's 49 tiles.
  assert.ok(stdout.lastWrite.includes(BORDER_AT_80), "the viewport did not come back")
})

/** The top border's run of dashes at 80 columns (a 49-tile viewport) and at 104 (the maximum, 72).
 *  The footer's position readout said the viewport until feedback F59 took the readout out. */
const BORDER_AT_80 = `+${"-".repeat(78)}+`
const BORDER_AT_104 = `+${"-".repeat(101)}+`

test("a bigger terminal shows a bigger viewport, and the frame is cleared when its size changes", async () => {
  const { stdout } = await spikeSession((_input, output) => {
    assert.ok(output.lastWrite.includes(BORDER_AT_80), "did not start at the 80-column viewport")
    output.columns = 104
    output.rows = 32
    output.emit("resize")
  })
  assert.ok(stdout.lastWrite.includes(BORDER_AT_104), "growing the terminal did not grow the viewport")
  assert.ok(
    stdout.written.includes(`${ESC}[2J`),
    "a frame that changed size was drawn over the old one without clearing it",
  )
})

test("--keys opens the Build Phase already in the state those keys reach, then hands over the keyboard", async () => {
  // Owner, 2026-09-29 (feedback F28/F40): demos and reports should start in a particular state. The
  // keys go through the same adapters as a player's, before the first frame.
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  const session = runSpike({
    settings: TEST_SETTINGS,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
    startKeys: parseKeyScript("n 1 1 Enter"),
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.ok(stdout.written.includes("Barracks placed"), "the start keys did not place the Barracks")
  assert.ok(stdout.written.includes("1 active"), "the start keys did not pick the power")
  // The keyboard is the player's now: Ctrl+C still leaves through the one disposer.
  stdin.emit("data", Buffer.from([3]))
  await new Promise((resolve) => setTimeout(resolve, 30))
  void session
  assert.deepEqual(exits, [0])
  assert.equal(stdin.raw, false)
})

test("--keys that cannot be delivered stops there and says why when the screen closes", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const reported: string[] = []
  const session = runSpike({
    settings: TEST_SETTINGS,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    host: { onInterrupt: () => () => {}, exit: () => {}, reportError: (text) => reported.push(text) },
    startKeys: parseKeyScript("click:95,39 n"),
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.ok(!stdout.written.includes("1 active"), "a step after the failed one ran")
  assert.ok(stdout.written.includes("Explore Map"), "the screen did not open")
  stdin.emit("data", Buffer.from([3]))
  await session
  assert.ok(reported.some((text) => text.includes("--keys stopped early") && text.includes("95,39")), reported.join(""))
})

// ---------------------------------------------------------------------------------------------
// Gate 6A: the Nexus Pulse in the live loop
// ---------------------------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** A plan that wins against the probe (`PROBE_PULSE`, which each run below asks for — the game defaults
 *  to a heavy raid): a Nexus power, two Turrets and a Hatchery, the commit and its yes. */
const WINNING_PLAN = `${DEFENCE_KEYS} s s`

test("the live loop plays a Nexus Pulse on its own clock: timer, last seconds, result, then idle — and starts over on Restart", async () => {
  let t = 5_000
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  void runSpike({
    settings: TEST_SETTINGS,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
    now: () => t,
    startKeys: parseKeyScript(WINNING_PLAN),
    experiments: PROBE_PULSE,
  })
  await sleep(80)
  // Opened already in the Pulse the start keys committed, at its very beginning — however many seconds of
  // script clock the keys took, the live clock started the Pulse at zero.
  assert.equal(timerAt(stdout.lastWrite), "0:15", "the Pulse did not open at zero")
  assert.match(stdout.lastWrite, /nexus pulse/)

  t += 6_000
  await sleep(80)
  assert.equal(timerAt(stdout.lastWrite), "0:09", "the Pulse did not follow the screen's clock")

  // The last seconds, in the run-up to the stop (the Pulse ends near 14.6 s and the warning is three seconds).
  t += 6_000
  await sleep(80)
  assert.match(stdout.lastWrite, /about to end/, "no warning before the fight stopped")

  // The result stands, in words a viewer can read without being told.
  t += 8_000
  await sleep(80)
  assert.match(stdout.lastWrite, /VICTORY/)
  assert.match(stdout.lastWrite, /came home/)

  // And the screen goes idle: a standing result draws nothing more, so the terminal is left alone.
  const size = stdout.written.length
  await sleep(150)
  assert.equal(stdout.written.length, size, "the frame timer kept running over a standing result")

  // Esc, then Restart: the Build Phase again, fresh.
  stdin.emit("data", Buffer.from(ESC))
  await sleep(AFTER_ESC_TIMEOUT_MS)
  stdin.emit("data", Buffer.from("r"))
  await sleep(80)
  assert.match(stdout.lastWrite, /Explore Map/, "restarting did not bring the Build Phase back")
  assert.doesNotMatch(stdout.lastWrite, /VICTORY/)

  stdin.emit("data", Buffer.from([3]))
  await sleep(50)
  assert.deepEqual(exits, [0])
  assert.equal(stdin.raw, false)
})

test("a Nexus Pulse holds still behind the resize gate and resumes from the same instant", async () => {
  let t = 5_000
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  void runSpike({
    settings: TEST_SETTINGS,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
    now: () => t,
    startKeys: parseKeyScript(WINNING_PLAN),
    experiments: PROBE_PULSE,
  })
  await sleep(60)
  t += 3_000
  await sleep(60)
  assert.equal(timerAt(stdout.lastWrite), "0:12")

  stdout.columns = 60
  stdout.emit("resize")
  await sleep(40)
  assert.match(stdout.lastWrite, /TERMINAL TOO SMALL/)
  t += 20_000 // a long time passes behind the gate
  await sleep(60)
  stdout.columns = 80
  stdout.emit("resize")
  await sleep(60)
  assert.equal(timerAt(stdout.lastWrite), "0:12", "the Pulse ran on behind the gate")
  stdin.emit("data", Buffer.from([3]))
  await sleep(30)
})
