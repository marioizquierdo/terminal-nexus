# Terminal Nexus — campaigns

_What a campaign and a mission are, how a mission is driven by triggers and judged by goals, the opening campaigns and the first missions in full, cutscenes, opponent policies and authoring tools. Mechanical definitions and schemas are Apache-2.0; the story, characters, mission text and ASCII art are CC BY-SA 4.0. Unmarked statements are GUIDANCE._

## 1. Development boundary

**The Campaign is built one mission at a time.** Each mission pulls in exactly the systems it needs rather than waiting for battle presentation, base construction and a two-faction microgame to each finish in full first. The first mission, PERIMETER (section 4.2 below), is played on the starter map with the disposable Citizen and Ravel bench rosters rather than a real Commander Army roster; a full Commander Army is not authored until a real roster is chosen, and one named Commander, her mechanic and her army file at the size of the bench content are the most that come before it, not a locked roster.

This document still gives the *destination* — the belief ramp, the later missions' teaching goals, the cast. Nothing beyond PERIMETER and RIGHT OF SALVAGE is built or in scope; the later missions are **IDEA**. A document describes; it does not schedule.

**The Campaign is one of two single-player modes** ([`game-modes.md`](game-modes.md)): the first-time player experience and the world's fixed story, judged on whether a new player comes out able to play a run and whether the world feels real. Replay value, breadth and duration are Challenge mode's job. Nothing in this document is a length or breadth requirement; the belief ramp is direction for what the missions teach and tell, not a count of missions the game owes. Mechanically the Campaign is the mode that grows the player's pool — each mission unlocks the cards it introduces — which makes its last mission a guided run in all but name.

**RULE — the first complete single-player direction is the Citizen origin campaign** (`armies/vasse/army.json`, PERIMETER, its first level; `tests/mission.test.ts`).

## 2. What defines a campaign

A campaign is an ordered or branching graph of missions plus persistent progression. A mission selects and configures:

- map and scenario rules;
- player and opponent Commander Armies;
- unlocked units, structures, Nexus powers, and upgrades;
- starting packages and resources;
- objectives, loss conditions, triggers, and scripted events;
- opponent policy and allowed exceptions;
- introductory and concluding cutscenes;
- pre-battle exchanges, interruptions, and debriefs;
- rewards, unlocks, and persistent narrative choices.

Campaign unlocks reveal complexity gradually. Full skirmish mode eventually exposes every legal roster without requiring campaign completion.

A high-level definition may resemble the following. It is architectural direction, not a frozen API; what is built today is the smaller `MissionDefinition` in `src/mission/types.ts` (regions, triggers, round count, seed and result text), held by a level of its campaign's army file with the level's map, credits and unlocks, and no opponent deck or objectives list yet.

**A campaign is data in its Commander's army** (RULE — `armies/vasse/army.json`, `src/armies/load.ts`, `tests/armies.test.ts`; army files are in [`content.md`](../system-design/content.md)). It names its Commander and lists its levels in the order they are played, each with a map by name, the credits a Build Phase starts with, what it unlocks and its mission: the sketch's `playerArmy` and `availableContent`, split between the campaign and its levels. **A level offers everything the levels before it unlocked, and its own unlocks**, in the order first unlocked so that a hotkey never moves, and records what is new in it for the screen between levels to show (not built). The Build Phase offers exactly that. The loader refuses an unlock its army cannot see, one an earlier level already gave, and a player Commander that is not the campaign's. PERIMETER, the first level, unlocks every card `armies/all` has, one by one, so that when it grows the level keeps what it teaches; the second, the Commander's cadence played in three rounds, has no unlocks of its own. The first two are called `vasse-test-1` and `vasse-test-2`, the names a route opens them by ([`routing.md`](../system-design/routing.md)), until the campaign has real levels.

```ts
interface MissionDefinition {
  id: string
  map: string
  playerArmy: string                       // a CommanderArmyDefinition id (commander-armies.md)
  opponentArmies: readonly string[]
  availableContent: readonly string[]
  startingState: string
  objective: ObjectiveDefinition            // section 2.2 — the main goal
  bonusObjective?: ObjectiveDefinition       // section 2.2 — optional, unlocks Challenge content
  triggers: readonly TriggerDefinition[]   // section 2.1 — the mission's rounds, script, and scenes
  opponentPolicy: string
  unlocks: readonly string[]
}

interface CampaignDefinition {
  id: string
  entryMission: string
  missions: readonly MissionDefinition[]
  armies: readonly string[]                // the Commander Armies this campaign ships or references
  progressionRules: readonly string[]
}
```

A scene is a trigger like any other (section 2.1), not a special slot; there is no `introScene` or `outroScene`. A mission's goal is a typed shape (section 2.2), not a list of strings, for the same reason Nexus powers are a bounded union ([`commander-armies.md`](commander-armies.md)): a trigger, a HUD and a validator all need to read it, and a string is something only a human can.

### 2.1 Mission time, rounds, and triggers

**A mission is a sequence of rounds driven by triggers** (RULE): as many rounds as its design wants, and a trigger is a condition and a list of actions, the way the original StarCraft editor declares them. The holders are `src/mission/types.ts` (the shapes), `src/mission/validate.ts` (every reference checked before a tick runs), `src/match/mission.ts` (the trigger runner), `tests/mission.test.ts` and `tests/mission-loop.test.ts`. The engine's own loop already alternates without limit ([`pulse.md`](../system-design/pulse.md)); this section is how a mission drives it.

**Mission time.** A simulation moment is addressed as a round and a tick, `{ pulse, tick }` in the code, where `pulse` counts rounds. Phase boundaries are mission events: `mission.start`, `build.start`, `pulse.start`, `pulse.end`, `mission.end`, each carrying the round number. A Pulse may be **scripted** — no player plan; the player watches — which is what an intro is when "enemies arrive and take position" should be *seen moving* rather than described. A scripted Pulse is still a Pulse: seeded, deterministic, in the replay, hash-checked.

**A trigger** is `{ id, when, once?, do }`: a condition, and the actions taken when it holds.

Conditions are evaluated on canonical state and events — **never on what rendered**, so a trigger can never fire because of a frame: a mission event (optionally for one round); a tick within a round; an entity or group dying; an entity entering a named region of the map; an objective changing state; a count of some kind of entity crossing a threshold. Built today: a moment (`{ pulse, tick }`), a round's end, a Nexus destroyed, and a round's Build Phase opening (`{ event: "build.start", pulse }`, for the presentation band).

Actions come in **two bands, and the band is the most important thing on this page**:

| Band | Actions | Where they run | Determinism |
| --- | --- | --- | --- |
| **Simulation** | `spawn` (units at a region, with a line of intention), `target` (where a side's troops head: from this moment its fighting units head for a region, engaging what comes within reach, round after round until another moves it), `commitPlan` (the scripted opponent's Build Phase plan for a given round), `objective` (set or change one), `win`, `lose`, `endPulse`, `startBuild`, `reveal` | applied by the trigger runner as scripted inputs at the tick the condition holds, validated like any player command, emitted as ordinary events | part of the hashed inputs — a replay re-derives them from mission, seed, and plans |
| **Presentation** | `focus` (camera to an entity or a tile, through the ordinary scroll), `card` (a character's portrait card), `say` (speaker and line, advanced by the player or a timeout), `bark`, `effect`, `pause` / `resume` | in presentation; they never write state | re-derived from the event stream and the trigger list; skipping or replaying them changes nothing |

Built today: `spawn`, `target`, `commitPlan`, `win` and `lose`, and in the presentation band `say` at its smallest. The `order` a group carried, which the kernel never read, is gone: a side's target is what the kernel keeps ([`pulse.md`](../system-design/pulse.md), a side's target), and a group's `intent` is what the player reads. Holding and withdrawing wait. PERIMETER names its target: the line, five tiles by two just ahead of the base. The rest are GUIDANCE. A Commander's barks in battle are not a mission's action: they are data in her army, said at moments the view reads off the round's events (her voice in battle, in the interface patterns); a mission's own `bark`, for a unit it names, is still not built.

**A mission's lines are data, and the dialog shows them** (RULE — `src/mission/scene.ts`, `src/mission/validate.ts`, `tests/dialog.test.ts`). `say: { speaker, side?, text, focus? }` runs only at `build.start`: as that round's Build Phase opens, its lines play in the dialog at the bottom of the screen ([`ui-patterns.md`](../system-design/ui-patterns.md), the dialog), one at a time, the camera on each line's focus (a unit, a group or a region). A speaker is a unit the mission brings — Vasse's name, side and `@` come from her content — or a name off the Grid, as Corvane is. Validation refuses, by name, a line anywhere but `build.start`, an empty speaker or text, a line too long for the box at 80 × 24, a structure as speaker, and any speaker or focus the mission does not bring by that round. The trigger runner never reads them, so a mission's states hash the same with and without its lines. The round a Commander is restored opens on one line in the game's own voice, looking at her. Not built: `card`, `bark`, `effect`, a timeout, a scripted Pulse.

**RULE — simulation actions are validated intents that are part of the hashed inputs; presentation actions never touch state** (`src/mission/validate.ts`, `tests/mission.test.ts`: "validation refuses every broken shape by name, and reports them all at once"; "a whole mission is the same mission every run"). A Pulse may be scripted and is still a Pulse. The trigger runner applies the simulation band at tick 0 and between two ticks, beside the kernel and without changing it; the kernel's own door for intents (the narrow hook in [`content.md`](../system-design/content.md)) is unbuilt.

The two bands keep the three-worlds rule ([`grid-engine.md`](../system-design/grid-engine.md)) intact under scripting: only the Pulse mutates state, and the presentation half of a trigger rides on the events the simulation half emits. A `spawn` at `{ pulse: 1, tick: 0 }` shows up in the log as a spawn event like any other; the `card` and `say` that introduce the spawned raid are drawn off that event, and a viewer with reduced motion, a skipped intro, or a monochrome terminal ends the intro on **exactly the same Grid**, because the state half ran whether or not the presentation half was watched.

**The vocabulary grows in code, not in missions.** When a mission needs a condition or action the vocabulary lacks, it is added as a typed kind with a named scenario, exactly the way a kernel rule is. A mission never contains a function. The narrow-hook door ([`content.md`](../system-design/content.md): read-only context in, intents out, validated by the kernel) is the escape hatch for a shape too odd for the vocabulary, and a hook used by two missions becomes a vocabulary entry. Declarative triggers are what is built (Q39, answered); a scripting API would be a design change.

**Custom campaigns.** A mission references armies by id, and an army is a bounded composition validated against its faction's pools ([`commander-armies.md`](commander-armies.md)). A custom campaign is therefore a folder of missions plus the Commander Armies it ships, loaded and validated by the same code as the first-party one. Nothing about that is built or promised now — it is *why* the trigger surface is data and army legality is a load-time check rather than a feature in itself.

**IDEA — PERIMETER's trigger list in this shape**: an intro, a raid in each of three Battle Rounds, and the hold, so the model is concrete rather than described. (The built mission is the first level in `armies/vasse/army.json`.)

```ts
triggers: [
  { id: "intro", when: { event: "mission.start" }, do: [
      { card: "vasse" }, { say: { speaker: "vasse", text: "..." } },
      { focus: { region: "nw-ridge" } },
  ]},
  { id: "raid-1", when: { pulse: 1, tick: 0 }, do: [
      { spawn: { unit: "unit.ravel.raider", count: 3, at: "nw-ridge", intent: "Probe the line at the ridge." } },
      { target: { side: "A", region: "line" } },
      { card: "corvane" }, { say: { speaker: "corvane", text: "Nice fence, roadmakers. We brought wire cutters." } },
  ]},
  { id: "raid-2", when: { pulse: 2, tick: 0 }, do: [ { spawn: { /* larger */ } } ] },
  { id: "raid-3", when: { pulse: 3, tick: 0 }, do: [ { spawn: { /* the push */ } } ] },
  { id: "hold",   when: { event: "pulse.end", pulse: 3 }, do: [ { objective: { id: "hold", state: "complete" } }, { win: true } ] },
]
```

The `{ atTick, action }` list the first raid used is this model with one condition kind and one round — a special case, not a different design.

### 2.2 Objectives

**A mission has goals, not a fixed length, and a goal is one of a bounded union** (RULE — settled; no code holds it yet). A mission is not given a strict length; it is given a few different goals. The goal is most often "destroy the enemy Grid Nexus," but equally "survive N rounds," "capture and hold X by round N," "accumulate X of Y," "keep Z alive." A small bounded union says all of them, in the same spirit as the six Nexus-power effect kinds. The built `MissionDefinition` decides its end with `win` and `lose` triggers and has no objective field.

```ts
type ObjectiveDefinition =
  | { kind: "destroyNexus" }                                         // the kernel's own default
  | { kind: "surviveUntil"; pulse: number }
  | { kind: "captureAndHold"; target: EntityId | RegionId; byPulse: number }
  | { kind: "accumulate"; resource: ContentId; amount: number }
  | { kind: "keepAlive"; target: EntityId | RegionId }
```

**How this meets the kernel's own victory check.** The kernel's check — Grid Nexus destroyed, one side annihilated, tick limit reached ([`pulse.md`](../system-design/pulse.md), where Mario has since settled that a side whose Nexus stands is never annihilated) — **does not change for a goal, and does not need to know about goals.** A mission's objective is resolved one level up, by the scenario and trigger layer (section 2.1), which watches the condition and fires an ordinary `win` or `lose` action when it holds — "the Nexus still stands when round 3 ends" is `{ when: { event: "pulse.end", pulse: 3 }, do: [{ objective: { id: "hold", state: "complete" } }, { win: true }] }`, a trigger like any other. The kernel's own check stays what it always was: the *fallback* result a battle without a scripted objective gets — Skirmish, and every Challenge battle, land on it directly. A mission with a declared objective is never left to that fallback, because its own `win` or `lose` trigger fires first and the mission ends there (`src/match/mission.ts` reads the triggers after the Pulse and lets the first `win` or `lose` decide).

This is a **local data shape**: reversible and narrow, so a session may change it alone (see "What a session decides alone" in [`DEVELOPMENT.md`](../../DEVELOPMENT.md)). What stays genuinely open is only implementation detail: whether `captureAndHold`'s region needs a new kernel primitive (a capture structure is already GUIDANCE, [`pulse.md`](../system-design/pulse.md)) or composes from existing ones. The milestone that builds it decides that on the fixture it actually builds.

## 3. Teaching and progression

**Before authoring anything in this document, read the lore's restraint rules ([`lore.md`](lore.md)).** Missions are where a world grows fastest and where over-authoring costs most: a new character here becomes a name to maintain forever, and a plot thread becomes something every later mission must carry. Complexity in Terminal Nexus grows through units and powers, not through story. A mission's fiction exists to make its *mechanic* memorable — briefing, a few lines, a debrief — and one timeline covers all of it.

Campaign structure should take inspiration from the best StarCraft and Warcraft campaigns and map editors: introduce one important tool in a constrained situation, let the player use it enough to understand its strategic purpose, and then combine it with prior tools.

Each mission should usually:

- teach one major mechanic;
- make one Commander Army choice newly meaningful;
- change one relationship;
- answer one local narrative question;
- open one larger mystery;
- reach player control quickly on replay.

Unlocks may include units, structures, upgrade families, Nexus powers, Commander variations, and campaign-specific options. They should expand decisions rather than provide permanent numerical grinding as a substitute for learning.

## 4. Initial Citizen campaign

The first campaign anchors the galaxy in a recognizable far-future human frontier.

Humans have studied a buried artificial apex for years without finding an age or material history. Harmonious seismic tones precede the Activation. The Prime Nexus rises as a pyramid many times larger than the mapped ruin, destroying the research annex. Neighboring colonies detect the energy release, and expedition security claims the area while central human space remains months away by communication.

A nearby Ravel Prime Nexus responds first, replicating a battle Nexus and sending an alien raiding coalition into the region. A local military leader becomes the provisional human Nexus Symbol. The Prime begins expressing ancient permissions through Citizen engineering and military doctrine.

The later campaign may involve (**IDEA**):

- Ravels as enemies, rivals, and temporary allies;
- Ancient authorities or golems following dangerous functions;
- other humans disputing military ownership of the discovery;
- an awakened Ancient Original.

Beyond the direction below, named cast, betrayals, and endings must wait for mechanics to establish what the campaign needs to teach. The committed cast is deliberately tiny: **Commander Edda Vasse**, the provisional human Symbol, and **Speaker Corvane**, the Symbol the Ravel Prime sent (see [`commander-armies.md`](commander-armies.md)).

The five faction campaigns may eventually show parallel perspectives on one war rather than a single objective chronology.

### 4.1 The belief ramp

Good campaigns teach cosmology from the chair: the player starts with something small and concrete — a machine that will not explain itself — and only much later understands they are inside something enormous. Terminal Nexus has an unusual instrument for this. The interface addresses the player as **Operator**, and what the Operator is belongs to the deliberate mysteries ([`lore.md`](lore.md)). The campaign's job is to promote that title from a decoration the player ignores into a question they carry.

Three rules govern the ramp:

- **Revelations arrive as mechanics wherever possible.** The player should learn the theology by playing it — a fact experienced through the rules outweighs a paragraph asserting it.
- **The interface may misbehave; it never testifies** (the deliberate mysteries in [`lore.md`](lore.md)). It can know too much, precommit a plan, and miscount. It cannot explain itself.
- **A narrative device never touches the engine's record.** The kernel, its event log, and replay stay exact, because determinism is what makes replay and fast-forward possible — a story device may only ever concern what a mission's interface *displays*. Whether any mission uses such a device is a writing decision for the mission that wants it, taken when that mission is designed.

The six-mission arc below is **IDEA** beyond its first two rows: direction for the missions to test, not a count the game owes. PERIMETER is built; RIGHT OF SALVAGE is the next to be built.

| # | Mission | The player believes going in | What the mission does to that belief | Teaches | The interface |
| --- | --- | --- | --- | --- | --- |
| 1 | PERIMETER | "Operator is my job title." | Nothing. The belief is allowed to feel true | Build Phase / Nexus Pulse loop on a small Grid that never scrolls, and that a Commander falls, sits a round out and is restored | Plain, military, correct |
| 2 | RIGHT OF SALVAGE | "The Nexus is a tool we are learning." | First itch: the tool knows things nobody entered | Salvage economy and contested wrecks | Names Speaker Corvane before any contact. Vasse: "Who filed that?" |
| 3 | RESTORATION | "The Nexus is issuing us equipment." | The player has watched Vasse fall and return since the first mission; here what the Nexus restores, and what it files about her, becomes the question | What comes back: the restoration, read closely (her death and absence are taught from mission 1) | Treats death as scheduling: `SYMBOL ABSENT — CYCLE 1 OF 1 — HOLD` |
| 4 | PRECOMMITTED | "I make the plans." | One draft item arrives already committed, marked `SOURCE: NEXUS`. The interface has another user — or another author | The Nexus upgrade draft | Suggestive, not explanatory. The precommitted choice is always defensive, which no one finds comforting |
| 5 | TWELVE OF TWELVE | "The interface reports; reports are true." | The screen's totals disagree with what the player watched. The log did not. Two workers are never accounted for | Reading the report and the replay as diegetic objects | `WORKERS RECOVERED: 12 OF 12` — after fourteen were seen to fall. The seam is discoverable in play |
| 6 | ANNEX ZERO | "Operator is a rank we invented." | Corvane, in parley: the machine speaks over everyone's head — and the player realizes the title predates the software | Neutral hazards: a golem executing its function, hostile to nobody and lethal anyway | Ends on the closing lines, now earned: `ANNEX ZERO EVACUATION COMPLETE / ANNEX ZERO NO LONGER LOCATED` |

By mission six, "Operator" has moved from job title to open question — a role in a protocol older than the rank, read differently by every civilization the player will meet. No mission answers it. Each faction campaign, if built, replays this ramp against its own reading ([`lore.md`](lore.md)): the Ravel campaign's Operator is a conspirator being trusted, the Glitch campaign's a process being audited, and neither campaign corrects the other.

### 4.2 Mission one, in full

The complete written material for PERIMETER, inside the lore's writing budgets ([`lore.md`](lore.md)) — the worked example of what a mission's writing actually weighs.

**Briefing (157 words):**

> OPERATION PERIMETER
>
> Fourteen hours ago the survey annex stopped existing. The structure beneath it did not. It is four hundred meters of illuminated geometry where our instruments report nothing measurable, and it is generating power we did not request and cannot refuse.
>
> Central authority is one hundred and ninety days away at best speed. Whatever we decide, we decide alone.
>
> Expedition security has claimed the site under emergency provisions. Commander Vasse holds the ground with what walked out of the annex: two squads, one fabricator, and a perimeter that exists chiefly in this briefing.
>
> A hostile force is inbound from the northwest ridge. Colonial signals intelligence cannot classify it. The structure, unhelpfully, can: it has already assigned the contact a name, a heraldry, and an estimated time of arrival.
>
> Hold the perimeter. Keep the workers alive. Do not touch the pyramid.
>
> The pyramid may touch you.

**Pre-battle exchange** (built: round 1 opens on it in the dialog, after Vasse's own bark, "By the book. The new book."):

```text
CORVANE: Nice fence, roadmakers. We brought wire cutters.
VASSE:   It is not our fence I would worry about.
CORVANE: ...Why is your pyramid looking at me?
```

**Barks (mission pool):**

- Citizen worker, under fire: "Not in the manual!"
- Citizen soldier, engaging: "Line holds or we hold it."
- Citizen soldier, dying: "Keep. Building."
- Vasse, first engagement: "By the book. The new book." (said in battle: one of her lines for the first shot of a round, in her army)
- Ravel raider, arriving: "Knock knock, bureaucrats!"
- Ravel raider, dying: "Worth it. Probably worth it."

**Mid-mission interruption** (first Nexus Pulse, one sentence): *VASSE: Whatever that rhythm is, we build between its beats now.*

**Debrief (103 words):**

> The perimeter held. Sixty percent of it was real by the end, which the after-action report will describe as ahead of schedule.
>
> Speaker Corvane withdrew in good order and worse temper. They will return with more than wire cutters.
>
> Casualties: four. Names filed. The fabricator ran through the night without fuel anyone can identify, printing barracks components to a standard none of our engineers wrote. The components fit our machines. The engineers have stopped asking why and started asking what else it knows.
>
> Commander Vasse has accepted provisional connection status. Her first standing order: nobody thanks the pyramid.

**Artifact entry (52 words):**

> FIELD CATALOG 001 — THE APEX
>
> Recovered nothing. Catalogued nothing. The apex predates the survey, the colony, and — by every measurement that ends without an error — the concept of before. Attached: fourteen years of instrument logs, one page of findings. The page is blank except for a header. The header is correct.

The mission teaches one mechanic (the Build/Pulse loop), changes one relationship (Vasse accepts the connection), answers one local question (can the perimeter hold?), and opens one larger mystery (what recognized her?) — the lore's writing-budget contract, demonstrated at full size.

### 4.3 The opening campaigns

**Three starting Commanders, two openings, one set of maps.** Vasse and Averno play the Citizen opening; Dob Hunter plays the same battles from the other side of the line ([`commander-armies.md`](commander-armies.md)). Mission 1 for Dob *is* PERIMETER — the same map, the same schedule, the raid's point of view. Reusing the map and mirroring the trigger list is what makes a second opening affordable, and the fiction lands from both directions at once: the Citizen player is unsettled that the machine named the raid before it arrived, and the Ravel player is unsettled that somebody's fence already knew his name.

**The Ravel opening reuses PERIMETER's map: the same file, roles swapped, no second map authored** (RULE — settled; no code holds it yet). PERIMETER already has everything both openings need: a Citizen base (Nexus, fabricator, starting crew) and a raid staging area to its northwest. For the Citizen opening that staging area is the scripted enemy's entry point; for the Ravel opening it becomes Dob's own starting camp, the Citizen base becomes the scripted defender, and his main goal is what the table below says — *destroy the fabricator*. Nothing about the Grid, the coordinates, or the terrain changes; only `playerArmy`, `opponentArmies`, `objective`, and the trigger list's own perspective swap. This is cheap precisely because a mission is data: swapping who a trigger list treats as "the player" is a content edit, not new code — it means the Ravel-side work is authoring one mirrored `MissionDefinition`, not a map.

The Ravel opening tracks the Citizen one closely through missions 1 and 2, then diverges — RESTORATION's beat is Citizen-specific (what the Nexus files about their Symbol), so the Ravel third mission reads restoration through its own event. What that event is has not been written and does not need to be yet.

**One timeline, two witnesses — not parallel stories.** The mirrored map does not imply multiple story timelines, and it must not: **there is one history, and both openings describe the same battle from opposite sides of it.** PERIMETER's outcome is already written and stays fixed — the perimeter holds, the fabricator survives and keeps printing, the raid withdraws "in good order and worse temper" (the debrief in section 4.2). The Ravel opening's own briefing and debrief must agree with those facts; what changes is whose voice reports them and what they were trying to do. Dob's mission goal is *reach the fabricator*, and his authored debrief is a raid that got in, took what it could carry, and did not stop the machine.

The distinction that makes this work is one the project already relies on: **authored text is the fixed story; a player's tactical result is not.** PERIMETER has one debrief regardless of how close the fight was, and that stays true when two Commanders play the same battle. A player who wins spectacularly as Dob has not rewritten history; they have played that engagement well. Objectives decide mission pass or fail and unlocks (section 2.2); the fixed narrative beats do not move. This is the ordinary strategy-campaign convention, and it is the only one that keeps a single coherent timeline while letting both sides be playable.

The rule that follows, for anyone authoring the second side of any battle: **check the other side's debrief before writing yours.** Two accounts of one engagement may differ in emphasis, blame, and what each side noticed — that is the interesting part — but not in what happened.

**Missions have goals, not fixed lengths** (RULE — settled; no code holds it yet), see section 2.2. A mission declares:

- **a main goal** — most often *destroy the enemy Grid Nexus*, but equally *survive N rounds*, *capture and hold X by round N*, *accumulate X of Y*, or *keep Z alive*. Standard strategy-campaign shapes, every one of them expressible as a trigger condition with an `objective`, `win`, or `lose` action (section 2.1);
- **a bonus goal** — harder, optional, achievement-shaped, and it **may unlock something for Challenge mode**: a Commander, a card, a starting variant. *Win without losing a unit. Reach supply 100. Win by round 4. Never lose a structure.* This is what gives a finished mission a reason to be replayed before the campaign is over.

**RULE — a bonus goal's unlock is additive, never primary.** Challenge keeps its own progression, independent of the Campaign; a bonus goal's unlock only lands if Challenge has not already granted the same thing through play. The two modes stay uncorrelated by design — nobody's Challenge content is gated behind finishing the Campaign — and this is the one deliberate exception where playing both pays a small, non-essential dividend (see [`game-modes.md`](game-modes.md) and [`commander-armies.md`](commander-armies.md)).

**Bonus goals are shown in the briefing, never a surprise** (RULE — settled; no code holds it yet). The briefing states both goals plainly, the same way it states the main one; a player decides whether to play toward it from the start, rather than discovering after the fact what they were being scored on. This is also the faction's own voice: the Citizen Nexus files the standard before the shift begins, it does not grade on a curve afterwards.

Round counts below are **design estimates for pacing, not contracts**. A round counter appears in the header only when the goal is itself about rounds: "survive five rounds" obviously shows one, "destroy the enemy Nexus" does not.

| # | Mission | Main goal | Bonus goal | Estimate | Teaches | Lore hint it plants |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PERIMETER (Citizen) · the same raid (Ravel) | Citizen: hold until the raid's schedule ends · Ravel: destroy the fabricator | Citizen: finish without losing a structure · Ravel: win by round 3 | ~3 rounds, 8–10 min | the loop — place, commit, watch, adapt | the Nexus is **ahead of you**: it named the raid, filed an arrival time, and the fabricator prints to a standard no engineer wrote |
| 2 | RIGHT OF SALVAGE | recover more of the wreck field than the other side | deny them every wreck | ~4 rounds, 10–12 min | workers, deposits, salvage, contested ground | it knows a name nobody entered — *"Who filed that?"* |
| 3 | RESTORATION (Citizen) · to be authored (Ravel) — **IDEA** | destroy the enemy Grid Nexus | hold the round your Commander is absent without losing a structure | ~5 rounds, 12–15 min | the Commander — her powers, death, absence, restoration | it keeps **personnel files**, and treats a death as a scheduling matter |

**Commanders die from the first mission** (RULE — the owner, 2026-10-04: "commanders die on this game, is part of the gameplay so we better integrate that into the lore and the campaign intro levels"; `tests/commander.test.ts`, `tests/dialog.test.ts`). A Commander's death is ordinary business on the Grid ([`lore.md`](lore.md)), so the intro levels teach it rather than save it: PERIMETER lets Vasse fall when the raid reaches her, the round she is out opens on a line saying so, and the round she returns opens on one saying that, looking at her. Her campaign's second test level spends the whole cadence in three rounds, so her return can be played (`--at 'campaign?level=vasse-test-2&round=3'`).

**Mission 3 keeps restoration as its subject (IDEA)**, now as the question the lore leaves open rather than the first sight of a death: the round she is absent is played through (`SYMBOL ABSENT — CYCLE 1 OF 1 — HOLD`), and what the Nexus restores, and what it files about her, is what the mission turns over. The bonus goal stays about surviving the absence.

**What each mission deliberately withholds**, so it is not built early: mission 1 has no economy and no real draft choice, and its Commander is only the mechanic — Vasse is on the Grid, falls when the raid reaches her, sits a round out and comes back, with no powers (the Commander milestone pulled her forward); mission 2 adds no more of her; mission 3 is the first with everything on, and the first to make her restoration a story. Removal, run drafts, and deck editing belong to **Challenge** mode ([`game-modes.md`](game-modes.md)) and never appear in the opening — the Campaign grows the pool, it does not prune it.

**Save slots.** A player may keep more than one campaign in progress and start another at any time, so campaign progress is **per slot**, each slot naming its Commander. That is more than the flat checked-in unlock list of the open question about the shape of an unlock record (Q31) assumes, so the campaign menu has to design the difference rather than discover it.

**RULE — there is no upfront Commander-choice screen** (`src/cli/menu.ts`, whose top-level menu has no Commander choice; `tests/title-menu-campaign-screen.test.ts`). The start is deliberately controlled: Vasse first, then Averno and Dob Hunter once the first mission is done. A new player starts Vasse's mission 1 directly — it is the whole first-time experience. Completing it (its main goal, not the bonus goal) unlocks Averno and Dob Hunter as two new rows on the campaign menu, each starting *their own* mission 1 on the same map. The choice belongs to the campaign menu as an unlock like any other, not to the top-level menu.

## 5. Cutscenes

Cutscenes reuse the presentation framework rather than becoming video. A scene combines:

- a hand-authored ASCII tableau;
- two to four meaningful poses or local animations;
- restrained palette shifts and effect recipes;
- speaker, concise dialogue, and prompt layout;
- keyboard advance, skip, replay, and accessibility controls.

The same content definition should be usable by the game, a preview tool, and agents generating or validating scenes. Cutscenes can introduce a Commander portrait, an army, an artifact, an Original, or a change in the Grid.

**Scripting an intro.** An intro focuses on a character, shows their face and card, and displays some text while they talk; then enemies spawn, move, and a new round starts. An intro is a trigger list (section 2.1), and it needs exactly four primitives, three of them presentation and one of them the simulation:

- **`focus`** — the camera moves to an entity or a tile, through the same cursor-driven scroll the player uses ([`grid.md`](../system-design/grid.md)). No second camera, no cinematic mode: the viewer's eye is taken where the player's cursor could go.
- **`card`** — a character's portrait card: a hand-authored ASCII tableau of the face, the name, the faction's glyph role, drawn in the side panel or as an overlay in the `chrome` band. The same card is what inspection shows for that character during play, so a face learned in the intro is the face met on the Grid.
- **`say`** — a line under the card, attributed, advanced by Enter, a click, or the driver — or by a timeout where the mission prefers pace to control. Skip is always available. Built as the dialog at the bottom of the screen, with no card and no timeout yet (section 2.1).
- **a scripted Pulse** — `spawn` and `target` run while the player watches enemies arrive and take position; then `startBuild` hands over the first Build Phase.

**Skip is a presentation action.** Skipping an intro jumps past its `card`, `say`, and `focus` actions; the scripted Pulse still resolves, so the skipped intro leaves the Grid exactly where the watched one would. That is the property that keeps intros out of the engine's record (the third rule of the belief ramp) while still letting them move things on the Grid.

The opening image should make the Prime Nexus physically impossible before the player controls it:

> **The buried ruin had not grown. It had remembered its size.**

## 6. Campaign opponent policies

Campaign opponents are local game AIs by default, not LLMs. They receive a bounded planning view and the same legal action vocabulary available to a human plan validator.

Possible tiers include scripted tutorials, weighted faction heuristics, limited search/rollout using the headless simulator, and mission policies altered by scenario parameters. Hidden plans do not leak into an ordinary policy. A mission may grant an explicit exception only when the player can understand it as a rule or narrative event. How a scripted raid names its plan and its intention, and where an opponent planner could come from, is in [`scripted-opponent.md`](scripted-opponent.md).

LLM dialogue or planning remains a future option, not a requirement for the first campaign.

## 7. Authoring tools

Campaign tools should allow humans and agents to:

- define missions as diffable text;
- preview maps, starting states, unlocks, and cutscenes;
- jump directly to a trigger or Nexus Pulse;
- play a mission end to end through the driver ([`input.md`](../system-design/input.md)) — the same command stream an agent uses to playtest, so a mission's script is checked by running it, not by reading it;
- run opponent policies across seeds;
- export a deterministic replay and event log;
- validate references, objectives, reachable states, and progression graphs;
- package a campaign using the same content contracts planned for future mods.

Many useful editors may be literal ASCII arrays, TypeScript definitions, command-line validators, and a shared preview TUI. A polished drag-and-drop editor is not required to make the pipeline powerful.
