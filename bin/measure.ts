#!/usr/bin/env node
import { main } from "../src/cli/measure.ts"

// Battles measured the same way before and after a rule changes: `measure help` lists the commands
// (docs/system-design/measurement.md).
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0)
    throw error
  })
}

try {
  process.exitCode = await main(process.argv.slice(2))
} catch (error: unknown) {
  process.stderr.write(`measure: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
