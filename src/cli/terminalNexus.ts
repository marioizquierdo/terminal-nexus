// The `terminal-nexus` executable's own CLI — milestone-03-game-menu.md: the game's actual entry
// point, as distinct from `grid`'s. No subcommand and no map file: `terminal-nexus` launches straight
// to the top-level menu.

import { parseCapability, parseGlyphPack, parseTheme } from "../view/index.ts"
import { detectCapability } from "./index.ts"
import { parseArgs } from "./args.ts"
import { runMenu } from "./menu.ts"

const USAGE = `terminal-nexus — the Terminal Nexus game

  terminal-nexus [--capability monochrome|color16|color256|truecolor]
                  [--theme dark|light] [--glyphs ascii|unicode]
                  [--backend auto|ansi|opentui]
      launches the top-level menu: Campaign, Challenge, Settings, Exit

--capability defaults to the best tier COLORTERM/TERM advertise, color16 if neither says more.
--theme defaults to dark; pass --theme light on a light terminal background.`

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.flags.has("help")) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }

  return runMenu({
    capability: parseCapability(args.options.get("capability") ?? detectCapability()),
    theme: parseTheme(args.options.get("theme") ?? "dark"),
    glyphPack: parseGlyphPack(args.options.get("glyphs") ?? "ascii"),
    backend: args.options.get("backend") ?? "auto",
    stdout: process.stdout,
    stdin: process.stdin,
  })
}
