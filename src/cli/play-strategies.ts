// What battles have taught so far (`docs/game-design/play-strategies.md`), for the brief a player that reads words is
// handed: the `skirmish` command prints it with every brief (`src/cli/skirmish-battle.ts`). A file read, so it lives
// here rather than beside the brief itself (`src/battle/brief.ts`), which is pure.

import { existsSync, readFileSync } from "node:fs"

/** Where the play strategies are kept, and the line after which the page is written to a player. */
const STRATEGIES = new URL("../../docs/game-design/play-strategies.md", import.meta.url)
const STRATEGIES_START = "<!-- The brief reads from here to the end of the page"

/**
 * The play strategies, from the page's marker to its end. Empty when the page is not there, as in a copy of the game
 * without its documents: the brief is whole without it.
 */
export function playStrategies(): string {
  if (!existsSync(STRATEGIES)) return ""
  const page = readFileSync(STRATEGIES, "utf8")
  const start = page.indexOf(STRATEGIES_START)
  if (start === -1) return ""
  return page.slice(page.indexOf("\n", start) + 1).trim()
}
