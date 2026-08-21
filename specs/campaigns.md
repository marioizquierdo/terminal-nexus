# Terminal Nexus — campaigns

**Document role:** Single-player structure, mission definitions, progression, cutscenes, and initial narrative direction
**Status:** Canonical direction; implementation deferred to Milestone 5
**Canon version:** 2.4
**Updated:** 2026-08-21
**License:** Narrative material is CC BY-SA 4.0; technical schemas are Apache-2.0

## 1. Development boundary

Campaigns will become the first complete single-player experience, but they must wait until battle presentation, deterministic Nexus Pulses, base construction, and a two-faction microgame are fun.

This document gives the game a destination and provides requirements for reusable tools. It does not authorize campaign implementation during Milestones 1–4.

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
  playerArmy: string
  opponentArmies: readonly string[]
  availableContent: readonly string[]
  startingState: string
  objectives: readonly string[]
  triggers: readonly string[]
  opponentPolicy: string
  introScene?: string
  outroScene?: string
  unlocks: readonly string[]
}

interface CampaignDefinition {
  id: string
  entryMission: string
  missions: readonly MissionDefinition[]
  progressionRules: readonly string[]
}
```

This is architectural direction, not a frozen API.

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
- **The screen may lie; the log never does.** Where a mission has the interface misreport, the deterministic report and replay stay truthful, and finding the seam is play, not trivia. Whether campaign presentation may misreport at all is Q10 in [`open-questions.md`](open-questions.md).

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
- run opponent policies across seeds;
- export a deterministic replay and event log;
- validate references, objectives, reachable states, and progression graphs;
- package a campaign using the same content contracts planned for future mods.

Many useful editors may be literal ASCII arrays, TypeScript definitions, command-line validators, and a shared preview TUI. A polished drag-and-drop editor is not required to make the pipeline powerful.
