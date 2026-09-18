// The Settings screen — Gate 3B. Reuses gate 3A's exact fake-stdin pattern and its equivalence-test
// shape: a raw hotkey, raw arrow-then-Enter, and a raw mouse click at the row's own rendered position
// must all cycle the identical row to the identical next value, not merely agree once something has
// already decoded it (engine.md 9.7). Also covers what is genuinely new here: a second screen reached
// through the first, going back two ways, a change taking effect on the very next frame, and a value
// actually surviving a stop-and-restart.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runMenu, settingsItems, TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import { composeMenuFrame, MENU_LAYOUT } from "../src/view/menu.ts"
import { createMenuList } from "../src/menu/list.ts"
import { menuItemLabel, menuItemRow } from "../src/menu/layout.ts"
import { frameToText } from "../src/view/index.ts"
import { createSettingsStore } from "../src/settings/store.ts"
import { DEFAULT_SETTINGS, nextCapability, nextGlyphPack, nextTheme, toggleReducedMotion } from "../src/settings/types.ts"
import type { Settings, SettingsStore } from "../src/settings/index.ts"

const ESC = String.fromCharCode(27)
const ARROW_DOWN = `${ESC}[B`

const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "color16" }

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
  written = ""
  /** Just the most recent write — a coloured frame is one `write()` call carrying the *whole*
   *  screen (`AnsiBackend.present`), so this is "what the terminal shows right now," unlike
   *  `written`'s full history of everything ever sent. Checking the cumulative log for the
   *  *absence* of something would be unsound: an earlier screen's text never disappears from it,
   *  even once a later frame has genuinely overwritten it on a real terminal. */
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

/** `assert.ok`'s narrowing does not survive being captured into a callback defined in an outer
 *  scope (a TypeScript closure limitation, not a runtime one) — this fails the same way at the same
 *  place, but the narrowed value it returns stays narrow anywhere it is then passed. */
function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

const SETTINGS_HOTKEY: string = required(
  TOP_LEVEL_ITEMS.find((item) => item.id === "settings")?.hotkey,
  "no item named settings exists on the top-level menu",
)

/**
 * Runs a session, enters the Settings screen, drives it with raw bytes, and returns the last frame
 * drawn — the same "read the frame back" contract engine.md 9.7 asks of the driver. A fresh session
 * per call, so cycling behaviour is never polluted by an earlier call's state.
 */
async function settingsFrameAfter(
  drive: (stdin: FakeStdin) => void,
  settingsStore: SettingsStore = noopSettingsStore(),
  settings: Settings = TEST_SETTINGS,
): Promise<string> {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const session = runMenu({
    settings,
    settingsStore,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: () => {},
  })
  await wait(30)
  stdin.emit("data", Buffer.from(SETTINGS_HOTKEY))
  await wait(10)
  drive(stdin)
  await wait(30)
  const result = stdout.lastWrite
  // Quit for real once the frame we care about is captured — a fresh `runMenu` per call is what
  // makes this helper trustworthy, but that only stays cheap if each one also cleans up its own
  // SIGINT/SIGTERM listeners rather than leaking a pair per call for the rest of the test process.
  stdin.emit("data", Buffer.from("q"))
  await wait(30)
  void session
  return result
}

test("every Settings row displays its own hotkey — a hotkey that is not displayed does not exist", () => {
  // Plain text, the same way tests/menu-view.test.ts checks the top-level menu: styling (a
  // differently-coloured hotkey next to its label) is a presentation concern frameToText strips
  // away entirely, which is exactly right for asking "is this literally on screen."
  const text = frameToText(
    composeMenuFrame(
      { state: createMenuList(settingsItems(TEST_SETTINGS)), notice: null, showBack: true },
      "color16",
    ),
  )
  for (const item of settingsItems(TEST_SETTINGS)) {
    assert.ok(text.includes(menuItemLabel(item)), `"${menuItemLabel(item)}" is not on screen`)
  }
})

/** Which row index each cyclable settings id sits at, and what its next value should read as —
 *  reused by both the equivalence test and the live-effect test below. */
const CYCLABLE_ROWS: readonly { id: string; index: number; nextLabel: (s: Settings) => string }[] = [
  { id: "capability", index: 0, nextLabel: (s) => `Colour depth: ${nextCapability(s.capability)}` },
  { id: "theme", index: 1, nextLabel: (s) => `Background: ${nextTheme(s.theme)}` },
  { id: "glyphPack", index: 2, nextLabel: (s) => `Symbols: ${nextGlyphPack(s.glyphPack)}` },
  {
    id: "reducedMotion",
    index: 3,
    nextLabel: (s) => `Reduced motion: ${toggleReducedMotion(s.reducedMotion) ? "on" : "off"}`,
  },
]

test(
  "the sharp edge: a raw hotkey, raw arrows-then-Enter, and a raw mouse click at the row's own " +
    "position all cycle the identical setting to the identical next value",
  async () => {
    for (const row of CYCLABLE_ROWS) {
      const expectedLabel = row.nextLabel(TEST_SETTINGS)
      const items = settingsItems(TEST_SETTINGS)
      const hotkey = required(items[row.index]?.hotkey, `row ${row.id} has no hotkey`)

      const viaHotkey = await settingsFrameAfter((stdin) => stdin.emit("data", Buffer.from(hotkey)))
      assert.ok(viaHotkey.includes(expectedLabel), `hotkey did not produce "${expectedLabel}"`)

      const viaArrows = await settingsFrameAfter((stdin) => {
        for (let step = 0; step < row.index; step += 1) stdin.emit("data", Buffer.from(ARROW_DOWN))
        stdin.emit("data", Buffer.from("\r"))
      })
      assert.ok(viaArrows.includes(expectedLabel), `arrows+Enter did not produce "${expectedLabel}"`)

      // A raw SGR click at the row's own rendered cell — the same functions the real composer draws
      // with, not a hand-picked coordinate.
      const targetItem = required(items[row.index], `row ${row.id} does not exist`)
      const rowLine = menuItemRow(MENU_LAYOUT, row.index)
      const column = MENU_LAYOUT.column + Math.floor(menuItemLabel(targetItem).length / 2)
      const rawClick = `${ESC}[<0;${column + 1};${rowLine + 1}M`
      const viaClick = await settingsFrameAfter((stdin) => stdin.emit("data", Buffer.from(rawClick)))
      assert.ok(viaClick.includes(expectedLabel), `a mouse click did not produce "${expectedLabel}"`)
    }
  },
)

test("the Back row returns to the top-level menu", async () => {
  const backHotkey = required(
    settingsItems(TEST_SETTINGS).find((item) => item.id === "back")?.hotkey,
    "no item named back exists on the settings screen",
  )
  const text = await settingsFrameAfter((stdin) => stdin.emit("data", Buffer.from(backHotkey)))
  assert.ok(text.includes("top-level menu"), "Back did not return to the top-level menu")
  assert.ok(!text.includes("Colour depth"), "the settings rows are still on screen after Back")
})

test(
  "two keys crossing a screen change in one stdin chunk both land on the right screen",
  async () => {
    // A hotkey that enters Settings, immediately followed by a hotkey that should cycle a Settings
    // row, delivered as ONE chunk — the same shape a fast typist or a script driving the game could
    // produce, and the exact case that silently misrouted the second key to the screen the player
    // had already left before this gate's own fix.
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
    // "3" enters Settings; "2" is Settings' own hotkey for Background, not the top-level menu's
    // hotkey for Challenge — one Buffer, one "data" event, exactly like a real terminal delivering
    // two fast keystrokes together.
    stdin.emit("data", Buffer.from(`${SETTINGS_HOTKEY}2`))
    await wait(30)

    assert.ok(
      stdout.lastWrite.includes(`Background: ${nextTheme(TEST_SETTINGS.theme)}`),
      "the second key did not cycle Background on the Settings screen",
    )
    assert.doesNotMatch(
      stdout.lastWrite,
      /not built yet/,
      "the second key was misrouted to the top-level menu and activated Challenge instead",
    )
    stdin.emit("data", Buffer.from("q"))
    await wait(30)
    void session
  },
)

test("Esc also returns to the top-level menu — the redundant, standard way back", async () => {
  const text = await settingsFrameAfter((stdin) => stdin.emit("data", Buffer.from(ESC)))
  assert.ok(text.includes("top-level menu"), "Esc did not return to the top-level menu")
})

test("Esc does nothing on the top-level menu itself — there is nowhere to back out to", async () => {
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
  stdin.emit("data", Buffer.from(ESC))
  await wait(30)
  assert.ok(stdout.written.includes("top-level menu"), "Esc changed the top-level screen")
  assert.doesNotMatch(stdout.written, /\[\?1049l/, "Esc on the top level quit the application")
  stdin.emit("data", Buffer.from("q"))
  await wait(30)
  void session
})

test("a colour-depth change is visible on the very next frame, without restarting the backend", async () => {
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
  stdin.emit("data", Buffer.from(SETTINGS_HOTKEY))
  await wait(10)
  stdin.emit("data", Buffer.from("1")) // cycle colour depth: color16 -> color256
  await wait(30)

  // color16 resolves a role's SGR as a bare number; color256 resolves it as "38;5;NNN". Cycling from
  // color16 lands on color256 (CAPABILITY_MODES' own order), so this substring in the *newest* frame
  // is the observable proof that setPresentation actually changed what the same backend draws with.
  assert.ok(
    stdout.lastWrite.includes(`${ESC}[38;5;`),
    "no color256-style SGR sequence appeared after cycling colour depth",
  )
  // And the backend was never stopped and restarted to get there - checked against the *whole*
  // session's history, since a real restart re-entering the alternate screen a second time would
  // show as a second alt-screen-enter sequence somewhere in it, not necessarily in the newest write.
  assert.equal(
    stdout.written.split(`${ESC}[?1049h`).length - 1,
    1,
    "the backend was stopped and restarted",
  )
  stdin.emit("data", Buffer.from("q"))
  await wait(30)
  void session
})

test("a setting changed on the Settings screen survives a full stop-and-restart", async () => {
  const directory = mkdtempSync(join(tmpdir(), "terminal-nexus-settings-e2e-"))
  const path = join(directory, "settings.json")
  try {
    // First "launch": change the colour depth, then quit for real (q), which is what actually
    // exercises the disposer step that waits for the write to land on disk before exiting.
    const firstStdout = new FakeStdout()
    const firstStdin = new FakeStdin()
    const firstStore = createSettingsStore(path)
    const exits: number[] = []
    const first = runMenu({
      settings: TEST_SETTINGS,
      settingsStore: firstStore,
      backend: "ansi",
      stdout: firstStdout as unknown as NodeJS.WriteStream,
      stdin: firstStdin as unknown as NodeJS.ReadStream,
      exit: (code) => exits.push(code),
    })
    await wait(30)
    firstStdin.emit("data", Buffer.from(SETTINGS_HOTKEY))
    await wait(10)
    firstStdin.emit("data", Buffer.from("1")) // cycle colour depth once: color16 -> color256
    await wait(10)
    firstStdin.emit("data", Buffer.from("q"))
    await wait(50)
    void first
    assert.deepEqual(exits, [0], "the first session never actually quit")

    // "Relaunch": nothing carried over in memory except the file path — a brand new store, a brand
    // new session, exactly what a real second process would be.
    const secondStdout = new FakeStdout()
    const secondStdin = new FakeStdin()
    const secondStore = createSettingsStore(path)
    const loaded = await secondStore.load()
    assert.equal(loaded?.capability, "color256", "the change did not survive on disk at all")

    const second = runMenu({
      settings: loaded ?? TEST_SETTINGS,
      settingsStore: secondStore,
      backend: "ansi",
      stdout: secondStdout as unknown as NodeJS.WriteStream,
      stdin: secondStdin as unknown as NodeJS.ReadStream,
      exit: () => {},
    })
    await wait(30)
    secondStdin.emit("data", Buffer.from(SETTINGS_HOTKEY))
    await wait(30)
    assert.ok(
      secondStdout.written.includes("Colour depth: color256"),
      "the relaunched session did not show the previously saved colour depth",
    )
    secondStdin.emit("data", Buffer.from("q"))
    await wait(30)
    void second
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
