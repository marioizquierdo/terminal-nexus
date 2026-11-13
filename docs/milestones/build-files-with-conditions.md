# Build files with conditions: a proposal

_A proposal for the next pull request (2026-11-12), written from the owner's idea: build files whose entries hold only
when the battle says so, reading one library of named facts that scripts, build files, a model player and missions
share. Planning, not design: nothing here is built until the owner says so; its open questions are at the end._

_Licence: Apache-2.0._

This sits on top of the plain build file, built: a list of entries, each
`{ "round": 3 | "2-4" | "*", ...build actions }`, where the first entry that matches the round wins. This
proposal adds one optional key to an entry, `when`, and one small library of named facts that `when` reads. It
leaves the entry shape, the round matching and the first-match rule as they are.

What I read: `src/battle/types.ts` (`BuildActions`), `src/battle/build-actions.ts` (`readBuildActions`), `src/battle/brief.ts`
(`briefOf`, `BriefData`, `briefText`), `src/battle/players.ts` (`balanced`, `rush`, `turtle`, `withArea`,
`withUpgrades`, `SCRIPTED`, `scriptedPlayer`), `src/mission/types.ts` and the trigger runner's `verdictAt` in
`src/match/mission.ts`, `src/skirmish/profile-files.ts` and `ScriptProfile` in `src/skirmish/save.ts`,
`players/scripts/*.json`, the armies' building cards, `docs/system-design/battles.md`,
`docs/system-design/skirmish-saves.md`, and the planner direction in `docs/game-design/scripted-opponent.md`.

---

## The format

### One new key: `when`

An entry matches when its `round` matches **and** its `when` holds. An entry with no `when` behaves exactly as
in the first layer. The first entry that matches wins, so put the conditional entries above the fallback.

```json
{ "round": "*", "when": { "credits": { "min": 120 }, "enemy.units": { "of": "bomber", "min": 3 } }, "formation": "apart", "build": [...], "stance": "hold" }
```

The grammar is four rules. That is the whole of it.

1. **`when` is an object, and every key in it must hold** (an "and").
2. **A key is the name of a fact** from the library (`credits`, `supply.room`, `enemy.nexus.share`,
   `enemy.buildings`, `open` ...). Every fact is a whole number.
3. **The value is a test**:
   - `{ "min": 3 }`, `{ "max": 7 }`, or both: the fact is at least, at most, or between (both ends counted).
   - `{ "of": "bomber", "min": 3 }`: the facts that count something of a kind take `of`, a card id or a unit id.
   - a bare string, `"open": "garrison"`, is short for `{ "of": "garrison", "min": 1 }`: "there is one", "it is
     open", "I can afford it". This is the common case, and it reads like a sentence.
   - A bare number is not allowed. `"credits": 120` could mean "exactly" or "at least"; a person and a model would
     guess differently, so the reader refuses it and says to write `min` or `max`.
4. **Two words combine tests**: `"any": [ {...}, {...} ]` holds when one of them holds; `"not": {...}` holds when
   it does not. They nest, but the examples below never need more than one level.

Yes-or-no facts are 0 or 1, so the same tests work on them: `"commander.out": { "min": 1 }`, or the string form
`"afford": "battery"`.

### Why this shape

- **It is JSON a model writes without a grammar to learn.** No expression strings to parse (`"credits >= 120"`),
  no operators as keys (`">="`). `min` and `max` are the two words a person would use.
- **It is checked before the battle.** Every fact name and every `of` is a name in a table, so a typo
  (`"suply.room"`) is refused at load with the list of names it could have meant, the way `src/mission/validate.ts`
  checks a mission and lists every problem, not only the first.
- **It mirrors the mission files.** A mission trigger is already `{ "when": ..., "do": [...] }`
  (`TriggerDefinition`); a build entry becomes `{ "round", "when", ...plan }`. Both are literals, never functions,
  which is what the owner already chose for missions (declarative triggers).

### What happens when nothing matches

Whatever the first layer does when no entry matches the round. I assume it is the plan `readBuildActions` returns for "no
plan found": keep nothing, build nothing, hold. A `when` does not change that.

### Examples

The building ids below are the Citizen army's (`barracks` 40 credits, `depot` 30, `garrison` 100 needing a
Barracks, `battery` 50 needing a Barracks, its Mortars hit an area) and `turret` (15) from `armies/all`. The
Ravels' area building is `fuse-shed`, its unit the Bomber.

**1. `rush` rewritten** (`players/scripts/agro.json` plays it). The script buys "the cheapest producer" with every
credit, forward, and attacks every round. For a Citizen side the cheapest producer is the Barracks, so:

```json
[
  { "round": "*",
    "build": [
      { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "forward" },
      { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "forward" }
    ],
    "stance": "attack", "note": "rush: Barracks forward with every credit, attack every round" }
]
```

It needs no condition at all. It cannot say "the cheapest producer", so it is written for one army. The four
Barracks are "while credits last": the ones it cannot pay for are refused, and each refusal is said in the next
brief and in the round's report. That works, but it is noisy (see the open questions: a way to say "as many as the
credits buy").

**2. `turtle` rewritten** (`defensive.json`). Two Turrets forward, the strongest producer behind, hold until the
last two rounds. The rounds a battle lasts are known before the battle (8 unless set), so "the last two rounds" is a
range:

```json
[
  { "round": "7-8",
    "build": [ { "building": "garrison", "at": "back" }, { "building": "barracks", "at": "back" }, { "building": "barracks", "at": "back" } ],
    "stance": "attack", "note": "turtle: the last two rounds, everything goes" },
  { "round": "*", "when": { "open": "garrison" },
    "build": [ { "building": "turret", "at": "forward" }, { "building": "turret", "at": "forward" }, { "building": "garrison", "at": "back" } ],
    "stance": "hold", "note": "turtle: turrets forward, the Garrison behind" },
  { "round": "*",
    "build": [ { "building": "turret", "at": "forward" }, { "building": "turret", "at": "forward" }, { "building": "barracks", "at": "back" } ],
    "stance": "hold", "note": "turtle: turrets forward, a Barracks behind until a Garrison opens" }
]
```

The condition does real work here: the script's "strongest producer" becomes "the Garrison once it is open, a
Barracks before". `"round": "7-8"` breaks when a save sets a different number of rounds; a fact `rounds.left`
fixes that (`"when": { "rounds.left": { "max": 2 } }`, entry on `"*"`), so the example could be written either
way.

**3. `balanced` rewritten** (`steady.json`, the setup screen's default opponent). Room before the army fills, then
the producers that train the most strength a credit, hold two rounds and attack from the third:

```json
[
  { "round": "1-2", "when": { "supply.room": { "max": 7 } },
    "build": [ { "building": "depot", "at": "back" }, { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "north" } ],
    "stance": "hold" },
  { "round": "1-2",
    "build": [ { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "north" }, { "building": "barracks", "at": "south" } ],
    "stance": "hold" },
  { "round": "*", "when": { "supply.room": { "max": 7 } },
    "build": [ { "building": "depot", "at": "back" }, { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "north" } ],
    "stance": "attack" },
  { "round": "*",
    "build": [ { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "north" }, { "building": "barracks", "at": "south" } ],
    "stance": "attack", "note": "balanced: room before the army fills, attack from round 3" }
]
```

The `supply.room` test is exactly the script's `roomLeft(brief) < 8`. What it cannot say: "the producer with the
most strength a credit", which the script works out from `BriefBuilding.strength / cost` each round. Written by
hand for one army, the answer is a fixed id. It also has to repeat the build list once per stance, because an
entry is a whole plan: four entries for what the script says in one function.

**4. Answering the enemy: spread out against area damage.** A file a script cannot be today without new code:

```json
[
  { "round": "*", "when": { "any": [ { "enemy.buildings": "fuse-shed" }, { "enemy.units": "bomber" } ] },
    "formation": "apart",
    "build": [ { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "forward" } ],
    "stance": "attack", "note": "they field Bombers: set apart" },
  { "round": "*", "formation": "block",
    "build": [ { "building": "barracks", "at": "forward" }, { "building": "barracks", "at": "forward" } ],
    "stance": "attack", "note": "no area damage across the line: a block" }
]
```

**5. Defend when hurt, press when ahead.** Reads both Nexuses:

```json
[
  { "round": "*", "when": { "nexus.share": { "max": 40 } },
    "build": [ { "building": "turret", "at": "nexus" }, { "building": "turret", "at": "nexus" }, { "building": "barracks", "at": "back" } ],
    "stance": "hold", "note": "below 40%: hold the Nexus" },
  { "round": "*", "when": { "enemy.nexus.share": { "max": 50 }, "credits": { "min": 100 } },
    "build": [ { "building": "garrison", "at": "forward" } ],
    "stance": "attack", "note": "they are below half: Pikemen forward" },
  { "round": "*", "build": [ { "building": "barracks", "at": "forward" } ], "stance": "attack" }
]
```

**6. A test for a coding agent** (the reason the owner gives: "testing capabilities that work for in-game
intelligence and coding agent alike"). One slot plays a fixed opening blind for three rounds, then reacts to one
fact, so a test can pin what happens when a Battery opens:

```json
[
  { "round": 1, "build": [ { "building": "barracks", "x": 14, "y": 12 } ], "stance": "hold" },
  { "round": "2-3", "when": { "afford": "battery" }, "build": [ { "building": "battery", "at": "back" } ], "stance": "hold" },
  { "round": "2-3", "stance": "hold" },
  { "round": "*", "stance": "attack" }
]
```

### What the format cannot express, honestly

Conditions choose **which plan**. They do not choose **what goes in the plan**. Everything the scripts compute
inside a plan is out of reach:

| The script does | A build file today |
| --- | --- |
| "the cheapest producer" (`rush`), "most strength a credit" (`balanced`), "strongest" (`turtle`) | names one building id: the file is written for one army |
| spends credits in a loop until nothing fits (`spend`) | lists a building several times; the extra ones are refused and said |
| keeps the rarest card, or one whose words say troops (`bestCard`) | `power` is a card's place in the hand, which the seed deals; a blind file cannot know it |
| buys every upgrade its standing buildings offer, cheapest first (`withUpgrades`) | `actions` name a building by its anchor, which a blind file does not know before the building stands |
| buys the area building, or what it needs, first (`withArea`) | expressible per army with `open` and `afford` (example 6), but as two entries per case |
| changes one field (formation) and keeps the rest (`inFormation`) | an entry is a whole plan, so every variant repeats the build list |

The three smallest fixes, each its own later pull request, each a choice for the owner (see the questions):
`power` as a list of preferred card ids; `"fill": true` on a placement ("as many as the credits buy");
building actions by building id instead of anchor (`{ "building": "barracks", "action": "production-line" }`:
every standing Barracks without it). With those three, `rush` and `turtle` are fully data for one army; `balanced`
still needs "strength a credit" (a selector, which I recommend against for now).

---

## The library of facts

### What it is

One table, `FACTS`, in a new pure module `src/battle/facts.ts`. Each entry is a name, a line saying what it is,
whether it takes `of` and what kind of id, and a pure function over `BriefData`:

```ts
export type Fact = Readonly<{
  about: string                                   // one line, shown to a model and in errors
  of?: "building" | "unit" | "power"               // the kind of id `of` names, when it takes one
  read: (brief: BriefData, of?: string) => number  // a whole number; yes/no is 0 or 1
}>
export const FACTS: Readonly<Record<string, Fact>> = { ... }
export function holds(when: Condition, brief: BriefData): boolean
export function checkCondition(when: unknown, where: string): readonly string[]   // problems, all of them
```

The table **is** the declarative schema the owner asks for: the reader of a build file checks a `when` against
it; `briefText` can list it for a model; a mission validator could check a mission's condition against it; and a
script calls `FACTS["supply.room"].read(brief)` instead of its own `roomLeft`. Same function, same number, for
every reader.

### The facts, first cut

Every one is computed from what `briefOf` already puts in `BriefData`. None reads the battle state directly.

| Fact | `of` | What it is | From |
| --- | --- | --- | --- |
| `round` | | this round's number | `brief.round` |
| `rounds.left` | | rounds after this one | `brief.rounds - brief.round` |
| `credits` | | credits to spend | `brief.credits` |
| `supply.used`, `supply.room` | | places used; places left (999 when unlimited) | `brief.supply` |
| `nexus.health`, `nexus.share` | | own Nexus's health; its share, a whole percent | `brief.nexus` |
| `enemy.nexus.health`, `enemy.nexus.share` | | the same for theirs | `brief.enemy.nexus` |
| `buildings`, `enemy.buildings` | building | how many stand (all, or of one card) | `brief.yours.buildings`, `brief.enemy.buildings` |
| `units`, `enemy.units` | unit | how many on the Grid (all, or of one kind) | `brief.yours.units`, `brief.enemy.units` |
| `open` | building | 1 when what it needs stands | `BriefBuilding.open` |
| `afford` | building | 1 when open and its cost is within credits | `open`, `cost`, `credits` |
| `kept`, `enemy.kept` | power | how many powers kept (all, or that one) | `brief.kept`, `brief.enemy.kept` |
| `hand` | power | 1 when that card is in this round's hand | `brief.hand` |
| `commander.out` | | 1 when the Commander is out this round | `brief.commander.status` |
| `enemy.area` | | 1 when anything the enemy can build trains area damage | `brief.enemy.trains` |
| `last.lost`, `last.dealt` | | what this side lost and dealt last round (0 in round 1) | `brief.last` |

Percentages are whole numbers (`Math.floor(health * 100 / most)`), so no fraction ever decides a branch
differently on Node and Bun.

### What `BriefData` needs first

Several brief fields are **words for a reader**, not data for a check, and a fact would have to parse them:

- `yours.buildings` and `enemy.buildings` are strings, `"Barracks at 9,5"`.
- `yours.units` and `enemy.units` are keyed by title (`"Trooper"`, via `titleOf`), not by id.
- `kept` and `enemy.kept` are power **names**, not ids.
- `commander.status` is a sentence; `enemy.trains` are sentences.

The fix is additive: `briefOf` also writes the same facts by id (a `standing: { id, x, y }[]` for each side,
units by short id, kept powers by id, `commander.out: boolean`, `enemy.area: boolean`). `briefText` keeps writing
words, so the model's brief does not change. Facts then read ids, never parse sentences. This is the one change to
existing code the library forces, and it makes the scripts better too: `withArea` today finds the building it
needs by comparing `area.needs` (names) with `building.name`.

`of` accepts the id a file author knows: a building's card id (`garrison`, as in a plan's `build`), a unit's short
id (`bomber`, the last part of `unit.ravel.bomber`), a power's id (`hot-dice`). An `of` the two armies do not have
is refused at load when the armies are known (on the `skirmish` command, they are), so `"enemy.units": "bomer"`
fails before the battle, not silently forever.

### What would be shared with missions, and what would move

The mission runner's conditions (`TriggerCondition` in `src/mission/types.ts`, read by `verdictAt` and
`missionOpening` in `src/match/mission.ts`) answer **when**: a moment in a Pulse, a Pulse's end, a Build Phase
opening, a Nexus destroyed (`hasNexus` before and after). The facts answer **whether**: what is true at the start
of a Build Phase. They are different questions, so neither replaces the other.

- **Nothing moves out of the mission runner in the first pull request.** `hasNexus` reads `MatchState` during the
  Pulse; a fact reads the brief before it. Forcing one onto the other would make the mission runner build a brief
  mid-Pulse.
- **Later, a trigger gains an optional `if`**, a `when` from this library, checked only on `build.start` and
  `pulse.end` (the two moments the whole state is settled). `{ "when": { "event": "build.start", "pulse": 2 },
  "if": { "enemy.units": { "min": 6 } }, "do": [ { "say": ... } ] }`. For that the mission side needs a
  `BriefData` (or the part of it facts read) for a side of a mission round. A battle computes one with `briefOf`
  from a `BattleState`; a mission round has a `MatchState` and a level, not a `BattleState`. So the shared input
  should be a **narrower type the facts read** (call it `Facts` data: the id fields above, credits, supply,
  Nexuses, round), which `briefOf` produces for a battle and a mission function would produce for a mission. That is
  the moment the library moves from `src/battle/facts.ts` to a home of its own beside `src/mission/` (it imports only
  types, so `tests/architecture.test.ts` keeps the mission files free of the kernel).
- **A mission's `commitPlan` already is a build-file entry in disguise**: a side's buildings for one Pulse. A
  mission's scripted side could one day be a build file (`round`, `when`, plan), which is what
  `scripted-opponent.md` asks for when it says the opponent's planner "writes plans in this same vocabulary". Not
  now: PERIMETER's raid is spawns, not a Build Phase.

---

## How the pieces meet

The key fact about the code as it stands: **every player is already `Player = (brief: BriefData) => BuildActions`**
(`src/battle/players.ts`). A build file with conditions is just one more of those:

```ts
export function buildFilePlayer(entries: readonly BuildEntry[]): Player {
  return (brief) => {
    const entry = entries.find((e) => roundMatches(e.round, brief.round) && (e.when === undefined || holds(e.when, brief)))
    return entry === undefined ? NO_PLAN : readBuildActions(planFieldsOf(entry)).plan
  }
}
```

That puts a build file on the same footing as `rush` everywhere a `Player` goes: `playNext`, the measurement
commands, a tally over seeds.

| Piece | Stays code | Can become data |
| --- | --- | --- |
| The facts (`FACTS`) | yes: each is a small pure function; the table is the boundary | their names and `about` lines are what data refers to |
| `balanced`, `rush`, `turtle` | yes, as the army-independent players (they work for any Commander because they rank the brief's buildings) | a per-army build file plays the same idea for one army; useful as a test of the format, not as a replacement |
| `withArea`, `withUpgrades`, `inFormation` | yes for now (they compose players) | `inFormation` already has a data form: an entry's `formation` |
| Small conditions inside scripts | `roomLeft`, `brief.round >= 3`, `brief.round >= brief.rounds - 1` become fact reads | |
| Script profiles (`players/scripts/*.json`) | | **could name a build file** instead of a script: `{ "build": "rush-citizen.json", "about": ... }`. Then a person adds a new opponent to the setup screen by adding two files, no code. `readProfiles` would accept either `script` or `build`. A later step, and the owner's call |
| A build file on the command line (`--p1 build:file.json`) | | is data, read by the first layer, with `when` added here |
| Missions | the runner, `hasNexus`, the moments | a trigger's `if`, later, from the same table |
| A model player | the brief, the reader | see below |

### A model player

Two uses, both reading the same table:

- **Per round, as now**: the brief's text gains a short "Facts" section written from `FACTS`, each name, its line
  and this round's value. The model then reads exactly the numbers a script and a build file read, by the same
  names, and its `note` can cite them ("supply.room 4, so a Depot").
- **Many rounds at once**: a model writes a build file with conditions once, for the rounds ahead, and the
  `skirmish` command plays it blind. One model call per battle instead of one per round, and the file it wrote is
  the record of how it meant to play, which a person can read and re-run on another seed. This is the owner's
  "play blindly" in its most useful form.
- **As a tool**: a coding agent driving `skirmish` could ask for a slot's facts (a later
  `skirmish -f s.json --facts p1`, printing the table's values). Not in the first pull request: the brief already
  carries them.

---

## Determinism and simultaneity

- **A condition reads only the brief at the start of the Build Phase.** `briefOf(state, side)` is a pure function
  of the `BattleState` between rounds, and both slots' briefs come from the same state before either plan exists.
  `holds(when, brief)` takes nothing else. It cannot see the other slot's plan this round, because that plan is not
  in the brief (`briefOf` says so: "The enemy's plan for this round is never in it").
- **What a slot sees of the other side is what is public**: its standing buildings, units on the Grid, kept powers,
  Nexus health, last round's report. The same facts a person on the Build Phase screen can see.
- **No clock, no random, no log.** Facts are whole-number arithmetic on the brief. They never read the Activity
  Logs or the round's printed lines; `brief.last` is the `RoundReport` kept in the battle's state, not a log, so the
  rule that a log is never an input holds.
- **The order is fixed**: entries are read top to bottom, `when` keys are all-of (order does not matter for an
  "and"), `any` is read in list order, and the first matching entry wins. The same file and the same brief give
  the same plan on Node and Bun, every run.
- **Blind is blind**: a file written before the battle cannot be changed by what happens during it, except through
  the facts it chose to test. A condition is the file's way of reacting; it is never a peek.

---

## A first pull request, sized small

**What it builds**

1. `src/battle/facts.ts`: the `FACTS` table (the first cut above, minus anything that needs the brief's id fields
   if those are not added in the same pull request), `holds`, and `checkCondition` returning every problem.
2. `BriefData` gains the id fields facts need (standing buildings by id and anchor, units by short id, kept powers
   by id, `commander.out`, `enemy.area`). Additive; `briefText` unchanged.
3. The first layer's build-file reader accepts an optional `when` on an entry, checks it at load against `FACTS`
   (and against the two armies' ids when the command knows them), and the entry matches only when it holds.
4. `roomLeft` in `src/battle/players.ts` becomes `FACTS["supply.room"].read`, and the scripts' round checks read
   `round` and `rounds.left`: one shared function, no change in play.
5. The command's manual (the opening comment of `src/cli/skirmish.ts`) and `battles.md` say what `when` is, with one
   example; a `when` example file beside the first layer's.

**What it tests**

- Each fact on a brief made from a known save (`saves/` or `sandboxes/`): the number it reads.
- `holds`: `min`, `max`, both, `of`, the string short form, `any`, `not`, a bare number refused.
- `checkCondition`: an unknown fact name, an `of` on a fact that takes none, an unknown id, all said at once.
- The first match wins with conditions: a file whose second entry holds and first does not plays the second.
- A battle played with example 4 against `rush-area` switches to `apart` once the Fuse Shed stands, and the same
  battle on the same seed hashes the same on Node and Bun.
- The scripts play exactly as before after step 4 (the existing pinned battles stay green, unchanged).

**What it leaves for later**

`power` by card id, `fill`, building actions by building id, profiles naming a build file, the brief's "Facts"
section for a model, `--facts`, a mission trigger's `if`, and any selector ("the cheapest producer").

---

## Open questions for the owner

1. **Should a bare number mean "at least"?** `"credits": 120` is shorter than `"credits": { "min": 120 }`.
   *Recommendation*: no, refuse it and say to write `min` or `max`. A model and a person would read it differently,
   and the error is cheap; the string short form already covers the common yes-or-no case.
2. **Should a build file name its power by card id instead of by its place in the hand?** The hand is dealt by the
   seed, so a file written blind cannot know that card 2 is Hot Dice. *Recommendation*: yes, as the next small pull
   request: `power` may also be a list of card ids, the first in the hand kept (`"power": ["hot-dice", "hired-guns"]`),
   and a number keeps working.
3. **A way to say "as many as the credits buy"?** Listing a Barracks four times works but fills the report with
   refusals. *Recommendation*: yes, `"fill": true` on the last placement, repeated while credits last, the
   refusals not said. Small and readable.
4. **Should the format grow selectors** ("the cheapest open producer", "the most strength a credit") so a file can
   be army-independent like the scripts? *Recommendation*: not now. That is a second language inside the first.
   Keep the three scripts as code for the army-independent opponents, and let build files be per army.
5. **Should a script profile be able to name a build file**, so a new opponent on the setup screen is two files
   and no code? *Recommendation*: yes, after questions 2 and 3, since those are what make a build file a fair
   opponent; until then a profile names a script.
6. **Should a mission trigger gain `if` from the same library?** *Recommendation*: yes in principle, but only when
   a mission needs one (none does today; PERIMETER's triggers are moments and a Nexus falling). Keep the library's
   input narrow so a mission can feed it then.
