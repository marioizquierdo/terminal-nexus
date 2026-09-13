#!/usr/bin/env node
import { main } from "../src/cli/terminalNexus.ts"

// Mirrors bin/grid.ts: a broken pipe downstream (`terminal-nexus --help | head`) is a normal exit,
// not an unhandled exception with a stack trace.
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0)
    throw error
  })
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    process.stderr.write(`[----] ERROR terminal-nexus ${String(error)}\n`)
    process.exitCode = 1
  })
