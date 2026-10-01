// The browser playtest page's host — the one file in the project that touches the DOM.
//
// A development tool, never a supported platform (`runtime.md`): iTerm2 at 80 x 24 stays the
// acceptance target. The rule that keeps it honest is that the browser gets **no game loop of its
// own**. It runs the terminal's three screen loops, unmodified — `runMenu`, `runBuildPhase` (the Build
// Phase) and `watchPulse` — and hands them a stand-in terminal. The only things converted here are:
//
//   frames  -> pixels         `CanvasBackend` (src/view/backends/canvas.ts)
//   keys    -> terminal bytes `src/web/keys.ts`, through the scripted playtest's own key names
//   taps    -> SGR mouse reports, the same bytes a terminal sends for a click
//   settings -> browser storage instead of ~/.terminal-nexus/settings.json
//   export   -> the clipboard and a text box under the screen, instead of OSC 52 and a file
//   import   -> `#settings=<text>` in the page's address, or that same text box
//
// Built into one self-contained HTML file by `scripts/build-web.mjs`.

import { runMenu } from "../cli/menu.ts"
import type { PlaytestStep } from "../playtest/keys.ts"
import { runBuildPhase } from "../cli/build-phase.ts"
import { watchPulse } from "../cli/watch.ts"
import { buildTimeline } from "../cli/timeline.ts"
import type { Host } from "../cli/lifecycle.ts"
import { loadScenario } from "../scenario/load.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { DEFAULT_SETTINGS, parseSettings } from "../settings/types.ts"
import { importSettings } from "../build/settings-export.ts"
import type { Settings, SettingsStore } from "../settings/types.ts"
import { DEFAULT_PRESENTATION } from "../view/snapshot.ts"
import { CanvasBackend } from "../view/backends/canvas.ts"
import type { TerminalInput, TerminalOutput } from "../view/backends/ports.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, MOUSE_WHEEL_DOWN, MOUSE_WHEEL_UP } from "../build/mouse.ts"
import { keyBytes, parseKeyScript } from "../playtest/keys.ts"
import { KEY_BAR, StandInKeyboard, mouseBytes, withShift } from "./keys.ts"
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
/** The page's side of the kitty keyboard protocol: it answers the Build Phase's question, keeps the
 *  flags it pushes, and marks key repeats and releases the way such a terminal does (`src/web/keys.ts`). */
const standIn = new StandInKeyboard()
const terminal: TerminalOutput & { columns: number; rows: number } = {
  isTTY: true,
  columns: 80,
  rows: 24,
  // Everything a loop writes besides frames is terminal housekeeping — the alternate screen, mouse
  // reporting, a clear before a resized frame. The canvas repaints whole frames, so none of it
  // applies here — except the keyboard protocol's question, answered as input a moment later, as a
  // terminal would.
  write: (text: string) => {
    const reply = standIn.written(text)
    if (reply !== "") setTimeout(() => send(reply), 0)
    return true
  },
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
const settingsBox = element<HTMLDetailsElement>("settings-box")
const settingsText = element<HTMLTextAreaElement>("settings-text")

element("build").textContent = `${__TN_BUILD__.commit} · ${__TN_BUILD__.branch}`

let backend: CanvasBackend | null = null
let running: Promise<number> | null = null
let switching = false
let shift = false
let mode: Mode = "build"
/**
 * Settings text to start the Build Phase with — from `#settings=` in the address, or the text box's
 * "Start the Build Phase with these". Its player settings apply for this visit without being saved,
 * as `--settings` does in a terminal; changing one in the game's Settings saves them all.
 */
let imported: string | null = null

function importFromAddress(): void {
  const match = /(?:^#|&)settings=([^&]*)/u.exec(window.location.hash)
  if (match === null) return
  try {
    imported = decodeURIComponent(match[1] ?? "")
  } catch {
    imported = match[1] ?? ""
  }
  settingsText.value = imported
}

/**
 * A key script to open the Build Phase in a particular state — `#keys=<script>` in the address, in
 * the scripted playtest's key names (`#keys=n%201%201%20Enter` picks a power and places a Barracks):
 * how a demo link opens already where it should, as `--keys` does in a terminal.
 */
function keysFromAddress(): string | null {
  const match = /(?:^#|&)keys=([^&]*)/u.exec(window.location.hash)
  if (match === null) return null
  try {
    return decodeURIComponent(match[1] ?? "")
  } catch {
    return match[1] ?? ""
  }
}

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

  const saved: Settings = (await settingsStore.load()) ?? { ...DEFAULT_SETTINGS, capability: "truecolor" }
  // The settings text reaches the Build Phase only; the menu opens on what is saved.
  const importing = importSettings(next === "build" ? (imported ?? undefined) : undefined, saved)
  if (importing.ignored.length > 0) status.textContent = `Settings text: ignored ${importing.ignored.join(", ")}`
  const startScript = next === "build" ? keysFromAddress() : null
  let startKeys: PlaytestStep[] | null = null
  if (startScript !== null) {
    try {
      startKeys = parseKeyScript(startScript)
    } catch (error) {
      status.textContent = `#keys: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  const { settings, experiments } = importing
  backend = new CanvasBackend({
    canvas,
    capability: settings.capability,
    theme: settings.theme,
    fit: () => ({ width: stage.clientWidth, height: stage.clientHeight }),
    pixelRatio: () => window.devicePixelRatio || 1,
  })
  const common = { backend, stdout: terminal, stdin: keyboard, host } as const
  if (next === "menu") running = runMenu({ ...common, settings, settingsStore })
  else if (next === "build") {
    running = runBuildPhase({
      ...common,
      settings,
      settingsStore,
      buildId: __TN_BUILD__.commit,
      experiments,
      ...(startKeys === null ? {} : { startKeys }),
      exporter: {
        destination: "Copied to the clipboard, and shown in the settings text box under the screen.",
        export: (text) => {
          settingsText.value = text
          settingsBox.open = true
          // Inside the key press or tap that asked for it, so the browser allows the write; a refusal
          // leaves the text box, which is why it is filled first.
          return navigator.clipboard?.writeText(text).catch(() => {
            status.textContent = "The clipboard refused the export: copy it from the settings text box."
          })
        },
      },
    })
  }
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

// A hardware keyboard: an iPad's, or a laptop's. Its presses, the browser's own repeats, and its
// releases, marked as a terminal speaking the kitty keyboard protocol marks them once the Build Phase
// has asked for that (`StandInKeyboard`); otherwise a classic terminal's presses only.
const ownsKey = (event: KeyboardEvent): boolean =>
  !(event.target === typing || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)
window.addEventListener("keydown", (event) => {
  if (!ownsKey(event)) return
  const bytes = standIn.bytesFor(event, event.repeat ? "repeat" : "press")
  if (bytes === null) return
  event.preventDefault()
  send(bytes)
})
window.addEventListener("keyup", (event) => {
  if (!ownsKey(event)) return
  const bytes = standIn.bytesFor(event, "release")
  if (bytes !== null) send(bytes)
})

// A phone's own keyboard, for letters: a hidden field collects what is typed and passes it on.
typing.addEventListener("input", () => {
  const text = typing.value
  typing.value = ""
  for (const character of text) send(keyBytes(character === " " ? "Space" : character))
})
typing.addEventListener("keydown", (event) => {
  if (event.key.length === 1) return
  const bytes = standIn.bytesFor(event, event.repeat ? "repeat" : "press")
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

element("settings-copy").addEventListener("click", () => {
  void navigator.clipboard?.writeText(settingsText.value).catch(() => {
    settingsText.select()
  })
})
element("settings-apply").addEventListener("click", () => {
  imported = settingsText.value
  void start("build")
})
window.addEventListener("hashchange", () => {
  importFromAddress()
  if (imported !== null) void start("build")
})

importFromAddress()
void start("build")
