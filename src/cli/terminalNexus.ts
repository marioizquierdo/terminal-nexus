// The `terminal-nexus` executable's own CLI — milestone-03-game-menu.md: the game's actual entry
// point, as distinct from `grid`'s. No subcommand and no map file: `terminal-nexus` launches straight
// to the top-level menu.
//
// Gate 3B added a real Settings screen, so what a session starts with is now layered: a saved choice
// (from a previous run's Settings screen) beats `grid`'s own first-run colour-depth guess, and an
// explicit command-line flag beats either — the same override order `grid` itself already uses for
// most of its own flags, just with a saved file added underneath.

import { parseCapability, parseGlyphPack, parseTheme } from "../view/index.ts"
import { parseEdgeStyle } from "../view/build.ts"
import { detectCapability } from "./index.ts"
import { parseArgs, parseInteger } from "./args.ts"
import { runMenu } from "./menu.ts"
import { runSpike } from "./spike.ts"
import { DEFAULT_SETTINGS, createSettingsStore, defaultSettingsPath } from "../settings/index.ts"
import type { Settings } from "../settings/index.ts"

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
      --scroll-margin <tiles> changes how close to the edge of the screen the cursor gets
      before the map starts scrolling. Three is the canon's number; try 2 and 5 against it.
      --edge-style hard-soft|scrollbar picks how the border says "there is more Grid this way" -
      the default marks a whole side plain or dim; scrollbar also turns the bottom and west
      sides into a proportional thumb.

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

  const settings: Settings = {
    capability: parseCapability(args.options.get("capability") ?? base.capability),
    theme: parseTheme(args.options.get("theme") ?? base.theme),
    glyphPack: parseGlyphPack(args.options.get("glyphs") ?? base.glyphPack),
    reducedMotion: args.flags.has("reduced-motion") ? true : base.reducedMotion,
  }

  if (args.flags.has("spike")) {
    const margin = args.options.get("scroll-margin")
    const edgeStyle = args.options.get("edge-style")
    return runSpike({
      settings,
      backend: args.options.get("backend") ?? "auto",
      stdout: process.stdout,
      stdin: process.stdin,
      ...(margin === undefined
        ? {}
        : { scrollMargin: parseInteger(margin, "--scroll-margin") }),
      ...(edgeStyle === undefined ? {} : { edgeStyle: parseEdgeStyle(edgeStyle) }),
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
