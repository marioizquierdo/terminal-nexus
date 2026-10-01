// Log levels. `grid`'s CLI defaults to warn. One vocabulary for every log in the project
// (`src/log/levels.ts`); the battle report prints a level in capitals, in its own fixed column.

export type { LogLevel } from "../log/levels.ts"
export { LOG_LEVELS, includesLevel, parseLevel } from "../log/levels.ts"
