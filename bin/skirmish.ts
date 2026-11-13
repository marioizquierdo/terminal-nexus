#!/usr/bin/env node
import { main } from "../src/cli/skirmish.ts"

// One Skirmish, headless: `skirmish --help` says how (src/cli/skirmish.ts, whose opening comment is the command's manual).
for (const stream of [process.stdout, process.stderr]) {
  stream.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EPIPE") process.exit(0)
    throw error
  })
}

process.exitCode = main(process.argv.slice(2))
