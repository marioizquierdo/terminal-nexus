# Terminal Nexus — campaigns

**Document role:** Single-player structure, mission definitions, progression, cutscenes, and initial narrative direction
**Status:** Canonical direction; PERIMETER (Mission 1) is in active implementation across `milestones/`
**Canon version:** 2.16
**Updated:** 2026-09-12
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
Commander Army before Milestone 12 is unchanged by this (Milestone 8 of that sequence draws the exact
line: one named Commander mechanic, not a locked roster). This document still gives the *destination*
— the full belief ramp, the later missions' teaching goals, the cast — and none of
that beyond Mission 1 (and, per Milestone 10, Mission 2) is authorized to build yet; only what a
milestone's own accepted gate report claims
is real.

Campaigns remain the first *complete* single-player experience only once the whole belief ramp exists;
what changed is that reaching it no longer waits for battle presentation, base construction, and the
two-faction microgame to each finish in full first. It waits for each *level* to finish, one at a
time, pulling in only the piece of each of those systems that level's own mission needs.

**Re-scoped again at canon 2.11, and lighter.** The Campaign is now one of two single-player modes
([`game-modes.md`](game-modes.md)): **the first-time player experience and the world's canon**,
judged on whether a new player comes out able to play a run and whether the world feels real.
Replay value, breadth, and duration are Challenge mode's job (runs, `game-modes.md` Section 3.2).
Nothing in this document is a length or breadth requirement; the belief ramp is direction for what
the missions teach and tell, not a count of missions the game owes. Mechanically the Campaign is the
mode that grows the player's pool — each mission unlocks the cards it introduces — which is what
makes its last mission a guided run in all but name.

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
  objective: ObjectiveDefinition            // Section 2.2 — the main goal
  bonusObjective?: ObjectiveDefinition       // Section 2.2 — optional, unlocks Challenge content
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
`objectives: readonly string[]` from an earlier draft is gone too — Section 2.2 replaces it with a
typed shape, for the same reason Nexus powers stopped being an open-ended list (`commander-armies.md`
Section 4.5): a mission's goal is something a trigger, a HUD, and a validator all need to read, and
a string is something only a human can.

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

**Custom campaigns.** A mission references armies by id, and an army is a bounded composition
validated against its faction's pools ([`commander-armies.md`](commander-armies.md) Section 2.1). A
custom campaign is therefore a folder of missions plus the Commander Armies it ships, loaded and
validated by the same code as the first-party one. Nothing about that is built or promised now — it
is *why* the trigger surface is data and army legality is a load-time check rather than a feature in
itself.

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

### 2.2 Objectives — GUIDANCE, and how they meet the kernel's own victory check

**Owner direction, canon 2.13** (Section 4.3) replaced fixed Pulse counts with **goals** — most often
"destroy the enemy Grid Nexus," but equally "survive N Pulses," "capture and hold X by Pulse N,"
"accumulate X of Y," "keep Z alive." A small bounded union is enough to say all of them, in the same
spirit as the six Nexus-power effect kinds:

```ts
type ObjectiveDefinition =
  | { kind: "destroyNexus" }                                         // the kernel's own default
  | { kind: "surviveUntil"; pulse: number }
  | { kind: "captureAndHold"; target: EntityId | RegionId; byPulse: number }
  | { kind: "accumulate"; resource: ContentId; amount: number }
  | { kind: "keepAlive"; target: EntityId | RegionId }
```

**How this meets `engine.md` Section 4.3's own victory check, and this is the part Q36 was actually
asking about.** The kernel's RULE-level check — Grid Nexus destroyed, one side annihilated, tick
limit reached — **does not change, and does not need to know about goals.** A mission's objective is
resolved one level up, by the scenario/trigger layer (Section 2.1), which watches the condition and
fires an ordinary `win` or `lose` action when it holds — "the Nexus still stands when Pulse 3 ends" is
`{ when: { event: "pulse.end", pulse: 3 }, do: [{ objective: { id: "hold", state: "complete" } },
{ win: true }] }`, a trigger like any other. The kernel's own check stays exactly what it always was:
the *fallback* result a battle without a scripted objective gets — Skirmish, and every Challenge
battle, land on it directly. A mission with a declared objective is never left to that fallback,
because its own `win`/`lose` trigger fires first and the mission ends there.

This is a **local data shape** in the sense of `project-governance.md` Section 2 — reversible,
narrow, no RULE change — so it is written here as GUIDANCE and not registered as a question. What
stays genuinely open is only implementation detail: whether `captureAndHold`'s region needs a new
kernel primitive (a capture structure is already GUIDANCE, `engine.md` Section 5.2) or composes from
existing ones. Milestone 6 decides that on the fixture it actually builds.

## 3. Teaching and progression

**Before authoring anything in this document, read
[`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 10.6.** Missions are where a canon grows
fastest and where over-authoring costs most: a new character here becomes a name to maintain forever,
and a plot thread becomes something every later mission must carry. Complexity in Terminal Nexus grows
through units and powers, not through story. A mission's fiction exists to make its *mechanic*
memorable — briefing, a few lines, a debrief — and one timeline covers all of it.

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

### 4.3 The opening campaigns — GUIDANCE

**Three starting Commanders, two openings, one set of maps.** Vasse and Averno play the Citizen
opening; Dob Hunter plays the same battles from the other side of the line
([`commander-armies.md`](commander-armies.md) Section 4.6). Mission 1 for Dob *is* PERIMETER — the
same map, the same schedule, the raid's point of view. Reusing the map and mirroring the trigger list
is what makes a second opening affordable, and the fiction lands from both directions at once: the
Citizen player is unsettled that the machine named the raid before it arrived, and the Ravel player is
unsettled that somebody's fence already knew his name.

**Only one map file — this is Q47, and the recommendation below is what Section 4.4 there proceeds
under.** "Reusing the map" could mean a second, mirrored `.map.json`, or the literal same file with
roles swapped. **Recommendation: the same file, roles swapped, no second map authored.** PERIMETER
already has everything both openings need: a Citizen base (Nexus, fabricator, starting crew) and a
raid staging area to its northwest. For the Citizen opening that staging area is the scripted enemy's
entry point; for the Ravel opening it becomes Dob's own starting camp, the Citizen base becomes the
scripted defender, and his main goal is what the table below already says — *destroy the fabricator*.
Nothing about the Grid, the coordinates, or the terrain changes; only `playerArmy`, `opponentArmies`,
`objective`, and the trigger list's own perspective swap. This is cheap precisely because a mission is
data (Q39): swapping who a trigger list treats as "the player" is a content edit, not new code — and
it means Milestone 10's Ravel-side work is authoring one mirrored `MissionDefinition`, not a map.

The Ravel opening tracks the Citizen one closely through missions 1 and 2, then diverges — RESTORATION's
beat is Citizen-specific (their Symbol falls and the Nexus files it), so the Ravel third mission
teaches the same *mechanic* through its own event. What that event is has not been written and does
not need to be before Milestone 10.

**One timeline, two witnesses — not parallel stories.** Mario asked directly whether the mirrored map
implies multiple story timelines. It does not, and it must not: **there is one history, and both
openings describe the same battle from opposite sides of it.** PERIMETER's canonical outcome is
already written and stays fixed — the perimeter holds, the fabricator survives and keeps printing,
the raid withdraws "in good order and worse temper" (Section 4.2's debrief). The Ravel opening's own
briefing and debrief must agree with those facts; what changes is whose voice reports them and what
they were trying to do. Dob's mission goal is *reach the fabricator*, and his authored debrief is a
raid that got in, took what it could carry, and did not stop the machine.

The distinction that makes this work is one the project already relies on: **authored text is canon;
a player's tactical result is not.** PERIMETER has one debrief regardless of how close the fight was,
and that stays true when two Commanders play the same battle. A player who wins spectacularly as Dob
has not rewritten history; they have played that engagement well. Objectives decide mission
pass/fail and unlocks (Section 2.2); the fixed narrative beats do not move. This is the ordinary
strategy-campaign convention, and it is the only one that keeps a single coherent timeline while
letting both sides be playable.

The rule that follows, for anyone authoring the second side of any battle: **check the other side's
debrief before writing yours.** Two accounts of one engagement may differ in emphasis, blame, and
what each side noticed — that is the interesting part — but not in what happened.

**Missions have goals, not fixed lengths.** Owner direction, canon 2.13: "we don't need to make it
strict. Instead, we will have a few different goals for each mission." A mission declares:

- **a main goal** — most often *destroy the enemy Grid Nexus*, but equally *survive N Pulses*,
  *capture and hold X by Pulse N*, *accumulate X of Y*, or *keep Z alive*. Standard
  strategy-campaign shapes, every one of them expressible as a trigger condition with an `objective`,
  `win`, or `lose` action (Section 2.1);
- **a bonus goal** — harder, optional, achievement-shaped, and it **may unlock something for Challenge
  mode**: a Commander, a card, a starting variant. *Win without losing a unit. Reach supply 100. Win
  by Pulse 4. Never lose a structure.* This is what gives a finished mission a reason to be replayed
  before the campaign is over. **The unlock is additive, never primary — Q46.** Challenge keeps its
  own progression, independent of the Campaign; a bonus goal's unlock only lands if Challenge hasn't
  already granted the same thing through play. The two modes stay uncorrelated by design — nobody's
  Challenge content is gated behind finishing the Campaign — and this is the one deliberate exception
  where playing both pays a small, non-essential dividend.
  **Bonus goals are shown, not revealed as a surprise — this is Q48.** The briefing states both goals
  plainly, the same way it already states the main one (Q44); a player decides whether to play toward
  it from the start, rather than discovering after the fact what they were being scored on. This is
  also the faction's own voice: the Citizen Nexus files the standard before the shift begins, it does
  not grade on a curve afterwards.

Pulse counts below are **design estimates for pacing, not contracts**. A Pulse counter appears in the
header only when the goal is itself about Pulses: "survive five Pulses" obviously shows one, "destroy
the enemy Nexus" does not.

| # | Mission | Main goal | Bonus goal | Estimate | Teaches | Lore hint it plants |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PERIMETER (Citizen) · the same raid (Ravel) | Citizen: hold until the raid's schedule ends · Ravel: destroy the fabricator | Citizen: finish without losing a structure · Ravel: win by Pulse 3 | ~3 Pulses, 8–10 min | the loop — place, commit, watch, adapt | the Nexus is **ahead of you**: it named the raid, filed an arrival time, and the fabricator prints to a standard no engineer wrote |
| 2 | RIGHT OF SALVAGE | recover more of the wreck field than the other side | deny them every wreck | ~4 Pulses, 10–12 min | workers, deposits, salvage, contested ground | it knows a name nobody entered — *"Who filed that?"* |
| 3 | RESTORATION (Citizen) · to be authored (Ravel) | destroy the enemy Grid Nexus | hold the Pulse your Commander is absent without losing a structure | ~5 Pulses, 12–15 min | the Commander — her powers, death, absence, restoration | it keeps **personnel files**, and treats a death as a scheduling matter |

**Level 3 is the shape to protect.** The Commander is a unit for the first time, with powers of her
own — and she falls on a scripted beat, and the mission does not end. The Pulse after is played
through the absence the rules already impose (`SYMBOL ABSENT — CYCLE 1 OF 1 — HOLD`), and the next
restores her. The belief ramp's whole point lands mechanically before anyone says a word about it,
which is why the bonus goal is about surviving the absence rather than about avoiding the death.

**What each level deliberately withholds**, so no milestone builds it early: Level 1 has no economy,
no Commander, and no real draft choice; Level 2 has no Commander; Level 3 is the first with everything
on. Removal, run drafts, and deck editing belong to **Challenge** mode
([`game-modes.md`](game-modes.md) Section 3.2) and never appear in the opening — the Campaign grows
the pool, it does not prune it.

**Save slots.** A player may keep more than one campaign in progress and start another at any time,
so campaign progress is **per slot**, each slot naming its Commander. That is more than Q31's flat
checked-in unlock list assumes, and Milestone 4 is where the difference gets designed rather than
discovered.

**Q43, decided.** Mario: "Perhaps we can just start with Vasse, so we have a more controlled start,
and after that first level is completed, the Averno and Dob Hunter campaigns become unlocked." A new
player is never shown a Commander-choice screen — **there is no upfront selection.** Vasse's mission 1
is the whole first-time experience; completing it (its main goal, not the bonus goal) unlocks Averno
and Dob Hunter as two new rows on the campaign menu, each starting *their own* mission 1 on the same
map. This removes the "selection screen for three" work an earlier draft of this section asked
Milestone 3 to build — the choice belongs to Milestone 4's campaign menu, as an unlock like any other,
not to the top-level menu.

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
