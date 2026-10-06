export type ParsedArgs = Readonly<{
  /** `positional[0]` is the map file path when one was given; there is no subcommand any more. */
  positional: readonly string[]
  options: ReadonlyMap<string, string>
  flags: ReadonlySet<string>
}>

const VALUE_OPTIONS = new Set([
  "seed",
  "ticks",
  "turn",
  "log-level",
  "save-log",
  "events",
  "runs",
  "capability",
  "speed",
  "backend",
  "cosmetic-seed",
  "glyphs",
  "theme",
  "scroll-margin",
  // A launch's parts (src/cli/launch.ts): where the game opens, the settings text and the keys it starts from.
  // Every one must be here (tests/launch.test.ts), or the parser would take it for a flag and drop its text.
  "at",
  "settings",
  "keys",
])

/**
 * Options no command line reads any more, each with what to say instead: both `grid` and `terminal-nexus` refuse
 * one, saying what changed, rather than run a command copied from an older note as something it did not mean.
 * Each took a value and still takes it here, so the value is refused with its option rather than read as a map or
 * a stray word.
 */
export const RETIRED_OPTIONS: ReadonlyMap<string, string> = new Map([
  ["tile-width", "a tile is one column wide at every terminal size"],
])

/** What a command line says, after its own name, of an option it no longer reads, or `undefined` for one that was
 *  never retired: `--tile-width is gone: a tile is one column wide at every terminal size.` */
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
