# Milestone 9 — Mission Cutscenes

**Status:** PLANNED
**Depends on:** Milestone 6 (events fire during the Pulse), Milestone 4 (the campaign menu is a plausible home for artifact entries)

This is the real mechanism, not a placeholder. An earlier plan deferred cutscenes to plain printed
text, reasoning that a full system built for one mission's briefing would be a framework built for one
use. That reasoning was sound for the scope it was written against. The scope has changed, and the
plan now asks for the real thing.

## Question

Can a mission declare a briefing, a pre-battle exchange, mission-pool barks, a mid-mission
interruption, a debrief and an artifact entry as one reusable content shape, and play all of them
through the existing presentation framework, with no new rendering system and no second effect
language?

## What it builds

This is built for the first time against PERIMETER's own already-written material in
[`docs/game-design/campaigns.md`](../game-design/campaigns.md). Nothing new needs writing, only
displaying.

- **A cutscene content definition.** A hand-authored ASCII tableau, two to four meaningful poses or
  local animations, restrained palette shifts and effect recipes, speaker, dialogue and prompt layout.
  It reuses `ReadonlyCellFrame`, the band compositor and the existing effect recipe vocabulary rather
  than inventing new ones. The same definition should work for the game, a preview tool, and agents
  generating or validating scenes. Build the definition and in-game playback first. A preview and
  validation tool is worth adding only once it is cheap, and it does not block this milestone.
- **The presentation half of the trigger model.** A cutscene is a trigger's `focus`, `card` and `say`
  actions, riding on the events Milestone 6's simulation half emits. `focus` moves the camera through
  the ordinary cursor-driven scroll. `card` is the character's portrait card (face tableau, name,
  faction glyph role), drawn in the side panel or the `chrome` band; it is the same card inspection
  shows for that character on the Grid. `say` is the attributed line beneath it. In Mario's words:
  "focusing on a character, showing their face/card and displaying some text while they talk."
  PERIMETER's intro is the first use: cards and lines, then a scripted Pulse in which the raid arrives
  and takes position (already built by Milestone 6), then `startBuild`.
- **Playback controls.** Advance by Enter, click or the driver; skip; replay; and the same
  accessibility modes (reduced motion, monochrome) as every other piece of presentation, not a second
  accessibility story. Skip leaves the same Grid: it jumps past the presentation actions and the
  scripted Pulse still resolves, so a skipped intro and a watched one hand the player an identical
  first Build Phase. This is asserted in a test.
- **PERIMETER's six pieces, played at the right moments.**
  - The briefing before the Build Phase.
  - The pre-battle exchange at the start of the Pulse.
  - At least one bark during the fight, triggered by a real event (an engagement, a death) rather
    than a scripted timer.
  - The mid-mission interruption at the Pulse's first tick ("whatever that rhythm is, we build between
    its beats now").
  - The debrief once the Pulse resolves.
  - The artifact entry, shown wherever Milestone 4's campaign menu can reasonably hold a collectible
    (a small addition to that screen, not a new one).

## Steps

### Step 9A — The presentation band

- [ ] `focus`, `card` and `say` work as trigger actions riding on Milestone 6's events.
- [ ] The character card is drawn once and reused by inspection.
- [ ] Advance, skip and replay work through all three adapters (keyboard, mouse, driver).
- [ ] Skip provably leaves the same Grid.

### Step 9B — PERIMETER's six pieces at their moments

- [ ] Briefing, exchange, barks off real events, interruption, debrief and artifact entry all play,
      using the already-written material.

### Step 9C — The three-forms bar

- [ ] Every scene works at all four capability tiers, in monochrome, and with reduced motion.

## Out of scope

- New mission writing. Every word PERIMETER needs is already in the campaign design.
- A preview or validation tool beyond what falls out cheaply from building playback.
- Cutscenes for any mission beyond PERIMETER. RIGHT OF SALVAGE's material does not exist yet; that is
  Milestone 10's job.

## How it is judged

Automated: every cutscene renders without error at all four capability tiers and in monochrome. Skip
and replay leave the game in a consistent state. A bark fires exactly once per triggering event, not
once per frame that happens to render while the event is still recent.

Human, and this is the real test: a fresh viewer reads the briefing, plays or watches the mission, and
the pre-battle exchange, the mid-mission interruption and the debrief read as one coherent piece of
fiction wrapped around the mechanism, not a mechanism with captions bolted on.

## Done when

- [ ] All six pieces of PERIMETER's written material play at the correct moment.
- [ ] Advance, skip and replay work through keyboard, mouse and the driver, and a skipped intro leaves
      the Grid identical to a watched one.
- [ ] Every cutscene passes the three-forms bar described in
      [`docs/system-design/effects.md`](../system-design/effects.md), like any other presentation.
- [ ] `./scripts/check-repository.sh` passes.
