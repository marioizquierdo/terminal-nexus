#!/usr/bin/env node
import { main } from "../src/cli/skirmish.ts"

// One Skirmish, set up, played a round at a time and saved, headless: `skirmish --help` says how (docs/system-design/skirmish-saves.md).
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0)
    throw error
  })
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error: unknown) {
  process.stderr.write(`skirmish: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
