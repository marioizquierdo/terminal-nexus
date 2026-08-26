# Milestone 9 — Mission Cutscenes

**Document role:** Milestone tracker — declare and play cutscenes for mission intros and events
**Status:** GATED
**Depends on:** Milestone 6 (events fire during the Pulse), Milestone 4 (the campaign menu is a plausible home for artifact entries)
**Updated:** 2026-08-26
**License:** Technical mechanism is Apache-2.0; the cutscene content itself is CC BY-SA 4.0

> **This is the real thing, not the placeholder an earlier draft of this roadmap proposed.** The
> milestone-2-deterministic-pulse.md contract this sequence replaced (see
> [`README.md`](README.md)) explicitly deferred cutscenes to plain printed text, reasoning that a full
> system built for one mission's briefing would be "a framework built for one use." Mario's list asks
> for the real mechanism now. That earlier reasoning was not wrong given the scope it was written
> against — the scope changed.

## 1. Question

Can a mission declare a briefing, a pre-battle exchange, mission-pool barks, a mid-mission
interruption, a debrief, and an artifact entry as one reusable content shape, and play all of them
through the existing presentation framework — no new rendering system, no second effect language?

## 2. What gets built

Per [`../specs/campaigns.md`](../specs/campaigns.md) Section 5, built for the first time against
PERIMETER's own already-written material (Section 4.2 there — nothing new to write, only to display):

- **A cutscene content definition**: a hand-authored ASCII tableau, two to four meaningful poses or
  local animations, restrained palette shifts and effect recipes, speaker, dialogue, and prompt layout
  — reusing `ReadonlyCellFrame`, the band compositor, and the existing effect recipe vocabulary rather
  than inventing new ones. "The same content definition should be usable by the game, a preview tool,
  and agents generating or validating scenes" (`campaigns.md` Section 5) — build the definition and
  in-game playback first; a dedicated preview/validation tool is worth adding only once it is cheap,
  not a blocker for this gate.
- **Playback controls**: keyboard advance, skip, replay, and the same accessibility modes (reduced
  motion, monochrome) every other piece of presentation already supports — not a second accessibility
  story.
- **PERIMETER's own six pieces, played at the right moments**: the briefing before Build Phase; the
  pre-battle exchange at Pulse start; at least one bark during the fight, triggered off a real event
  (an engagement, a death) rather than a scripted timer; the mid-mission interruption at the Pulse's
  first tick ("whatever that rhythm is, we build between its beats now"); the debrief once the Pulse
  resolves; the artifact entry, surfaced wherever Milestone 4's campaign menu can reasonably hold a
  collectible (a small addition to that screen, not a new one).

## 3. Explicitly not this milestone

New mission writing — every word PERIMETER needs is already in `campaigns.md` Section 4.2; a preview
or validation tool beyond what falls out cheaply from building playback; cutscenes for any mission
beyond PERIMETER (RIGHT OF SALVAGE's own material does not exist yet — Milestone 10's job).

## 4. Acceptance

Automated: every cutscene renders without error at all four capability tiers and in monochrome; skip
and replay leave the game in a consistent state; a bark fires exactly once per triggering event, not
once per frame that happens to render while the event is still recent.

Human, and this is the real gate: a fresh viewer reads the briefing, plays or watches the mission, and
the pre-battle exchange, the mid-mission interruption, and the debrief read as one coherent piece of
fiction wrapped around the mechanism — not a mechanism with captions bolted on.

## 5. Definition of done

- [ ] all six pieces of PERIMETER's own written material play at the correct moment;
- [ ] playback controls (advance, skip, replay) work correctly;
- [ ] every cutscene passes the same three-forms bar (`../specs/ascii-effects.md` Section 4) as any
      other piece of presentation in this project;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes.
