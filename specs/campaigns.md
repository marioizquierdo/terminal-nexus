# Terminal Nexus — campaigns

**Document role:** Single-player structure, mission definitions, progression, cutscenes, and initial narrative direction
**Status:** Canonical direction; PERIMETER (Mission 1) is in active implementation across `milestones/`
**Canon version:** 2.10
**Updated:** 2026-09-01
**License:** Narrative material is CC BY-SA 4.0; technical schemas are Apache-2.0

## 1. Development boundary

**Amended, canon 2.8, formalized at 2.9.** This section used to say campaigns must wait until battle
presentation, deterministic Nexus Pulses, base construction, and a two-faction microgame are all fun
first — written when the roadmap was horizontal, one whole system at a time. Mario redirected the
roadmap directly: build the campaign one level at a time, and let each level pull in exactly the
systems it needs rather than waiting for all of them.
[`../milestones/README.md`](../milestones/README.md)'s ten-milestone sequence is PERIMETER (Mission 1,
Section 4.2 below), in implementation now, using the existing disposable Citizen and Ravel fixture
content rather than a real Commander Army roster — `AGENTS.md` Section 2's ban on authoring the full
Commander Army before Milestone 4 is unchanged by this (Milestone 8 of that sequence draws the exact
line: one named Commander mechanic, not a locked roster). This document still gives the *destination*
— the full belief ramp, the later missions' teaching goals, the cast — and none of
that beyond Mission 1 (and, per Milestone 10, Mission 2) is authorized to build yet; only what a
milestone's own accepted gate report claims
is real.

Campaigns remain the first *complete* single-player experience only once the whole belief ramp exists;
what changed is that reaching it no longer waits for battle presentation, base construction, and the
two-faction microgame to each finish in full first. It waits for each *level* to finish, one at a
time, pulling in only the piece of each of those systems that level's own mission needs.

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

A high-level definition may resemble:

```ts
interface MissionDefinition {
  id: string
  map: string
  playerArmy: string                       // a CommanderArmyDefinition id (commander-armies.md 2.1)
  opponentArmies: readonly string[]
  availableContent: readonly string[]
  startingState: string
  objectives: readonly string[]
  triggers: readonly TriggerDefinition[]   // Section 2.1 — the mission's Pulses, script, and scenes
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

This is architectural direction, not a frozen API. `introScene` and `outroScene` from an earlier
draft are gone on purpose: a scene is a trigger like any other (Section 2.1), not a special slot.

### 2.1 Mission time, Pulses, and triggers — GUIDANCE on the shape; the authored surface is Q39

**Owner direction, canon 2.10.** Mario: "The campaign levels should work with multiple pulses, not
just one pulse, and have a way to declare 'triggers' and 'actions' same as the original StarCraft
editor." A mission is **a sequence of Build Phase / Nexus Pulse cycles** — as many as its design
wants — and **triggers** decide what happens during and between them. The engine's own loop already
alternates without limit ([`engine.md`](engine.md) Section 5); this section is how a mission drives
it.

**Mission time.** A simulation moment is addressed as `{ pulse, tick }`. Phase boundaries are
mission events: `mission.start`, `build.start`, `pulse.start`, `pulse.end`, `mission.end`, each
carrying the pulse number. A Pulse may be **scripted** — no player plan; the player watches — which
is what an intro is when "enemies arrive and take position" should be *seen moving* rather than
described. A scripted Pulse is still a Pulse: seeded, deterministic, in the replay, hash-checked.

**A trigger** is `{ id, when, once?, do }`: a condition, and the actions taken when it holds.

Conditions, evaluated on canonical state and events — **never on what rendered**, so a trigger can
never fire because of a frame: a mission event (optionally for one pulse); a tick within a pulse; an
entity or group dying; an entity entering a named region of the map; an objective changing state; a
count of some kind of entity crossing a threshold.

Actions come in **two bands, and the band is the most important thing on this page**:

| Band | Actions | Where they run | Determinism |
| --- | --- | --- | --- |
| **Simulation** | `spawn` (units at a region, with an initial order), `order` (a group advances, holds, or withdraws toward a region), `commitPlan` (the scripted opponent's Build Phase plan for a given pulse), `objective` (set or change one), `win`, `lose`, `endPulse`, `startBuild`, `reveal` | inside the kernel, as scripted intents at the tick the condition holds, validated like any player command, emitted as ordinary events | part of the hashed inputs — a replay re-derives them from mission, seed, and plans |
| **Presentation** | `focus` (camera to an entity or a tile, through the ordinary scroll), `card` (a character's portrait card), `say` (speaker and line, advanced by the player or a timeout), `bark`, `effect`, `pause` / `resume` | in presentation; they never write state | re-derived from the event stream and the trigger list; skipping or replaying them changes nothing |

The two bands keep the three-worlds law ([`engine.md`](engine.md) Section 1) intact under scripting:
only the Pulse mutates state, and the presentation half of a trigger rides on the events the
simulation half emits. A `spawn` at `{ pulse: 1, tick: 0 }` shows up in the log as a spawn event like
any other; the `card` and `say` that introduce the spawned raid are drawn off that event, and a viewer
with reduced motion, a skipped intro, or a monochrome terminal ends the intro on **exactly the same
Grid**, because the state half ran whether or not the presentation half was watched.

**The vocabulary grows in code, not in missions.** When a mission needs a condition or action the
vocabulary lacks, it is added as a typed kind with a named scenario, exactly the way a kernel rule
is. A mission never contains a function. The narrow-hook door ([`engine.md`](engine.md) Section 8 —
read-only context in, intents out, validated by the kernel) is the escape hatch for a shape too odd
for the vocabulary, and a hook used by two missions becomes a vocabulary entry. Whether this
declarative model or a scripting API is the right *authored* surface is **Q39**; this section
proceeds under its recommendation, which is this model.

**Custom campaigns.** A mission references armies by id, and an army is a deck validated against
its faction's pool ([`commander-armies.md`](commander-armies.md) Section 2.1). A custom campaign is
therefore a folder of missions plus the Commander Armies it ships, loaded and validated by the same
code as the first-party one. Nothing about that is built or promised now — it is *why* the trigger
surface is data and the army is a deck rather than a feature in itself.

A sketch of PERIMETER's own trigger list in this shape — an intro, a raid in waves across three
Pulses, and the hold — so the model is concrete rather than described:

```ts
triggers: [
  { id: "intro", when: { event: "mission.start" }, do: [
      { card: "vasse" }, { say: { speaker: "vasse", text: "..." } },
      { focus: { region: "nw-ridge" } },
  ]},
  { id: "wave-1", when: { pulse: 1, tick: 0 }, do: [
      { spawn: { unit: "unit.ravel.raider", count: 3, at: "nw-ridge", order: { advance: "nexus" } } },
      { card: "corvane" }, { say: { speaker: "corvane", text: "Nice fence, roadmakers. We brought wire cutters." } },
  ]},
  { id: "wave-2", when: { pulse: 2, tick: 0 }, do: [ { spawn: { /* larger */ } } ] },
  { id: "wave-3", when: { pulse: 3, tick: 0 }, do: [ { spawn: { /* the push */ } } ] },
  { id: "hold",   when: { event: "pulse.end", pulse: 3 }, do: [ { objective: { id: "hold", state: "complete" } }, { win: true } ] },
]
```

The `{ atTick, action }` list Milestone 2 decided for the raid (Q32) is this model with one
condition kind and one pulse — a special case, not a different design.

## 3. Teaching and progression

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

The later campaign may involve:

- Ravels as enemies, rivals, and temporary allies;
- Ancient authorities or golems following dangerous functions;
- other humans disputing military ownership of the discovery;
- an awakened Ancient Original.

Beyond the direction below, named cast, betrayals, and endings must wait for mechanics to establish what the campaign needs to teach. The committed cast is deliberately tiny: **Commander Edda Vasse**, the provisional human Symbol, and **Speaker Corvane**, the Symbol the Ravel Prime sent (see [`commander-armies.md`](commander-armies.md) Section 4.4).

The five faction campaigns may eventually show parallel perspectives on one war rather than a single objective chronology.

### 4.1 The belief ramp

Good campaigns teach cosmology from the chair: the player starts with something small and concrete — a machine that will not explain itself — and only much later understands they are inside something enormous. Terminal Nexus has an unusual instrument for this. The interface addresses the player as **Operator**, and what the Operator is belongs to the deliberate mysteries ([`terminal-nexus-lore.md`](terminal-nexus-lore.md) Sections 5.1 and 7). The campaign's job is to promote that title from a decoration the player ignores into a question they carry.

Three rules govern the ramp:

- **Revelations arrive as mechanics wherever possible.** The player should learn the theology by playing it — a fact experienced through the rules outweighs a paragraph asserting it.
- **The interface may misbehave; it never testifies** (lore Section 7). It can know too much, precommit a plan, and miscount. It cannot explain itself.
- **A narrative device never touches the engine's record.** The kernel, its event log, and replay stay exact, because determinism is what makes replay and fast-forward possible — a story device may only ever concern what a mission's interface *displays*. Whether any mission uses such a device is a writing decision for the mission that wants it, taken when campaigns are designed (Q10).

The six-mission arc, as direction for Milestone 5 to test:

| # | Mission | The player believes going in | What the mission does to that belief | Teaches | The interface |
| --- | --- | --- | --- | --- | --- |
| 1 | PERIMETER | "Operator is my job title." | Nothing. The belief is allowed to feel true | Build Phase / Nexus Pulse loop on a small Grid that never scrolls | Plain, military, correct |
| 2 | RIGHT OF SALVAGE | "The Nexus is a tool we are learning." | First itch: the tool knows things nobody entered | Salvage economy and contested wrecks | Names Speaker Corvane before any contact. Vasse: "Who filed that?" |
| 3 | RESTORATION | "The Nexus is issuing us equipment." | Vasse dies mid-Pulse — and play continues. The Nexus keeps its own personnel files, and the player commands through the absence | Commander death, absence, and restoration cadence | Treats death as scheduling: `SYMBOL ABSENT — CYCLE 1 OF 1 — HOLD` |
| 4 | PRECOMMITTED | "I make the plans." | One draft item arrives already committed, marked `SOURCE: NEXUS`. The interface has another user — or another author | The Nexus upgrade draft | Suggestive, not explanatory. The precommitted choice is always defensive, which no one finds comforting |
| 5 | TWELVE OF TWELVE | "The interface reports; reports are true." | The screen's totals disagree with what the player watched. The log did not. Two workers are never accounted for | Reading the report and the replay as diegetic objects | `WORKERS RECOVERED: 12 OF 12` — after fourteen were seen to fall. The seam is discoverable in play |
| 6 | ANNEX ZERO | "Operator is a rank we invented." | Corvane, in parley: the machine speaks over everyone's head — and the player realizes the title predates the software | Neutral hazards: a golem executing its function, hostile to nobody and lethal anyway | Ends on the canonical lines, now earned: `ANNEX ZERO EVACUATION COMPLETE / ANNEX ZERO NO LONGER LOCATED` |

By mission six, "Operator" has moved from job title to open question — a role in a protocol older than the rank, read differently by every civilization the player will meet. No mission answers it. Each faction campaign, if built, replays this ramp against its own reading (lore Section 8): the Ravel campaign's Operator is a conspirator being trusted, the Glitch campaign's a process being audited, and neither campaign corrects the other.

### 4.2 Mission one, in full

The complete written material for PERIMETER, inside the lore budgets (lore Section 10.5) — the worked example of what a mission's writing actually weighs.

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

**Pre-battle exchange:**

```text
CORVANE: Nice fence, roadmakers. We brought wire cutters.
VASSE:   It is not our fence I would worry about.
CORVANE: ...Why is your pyramid looking at me?
```

**Barks (mission pool):**

- Citizen worker, under fire: "Not in the manual!"
- Citizen soldier, engaging: "Line holds or we hold it."
- Citizen soldier, dying: "Keep. Building."
- Vasse, first engagement: "By the book. The new book."
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

The mission teaches one mechanic (the Build/Pulse loop), changes one relationship (Vasse accepts the connection), answers one local question (can the perimeter hold?), and opens one larger mystery (what recognized her?) — the lore Section 10.5 contract, demonstrated at full size.

## 5. Cutscenes

Cutscenes reuse the presentation framework rather than becoming video. A scene combines:

- a hand-authored ASCII tableau;
- two to four meaningful poses or local animations;
- restrained palette shifts and effect recipes;
- speaker, concise dialogue, and prompt layout;
- keyboard advance, skip, replay, and accessibility controls.

The same content definition should be usable by the game, a preview tool, and agents generating or validating scenes. Cutscenes can introduce a Commander portrait, an army, an artifact, an Original, or a change in the Grid.

**Scripting an intro — GUIDANCE, owner direction at canon 2.10.** Mario: "Special attention to
scripting intros, focusing on a character, showing their face/card and displaying some text while
they talk. Then spawn enemies, get them to move, and start a new pulse." An intro is a trigger list
(Section 2.1), and it needs exactly four primitives, three of them presentation and one of them the
simulation:

- **`focus`** — the camera moves to an entity or a tile, through the same cursor-driven scroll the
  player uses ([`engine.md`](engine.md) Section 3.3). No second camera, no cinematic mode: the
  viewer's eye is taken where the player's cursor could go.
- **`card`** — a character's portrait card: a hand-authored ASCII tableau of the face, the name, the
  faction's glyph role, drawn in the side panel or as an overlay in the `chrome` band. The same card
  is what inspection shows for that character during play, so a face learned in the intro is the face
  met on the Grid.
- **`say`** — a line under the card, attributed, advanced by Enter, a click, or the driver — or by a
  timeout where the mission prefers pace to control. Skip is always available.
- **a scripted Pulse** — `spawn` and `order` run inside the kernel while the player watches enemies
  arrive and take position; then `startBuild` hands over the first Build Phase.

**Skip is a presentation action.** Skipping an intro jumps past its `card`, `say`, and `focus`
actions; the scripted Pulse still resolves, so the skipped intro leaves the Grid exactly where the
watched one would. That is the property that keeps intros out of the engine's record
(Section 4.1's third rule) while still letting them move things on the Grid.

The opening image should make the Prime Nexus physically impossible before the player controls it:

> **The buried ruin had not grown. It had remembered its size.**

## 6. Campaign opponent policies

Campaign opponents are local game AIs by default, not LLMs. They receive a bounded planning view and the same legal action vocabulary available to a human plan validator.

Possible tiers include scripted tutorials, weighted faction heuristics, limited search/rollout using the headless simulator, and mission policies altered by scenario parameters. Hidden plans do not leak into an ordinary policy. A mission may grant an explicit exception only when the player can understand it as a rule or narrative event.

LLM dialogue or planning remains a future option, not a requirement for the first campaign.

## 7. Authoring tools

Campaign tools should allow humans and agents to:

- define missions as diffable text;
- preview maps, starting states, unlocks, and cutscenes;
- jump directly to a trigger or Nexus Pulse;
- play a mission end to end through the driver ([`engine.md`](engine.md) Section 9.7) — the same
  command stream an agent uses to playtest, so a mission's script is checked by running it, not by
  reading it;
- run opponent policies across seeds;
- export a deterministic replay and event log;
- validate references, objectives, reachable states, and progression graphs;
- package a campaign using the same content contracts planned for future mods.

Many useful editors may be literal ASCII arrays, TypeScript definitions, command-line validators, and a shared preview TUI. A polished drag-and-drop editor is not required to make the pipeline powerful.
