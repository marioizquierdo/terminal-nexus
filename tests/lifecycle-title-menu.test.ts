// `runMenu`'s lifecycle — docs/system-design/runtime.md, "Terminal lifecycle": one idempotent disposer, reached from `q`, an interrupt
// byte, SIGINT, SIGTERM, the menu's own Exit item, and a caught render failure alike, and it leaves
// mouse reporting off (alongside raw mode and the alternate screen) on every one of those paths.
// Follows the exact fake-stdin pattern `tests/lifecycle-backend.test.ts` uses.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { runMenu, TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../src/title-menu/mouse.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings, SettingsStore } from "../src/settings/index.ts"

const ESC = String.fromCharCode(27)

/** A settings screen exists (tests/title-menu-settings.test.ts covers it); these lifecycle tests only need
 *  *some* legal starting settings and a store that never actually touches a disk. */
const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, colors: "monochrome" }

function noopSettingsStore(): SettingsStore {
  return {
    load: async () => null,
    save: async () => {},
  }
}

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  /** Just the most recent write — `written`'s cumulative history never loses an earlier screen's
   *  text even once a later frame has genuinely replaced it, so it cannot prove something is *absent*
   *  from what's on screen right now (title-menu-settings-screen.test.ts hit this first). */
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

function fakes(): { stdout: FakeStdout; stdin: FakeStdin } {
  return { stdout: new FakeStdout(), stdin: new FakeStdin() }
}

async function menuSession(
  end: (stdin: FakeStdin) => void,
): Promise<{ stdout: FakeStdout; stdin: FakeStdin; exits: number[] }> {
  const { stdout, stdin } = fakes()
  const exits: number[] = []

  const session = runMenu({
    settings: TEST_SETTINGS,
    settingsStore: noopSettingsStore(),
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 30))
  end(stdin)
  await new Promise((resolve) => setTimeout(resolve, 30))
  void session
  return { stdout, stdin, exits }
}

test("launching enters the alternate screen, raw mode, and turns mouse reporting on", async () => {
  const { stdout, stdin } = await menuSession(() => {})
  assert.ok(stdout.written.includes(`${ESC}[?1049h`), "never entered the alternate screen")
  assert.ok(stdout.written.includes(`${ESC}[?25l`), "never hid the cursor")
  assert.equal(stdin.raw, true, "never entered raw mode")
  assert.ok(stdout.written.includes(MOUSE_REPORTING_ON), "never turned mouse reporting on")
})

test("q runs the disposer exactly once and leaves mouse reporting off, alongside raw mode", async () => {
  const { stdout, stdin, exits } = await menuSession((input) => {
    input.emit("data", Buffer.from("q"))
  })
  assert.deepEqual(exits, [0])
  assert.equal(stdin.raw, false, "q left the terminal in raw mode")
  assert.ok(stdout.written.includes(`${ESC}[?1049l`), "q did not leave the alternate screen")
  assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), "q left mouse reporting on")
})

test("an interrupt byte in raw mode quits the same way q does", async () => {
  const { stdin, exits } = await menuSession((input) => {
    input.emit("data", Buffer.from([3]))
  })
  assert.deepEqual(exits, [0])
  assert.equal(stdin.raw, false)
})

test("SIGINT and SIGTERM reach the same disposer as q", async () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const { stdout, stdin, exits } = await menuSession(() => {
      process.emit(signal)
    })
    assert.deepEqual(exits, [0], `${signal} did not end the session`)
    assert.equal(stdin.raw, false, `${signal} left the terminal in raw mode`)
    assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), `${signal} left mouse reporting on`)
  }
})

test("activating the menu's own Exit item — by its hotkey — reaches the same disposer", async () => {
  const exitItem = TOP_LEVEL_ITEMS.find((item) => item.id === "exit")
  assert.ok(exitItem, "no item named exit exists on the top-level menu")
  const { stdout, stdin, exits } = await menuSession((input) => {
    input.emit("data", Buffer.from(exitItem!.hotkey))
  })
  assert.deepEqual(exits, [0], "the Exit item's hotkey did not quit")
  assert.equal(stdin.raw, false)
  assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF))
})

// Re-pinned from Challenge, which started a run, on Skirmish, whose New game starts one battle the same way: Skirmish,
// New game, and Enter on Start, where it opens.
test("Skirmish, New game and Enter leave the menu without quitting and open a battle on the defaults, on a seed from the clock", async () => {
  const challenge = TOP_LEVEL_ITEMS.find((item) => item.id === "skirmish")
  assert.ok(challenge)
  assert.notEqual(challenge!.disabled, true, "Skirmish is a dimmed stub")
  assert.equal(challenge!.label, "Skirmish")
  assert.equal(challenge!.hotkey, "1", "Skirmish is the title menu's first row")
  const { stdout, stdin } = fakes()
  const exits: number[] = []
  const opened: string[] = []
  const session = runMenu({
    settings: TEST_SETTINGS,
    settingsStore: noopSettingsStore(),
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
    // A clock at 1,234,567,890 ms: the battle's seed is its last six digits.
    now: () => 1_234_567_890,
    open: async (at) => {
      opened.push(at.level.route ?? at.level.id)
      return 7
    },
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  stdin.emit("data", Buffer.from(challenge!.hotkey))
  stdin.emit("data", Buffer.from("1"))
  stdin.emit("data", Buffer.from("\r"))
  // What the battle's screen returns is what the menu returns.
  assert.equal(await session, 7)
  // The setup screen's defaults: its opponent is the steady profile, which the route names, so the battle reopens the same.
  assert.deepEqual(opened, ["skirmish?seed=567890&p2=script:steady"])
  assert.deepEqual(exits, [], "choosing Skirmish exited the application")
  // The menu's own disposer ran before the battle opened: raw mode, the alternate screen and mouse reporting all off.
  assert.equal(stdin.raw, false)
  assert.ok(stdout.written.includes(`${ESC}[?1049l`), "the menu never left the alternate screen")
  assert.ok(stdout.written.includes(MOUSE_REPORTING_OFF), "the menu left mouse reporting on")
})

test("the top-level menu has no Story row: Story waits until Skirmish is solid", async () => {
  // The owner, 2026-11-26: Story stops; it returns as a scripting layer over a Skirmish.
  assert.deepEqual(TOP_LEVEL_ITEMS.map((item) => item.label), ["Skirmish", "Settings", "About", "Exit"])
  const { stdout } = await menuSession(() => {})
  assert.ok(!stdout.written.includes("Story"), "Story is drawn on the title menu")
})

test("a non-TTY launch prints one line and no escape sequences, and needs no signal to end", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  stdout.isTTY = false
  stdin.isTTY = false
  const status = await runMenu({
    settings: TEST_SETTINGS,
    settingsStore: noopSettingsStore(),
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
  })
  assert.equal(status, 0)
  assert.doesNotMatch(stdout.written, new RegExp(ESC), "a non-TTY launch emitted an escape sequence")
  assert.equal(stdout.written.trim().split("\n").length, 1, "a non-TTY launch printed more than one line")
})

test("a render failure is caught, still disposes, and reports failure", async () => {
  const { stdout, stdin } = fakes()
  let frames = 0
  stdout.write = (text: string): boolean => {
    stdout.written += text
    frames += 1
    // Write 1 is backend.start()'s escapes, write 2 turns mouse reporting on — write 3 is the first
    // actual composeMenuFrame/present() call, which is what "a render failure" means here.
    if (frames === 3) throw new Error("render exploded")
    return true
  }

  const status = await runMenu({
    settings: TEST_SETTINGS,
    settingsStore: noopSettingsStore(),
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })

  assert.equal(status, 1, "a caught render failure should report a failure")
  assert.equal(stdin.raw, false, "a render failure left the terminal in raw mode")
})

test("the disposer is idempotent: quitting twice in the same tick writes no extra escapes", async () => {
  const { stdout, stdin, exits } = await menuSession((input) => {
    input.emit("data", Buffer.from("q"))
    input.emit("data", Buffer.from("q"))
  })
  assert.deepEqual(exits, [0], "a repeated quit key exited more than once")
  assert.equal(stdin.raw, false)
  void stdout
})
