#!/usr/bin/env node
import { main } from "../src/cli/index.ts"

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    process.stderr.write(`[----] ERROR playground ${String(error)}\n`)
    process.exitCode = 1
  })
