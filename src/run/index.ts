// Challenge runs (docs/game-design/game-modes.md, Challenge — runs): a seeded series of battles, each a duel against
// a Commander Army played by a scripted duel player. `run.ts` is the run, pure; the application shell plays its
// battles on the Build Phase screen (`src/cli/run-play.ts`).

export * from "./types.ts"
export * from "./run.ts"
export * from "./army.ts"
export * from "./draft.ts"
