// The browser playtest page (docs/system-design/runtime.md, the delivery ladder): a development tool that must run the terminal's own
// code, never a copy of it. These are the tests that stop it drifting:
//
//   1. nothing Node-only is reachable from the page — checked on the import graph (both runtimes)
//      and by the build itself (`scripts/lib/web-bundle.mjs` fails on any `node:` import);
//   2. the same results in both places — the bundled code, run in a sandbox with no `process`, no
//      `Buffer` and no `require`, fingerprints a battle, a Build Phase and a menu exactly as Node does
//      (Bun only: the bundler is Bun's, and CI runs the Bun pass);
//   3. the same characters and colours as the terminal — the canvas backend's paint step against
//      `frameToText` and the colour table;
//   4. the page's keys are the scripted playtest's keys — one table of what a terminal sends;
//   5. its direct links are the game's routes — `#at=`, the mode buttons and a demo's `at` read what `--at` reads.

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import test from "node:test"
import { runInNewContext } from "node:vm"

import { EventEmitter } from "node:events"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { starterContext } from "../src/cli/starter.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { KEYBOARD_POP, KEYBOARD_PUSH, KEYBOARD_QUERY, encodeKeyEvent } from "../src/terminal/key-events.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { buildLayout } from "../src/build/layout.ts"
import { keyBytes } from "../src/playtest/keys.ts"
import { DIM_ALPHA, paintOps } from "../src/view/backends/canvas.ts"
import { chunkText } from "../src/view/backends/ports.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { frameToText } from "../src/view/frame.ts"
import type { ReadonlyCellFrame } from "../src/view/frame.ts"
import { keysFromChunk } from "../src/terminal/playback.ts"
import { BACKGROUND_RGB, rgbFor, seeThroughColours } from "../src/view/roles.ts"
import { KEY_BAR, StandInKeyboard, bytesForKeyPress, keyNameFor, mouseBytes, withShift } from "../src/web/keys.ts"
import { readAddress } from "../src/web/address.ts"
import { checkDemos } from "../src/web/demos.ts"
import { BUILD_PHASE_ROUTE, formatRoute, parseRoute } from "../src/cli/route.ts"
import { RUNTIME_IS_BUN, loadScenarioFile } from "./helpers.ts"
import { sameness } from "./web-helpers.ts"

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..")

// --- 1. Nothing Node-only is reachable ------------------------------------------------------------

/** Every module the page can load at run time, following value imports (a type-only import is
 *  erased and loads nothing) and dynamic `import()`s, from the page's own entry point. */
function reachableFrom(entry: string): { files: Set<string>; external: string[] } {
  const files = new Set<string>()
  const external: string[] = []
  const pending = [resolve(ROOT, entry)]
  while (pending.length > 0) {
    const file = pending.pop() as string
    if (files.has(file)) continue
    files.add(file)
    const source = readFileSync(file, "utf8")
    const specifiers = [
      ...source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^"';]*?from\s+"([^"]+)"/gmu),
      ...source.matchAll(/^\s*import\s+"([^"]+)"/gmu),
      ...source.matchAll(/\bimport\(\s*"([^"]+)"\s*\)/gu),
    ].map((match) => match[1] as string)
    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) {
        external.push(`${relative(ROOT, file)} -> ${specifier}`)
        continue
      }
      const target = resolve(dirname(file), specifier)
      // The build swaps OpenTUI for a stub: it is native code the page never selects.
      if (target.endsWith("src/view/backends/opentui.ts")) continue
      if (target.endsWith(".ts")) pending.push(target)
    }
  }
  return { files, external }
}

test("the page reaches no Node module and no package, only the game's own files", () => {
  const { files, external } = reachableFrom("src/web/host.ts")
  assert.deepEqual(external, [], "the page imports something that is not the game's own code")
  const names = [...files].map((file) => relative(ROOT, file))
  // The three screen loops themselves — not copies of them.
  for (const loop of ["src/cli/menu.ts", "src/cli/build-phase.ts", "src/cli/watch.ts"]) {
    assert.ok(names.includes(loop), `the page does not run ${loop}`)
  }
  // And none of the files that exist only for a terminal or a disk.
  for (const terminalOnly of ["src/settings/store.ts", "src/view/backends/opentui.ts", "src/cli/terminal-nexus.ts"]) {
    assert.ok(!names.includes(terminalOnly), `the page reaches ${terminalOnly}`)
  }
})

// --- 2. The same results in both places -----------------------------------------------------------

if (RUNTIME_IS_BUN) {
  test("bundled for a browser and run with no Node features, the game computes exactly what Node does", async () => {
    // Through a variable: the build helper is a plain script, with no types for the checker to read.
    const helper = "../scripts/lib/web-bundle.mjs"
    const { bundleForBrowser } = (await import(helper)) as {
      bundleForBrowser: (entry: string, options?: object) => Promise<{ code: string; files: string[] }>
    }
    const { code, files } = await bundleForBrowser("tests/web-helpers.ts", { minify: false })
    assert.ok(files.includes("src/cli/build-phase.ts") || files.includes("src/view/build-session.ts"))
    const scenario = await loadScenarioFile("grand-battle.map.json")

    // A browser's globals, and nothing of Node's: no process, Buffer, require or module.
    const sandbox: Record<string, unknown> = { TextEncoder, TextDecoder, console }
    sandbox["globalThis"] = sandbox
    runInNewContext(code, sandbox)
    const inBrowser = (sandbox["__terminalNexusSameness"] as typeof sameness)(scenario)

    const inNode = sameness(scenario)
    assert.equal(inBrowser.stateHash, inNode.stateHash)
    assert.equal(inBrowser.eventsHash, inNode.eventsHash)
    assert.deepEqual(inBrowser.pulseFrames, inNode.pulseFrames)
    assert.deepEqual(inBrowser.buildFrames, inNode.buildFrames)
    assert.deepEqual(inBrowser.menuFrames, inNode.menuFrames)
    assert.ok(inNode.pulseFrames.length > 30 && inNode.buildFrames.length > 10)
  })
}

// --- 3. The same characters and colours as the terminal -------------------------------------------

function buildFrame(script: readonly string[]): ReadonlyCellFrame {
  const context = starterContext()
  const layout = buildLayout({ columns: 80, rows: 24 }, context.grid)
  const build = new BuildSession({ context, cursor: STARTER_START_CURSOR, viewport: layout.viewport })
  for (const name of script) build.handleData(keyBytes(name), layout)
  return composeBuildFrame({ context, state: build.state, layout }, "truecolor")
}

function paintedText(frame: ReadonlyCellFrame, ops: ReturnType<typeof paintOps>): string {
  const rows = Array.from({ length: frame.height }, () => Array.from({ length: frame.width }, () => " "))
  for (const op of ops) (rows[op.y] as string[])[op.x] = op.glyph
  return rows.map((row) => row.join("").replace(/[ ]+$/u, "")).join("\n")
}

test("the canvas paints every glyph the terminal shows, where it shows it", () => {
  // The opening screen, a popup over the Grid, and the map scrolled to its west edge.
  for (const script of [[], ["n"], ["n", "1", "Tab", "S-Left", "S-Left", "S-Left", "S-Left"]]) {
    const frame = buildFrame(script)
    for (const capability of ["truecolor", "color256", "color16", "monochrome"] as const) {
      const ops = paintOps(frame, capability)
      assert.equal(ops.length, frame.width * frame.height)
      assert.equal(paintedText(frame, ops), frameToText(frame), `${script.join(" ")} at ${capability}`)
    }
  }
})

test("the canvas takes its colours from the terminal's role table, inverse and dim included", () => {
  // Scrolled to the map's corner, then back on the menu, whose highlight is an inverse bar.
  const frame = buildFrame(["n", "1", "Tab", "S-Left", "S-Left", "S-Left", "S-Left", "S-Up", "S-Up", "Tab"])
  const ops = paintOps(frame, "truecolor", "dark")
  const css = (rgb: readonly number[]): string => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
  let inverse = 0
  let dim = 0
  let washed = 0
  frame.cells.forEach((cell, index) => {
    const op = ops[index]
    assert.ok(op !== undefined)
    const colour = css(rgbFor(cell.style.fgRole, "truecolor", "dark", cell.style.fade ?? 0))
    // A see-through style that shows — the incoming raid's wash — is the role table's colours mixed as the
    // terminal mixes them, glyph and fill.
    const seen = seeThroughColours(cell, "truecolor", "dark")
    if (seen !== null) {
      washed += 1
      assert.equal(op.foreground, css(seen.foreground))
      assert.equal(op.background, css(seen.background))
    } else if (cell.style.inverse === true) {
      // The map's solid edge: the role colour becomes the cell's fill, the theme's ground its ink.
      inverse += 1
      assert.equal(op.background, colour)
      assert.equal(op.foreground, css(BACKGROUND_RGB.dark))
    } else {
      assert.equal(op.foreground, colour)
    }
    if (cell.style.dim === true && seen === null) {
      dim += 1
      assert.equal(op.alpha, DIM_ALPHA)
    }
    assert.equal(op.bold, cell.style.bold === true)
  })
  assert.ok(inverse > 10, "the frame drew no inverse cells to check")
  assert.ok(dim > 0)
  assert.ok(washed > 0, "the frame drew no incoming raid to check")
})

// --- 4. The page's keys are the scripted playtest's keys ------------------------------------------

test("every key on the page's key bar is a playtest key name and reaches the game as one key", () => {
  for (const key of [...KEY_BAR.common, ...KEY_BAR.menu, ...KEY_BAR.build, ...KEY_BAR.pulse]) {
    const bytes = keyBytes(withShift(key.name, false))
    assert.equal(keysFromChunk(bytes).length, 1, key.name)
  }
  // Shift on the bar turns the next arrow into the fast move, and nothing else.
  assert.equal(keyBytes(withShift("Left", true)), keyBytes("S-Left"))
  assert.equal(keyBytes(withShift("Tab", true)), keyBytes("Tab"))
})

test("a hardware key press sends the same bytes as the playtest name for that key", () => {
  const press = (key: string, modifiers: Partial<Record<"shiftKey" | "altKey" | "ctrlKey" | "metaKey", boolean>> = {}) => ({
    key,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...modifiers,
  })
  const expected: ReadonlyArray<readonly [ReturnType<typeof press>, string]> = [
    [press("ArrowUp"), "Up"],
    [press("ArrowLeft", { shiftKey: true }), "S-Left"],
    [press("ArrowRight", { altKey: true }), "M-Right"],
    [press("Tab"), "Tab"],
    [press("Tab", { shiftKey: true }), "S-Tab"],
    [press("Escape"), "Esc"],
    [press("Enter"), "Enter"],
    [press(" "), "Space"],
    [press("Backspace"), "Bksp"],
    [press("Delete"), "Del"],
    [press("PageDown"), "PgDn"],
    [press("c", { ctrlKey: true }), "C-c"],
    [press("n"), "n"],
    [press("3"), "3"],
  ]
  for (const [event, name] of expected) {
    assert.equal(keyNameFor(event), name)
    assert.equal(bytesForKeyPress(event), keyBytes(name))
  }
  // The browser keeps its own shortcuts, and keys the game has no use for.
  assert.equal(bytesForKeyPress(press("r", { metaKey: true })), null)
  assert.equal(bytesForKeyPress(press("Shift")), null)
})

test("a tap is the press and release a terminal reports, at the same cell", () => {
  assert.equal(mouseBytes(0, 4, 9, true), "\u001b[<0;5;10M")
  assert.equal(mouseBytes(0, 4, 9, false), "\u001b[<0;5;10m")
  assert.equal(chunkText(new TextEncoder().encode(mouseBytes(2, 0, 0, true))), "\u001b[<2;1;1M")
})



test("the page plays a terminal that reports key events: it answers, keeps the flags, and marks repeats and releases", async () => {
  const key = (name: string, modifiers: Partial<Record<"shiftKey" | "altKey" | "ctrlKey" | "metaKey", boolean>> = {}) => ({
    key: name,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...modifiers,
  })
  const standIn = new StandInKeyboard()
  // Before anything is pushed: a classic terminal's presses, repeats as presses, no releases.
  assert.equal(standIn.bytesFor(key("ArrowRight"), "press"), keyBytes("Right"))
  assert.equal(standIn.bytesFor(key("ArrowRight"), "repeat"), keyBytes("Right"))
  assert.equal(standIn.bytesFor(key("ArrowRight"), "release"), null)
  assert.equal(standIn.bytesFor(key("Escape"), "press"), keyBytes("Esc"))
  // Asked, it answers as a terminal speaking the protocol; pushed, it marks what it can.
  assert.equal(standIn.written(KEYBOARD_QUERY), "\u001b[?0u\u001b[?62;22c")
  assert.equal(standIn.written(`\u001b[2J${KEYBOARD_PUSH}\u001b[0m`), "")
  assert.equal(standIn.flags, 3)
  assert.equal(standIn.bytesFor(key("ArrowRight"), "press"), keyBytes("Right"))
  assert.equal(standIn.bytesFor(key("ArrowRight"), "repeat"), encodeKeyEvent(keyBytes("Right"), "repeat"))
  assert.equal(standIn.bytesFor(key("ArrowRight"), "release"), encodeKeyEvent(keyBytes("Right"), "release"))
  assert.equal(standIn.bytesFor(key("ArrowLeft", { shiftKey: true }), "release"), encodeKeyEvent(keyBytes("S-Left"), "release"))
  assert.equal(standIn.bytesFor(key("Escape"), "press"), "\u001b[27;1:1u")
  assert.equal(standIn.bytesFor(key("n"), "repeat"), "n")
  assert.equal(standIn.bytesFor(key("n"), "release"), null)
  // Popped: a classic terminal again.
  standIn.written(KEYBOARD_POP)
  assert.equal(standIn.flags, 0)
  assert.equal(standIn.bytesFor(key("ArrowRight"), "release"), null)

  // The Build Phase's own loop against it, as the page runs it: asked and pushed on start, popped on the way out.
  const page = new StandInKeyboard()
  const input = new EventEmitter()
  const output = Object.assign(new EventEmitter(), {
    isTTY: true,
    columns: 80,
    rows: 24,
    write(text: string): boolean {
      const reply = page.written(text)
      if (reply !== "") setTimeout(() => input.emit("data", reply), 0)
      return true
    },
  })
  const keyboard = Object.assign(input, { isTTY: true })
  const running = runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    backend: { name: "page", start: async () => {}, present: () => {}, stop: async () => {} },
    stdout: output,
    stdin: keyboard,
    host: { onInterrupt: () => () => {}, exit: () => {}, reportError: () => {} },
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(page.flags, 3, "the Build Phase did not switch the page's key events on")
  input.emit("data", keyBytes("C-c"))
  assert.equal(await running, 0)
  assert.equal(page.flags, 0, "the Build Phase left the page's key events on")
})

// --- 5. The page's direct links are the game's routes ---------------------------------------------

test("#at= opens a route, whole: a part runs to the next part the page knows, not to the next &", () => {
  // As a person writes it: the route's own ? = and &, then a settings text with its own & and =, then keys.
  const address = readAddress("#at=campaign?level=vasse-test-1&round=2&settings=nextRound=auto&trainEvery=6&keys=Esc n 1")
  assert.deepEqual(address, { at: "campaign?level=vasse-test-1&round=2", settings: "nextRound=auto&trainEvery=6", keys: "Esc n 1" })
  const at = parseRoute(address.at ?? "")
  assert.equal(at.kind === "level" ? `${at.level.id} ${at.round}` : at.place, "vasse-test-1 2")
  // Percent-encoded, as an address often is, and in any order.
  assert.deepEqual(readAddress("#keys=Esc%20n%201&at=campaign%3Flevel%3Dvasse-test-1%26round%3D3"), {
    keys: "Esc n 1",
    at: "campaign?level=vasse-test-1&round=3",
  })
  // The addresses the page always took still read as they did.
  assert.deepEqual(readAddress("#settings=raid%3Dprobe%20crew%3Dsome"), { settings: "raid=probe crew=some" })
  assert.deepEqual(readAddress("#keys=n%201%201%20Enter"), { keys: "n 1 1 Enter" })
  assert.deepEqual(readAddress("#at=settings"), { at: "settings" })
  // Nothing it knows: nothing asked. A lone % is kept as written rather than lost.
  assert.deepEqual(readAddress(""), {})
  assert.deepEqual(readAddress("#somewhere"), {})
  assert.deepEqual(readAddress("#at=campaign?level=100%"), { at: "campaign?level=100%" })
  // The first of a repeated part counts.
  assert.deepEqual(readAddress("#at=about&at=settings"), { at: "about" })
})

test("the page's mode buttons that are game screens open their routes; the replays are named as replays", () => {
  const html = readFileSync(resolve(ROOT, "src/web/page.html"), "utf8")
  const routes = [...html.matchAll(/data-at="([^"]*)"/gu)].map((match) => match[1] as string)
  assert.deepEqual(routes, ["menu", BUILD_PHASE_ROUTE])
  for (const route of routes) assert.equal(formatRoute(parseRoute(route)), route)
  assert.deepEqual([...html.matchAll(/data-pulse="([^"]*)"/gu)].map((match) => match[1]), ["pulse-grand", "pulse-mirror"])
  assert.doesNotMatch(html, /data-mode=/u, "a mode button still names a mode rather than a route")
})

test("every checked-in demo is one the page can follow: its route, its keys, and nothing it does not know", () => {
  const folder = resolve(ROOT, "scripts/demos")
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".json"))) {
    const demos = checkDemos(JSON.parse(readFileSync(join(folder, file), "utf8")), file)
    assert.ok(demos.length > 0, `${file} has no demos`)
    for (const demo of demos) if (demo.at !== undefined) parseRoute(demo.at)
  }
  // A demo may open a level at a round; one whose route is not a place, or is on the title menu with keys, is refused.
  const round2 = checkDemos([{ label: "Round 2", try: "-", at: "campaign?level=vasse-test-1&round=2", keys: "Esc" }], "demos.json")
  assert.equal(round2[0]?.at, "campaign?level=vasse-test-1&round=2")
  assert.throws(() => checkDemos([{ label: "x", try: "-", at: "campaign?level=nowhere" }], "demos.json"), /demos\.json: demo 1's at: .*no level "nowhere"/u)
  assert.throws(() => checkDemos([{ label: "x", try: "-", at: "settings", keys: "Down" }], "demos.json"), /is on the title menu: its keys and settings are for a campaign level/u)
  assert.throws(() => checkDemos([{ label: "x", try: "-", keys: "Dwn" }], "demos.json"), /demo 1's keys: unknown key "Dwn"/u)
  assert.throws(() => checkDemos([{ label: "x", try: "-", where: "here" }], "demos.json"), /unknown: where/u)
  assert.throws(() => checkDemos({ label: "x" }, "demos.json"), /expected a list of demos/u)
})
