// The About screen: who made the game, where its code lives, how to
// contribute, and which build this is. Driven through `runMenu` itself, with raw key bytes and raw
// clicks on a fake terminal, and read back from the very frames the loop presented (a backend that
// records them) — so what is asserted is the screen a player gets, not a hand-built composition.
//
// Also the title menu's Activity Logs: `session.start` once, a schema-valid `menu.select` for every
// row picked, and nothing for Esc, which is not a pick.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { runMenu, TOP_LEVEL_ITEMS } from "../src/cli/menu.ts"
import type { MenuOptions } from "../src/cli/menu.ts"
import { ACTIVITY_EVENTS, activity, createLogger, entryProblems } from "../src/log/index.ts"
import type { LogEntry } from "../src/log/index.ts"
import { CONTRIBUTIONS_TEXT, REPOSITORY_URL } from "../src/title-menu/about.ts"
import { menuItemLabel, menuItemRow } from "../src/title-menu/layout.ts"
import { formatMouseClick } from "../src/title-menu/mouse.ts"
import type { MenuItem } from "../src/title-menu/types.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings } from "../src/settings/index.ts"
import { cellAt, frameToText, offendingGlyph } from "../src/view/index.ts"
import type { ReadonlyCellFrame } from "../src/view/index.ts"
import { MENU_LAYOUT, MENU_SIZE } from "../src/view/menu.ts"

const ESC = String.fromCharCode(27)
const ARROW_DOWN = `${ESC}[B`

const TEST_SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "color16" }

function itemNamed(id: string): MenuItem {
  const item = TOP_LEVEL_ITEMS.find((candidate) => candidate.id === id)
  if (item === undefined) throw new Error(`no item named ${id} exists on the top-level menu`)
  return item
}

const ABOUT = itemNamed("about")
const EXIT = itemNamed("exit")
const ABOUT_INDEX = TOP_LEVEL_ITEMS.indexOf(ABOUT)

class FakeStdout extends EventEmitter {
  isTTY = true
  columns: number = MENU_SIZE.width
  rows: number = MENU_SIZE.height
  write(): boolean {
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type Running = Readonly<{
  frames: ReadonlyCellFrame[]
  stdout: FakeStdout
  /** Raw bytes in, as a terminal (or a driver script) sends them. */
  send: (bytes: string) => void
  /** The text of the frame on screen now. */
  screen: () => string
  /** `q`, then the session's own end. */
  quit: () => Promise<number>
}>

/** A title menu on a fake 80 x 24 terminal whose backend keeps every frame it is handed. */
async function startMenu(extra: Partial<MenuOptions> = {}): Promise<Running> {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const frames: ReadonlyCellFrame[] = []
  const done = runMenu({
    settings: TEST_SETTINGS,
    settingsStore: { load: async () => null, save: async () => {} },
    backend: {
      name: "recorder",
      start: async () => {},
      present: (frame) => {
        frames.push(frame)
      },
      stop: async () => {},
    },
    stdout,
    stdin,
    host: { onInterrupt: () => () => {}, exit: () => {}, reportError: () => {} },
    exit: () => {},
    ...extra,
  })
  await wait(20)
  const screen = (): string => {
    const frame = frames.at(-1)
    if (frame === undefined) throw new Error("the menu never presented a frame")
    return frameToText(frame)
  }
  return {
    frames,
    stdout,
    send: (bytes) => stdin.emit("data", bytes),
    screen,
    quit: async () => {
      stdin.emit("data", "q")
      return done
    },
  }
}

/** A frame row's words, without the border either side. */
const inner = (line: string): string => line.slice(1, -1).trim()

/** The click a terminal sends for the middle of a row's label — 1-based, as terminals count. */
function clickOn(item: MenuItem, index: number): string {
  const label = menuItemLabel(item)
  return formatMouseClick(MENU_LAYOUT.column + Math.floor(label.length / 2) + 1, menuItemRow(MENU_LAYOUT, index) + 1)
}

const BACK: MenuItem = { id: "back", hotkey: "1", label: "Back" }

test("About is on the top-level menu just above Exit, and Exit's digit moved from 4 to 5", () => {
  assert.equal(ABOUT.label, "About")
  assert.equal(TOP_LEVEL_ITEMS.indexOf(EXIT), ABOUT_INDEX + 1, "About is not directly above Exit")
  assert.equal(ABOUT.hotkey, "4")
  assert.equal(EXIT.hotkey, "5")
  assert.deepEqual(
    TOP_LEVEL_ITEMS.map((item) => item.hotkey),
    ["1", "2", "3", "4", "5"],
    "the digits are no longer one sequence in walking order",
  )
})

test("the About screen says, in order: the game's name, its author, the repository, Contributions and its paragraph, and the build", async () => {
  const menu = await startMenu({ buildId: "abc1234" })
  menu.send(ABOUT.hotkey)
  const lines = menu.screen().split("\n")
  await menu.quit()

  assert.ok(lines[1]?.includes("about"), "the header does not say this is the About screen")
  const rowOf = (words: string): number => {
    const row = lines.findIndex((line) => inner(line) === words)
    assert.notEqual(row, -1, `"${words}" is not a line of its own on the About screen`)
    return row
  }
  const order = [
    rowOf("Terminal Nexus"),
    rowOf("Designed and developed by: Mario Izquierdo"),
    rowOf(REPOSITORY_URL),
    rowOf("Contributions"),
    rowOf("Build: abc1234"),
  ]
  assert.deepEqual([...order].sort((a, b) => a - b), order, "the About screen's lines are out of order")
  assert.ok(lines.some((line) => inner(line) === menuItemLabel(BACK)), "the Back row is not on screen")

  // The paragraph, read back from its wrapped lines, is the owner's sentence whole — nothing clipped,
  // and his "designed to b" mended.
  const contributions = rowOf("Contributions")
  const paragraph: string[] = []
  for (let row = contributions + 1; inner(lines[row] ?? "") !== ""; row += 1) paragraph.push(inner(lines[row] ?? ""))
  assert.ok(paragraph.length > 1, "the paragraph was not wrapped onto several lines")
  assert.equal(paragraph.join(" "), CONTRIBUTIONS_TEXT)
  assert.match(CONTRIBUTIONS_TEXT, /designed to be modular/u)
})

test("the About screen fits at 80 x 24: every line inside the margins, clear of the controls line, one column a glyph", async () => {
  for (const glyphPack of ["ascii", "unicode"] as const) {
    const menu = await startMenu({ buildId: "abc1234", settings: { ...TEST_SETTINGS, glyphPack } })
    menu.send(ABOUT.hotkey)
    const frame = menu.frames.at(-1) as ReadonlyCellFrame
    const lines = menu.screen().split("\n")
    await menu.quit()

    assert.equal(frame.width, MENU_SIZE.width)
    assert.equal(frame.height, MENU_SIZE.height)
    assert.equal(offendingGlyph(frame), null, `${glyphPack}: a cell was not one column wide`)
    const controlsRow = MENU_SIZE.height - 3
    assert.match(lines[controlsRow] ?? "", /esc back/u, "the controls line was overwritten or lost Esc")
    const build = lines.findIndex((line) => inner(line) === "Build: abc1234")
    assert.ok(build < controlsRow - 1, "the About screen's words run into the controls line")
    // Every row between the header and the controls keeps its right border, and its words end at least
    // a margin as wide as the left one before it.
    for (let row = 1; row < controlsRow; row += 1) {
      const line = lines[row] ?? ""
      assert.equal(line.length, MENU_SIZE.width, `row ${row} lost its right border`)
      const words = line.slice(0, -1).trimEnd()
      assert.ok(words.length <= MENU_SIZE.width - MENU_LAYOUT.column, `row ${row} runs into the right margin: "${words}"`)
    }
  }
})

test("a build that does not know its commit leaves the build line out rather than printing 'unknown'", async () => {
  const menu = await startMenu()
  menu.send(ABOUT.hotkey)
  const text = menu.screen()
  await menu.quit()
  assert.ok(text.includes("Designed and developed by: Mario Izquierdo"))
  assert.ok(!text.includes("Build:"), "a build line was shown with nothing to say")
})

test("About opens the same by its hotkey, by arrows and Enter, and by a click on its row", async () => {
  const ways: Readonly<Record<string, readonly string[]>> = {
    hotkey: [ABOUT.hotkey],
    "arrows and Enter": [...Array.from({ length: ABOUT_INDEX }, () => ARROW_DOWN), "\r"],
    click: [clickOn(ABOUT, ABOUT_INDEX)],
  }
  for (const [way, keys] of Object.entries(ways)) {
    const menu = await startMenu()
    for (const key of keys) menu.send(key)
    const text = menu.screen()
    await menu.quit()
    assert.ok(text.includes("Designed and developed by: Mario Izquierdo"), `${way} did not open the About screen`)
  }
})

test("Back's hotkey, Enter on Back, a click on Back and Esc each return to the top-level menu, About still highlighted", async () => {
  const ways: Readonly<Record<string, string>> = {
    "Back's hotkey": BACK.hotkey,
    "Enter on Back": "\r",
    "a click on Back": clickOn(BACK, 0),
    Esc: ESC,
  }
  for (const [way, key] of Object.entries(ways)) {
    const menu = await startMenu()
    menu.send(ABOUT.hotkey)
    menu.send(key)
    const text = menu.screen()
    const frame = menu.frames.at(-1) as ReadonlyCellFrame
    await menu.quit()
    assert.ok(text.includes("main menu"), `${way} did not return to the top-level menu`)
    assert.ok(text.includes(menuItemLabel(EXIT)), `${way}: the top-level rows are not back`)
    assert.ok(!text.includes("Contributions"), `${way}: the About screen's words are still on screen`)
    // Finishing goes back to where it began: the highlight waits on About, not on the first row.
    const aboutCell = cellAt(frame, MENU_LAYOUT.column, menuItemRow(MENU_LAYOUT, ABOUT_INDEX))
    assert.equal(aboutCell.style.inverse, true, `${way}: the highlight did not come back to About`)
  }
})

const picks = (entries: readonly LogEntry[]): readonly (readonly [unknown, unknown])[] =>
  entries.filter((entry) => entry.event === "menu.select").map((entry) => [entry.props["screen"], entry.props["item"]] as const)

test("the title menu logs one session.start and a schema-valid menu.select for every row picked, and nothing for Esc", async () => {
  const log = createLogger({ name: "activity", events: ACTIVITY_EVENTS, capacity: 100 })
  const menu = await startMenu({ activity: log, buildId: "abc1234", hostName: "web" })
  menu.send(ABOUT.hotkey)
  menu.send(BACK.hotkey)
  menu.send(itemNamed("settings").hotkey)
  menu.send("4") // Settings' reduced-motion row
  menu.send(ESC) // back, which is not a pick
  menu.send(itemNamed("campaign").hotkey)
  menu.send("\r") // Enter on Campaign's Back
  menu.stdout.emit("resize") // the browser page's window changed shape, the terminal did not
  menu.stdout.columns = 100
  menu.stdout.emit("resize")
  menu.send(EXIT.hotkey)
  await wait(20)

  const entries = log.entries()
  for (const entry of entries) {
    assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [], `${entry.event} does not match its schema`)
  }
  const starts = entries.filter((entry) => entry.event === "session.start")
  assert.equal(starts.length, 1, "the title menu did not log exactly one session.start")
  assert.deepEqual(starts[0]?.props, { screen: "menu", build: "abc1234", host: "web", columns: 80, rows: 24, colours: "color16" })
  assert.deepEqual(picks(entries), [
    ["top", "about"],
    ["about", "back"],
    ["top", "settings"],
    ["settings", "reducedMotion"],
    ["top", "campaign"],
    ["campaign", "back"],
    ["top", "exit"],
  ])
  const resizes = entries.filter((entry) => entry.event === "session.resize").map((entry) => entry.props)
  assert.deepEqual(resizes, [{ columns: 100, rows: 24 }], "a resize that changed nothing was logged, or a real one was not")
})

test("without a log of its own, the title menu records into the program's Activity Logs, as a terminal by default", async () => {
  const marker = activity.lastSeq
  const menu = await startMenu()
  menu.send(ABOUT.hotkey)
  await menu.quit()
  const mine = activity.entries().filter((entry) => entry.seq > marker)
  const start = mine.find((entry) => entry.event === "session.start")
  assert.equal(start?.props["host"], "terminal")
  assert.equal("build" in (start?.props ?? {}), false, "an unknown build was logged anyway")
  assert.deepEqual(picks(mine), [["top", "about"]])
})
