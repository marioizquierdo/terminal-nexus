// The browser playtest page's host — the one file in the project that touches the DOM.
//
// A development tool, never a supported platform (engine.md 10.2): iTerm2 at 80 x 24 stays the
// acceptance target. The rule that keeps it honest is that the browser gets **no game loop of its
// own**. It runs the terminal's three screen loops, unmodified — `runMenu`, `runSpike` (the Build
// Phase) and `watchPulse` — and hands them a stand-in terminal. The only things converted here are:
//
//   frames  -> pixels         `CanvasBackend` (src/view/backends/canvas.ts)
//   keys    -> terminal bytes `src/web/keys.ts`, through the scripted playtest's own key names
//   taps    -> SGR mouse reports, the same bytes a terminal sends for a click
//   settings -> browser storage instead of ~/.terminal-nexus/settings.json
//
// Built into one self-contained HTML file by `scripts/build-web.mjs`.

import { runMenu } from "../cli/menu.ts"
import { runSpike } from "../cli/spike.ts"
import { watchPulse } from "../cli/watch.ts"
import { buildTimeline } from "../cli/timeline.ts"
import type { Host } from "../cli/lifecycle.ts"
import { loadScenario } from "../scenario/load.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { DEFAULT_SETTINGS, parseSettings } from "../settings/types.ts"
import type { Settings, SettingsStore } from "../settings/types.ts"
import { DEFAULT_PRESENTATION } from "../view/snapshot.ts"
import { CanvasBackend } from "../view/backends/canvas.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, MOUSE_WHEEL_DOWN, MOUSE_WHEEL_UP } from "../build/mouse.ts"
import { keyBytes } from "../playtest/keys.ts"
import { KEY_BAR, bytesForKeyPress, mouseBytes, withShift } from "./keys.ts"
import grandBattle from "../../scenarios/grand-battle.map.json" with { type: "json" }
import citizensVersusRavels from "../../scenarios/citizens-versus-ravels.map.json" with { type: "json" }

/** Stamped in by the build: which commit this page is, so a screenshot from a phone says so. */
declare const __TN_BUILD__: Readonly<{ commit: string; branch: string; builtAt: string }>

type Mode = "menu" | "build" | "pulse-grand" | "pulse-mirror"

const PULSES: Readonly<Record<"pulse-grand" | "pulse-mirror", ScenarioDefinition>> = {
  "pulse-grand": grandBattle as unknown as ScenarioDefinition,
  "pulse-mirror": citizensVersusRavels as unknown as ScenarioDefinition,
}

// --- The stand-in terminal ------------------------------------------------------------------------

type Listener = (...args: never[]) => void
function listeners<E extends string>(): {
  on(event: E, listener: Listener): void
  off(event: E, listener: Listener): void
  emit(event: E, ...args: unknown[]): void
} {
  const table = new Map<E, Listener[]>()
  return {
    on(event, listener) {
      table.set(event, [...(table.get(event) ?? []), listener])
    },
    off(event, listener) {
      table.set(event, (table.get(event) ?? []).filter((candidate) => candidate !== listener))
    },
    emit(event, ...args) {
      for (const listener of table.get(event) ?? []) (listener as (...values: unknown[]) => void)(...args)
    },
  }
}

const outputEvents = listeners<"resize">()
const inputEvents = listeners<"data">()
const terminal: TerminalOutput & { columns: number; rows: number } = {
  isTTY: true,
  columns: 80,
  rows: 24,
  // Everything a loop writes besides frames is terminal housekeeping — the alternate screen, mouse
  // reporting, a clear before a resized frame. The canvas repaints whole frames, so none of it
  // applies here.
  write: () => true,
  on: (event, listener) => outputEvents.on(event, listener),
  off: (event, listener) => outputEvents.off(event, listener),
}
const keyboard: TerminalInput = {
  isTTY: true,
  on: (event, listener) => inputEvents.on(event, listener),
  off: (event, listener) => inputEvents.off(event, listener),
}
const send = (bytes: string): void => inputEvents.emit("data", bytes)

// --- Settings, in this browser only ---------------------------------------------------------------

const SETTINGS_KEY = "terminal-nexus.settings"
const settingsStore: SettingsStore = {
  async load() {
    try {
      const text = localStorage.getItem(SETTINGS_KEY)
      return text === null ? null : parseSettings(JSON.parse(text))
    } catch {
      return null
    }
  },
  async save(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // Private browsing or blocked storage: the change still applies for this visit.
    }
  },
}

// --- The page -------------------------------------------------------------------------------------

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id)
  if (found === null) throw new Error(`the page has no #${id}`)
  return found as T
}
const canvas = element<HTMLCanvasElement>("screen")
const stage = element<HTMLElement>("stage")
const keyBar = element<HTMLElement>("keys")
const typing = element<HTMLInputElement>("typing")
const status = element<HTMLElement>("status")
const sizeSelect = element<HTMLSelectElement>("size")

element("build").textContent = `${__TN_BUILD__.commit} · ${__TN_BUILD__.branch}`

let backend: CanvasBackend | null = null
let running: Promise<number> | null = null
let switching = false
let shift = false
let mode: Mode = "build"

/** A tab never exits; a screen that ends just says so, and a mode button starts another. */
const host: Host = {
  onInterrupt: () => () => {},
  exit: () => {},
  reportError: (text) => {
    console.error(text)
    status.textContent = text.trim()
  },
}

async function start(next: Mode): Promise<void> {
  if (running !== null) {
    // Ctrl+C is every screen's immediate quit, through its own disposer — the Build Phase's `q`
    // asks first, so it cannot be what switches screens.
    switching = true
    send(keyBytes("C-c"))
    await running
    switching = false
  }
  mode = next
  document.body.dataset["mode"] = next
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset["mode"] === next))
  }
  renderKeyBar()
  status.textContent = ""

  const settings: Settings = (await settingsStore.load()) ?? { ...DEFAULT_SETTINGS, capability: "truecolor" }
  backend = new CanvasBackend({
    canvas,
    capability: settings.capability,
    theme: settings.theme,
    fit: () => ({ width: stage.clientWidth, height: stage.clientHeight }),
    pixelRatio: () => window.devicePixelRatio || 1,
  })
  const common = { backend, stdout: terminal, stdin: keyboard, host } as const
  if (next === "menu") running = runMenu({ ...common, settings, settingsStore })
  else if (next === "build") running = runSpike({ ...common, settings })
  else {
    const scenario = PULSES[next]
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
    const timeline = buildTimeline(scenario, loaded.state, loaded.registry, scenario.pulseTicks, scenario.seed)
    running = watchPulse({
      ...common,
      timeline,
      capability: settings.capability,
      theme: settings.theme,
      tileWidth: 1,
      speed: 1,
      presentation: { ...DEFAULT_PRESENTATION, reducedMotion: settings.reducedMotion, glyphPack: settings.glyphPack },
    })
  }
  const mine = running
  void mine.then(() => {
    if (running !== mine) return
    running = null
    if (!switching) status.textContent = "That screen has ended. Pick one above to start again."
  })
}

function renderKeyBar(): void {
  const own = mode === "menu" ? KEY_BAR.menu : mode === "build" ? KEY_BAR.build : KEY_BAR.pulse
  const keys = [...KEY_BAR.common, ...own]
  keyBar.replaceChildren()
  const button = (label: string, name: string, extra: Partial<HTMLButtonElement> = {}): void => {
    const node = document.createElement("button")
    node.type = "button"
    node.textContent = label
    node.dataset["key"] = name
    Object.assign(node, extra)
    keyBar.append(node)
  }
  for (const key of keys.slice(0, 4)) button(key.label, key.name, { ariaLabel: key.name })
  button("Shift", "shift")
  keyBar.lastElementChild?.setAttribute("aria-pressed", String(shift))
  for (const key of keys.slice(4)) button(key.label, key.name)
  button("abc", "abc", { ariaLabel: "Open the keyboard to type letters" })
}

keyBar.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
  const name = target?.dataset["key"]
  if (target === null || target === undefined || name === undefined) return
  if (name === "shift") {
    shift = !shift
    target.setAttribute("aria-pressed", String(shift))
    return
  }
  if (name === "abc") {
    typing.focus()
    return
  }
  send(keyBytes(withShift(name, shift)))
})

// A hardware keyboard: an iPad's, or a laptop's.
window.addEventListener("keydown", (event) => {
  if (event.target === typing || event.target instanceof HTMLSelectElement) return
  const bytes = bytesForKeyPress(event)
  if (bytes === null) return
  event.preventDefault()
  send(bytes)
})

// A phone's own keyboard, for letters: a hidden field collects what is typed and passes it on.
typing.addEventListener("input", () => {
  const text = typing.value
  typing.value = ""
  for (const character of text) send(keyBytes(character === " " ? "Space" : character))
})
typing.addEventListener("keydown", (event) => {
  if (event.key.length === 1) return
  const bytes = bytesForKeyPress(event)
  if (bytes === null) return
  event.preventDefault()
  send(bytes)
})

// Taps and clicks: a press and a release at the cell under the finger, as a terminal reports them.
function cellOf(event: PointerEvent | WheelEvent): Readonly<{ column: number; row: number }> | null {
  if (backend === null) return null
  const box = canvas.getBoundingClientRect()
  return backend.cellAt(event.clientX - box.left, event.clientY - box.top)
}
canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault()
  const cell = cellOf(event)
  if (cell !== null) send(mouseBytes(event.button === 2 ? MOUSE_RIGHT : MOUSE_LEFT, cell.column, cell.row, true))
})
canvas.addEventListener("pointerup", (event) => {
  const cell = cellOf(event)
  if (cell !== null) send(mouseBytes(event.button === 2 ? MOUSE_RIGHT : MOUSE_LEFT, cell.column, cell.row, false))
})
canvas.addEventListener("contextmenu", (event) => event.preventDefault())
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault()
    const cell = cellOf(event)
    if (cell !== null) send(mouseBytes(event.deltaY < 0 ? MOUSE_WHEEL_UP : MOUSE_WHEEL_DOWN, cell.column, cell.row, true))
  },
  { passive: false },
)

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
  button.addEventListener("click", () => void start(button.dataset["mode"] as Mode))
}

// The terminal size the loops lay out for: 80 x 24 is the game's floor and acceptance target.
sizeSelect.addEventListener("change", () => {
  const [columns, rows] = sizeSelect.value.split("x").map(Number)
  terminal.columns = columns ?? 80
  terminal.rows = rows ?? 24
  outputEvents.emit("resize")
})
// The window changed shape: the loops re-present, and the canvas refits the space it has.
window.addEventListener("resize", () => outputEvents.emit("resize"))

void start("build")
