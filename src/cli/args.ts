export type ParsedArgs = Readonly<{
  command: string
  positional: readonly string[]
  options: ReadonlyMap<string, string>
  flags: ReadonlySet<string>
}>

const VALUE_OPTIONS = new Set([
  "seed",
  "ticks",
  "log-level",
  "events",
  "runs",
  "capability",
  "tile-width",
  "speed",
  "backend",
  "frames",
  "at",
])

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
    if (VALUE_OPTIONS.has(key)) {
      const value = inline ?? argv[index + 1]
      if (value === undefined) throw new Error(`option --${key} needs a value`)
      if (inline === undefined) index += 1
      options.set(key, value)
    } else {
      flags.add(key)
    }
  }

  const [command = "help", ...rest] = positional
  return { command, positional: rest, options, flags }
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
