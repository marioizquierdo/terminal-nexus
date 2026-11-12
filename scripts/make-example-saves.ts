#!/usr/bin/env node
// Writes the example Skirmish saves in saves/ (docs/system-design/skirmish-saves.md), each from its setup and, for a
// battle already under way, the rounds the scripts played to reach it. Run it again when a rule or the content changes
// a battle, and commit what changed: the saves test checks each file is as the game writes it.
//
//   node scripts/make-example-saves.ts

import { writeFileSync } from "node:fs"
import { briefOf, playRound, SCRIPTED } from "../src/duel/index.ts"
import type { SaveSetup } from "../src/skirmish/save.ts"
import { duelOf, newSetup, saveOf, saveText, SIDE_OF } from "../src/skirmish/save.ts"

type Example = Readonly<{ file: string; name: string; notes: string; setup: SaveSetup; played?: number; scripts?: readonly [string, string] }>

const EXAMPLES: readonly Example[] = [
  {
    file: "crossing-new",
    name: "Vasse against Dob on the Crossing",
    notes: "A new battle with the setup screen's defaults: Vasse played by a person, Dob Hunter by the balanced script.",
    setup: newSetup({ map: "crossing", seed: 7 }),
  },
  {
    file: "crossing-round-4",
    name: "Vasse against Dob, round 4",
    notes: "Three rounds in, both bases built up and the armies regrouped where they fought: Vasse's first three rounds were the balanced script's.",
    setup: newSetup({ map: "crossing", seed: 7 }),
    played: 3,
    scripts: ["balanced", "balanced"],
  },
  {
    file: "mirror-vasse",
    name: "Vasse against Vasse",
    notes: "A mirror, both slots scripted: nobody builds by hand, so the battle is watched (spectating). Balanced in the west, rush in the east.",
    setup: newSetup({ map: "crossing", seed: 2, slots: { p1: { controller: "script:balanced" }, p2: { commander: "vasse", controller: "script:rush" } } }),
  },
  {
    file: "pocket-short",
    name: "A short battle on the Pocket",
    notes: "Four rounds on the small map, the bases close enough to build into each other's reach: a playtest that fits in ten minutes.",
    setup: newSetup({ map: "pocket", seed: 5, rounds: 4, slots: { p1: { commander: "averno" }, p2: { controller: "script:rush" } } }),
  },
]

for (const example of EXAMPLES) {
  let state = duelOf({ format: "terminal-nexus.save/1", setup: example.setup })
  for (let index = 0; index < (example.played ?? 0) && state.result === null; index += 1) {
    const [a, b] = example.scripts ?? ["balanced", "balanced"]
    state = playRound(state, { [SIDE_OF.p1]: SCRIPTED[a]!(briefOf(state, "A").data), [SIDE_OF.p2]: SCRIPTED[b]!(briefOf(state, "B").data) } as never).state
  }
  const path = new URL(`../saves/${example.file}.save.json`, import.meta.url)
  writeFileSync(path, saveText(saveOf(example.setup, state, { name: example.name, notes: example.notes })))
  process.stdout.write(`saves/${example.file}.save.json: round ${state.round}\n`)
}
