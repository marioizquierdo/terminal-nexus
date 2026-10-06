// `runBuildPhase`'s lifecycle — the terminal lifecycle RULE (docs/system-design/runtime.md), applied to the Build Phase screen. The same fake
// stdin/stdout pattern `tests/lifecycle-title-menu.test.ts` and `tests/lifecycle-backend.test.ts` already use, and
// the same non-negotiables: one idempotent disposer reached from `q`, an interrupt byte, Esc with
// nothing armed, SIGINT and SIGTERM alike; raw mode, the alternate screen and mouse reporting all
// left off on every one of those paths.
//
// What is new here, and what the menu never had to answer: this screen's frame *changes size* with
// the terminal, so resizing is not only a gate question but a redraw question.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { defaultExperiments } from "../src/build/experiments.ts"
import { TUNING } from "../src/build/tuning.ts"
import { PROCESS_HOST } from "../src/cli/lifecycle.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../src/title-menu/mouse.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { AnsiBackend } from "../src/view/backends/ansi.ts"
import { KEYBOARD_POP, KEYBOARD_PUSH, KEYBOARD_QUERY } from "../src/terminal/key-events.ts"
import type { Settings } from "../src/settings/index.ts"
import { ESC } from "./build-helpers.ts"
import { DEFENCE_KEYS } from "./pulse-helpers.ts"


/** The title row's clock, whatever styling sits between the words and the time. */
const timerAt = (write: string): string | undefined => new RegExp(`BATTLE ROUND 1(?:${ESC}\\[[0-9;]*m)* +(\\d:\\d\\d)`).exec(write)?.[1]

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

async function starterSession(
  end: (stdin: FakeStdin, stdout: FakeStdout) => void,
  settleMs = 30,
): Promise<{ stdout: FakeStdout; stdin: FakeStdin; exits: number[] }> {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []

  const session = runBuildPhase({
    settings: TEST_SETTINGS,
    scenes: false,
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
  const { stdout, stdin } = await starterSession(() => {})
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
    const { stdout, stdin, exits } = await starterSession((input) => {
      for (const read of reads) input.emit("data", read)
    })
    assert.deepEqual(exits, [0], `${name} did not end the session`)
    assert.equal(stdin.raw, false, `${name} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(`${ESC}[?1049l`), `${name} did not leave the alternate screen`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${name} left mouse reporting on`)
  }
})

test("a lone q or Esc only asks — it never leaves the screen by itself", async () => {
  // docs/system-design/input.md: Esc "never quits the game by itself"; since the exit question, neither does q —
  // both open the game menu (Settings, Quit) now.
  for (const key of ["q", ESC]) {
    const { stdout, exits } = await starterSession((input) => {
      input.emit("data", Buffer.from(key))
    }, AFTER_ESC_TIMEOUT_MS)
    assert.deepEqual(exits, [], `${JSON.stringify(key)} left without asking`)
    assert.ok(stdout.lastWrite.includes("Controls and hotkeys"), "the game menu was not drawn")
  }
})

test("Esc with something armed disarms instead of leaving", async () => {
  const { stdout, exits } = await starterSession((input) => {
    input.emit("data", Buffer.from("1"))
    input.emit("data", Buffer.from(ESC))
  }, AFTER_ESC_TIMEOUT_MS)
  assert.deepEqual(exits, [], "Esc quit while a structure was armed")
  assert.ok(stdout.lastWrite.includes("Cancelled"), "Esc did not disarm")
})

test("a lone Esc waits a moment for the rest of a key: Esc then [A in the next read is one Up arrow", async () => {
  // An arrow split across two reads (a slow link) used to arrive as Esc and then two stray
  // characters. Within the timeout the two reads are joined and are the one key they always were.
  const { stdout, exits } = await starterSession((input) => {
    input.emit("data", Buffer.from("e")) // explore, so the arrow moves the map cursor
    input.emit("data", Buffer.from(ESC))
    input.emit("data", Buffer.from("[A"))
  }, AFTER_ESC_TIMEOUT_MS + TUNING.cardRevealMs) // and the card's reveal, typed out
  assert.deepEqual(exits, [])
  // Explore Map put the cursor on clear ground, a free column right of the Nexus (21,10), and the arrow moved it up one tile: the Explore Map card names the tile. Read from everything
  // written, since the hand-off to the map may still be redrawing only the cells it changes.
  assert.match(stdout.written, /Open ground/, "the cursor is not on open ground")
  assert.match(stdout.written, /21,9/, "the split arrow did not move the cursor up one tile")
})

test("a right click never leaves the screen", async () => {
  const { exits } = await starterSession((input) => {
    input.emit("data", Buffer.from(`${ESC}[<2;10;10M`))
  })
  assert.deepEqual(exits, [], "a right click ended the session")
})

test("SIGINT and SIGTERM reach the same disposer", async () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const { stdout, stdin, exits } = await starterSession(() => {
      process.emit(signal)
    })
    assert.deepEqual(exits, [0], `${signal} did not end the session`)
    assert.equal(stdin.raw, false, `${signal} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${signal} left mouse reporting on`)
  }
})

test("below the floor the screen gates, and resizing back above it restores the Grid", async () => {
  const { stdout } = await starterSession((input, output) => {
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
 *  The footer's position readout once said the viewport; the readout is gone. */
const BORDER_AT_80 = `+${"-".repeat(78)}+`
const BORDER_AT_104 = `+${"-".repeat(101)}+`

test("a bigger terminal shows a bigger viewport, and the frame is cleared when its size changes", async () => {
  const { stdout } = await starterSession((_input, output) => {
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
  // Owner, 2026-09-29: demos and reports should start in a particular state. The
  // keys go through the same adapters as a player's, before the first frame.
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  const session = runBuildPhase({
    settings: TEST_SETTINGS,
    scenes: false,
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
  const session = runBuildPhase({
    settings: TEST_SETTINGS,
    scenes: false,
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
// The Nexus Pulse in the live loop
// ---------------------------------------------------------------------------------------------

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** A plan that wins PERIMETER's first round: a Nexus power, two Turrets and a Hatchery, the commit and its
 *  yes. */
const WINNING_PLAN = `${DEFENCE_KEYS} s s`

test("the live loop plays a Nexus Pulse on its own clock: timer, last seconds, result, then idle — and starts over on Restart", async () => {
  let t = 5_000
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  void runBuildPhase({
    settings: TEST_SETTINGS,
    scenes: false,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
    now: () => t,
    startKeys: parseKeyScript(WINNING_PLAN),
  })
  await sleep(80)
  // Opened already in the Pulse the start keys committed, at its very beginning — however many seconds of
  // script clock the keys took, the live clock started the Pulse at zero.
  assert.equal(timerAt(stdout.lastWrite), "0:13", "the Pulse did not open at zero")
  assert.match(stdout.lastWrite, /battle round/)

  t += 3_000
  await sleep(80)
  assert.equal(timerAt(stdout.lastWrite), "0:10", "the Pulse did not follow the screen's clock")

  // The last seconds, in the run-up to the stop (PERIMETER's first round ends near 12.2 s with this plan,
  // Vasse in the squads, the squads holding the line and the Barracks's wave beside them five seconds in, and
  // the warning is three seconds).
  t += 8_000
  await sleep(80)
  assert.match(stdout.lastWrite, /about to end/, "no warning before the fight stopped")

  // The result stands, in words a viewer can read without being told.
  t += 9_000
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
  void runBuildPhase({
    settings: TEST_SETTINGS,
    scenes: false,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
    now: () => t,
    startKeys: parseKeyScript(WINNING_PLAN),
  })
  await sleep(60)
  t += 3_000
  await sleep(60)
  assert.equal(timerAt(stdout.lastWrite), "0:10")

  stdout.columns = 60
  stdout.emit("resize")
  await sleep(40)
  assert.match(stdout.lastWrite, /TERMINAL TOO SMALL/)
  t += 20_000 // a long time passes behind the gate
  await sleep(60)
  stdout.columns = 80
  stdout.emit("resize")
  await sleep(60)
  assert.equal(timerAt(stdout.lastWrite), "0:10", "the Pulse ran on behind the gate")
  stdin.emit("data", Buffer.from([3]))
  await sleep(30)
})

// ---------------------------------------------------------------------------------------------
// Key releases, where the terminal reports them (the owner's third round of movement feedback)
// ---------------------------------------------------------------------------------------------

/** A terminal that answers the keyboard question the way one speaking the kitty protocol does (its
 *  flags, then Device Attributes), or one that only answers Device Attributes, or one that says nothing. */
type Answers = "kitty" | "attributes-only" | "silent"

class AnsweringStdout extends FakeStdout {
  private readonly input: FakeStdin
  private readonly answers: Answers
  constructor(input: FakeStdin, answers: Answers) {
    super()
    this.input = input
    this.answers = answers
  }
  override write(text: string): boolean {
    super.write(text)
    if (text.includes(KEYBOARD_QUERY) && this.answers !== "silent") {
      const reply = this.answers === "kitty" ? `${ESC}[?0u${ESC}[?62;22c` : `${ESC}[?62;22c`
      setImmediate(() => this.input.emit("data", Buffer.from(reply)))
    }
    return true
  }
}

const count = (text: string, part: string): number => text.split(part).length - 1

type KeyboardRun = Readonly<{ stdout: AnsweringStdout; stdin: FakeStdin; exits: number[]; session: Promise<number>; failure: { now: boolean } }>

/** The Build Phase on a terminal that answers as told. The ANSI backend is wrapped so a frame can be
 *  made to throw on demand (`failure.now`), and `startFails` makes its start throw. */
async function keyboardRun(answers: Answers, options: { keyReleases?: "auto" | "off"; startFails?: boolean } = {}): Promise<KeyboardRun> {
  const stdin = new FakeStdin()
  const stdout = new AnsweringStdout(stdin, answers)
  const exits: number[] = []
  const failure = { now: false }
  const inner = new AnsiBackend({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    capability: "monochrome",
  })
  const session = runBuildPhase({
    settings: TEST_SETTINGS,
    scenes: false,
    backend: {
      name: "flaky",
      start: async () => {
        await inner.start()
        if (options.startFails === true) throw new Error("no terminal after all")
      },
      present: (frame) => {
        if (failure.now) throw new Error("a frame failed")
        inner.present(frame)
      },
      stop: () => inner.stop(),
    },
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    host: {
      onInterrupt: PROCESS_HOST.onInterrupt,
      exit: (code) => {
        exits.push(code)
      },
      reportError: () => {},
    },
    ...(options.keyReleases === undefined ? {} : { experiments: { keyReleases: options.keyReleases } }),
  })
  await sleep(30)
  return { stdout, stdin, exits, session, failure }
}

/** The flags were pushed, and popped as often as pushed, the last pop after the last push and before
 *  the alternate screen was left. */
function assertPoppedAfterPush(written: string, path: string): void {
  assert.ok(written.includes(KEYBOARD_PUSH), `${path}: the flags were never pushed`)
  assert.equal(count(written, KEYBOARD_POP), count(written, KEYBOARD_PUSH), `${path}: pushed and popped a different number of times`)
  assert.ok(written.lastIndexOf(KEYBOARD_POP) > written.lastIndexOf(KEYBOARD_PUSH), `${path}: the last push was never popped`)
  assert.ok(written.lastIndexOf(KEYBOARD_POP) < written.lastIndexOf(`${ESC}[?1049l`), `${path}: popped after leaving the alternate screen`)
}

test("on auto the screen asks, pushes the key-event flags when the terminal answers, and pops them on every way out", async () => {
  const paths: readonly (readonly [string, (run: KeyboardRun) => void])[] = [
    [
      "q q",
      (run) => {
        run.stdin.emit("data", Buffer.from("q"))
        run.stdin.emit("data", Buffer.from("q"))
      },
    ],
    ["Ctrl+C in the protocol's form", (run) => run.stdin.emit("data", Buffer.from(`${ESC}[99;5u`))],
    ["a classic Ctrl+C byte", (run) => run.stdin.emit("data", Buffer.from([3]))],
    [
      "Esc in the protocol's form, then q",
      (run) => {
        run.stdin.emit("data", Buffer.from(`${ESC}[27u`))
        run.stdin.emit("data", Buffer.from("q"))
      },
    ],
    ["SIGINT", () => process.emit("SIGINT")],
    ["SIGTERM", () => process.emit("SIGTERM")],
    [
      "a caught render failure",
      (run) => {
        run.failure.now = true
        run.stdin.emit("data", Buffer.from("n"))
      },
    ],
  ]
  for (const [path, end] of paths) {
    const run = await keyboardRun("kitty")
    assert.ok(run.stdout.written.includes(KEYBOARD_QUERY), `${path}: the screen never asked`)
    assert.ok(run.stdout.written.includes(KEYBOARD_PUSH), `${path}: the answer did not push the flags`)
    end(run)
    await sleep(30)
    assert.deepEqual(run.exits, [0], `${path} did not end the session`)
    assert.equal(run.stdin.raw, false, `${path} left raw mode on`)
    assertPoppedAfterPush(run.stdout.written, path)
  }
})

test("a terminal that answers only Device Attributes, or nothing at all, is never pushed, and nothing is popped", async () => {
  for (const answers of ["attributes-only", "silent"] as const) {
    const run = await keyboardRun(answers)
    assert.ok(run.stdout.written.includes(KEYBOARD_QUERY), `${answers}: the screen never asked`)
    run.stdin.emit("data", Buffer.from([3]))
    await sleep(30)
    assert.deepEqual(run.exits, [0])
    assert.ok(!run.stdout.written.includes(KEYBOARD_PUSH), `${answers}: pushed flags nobody offered`)
    assert.ok(!run.stdout.written.includes(KEYBOARD_POP), `${answers}: popped flags it never pushed`)
  }
})

test("with Key releases off nothing is asked; switched in Settings, the flags are pushed and popped at once", async () => {
  const off = await keyboardRun("kitty", { keyReleases: "off" })
  assert.ok(!off.stdout.written.includes(KEYBOARD_QUERY), "asked with the Experiment off")
  // `d` opens the Experiments at the hold window; Key releases is the row below. Right steps it to auto.
  off.stdin.emit("data", Buffer.from("d"))
  off.stdin.emit("data", Buffer.from(`${ESC}[B`))
  off.stdin.emit("data", Buffer.from(`${ESC}[C`))
  await sleep(10)
  assert.ok(off.stdout.written.includes(KEYBOARD_PUSH), "switching to auto did not ask and push")
  // And back off: popped at once, before anything else happens.
  const before = count(off.stdout.written, KEYBOARD_POP)
  off.stdin.emit("data", Buffer.from(`${ESC}[C`))
  assert.equal(count(off.stdout.written, KEYBOARD_POP), before + 1, "switching off did not pop the flags")
  off.stdin.emit("data", Buffer.from([3]))
  await sleep(30)
  assert.deepEqual(off.exits, [0])
  assert.equal(count(off.stdout.written, KEYBOARD_POP), count(off.stdout.written, KEYBOARD_PUSH), "left with the flags pushed")
})

test("a setup failure asks nothing and pops nothing, and still restores the terminal", async () => {
  const run = await keyboardRun("kitty", { startFails: true })
  assert.equal(await run.session, 1)
  assert.ok(!run.stdout.written.includes(KEYBOARD_PUSH))
  assert.ok(!run.stdout.written.includes(KEYBOARD_POP))
  assert.equal(run.stdin.raw, false)
  assert.ok(run.stdout.written.includes(`${ESC}[?1049l`), "the alternate screen was not left")
})

test("with the protocol on, Esc arrives whole: the game menu opens at once, with no wait for the rest of a key", async () => {
  const run = await keyboardRun("kitty")
  run.stdin.emit("data", Buffer.from(`${ESC}[27u`))
  assert.ok(run.stdout.lastWrite.includes("Controls and hotkeys"), "Esc waited for the rest of a sequence")
  // A classic Esc, by contrast, waits a moment: it could still be the start of an arrow.
  const classic = await keyboardRun("silent")
  classic.stdin.emit("data", Buffer.from(ESC))
  assert.ok(!classic.stdout.lastWrite.includes("Controls and hotkeys"), "a classic Esc did not wait")
  await sleep(AFTER_ESC_TIMEOUT_MS)
  assert.ok(classic.stdout.lastWrite.includes("Controls and hotkeys"), "a classic Esc never counted")
  for (const each of [run, classic]) each.stdin.emit("data", Buffer.from([3]))
  await sleep(30)
})
