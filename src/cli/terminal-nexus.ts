// The `terminal-nexus` executable's own CLI: the game's actual entry
// point, as distinct from `grid`'s. No subcommand and no map file: a bare `terminal-nexus` opens the title
// menu, and `--at <route>` opens any other place in the game (`./route.ts`) — a screen of the title menu, or a
// campaign level's Build Phase at one of its rounds.
//
// **The bare command** opens the title menu today. That is a stand-in for the intended start: once the game can
// save, a plain launch continues the saved game from its default place beside the settings
// (`~/.terminal-nexus/`), and opens the title menu only when there is none; `--at` stays the way to go anywhere
// else, saved game or not. Saves are not built (`launchDestination`).
//
// The Settings screen makes what a session starts with layered: a saved choice
// (from a previous run's Settings screen) beats `grid`'s own first-run colour-depth guess, and an
// explicit command-line flag beats either — the same override order `grid` itself already uses for
// most of its own flags, just with a saved file added underneath.

import { execFileSync } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { parseCapability, parseGlyphPack, parseTheme } from "../view/index.ts"
import { detectCapability } from "./grid-main.ts"
import { parseArgs, parseInteger } from "./args.ts"
import type { ParsedArgs } from "./args.ts"
import { runMenu } from "./menu.ts"
import { parseKeyScript } from "../playtest/keys.ts"
import { runBuildPhase } from "./build-phase.ts"
import type { Exporter } from "./build-phase.ts"
import { DEFAULT_LEVEL, LEVELS } from "./levels.ts"
import { DEFAULT_LEVEL_ROUTE, PLACES, PLACE_NAMES, RouteError, formatRoute, parseRoute } from "./route.ts"
import type { Destination } from "./route.ts"
import type { ExportKind } from "../build/types.ts"
import { DEFAULT_SETTINGS, createSettingsStore, defaultSettingsPath } from "../settings/index.ts"
import type { Settings } from "../settings/index.ts"
import { importSettings } from "../build/settings-export.ts"
import { TUNING } from "../build/tuning.ts"
import type { TerminalOutput } from "../view/backends/ports.ts"

/** `--help`: the places a route names and the levels come from the route table and the level list, so the
 *  text never names a place or a level the game does not have. */
function usage(): string {
  const places = PLACE_NAMES.map((name) => `        ${name.padEnd(12)}${PLACES[name]?.opens ?? ""}`).join("\n")
  const levels = LEVELS.map((level) => `        ${level.id.padEnd(16)}${level.title}, rounds 1 to ${level.rounds}`).join("\n")
  // Quoted only where the shell would read the route itself.
  const example = (route: string, what: string): string =>
    `        --at ${/[?&]/u.test(route) ? `'${route}'` : route}`.padEnd(54) + what
  return `terminal-nexus — the Terminal Nexus game

  terminal-nexus [--at <route>] [--settings "<text>"]
                 [--capability monochrome|color16|color256|truecolor]
                 [--theme dark|light] [--glyphs ascii|unicode] [--reduced-motion]
                 [--backend auto|ansi|opentui]
      With no --at, opens the title menu: Campaign, Challenge, Settings, About, Exit.
      (Once the game can save, a plain launch will continue the saved game instead.)

  --at <route>
      opens the game at a place, written like a web address without its site: the place,
      then ? and name=value pairs joined by &. Quote it: the shell reads ? and & itself.
${places}
      For example:
${example("settings", "the title menu's Settings screen")}
${example(DEFAULT_LEVEL_ROUTE, `${DEFAULT_LEVEL.title}'s Build Phase, round 1`)}
${example(`${DEFAULT_LEVEL_ROUTE}&round=3`, "its round 3, reached as a player who")}
${"".padEnd(54)}builds nothing reaches it
      round counts Battle Rounds from 1, as the screen does. The levels:
${levels}

      A campaign level opens its Build Phase on its map and plays its mission from there: a
      Grid larger than the screen, a cursor that scrolls it, buildings to place by keyboard,
      by mouse or from a script, a Nexus power to pick, then the Nexus Pulse. Esc opens the
      game menu: Settings, in sections - the display settings (saved, like the title menu's)
      and Experiments, the choices still being tried, live, never saved; d jumps straight to
      the first of them. "Export settings" copies them all as text. The game menu's Activity
      logs shows what happened, through a filter; "Export logs" copies it and saves
      activity-export.txt. Two flags only a campaign level takes:
      --keys "<key script>" opens it already in the state those keys reach, in the scripted
      playtest's key names: --keys "Esc n 1 1 Enter" skips the intro, picks the first power and
      places a Barracks. For demos and for reproducing a report; the keyboard is yours after
      the last key.
      --scroll-margin <percent> changes how close to the edge of the view the cursor gets
      before the map starts scrolling, as a share of the view's width and height
      (${TUNING.scrollMargin} unless given; "${TUNING.scrollMargin}" and "${TUNING.scrollMargin}%" are the same).

  --settings "<text>"
      starts with an exported text's settings and experiments, for this run only: paste the
      whole export, or just pairs, separated by spaces or by & as in a route:
      "nextRound=auto trainEvery=6" or "trainEvery=6&reducedMotion=true". On and off
      settings take true and false too.

A first launch guesses colour depth the way \`grid\` does; every launch after that remembers whatever
was last chosen on the Settings screen (~/.terminal-nexus/settings.json). Any flag above overrides
its own setting for this one run without changing what is saved.

--theme defaults to dark; pass --theme light on a light terminal background.`
}

/**
 * Where a launch opens: where `--at <route>` says. Throws a `RouteError` for a route that is not a place in the
 * game.
 *
 * **Without it, the title menu.** That is a stand-in for the intended start: once the game can save, a bare
 * launch is meant to continue the saved game from its default place beside the settings (a file in
 * `~/.terminal-nexus/`, next to `settings.json`), and to open the title menu only when there is no saved game;
 * `--at` stays the way to go anywhere else. Saves are not built.
 */
export function launchDestination(args: ParsedArgs): Destination {
  return parseRoute(args.options.get("at") ?? "menu")
}

/** What `--at` says for a route that is not a place: every problem, then where to read what exists. */
export function routeRefusal(error: RouteError): string {
  const problems = error.problems.map((problem) => `  - ${problem}\n`).join("")
  return `terminal-nexus: --at "${error.route}" is not a place in the game:\n${problems}terminal-nexus --help lists every place, with examples.\n`
}

/** The flags only a campaign level's Build Phase reads. */
const BUILD_PHASE_FLAGS = ["keys", "scroll-margin"] as const

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.flags.has("help")) {
    process.stdout.write(`${usage()}\n`)
    return 0
  }

  // Where to open, read before anything is touched: a route that is not a place is refused whole, every
  // problem at once, and so is a flag the place it names cannot use.
  let destination: Destination
  try {
    destination = launchDestination(args)
  } catch (error) {
    if (!(error instanceof RouteError)) throw error
    process.stderr.write(routeRefusal(error))
    return 2
  }
  const unused = BUILD_PHASE_FLAGS.filter((name) => args.options.has(name))
  if (destination.kind === "title" && unused.length > 0) {
    const flags = unused.map((name) => `--${name}`).join(" and ")
    process.stderr.write(
      `terminal-nexus: ${flags} ${unused.length > 1 ? "are" : "is"} for a campaign level's Build Phase, and ` +
        `${formatRoute(destination)} is on the title menu: try --at '${DEFAULT_LEVEL_ROUTE}'\n`,
    )
    return 2
  }

  const settingsStore = createSettingsStore(defaultSettingsPath())
  const saved = await settingsStore.load()
  // Nothing saved yet: guess the way `grid` always has, rather than a fixed baseline nobody chose.
  // Once anything is saved, that choice is what a plain relaunch (no flags) sees from here on.
  const base: Settings = saved ?? { ...DEFAULT_SETTINGS, capability: detectCapability() }

  // An exported text (`--settings`) sits between what is saved and a flag of its own: it is how an
  // agent starts from exactly what the owner had, and a flag still overrides one setting of it. What
  // it could not read is said once, before the screen starts.
  const imported = importSettings(args.options.get("settings"), base)
  if (imported.ignored.length > 0) {
    process.stderr.write(`terminal-nexus: --settings ignored ${imported.ignored.join(", ")}\n`)
  }
  const settings: Settings = {
    capability: parseCapability(args.options.get("capability") ?? imported.settings.capability),
    theme: parseTheme(args.options.get("theme") ?? imported.settings.theme),
    glyphPack: parseGlyphPack(args.options.get("glyphs") ?? imported.settings.glyphPack),
    reducedMotion: args.flags.has("reduced-motion") ? true : imported.settings.reducedMotion,
  }

  // The commit this build is: named on About, at the top of an export, and at `session.start`.
  const buildId = currentCommit()

  // A campaign level: its Build Phase, at the round the route names.
  if (destination.kind === "level") {
    const margin = args.options.get("scroll-margin")
    const startKeys = args.options.get("keys")
    return runBuildPhase({
      settings,
      settingsStore,
      level: destination.level,
      round: destination.round,
      backend: args.options.get("backend") ?? "auto",
      stdout: process.stdout,
      stdin: process.stdin,
      ...(margin === undefined
        ? {}
        : { scrollMargin: parseInteger(margin.endsWith("%") ? margin.slice(0, -1) : margin, "--scroll-margin") }),
      experiments: imported.experiments,
      ...(buildId === undefined ? {} : { buildId }),
      ...(startKeys === undefined ? {} : { startKeys: parseKeyScript(startKeys) }),
      exporter: terminalExporter(process.stdout, exportPath()),
    })
  }

  // A place on the title menu: the menu, opened where the route says.
  return runMenu({
    settings,
    settingsStore,
    at: destination,
    backend: args.options.get("backend") ?? "auto",
    stdout: process.stdout,
    stdin: process.stdin,
    ...(buildId === undefined ? {} : { buildId }),
    hostName: "terminal",
  })
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

/** The Activity Logs' export file, beside the settings' export. */
export const ACTIVITY_EXPORT_FILE = "activity-export.txt"

/**
 * The terminal's export: the text to the clipboard through OSC 52 — the escape sequence iTerm2 and
 * most modern terminals accept for "put this on the clipboard" (iTerm2 asks for it to be allowed:
 * Settings > General > Selection > "Applications in terminal may access clipboard") — and to a file,
 * which always works. Each export has its own file: the settings' at `path`, the Activity Logs' beside
 * it (`activity-export.txt`), so exporting one never overwrites the other.
 */
export function terminalExporter(stdout: TerminalOutput, path: string): Exporter & Readonly<{ export: (text: string, kind: ExportKind) => Promise<void> }> {
  const home = homedir()
  const shown = (file: string): string => (file.startsWith(home) ? `~${file.slice(home.length)}` : file)
  const files: Readonly<Record<ExportKind, string>> = { settings: path, activity: join(dirname(path), ACTIVITY_EXPORT_FILE) }
  const destination = (kind: ExportKind): string => `Copied to the clipboard if your terminal allows it, and saved to ${shown(files[kind])}.`
  return {
    destination: { settings: destination("settings"), activity: destination("activity") },
    async export(text: string, kind: ExportKind): Promise<void> {
      stdout.write(osc52(text))
      await mkdir(dirname(files[kind]), { recursive: true })
      await writeFile(files[kind], text, "utf8")
    },
  }
}

/** OSC 52: "set the clipboard to this base64 text", ended by BEL, which more terminals accept than ST. */
export function osc52(text: string): string {
  return `\u001b]52;c;${Buffer.from(text, "utf8").toString("base64")}\u0007`
}
