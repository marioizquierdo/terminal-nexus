// Every route opens where it says (src/cli/route.ts): each place on the title menu through `runMenu`, each
// campaign level at each of its rounds through the Build Phase's own loop, on a stand-in terminal that records
// the frames presented — the fake terminal the lifecycle tests use, with a backend that keeps frames instead of
// writing escape sequences. And choosing a row is following its route: the same screen, the same frame.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { readLaunch } from "../src/cli/launch.ts"
import { DEFAULT_LEVEL, LEVELS } from "../src/cli/levels.ts"
import type { Host } from "../src/cli/lifecycle.ts"
import { TOP_LEVEL_ITEMS, runMenu } from "../src/cli/menu.ts"
import { DEFAULT_LEVEL_ROUTE, allRoutes, formatRoute, parseRoute } from "../src/cli/route.ts"
import type { LevelDestination, TitleDestination } from "../src/cli/route.ts"
import { ACTIVITY_EVENTS, createLogger, entryProblems } from "../src/log/index.ts"
import { keyBytes, parseKeyScript } from "../src/playtest/keys.ts"
import { playtestOpening, runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import type { Settings, SettingsStore } from "../src/settings/index.ts"
import { frameToAnsi, frameToText } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, capability: "color16" }
const STORE: SettingsStore = { load: async () => null, save: async () => {} }
/** No process signals, no exit: the loop ends and its promise settles. */
const HOST: Host = { onInterrupt: () => () => {}, exit: () => {}, reportError: () => {} }

/** A terminal at the 80 x 24 floor, and a backend that keeps every frame presented to it. */
function standIn(): {
  stdout: EventEmitter & { isTTY: true; columns: number; rows: number; write: (text: string) => boolean }
  stdin: EventEmitter & { isTTY: true }
  frames: ReadonlyCellFrame[]
  backend: { name: string; start: () => Promise<void>; present: (frame: ReadonlyCellFrame) => void; stop: () => Promise<void> }
} {
  const frames: ReadonlyCellFrame[] = []
  return {
    stdout: Object.assign(new EventEmitter(), { isTTY: true as const, columns: 80, rows: 24, write: () => true }),
    stdin: Object.assign(new EventEmitter(), { isTTY: true as const }),
    frames,
    backend: { name: "recorder", start: async () => {}, present: (frame) => frames.push(frame), stop: async () => {} },
  }
}

/** Until `ready` holds, in small steps: a loop draws its first frame once its backend has started. */
async function until(ready: () => boolean, what: string): Promise<void> {
  for (let waited = 0; !ready(); waited += 5) {
    if (waited > 5000) assert.fail(`never ${what}`)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

/** The title menu opened at `at` (or at the top), with `keys` pressed one at a time: the last frame. */
async function menuAt(at: TitleDestination | undefined, keys: readonly string[] = []): Promise<ReadonlyCellFrame> {
  const { stdout, stdin, frames, backend } = standIn()
  const running = runMenu({ settings: SETTINGS, settingsStore: STORE, backend, stdout, stdin, host: HOST, ...(at === undefined ? {} : { at }) })
  await until(() => frames.length > 0, "drew the title menu")
  for (const key of keys) {
    const before = frames.length
    stdin.emit("data", keyBytes(key))
    await until(() => frames.length > before, `drew after ${key}`)
  }
  const last = frames[frames.length - 1]!
  stdin.emit("data", keyBytes("C-c"))
  assert.equal(await running, 0)
  return last
}

/** A campaign level's Build Phase opened at `at` (or as it opens when told nothing): the first frame. */
async function buildAt(at: LevelDestination | undefined): Promise<ReadonlyCellFrame> {
  const { stdout, stdin, frames, backend } = standIn()
  const running = runBuildPhase({
    settings: SETTINGS,
    backend,
    stdout,
    stdin,
    host: HOST,
    scenes: false,
    ...(at === undefined ? {} : { at }),
  })
  await until(() => frames.length > 0, "drew the Build Phase")
  const first = frames[0]!
  stdin.emit("data", keyBytes("C-c"))
  assert.equal(await running, 0)
  return first
}

/** Where the scripted playtest's `--at <route>` opens, read as `scripts/playtest.mjs` reads it: refused when the
 *  route is not a place, or is on the title menu. */
function playtestAt(route: string): LevelDestination {
  const { launch, problems } = readLaunch({ at: route }, DEFAULT_LEVEL_ROUTE)
  if (problems[0] !== undefined) throw problems[0].error
  return playtestOpening(launch.destination)
}

/** What a title menu place's screen shows, and must: its subtitle and words only it has. */
const TITLE_SCREENS: Readonly<Record<TitleDestination["place"], readonly RegExp[]>> = {
  menu: [/top-level menu/u, /\[5\] Exit/u],
  campaign: [/campaign/u, /Campaign is not built yet/u, /\[1\] Back/u],
  challenge: [/top-level menu/u, /Challenge is not built yet/u],
  settings: [/settings/u, /Colour depth/u, /\[5\] Back/u],
  about: [/about/u, /Contributions/u, /\[1\] Back/u],
}

test("every route opens where it says: each title menu place on the title menu, each level at each round in its Build Phase", { timeout: 120_000 }, async () => {
  const routes = allRoutes()
  assert.ok(routes.length >= 5 + LEVELS.length, "the route table is shorter than the places and levels it should name")
  for (const route of routes) {
    const destination = parseRoute(route)
    if (destination.kind === "title") {
      const text = frameToText(await menuAt(destination))
      for (const shown of TITLE_SCREENS[destination.place]) assert.match(text, shown, `${route} opened a screen without ${String(shown)}`)
      if (destination.place !== "menu" && destination.place !== "challenge") assert.doesNotMatch(text, /\[5\] Exit/u, `${route} left the top-level menu on screen`)
    } else {
      const text = frameToText(await buildAt(destination))
      const { level, round } = destination
      assert.match(text, new RegExp(`build phase - round ${round} of ${level.rounds}`, "u"), `${route} opened another round`)
    }
  }
})

test("choosing a title menu row and following its route open the same screen, and Esc comes back to the row", async () => {
  for (const item of TOP_LEVEL_ITEMS) {
    if (item.route === undefined) continue
    const destination = parseRoute(item.route)
    assert.equal(destination.kind, "title")
    if (destination.kind !== "title") continue
    // Colour and highlight included: the frame as the terminal gets it.
    const print = (frame: ReadonlyCellFrame): string => frameToAnsi(frame, "color16", "dark")
    const chosen = await menuAt(undefined, [item.hotkey])
    const followed = await menuAt(destination)
    assert.equal(print(followed), print(chosen), `--at ${item.route} is not the screen its row opens`)
    if (destination.place === "challenge") continue
    // Back from where the route opened is back to its row, highlighted, as for a player who chose it.
    assert.equal(print(await menuAt(destination, ["Esc"])), print(await menuAt(undefined, [item.hotkey, "Esc"])), `Esc from ${item.route}`)
  }
})

test("the Activity Logs say where a screen opened, and the route a picked row opens", async () => {
  // The title menu opened at Settings; Back, then About.
  const menuLog = createLogger({ name: "activity", events: ACTIVITY_EVENTS, capacity: 100 })
  const menu = standIn()
  const at = parseRoute("settings")
  assert.equal(at.kind, "title")
  if (at.kind !== "title") return
  const runningMenu = runMenu({ settings: SETTINGS, settingsStore: STORE, backend: menu.backend, stdout: menu.stdout, stdin: menu.stdin, host: HOST, at, activity: menuLog })
  await until(() => menu.frames.length > 0, "drew the title menu")
  for (const key of ["Esc", "4"]) {
    const before = menu.frames.length
    menu.stdin.emit("data", keyBytes(key))
    await until(() => menu.frames.length > before, `drew after ${key}`)
  }
  menu.stdin.emit("data", keyBytes("C-c"))
  assert.equal(await runningMenu, 0)
  for (const entry of menuLog.entries()) assert.deepEqual(entryProblems(ACTIVITY_EVENTS, entry), [], entry.event)
  assert.equal(menuLog.entries().find((entry) => entry.event === "session.start")?.props["at"], "settings")
  const pick = menuLog.entries().find((entry) => entry.event === "menu.select")
  assert.deepEqual(pick?.props, { screen: "top", item: "about", route: "about" })

  // A level's round 2.
  const buildLog = createLogger({ name: "activity", events: ACTIVITY_EVENTS, capacity: 100 })
  const build = standIn()
  const running = runBuildPhase({
    settings: SETTINGS,
    backend: build.backend,
    stdout: build.stdout,
    stdin: build.stdin,
    host: HOST,
    scenes: false,
    at: { kind: "level", level: DEFAULT_LEVEL, round: 2 },
    activity: buildLog,
  })
  await until(() => build.frames.length > 0, "drew the Build Phase")
  build.stdin.emit("data", keyBytes("C-c"))
  assert.equal(await running, 0)
  const start = buildLog.entries().find((entry) => entry.event === "session.start")
  assert.equal(start?.props["at"], "campaign?level=vasse-test-1&round=2")
  assert.deepEqual(entryProblems(ACTIVITY_EVENTS, start!), [])
})

test("the default level is the Build Phase as it opens when told nothing: PERIMETER, round 1", async () => {
  const level = DEFAULT_LEVEL
  const told = await buildAt({ kind: "level", level, round: 1 })
  const untold = await buildAt(undefined)
  assert.equal(frameToAnsi(told, "color16", "dark"), frameToAnsi(untold, "color16", "dark"))
  assert.match(frameToText(untold), /build phase - round 1 of 3/u)
  assert.equal(formatRoute({ kind: "level", level, round: 1 }), "campaign?level=vasse-test-1")
})

test("a route to round 2 opens exactly the screen a player reaches by playing round 1 with nothing built", () => {
  // The demos used to walk there with keys: pick the first power, start the Pulse, let it play, then Enter.
  const walked = runBuildPlaytest({ steps: parseKeyScript("Esc n 1 s s wait~1000*16 Enter") })
  const routed = runBuildPlaytest({ steps: [], at: playtestAt("campaign?level=vasse-test-1&round=2") })
  const reached = walked.frames[walked.frames.length - 1]!
  const opened = routed.frames[0]!
  assert.equal(frameToAnsi(opened.frame, "truecolor", "dark"), frameToAnsi(reached.frame, "truecolor", "dark"))
  assert.equal(routed.context.allotment, walked.context.allotment)
  assert.equal(opened.state.pulseNumber, 2)
})

test("the scripted playtest's --at opens a level at a round, and refuses a title menu route", () => {
  const third = runBuildPlaytest({ steps: [], at: playtestAt("campaign?level=vasse-test-1&round=3") })
  assert.match(frameToText(third.frames[0]!.frame), /build phase - round 3 of 3/u)
  assert.equal(third.context.round?.number, 3)
  // With a settings text, the rounds on the way are played with its Experiments too.
  const settled = runBuildPlaytest({ steps: [], at: playtestAt("campaign?level=vasse-test-1&round=2"), experiments: { commanderHealth: 20 } })
  assert.equal(settled.frames[0]!.state.experiments.commanderHealth, 20)
  assert.throws(() => playtestAt("settings"), /--at settings is on the title menu, and the scripted playtest plays a campaign level's Build Phase/u)
  assert.throws(() => playtestAt("campaign"), /on the title menu/u)
  assert.throws(() => playtestAt("campaign?level=nowhere"), /no level "nowhere"/u)
})
