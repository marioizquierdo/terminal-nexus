export type ParsedArgs = Readonly<{
  /** Words that are not options: the game takes none. */
  positional: readonly string[]
  options: ReadonlyMap<string, string>
  flags: ReadonlySet<string>
}>

/** The game's options that take a value (`terminal-nexus`, src/cli/terminal-nexus.ts). Every one must be here, or the
 *  parser would take it for a flag and drop its text (tests/launch.test.ts, tests/route.test.ts). */
export const VALUE_OPTIONS: ReadonlySet<string> = new Set([
  // How it looks.
  "colors",
  "theme",
  "glyphs",
  "backend",
  "scroll-margin",
  // A launch's parts (src/cli/launch.ts): where the game opens, the settings text and the keys it starts from; a
  // playtest note to open.
  "at",
  "settings",
  "keys",
  "note",
  // The `skirmish` command's words for a battle, every one (`ASK_WORDS`, src/skirmish/ask.ts).
  "load",
  "map",
  "seed",
  "ticks",
  "rounds",
  "modifiers",
  "p1",
  "p2",
  "p1-commander",
  "p2-commander",
  "p1-credits",
  "p2-credits",
])

/**
 * Retired options, each with what to say instead of reading it: `terminal-nexus` refuses one with its
 * reason, so a command copied from an older note is told what changed rather than run as something it did not mean.
 * Each takes a value, which is refused with it rather than read as a map or a stray word.
 */
export const RETIRED_OPTIONS: ReadonlyMap<string, string> = new Map([
  ["tile-width", "a tile is one column wide at every terminal size"],
  ["capability", "it is called --colors now (monochrome, color256 or truecolor)"],
])

/** What a command line says, after its own name, of a retired option (`RETIRED_OPTIONS`), or `undefined` for any
 *  other argument: `--tile-width is gone: a tile is one column wide at every terminal size.` */
export function retiredOption(argument: string): string | undefined {
  const why = argument.startsWith("--") ? RETIRED_OPTIONS.get(argument.slice(2)) : undefined
  return why === undefined ? undefined : `${argument} is gone: ${why}.`
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = []
  const options = new Map<string, string>()
  const flags = new Set<string>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined) continue
    if (!token.startsWith("--")) {
      positional.push(token)
      continue
    }
    const name = token.slice(2)
    const [key, inline] = name.includes("=") ? splitOnce(name, "=") : [name, undefined]
    if (VALUE_OPTIONS.has(key) || RETIRED_OPTIONS.has(key)) {
      const value = inline ?? argv[index + 1]
      if (value === undefined) throw new Error(`option --${key} needs a value`)
      if (inline === undefined) index += 1
      options.set(key, value)
    } else {
      flags.add(key)
    }
  }

  return { positional, options, flags }
}

function splitOnce(value: string, separator: string): [string, string] {
  const at = value.indexOf(separator)
  return [value.slice(0, at), value.slice(at + 1)]
}

/** Accepts `0x5EED0001` and plain decimal alike. */
export function parseInteger(value: string, what: string): number {
  const parsed = value.startsWith("0x") || value.startsWith("0X") ? Number.parseInt(value, 16) : Number(value)
  if (!Number.isInteger(parsed)) throw new Error(`${what} must be an integer, received "${value}"`)
  return parsed
}
