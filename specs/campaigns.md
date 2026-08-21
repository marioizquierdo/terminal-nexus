# Terminal Nexus — campaigns

**Document role:** Single-player structure, mission definitions, progression, cutscenes, and initial narrative direction
**Status:** Canonical direction; implementation deferred to Milestone 5
**Canon version:** 2.3
**Updated:** 2026-08-20
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

That is enough canon for now. Named cast, exact mission sequence, betrayals, and endings must wait for mechanics to establish what the campaign needs to teach.

The five faction campaigns may eventually show parallel perspectives on one war rather than a single objective chronology.

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
