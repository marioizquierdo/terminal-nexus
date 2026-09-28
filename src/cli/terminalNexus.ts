// The `terminal-nexus` executable's own CLI — milestone-03-game-menu.md: the game's actual entry
// point, as distinct from `grid`'s. No subcommand and no map file: `terminal-nexus` launches straight
// to the top-level menu.
//
// Gate 3B added a real Settings screen, so what a session starts with is now layered: a saved choice
// (from a previous run's Settings screen) beats `grid`'s own first-run colour-depth guess, and an
// explicit command-line flag beats either — the same override order `grid` itself already uses for
// most of its own flags, just with a saved file added underneath.

import { execFileSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { parseCapability, parseGlyphPack, parseTheme } from "../view/index.ts"
import { detectCapability } from "./index.ts"
import { parseArgs, parseInteger } from "./args.ts"
import { runMenu } from "./menu.ts"
import { runSpike } from "./spike.ts"
import { DEFAULT_SETTINGS, createSettingsStore, defaultSettingsPath } from "../settings/index.ts"
import type { Settings } from "../settings/index.ts"
import type { DebugFlags } from "../build/debug.ts"
import { defaultExperiments, parseSettingsExport } from "../build/settings-export.ts"
import type { TerminalOutput } from "../view/backends/ports.ts"

const USAGE = `terminal-nexus — the Terminal Nexus game

  terminal-nexus [--capability monochrome|color16|color256|truecolor]
                  [--theme dark|light] [--glyphs ascii|unicode] [--reduced-motion]
                  [--backend auto|ansi|opentui]
      launches the top-level menu: Campaign, Challenge, Settings, Exit

  terminal-nexus --spike [the same presentation flags]
      opens the Build Phase scrolling-and-placement spike (Milestone 5, gate 5A): a Grid
      larger than the screen, a cursor that scrolls it, and three structures to place, by
      keyboard, by mouse, or from a script. It answers a question rather than shipping a
      screen - nothing it plans reaches the simulation, and nothing is saved.
      --scroll-margin <percent> changes how close to the edge of the view the cursor gets
      before the map starts scrolling, as a share of the view's width and height (20 unless
      given; "25" and "25%" are the same). Esc opens the game menu: Settings (saved, like the
      title menu's) and, at their bottom, Experiments - every movement and effect number, live,
      never saved; d jumps straight to them. "Export settings" copies them all as text.
      --settings "<text>" starts with an exported text's settings and experiments, for this
      run only: paste the whole export, or just pairs like "placeLight=rainbow scrollMargin=25".

A first launch guesses colour depth the way \`grid\` does; every launch after that remembers whatever
was last chosen on the Settings screen (~/.terminal-nexus/settings.json). Any flag above overrides
its own setting for this one run without changing what is saved.

--theme defaults to dark; pass --theme light on a light terminal background.`

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.flags.has("help")) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }

  const settingsStore = createSettingsStore(defaultSettingsPath())
  const saved = await settingsStore.load()
  // Nothing saved yet: guess the way `grid` always has, rather than a fixed baseline nobody chose.
  // Once anything is saved, that choice is what a plain relaunch (no flags) sees from here on.
  const base: Settings = saved ?? { ...DEFAULT_SETTINGS, capability: detectCapability() }

  // An exported text (`--settings`) sits between what is saved and a flag of its own: it is how an
  // agent starts from exactly what the owner had, and a flag still overrides one setting of it.
  const imported = importSettings(args.options.get("settings"), base)
  const settings: Settings = {
    capability: parseCapability(args.options.get("capability") ?? imported.settings.capability),
    theme: parseTheme(args.options.get("theme") ?? imported.settings.theme),
    glyphPack: parseGlyphPack(args.options.get("glyphs") ?? imported.settings.glyphPack),
    reducedMotion: args.flags.has("reduced-motion") ? true : imported.settings.reducedMotion,
  }

  if (args.flags.has("spike")) {
    const margin = args.options.get("scroll-margin")
    const buildId = currentCommit()
    return runSpike({
      settings,
      settingsStore,
      backend: args.options.get("backend") ?? "auto",
      stdout: process.stdout,
      stdin: process.stdin,
      ...(margin === undefined
        ? {}
        : { scrollMargin: parseInteger(margin.endsWith("%") ? margin.slice(0, -1) : margin, "--scroll-margin") }),
      ...(imported.experiments === undefined ? {} : { experiments: imported.experiments }),
      ...(buildId === undefined ? {} : { buildId }),
      exporter: terminalExporter(process.stdout, exportPath()),
    })
  }

  return runMenu({
    settings,
    settingsStore,
    backend: args.options.get("backend") ?? "auto",
    stdout: process.stdout,
    stdin: process.stdin,
  })
}

/** `--settings "<text>"` read onto what is saved: the settings it names, and its experiments. What it
 *  could not read is said once, before the screen starts. */
export function importSettings(
  text: string | undefined,
  base: Settings,
): Readonly<{ settings: Settings; experiments?: DebugFlags }> {
  if (text === undefined) return { settings: base }
  const result = parseSettingsExport(text, { settings: base, experiments: defaultExperiments() })
  if (result.ignored.length > 0) {
    process.stderr.write(`terminal-nexus: --settings ignored ${result.ignored.join(", ")}\n`)
  }
  return { settings: result.snapshot.settings, experiments: result.snapshot.experiments }
}

/** Where an export is written: beside the settings file, so it is found where settings already are. */
export function exportPath(): string {
  return join(dirname(defaultSettingsPath()), "settings-export.txt")
}

/** The commit this checkout is at, with "+changes" when it has uncommitted edits — the same stamp the
 *  browser playtest page shows. `undefined` outside a checkout. */
function currentCommit(): string | undefined {
  try {
    const options = { cwd: dirname(new URL(import.meta.url).pathname), encoding: "utf8" as const, stdio: "pipe" as const }
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], options).trim()
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], options).trim() !== ""
    return `${commit}${dirty ? "+changes" : ""}`
  } catch {
    return undefined
  }
}

/**
 * The terminal's export: the text to the clipboard through OSC 52 — the escape sequence iTerm2 and
 * most modern terminals accept for "put this on the clipboard" (iTerm2 asks for it to be allowed:
 * Settings > General > Selection > "Applications in terminal may access clipboard") — and to a file,
 * which always works.
 */
export function terminalExporter(
  stdout: TerminalOutput,
  path: string,
): Readonly<{ destination: string; export: (text: string) => Promise<void> }> {
  const home = homedir()
  const shown = path.startsWith(home) ? `~${path.slice(home.length)}` : path
  return {
    destination: `Copied to the clipboard if your terminal allows it, and saved to ${shown}.`,
    async export(text: string): Promise<void> {
      stdout.write(osc52(text))
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, text, "utf8")
    },
  }
}

/** OSC 52: "set the clipboard to this base64 text", ended by BEL, which more terminals accept than ST. */
export function osc52(text: string): string {
  return `\u001b]52;c;${Buffer.from(text, "utf8").toString("base64")}\u0007`
}
