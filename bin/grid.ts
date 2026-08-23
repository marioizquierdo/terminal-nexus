#!/usr/bin/env node
import { main } from "../src/cli/index.ts"

// A headless run's log is meant to be piped — `grid x --headless | grep death`, `| head -20` — and
// the downstream end of that pipe is allowed to close before the log does. Without this, Node's
// default behaviour is an unhandled EPIPE exception and a stack trace on a perfectly normal `head`.
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
    process.stderr.write(`[----] ERROR grid ${String(error)}\n`)
    process.exitCode = 1
  })
