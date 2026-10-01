// Log levels — milestone-1-spike-battle.md 3.3. `grid`'s CLI defaults to `warn`. One vocabulary for every
// log in the project (`src/log/levels.ts`); the battle report prints a level in capitals, in its own
// fixed column (`formatLine`).

export type { LogLevel } from "../log/levels.ts"
export { LOG_LEVELS, includesLevel, parseLevel } from "../log/levels.ts"
