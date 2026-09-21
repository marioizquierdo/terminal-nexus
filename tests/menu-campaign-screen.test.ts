// Campaign's placeholder screen — Gate 3C. Milestone 4 doesn't exist yet, so pressing Campaign no
// longer pins a notice to the top-level menu (Gate 3A's own shape): it leaves for a real second
// screen, built out of the exact same list/session/view machinery Gate 3B's Settings screen already
// proved. What's new here is smaller than Settings was — one row, Back — so what's worth proving is
// narrower too: the screen is genuinely reached and left, Esc works exactly like Settings' own Esc
// does, and a hotkey crossing into this *third* screen in the same stdin chunk as a second keystroke
// still routes that second keystroke correctly (Gate 3B's own cross-screen fix, now exercised on a
// screen it was never written against).

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { runMenu, TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings, SettingsStore } from "../src/settings/index.ts"

const ESC = String.fromCharCode(27)

const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "color16" }

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
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
  setRawMode(value: boolean): this {
    this.raw = value
    return this
  }
  resume(): this {
    return this
  }
  pause(): this {
    return this
  }
}

function noopSettingsStore(): SettingsStore {
  return { load: async () => null, save: async () => {} }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

const CAMPAIGN_HOTKEY: string = required(
  TOP_LEVEL_ITEMS.find((item) => item.id === "campaign")?.hotkey,
  "no item named campaign exists on the top-level menu",
)

/** Runs a session, enters Campaign's placeholder screen by its own hotkey, drives it with raw bytes,
 *  and returns the last frame drawn. A fresh session per call, the same shape
 *  tests/menu-settings-screen.test.ts uses for the identical reason. */
async function campaignFrameAfter(drive: (stdin: FakeStdin) => void): Promise<string> {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runMenu({
    settings: TEST_SETTINGS,
    settingsStore: noopSettingsStore(),
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })
  await wait(30)
  stdin.emit("data", Buffer.from(CAMPAIGN_HOTKEY))
  await wait(10)
  drive(stdin)
  await wait(30)
  const result = stdout.lastWrite
  stdin.emit("data", Buffer.from("q"))
  await wait(30)
  void session
  return result
}

test("Campaign's placeholder screen shows its own message and a way back, not the top-level menu", async () => {
  const text = await campaignFrameAfter(() => {})
  assert.ok(text.includes("Campaign is not built yet"), "the placeholder message is not on screen")
  assert.ok(text.includes("[1] Back"), "Back's own hotkey is not displayed - it would not exist")
  assert.ok(!text.includes("[4] Exit"), "the top-level menu's own items are still on screen")
})

test("the Back row's hotkey returns to the top-level menu", async () => {
  const text = await campaignFrameAfter((stdin) => stdin.emit("data", Buffer.from("1")))
  assert.ok(text.includes("top-level menu"), "Back did not return to the top-level menu")
  assert.ok(!text.includes("Campaign is not built yet"), "the placeholder screen is still on screen after Back")
})

test("Esc also returns to the top-level menu — the same redundant path Settings already has", async () => {
  const text = await campaignFrameAfter((stdin) => stdin.emit("data", Buffer.from(ESC)))
  assert.ok(text.includes("top-level menu"), "Esc did not return to the top-level menu")
})

test("a hotkey crossing into Campaign and a second key right behind it, in one chunk, both land correctly", async () => {
  // The exact shape Gate 3B's own cross-screen fix was built for, now driven at a *third* screen:
  // "1" enters Campaign, "1" again is Campaign's own Back - one Buffer, one "data" event.
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runMenu({
    settings: TEST_SETTINGS,
    settingsStore: noopSettingsStore(),
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })
  await wait(30)
  stdin.emit("data", Buffer.from(`${CAMPAIGN_HOTKEY}1`))
  await wait(30)

  assert.ok(
    stdout.lastWrite.includes("top-level menu"),
    "the second key was not routed to Campaign's own Back row at all",
  )
  assert.ok(
    !stdout.lastWrite.includes("Campaign is not built yet"),
    "the second key landed on the screen the player had already left, not the one they were on",
  )
  stdin.emit("data", Buffer.from("q"))
  await wait(30)
  void session
})
