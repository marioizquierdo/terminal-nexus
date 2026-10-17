#!/usr/bin/env node
import { main } from "../src/cli/duel.ts"

// Two Commander Armies fought out headless: `duel help` lists the commands (docs/system-design/duels.md).
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0)
    throw error
  })
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error: unknown) {
  process.stderr.write(`duel: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
