// Routing (milestone 16): how a unit finds its way. Pure parts, each tested alone (`tests/routing.test.ts`), that the
// kernel builds its routes from: where a body may stand (`ground.ts`), the anchors it must reach to act on its goal
// (`goals.ts`), the walking cost to them from anywhere (`field.ts`), and the choice of a step (`steps.ts`). None of
// them knows a tick, a unit or a side: they take a Grid and give numbers.

export * from "./ground.ts"
export * from "./goals.ts"
export * from "./field.ts"
export * from "./steps.ts"
