// `runMenu`'s lifecycle — engine.md 10.1: one idempotent disposer, reached from `q`, an interrupt
// byte, SIGINT, SIGTERM, the menu's own Exit item, and a caught render failure alike, and it leaves
// mouse reporting off (alongside raw mode and the alternate screen) on every one of those paths.
// Follows the exact fake-stdin pattern `tests/lifecycle.test.ts` uses for `grid watch`.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { runMenu, TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { MOUSE_REPORTING_OFF, MOUSE_REPORTING_ON } from "../src/menu/mouse.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings, SettingsStore } from "../src/settings/index.ts"

const ESC = String.fromCharCode(27)

/** A settings screen exists (tests/menu-settings.test.ts covers it); these lifecycle tests only need
 *  *some* legal starting settings and a store that never actually touches a disk. */
const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "monochrome" }

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
   *  from what's on screen right now (menu-settings-screen.test.ts hit this first). */
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

test("activating Challenge, a dimmed stub, shows a notice and does not quit or change screen", async () => {
  const challenge = TOP_LEVEL_ITEMS.find((item) => item.id === "challenge")
  assert.ok(challenge)
  assert.equal(challenge!.disabled, true, "Challenge is no longer marked disabled")
  const { stdout, exits } = await menuSession((input) => {
    input.emit("data", Buffer.from(challenge!.hotkey))
  })
  assert.deepEqual(exits, [], "a stub option should not exit the application")
  assert.ok(stdout.written.includes("not built yet"), "no honest stub notice was ever drawn")
  assert.ok(stdout.written.includes("top-level menu"), "activating a dimmed stub left the top-level menu")
})

test("activating Campaign leaves the top-level menu for its own placeholder screen", async () => {
  const campaign = TOP_LEVEL_ITEMS.find((item) => item.id === "campaign")
  assert.ok(campaign)
  assert.notEqual(campaign!.disabled, true, "Campaign should not be a dimmed stub - it gets a real screen")
  const { stdout, exits } = await menuSession((input) => {
    input.emit("data", Buffer.from(campaign!.hotkey))
  })
  assert.deepEqual(exits, [], "a placeholder screen should not exit the application")
  assert.ok(stdout.written.includes("Campaign is not built yet"), "no honest placeholder message was ever drawn")
  assert.ok(stdout.written.includes("campaign"), "the subtitle never switched away from the top-level menu")
  assert.ok(stdout.written.includes("Back"), "the placeholder screen has no way back")
  // The top-level menu's own other items are gone from the *current* frame - this is a different
  // screen, not a notice pinned to the one the player was already looking at. (`written`'s full
  // history still has them, from the very first frame drawn before any key was pressed at all.)
  assert.ok(!stdout.lastWrite.includes("[4] Exit"), "the top-level menu's own items are still on screen")
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
