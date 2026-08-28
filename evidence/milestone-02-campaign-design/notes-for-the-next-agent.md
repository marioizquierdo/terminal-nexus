# Notes for the next session

**Document role:** Internal cross-references and loose ends. Not written for Mario
**Status:** Working notes
**Updated:** 2026-08-28
**License:** Apache-2.0

The other documents in this folder are written for Mario and deliberately avoid document/section
shorthand — see AGENTS.md Section 5, "Write for a person, not for the filing system," added this
session at his request. This file is where the shorthand lives instead.

## Where each decision is filed

| Mario-facing label | Register row | Document |
| --- | --- | --- |
| Decision A — where the campaign starts | **Q39** | `where-to-start.md` |
| Decision B — who the Citizen commander is | **Q43** | `who-leads-and-what-happens.md` |
| Decision C — fixed unlock or a choice of two | **Q40** | `unlocking-and-teaching.md` Section 1.6 |
| Decision D — the lose-everything set-piece | **Q41** | `where-to-start.md`, final section |
| Decision E — a second commander | **Q42** | `who-leads-and-what-happens.md` Section 5 |

Q39 was rewritten this session. Its first version asked "which campaign concept," including options
that swapped the faction pairing — which Mario had already decided (Citizens versus Ravels, opening on
Nexus events). It now asks the narrower and correct question: which *moment* of that story the player
starts in.

## Canon this pass touches, and where

- `campaigns.md` Section 4.1's belief ramp — the six-mission teaching table. `unlocking-and-teaching.md`
  Section 2.3 fills in its unlock column, which was blank.
- `campaigns.md` Section 4.2 — PERIMETER's written material (briefing, exchange, barks, interruption,
  debrief, artifact entry). Unchanged and reused; the mission-one anatomy is built around it.
- `commander-armies.md` Section 4.4 — the proposed Commanders. Decision B revisits Vasse's *profession*
  rather than her name; Decision E places Teag.
- `engine.md` Section 5 — Build Phase, Commander, structures, automatic production. Nothing changed;
  Section 5.4's admission that the upgrade draft "is not designed" is what
  `unlocking-and-teaching.md` Section 3.1 proposes a design for.
- `engine.md` Section 4.3 — the victory check. Q36 (does a defensive mission need a new victory shape?)
  is untouched and its recommendation still stands: play it before changing a rule.
- Q15 — the on-axis routing dead end. The map in `what-a-mission-looks-like.md` Section 3.1 is authored
  around it, which is Q33's Option A. **The layout constraint is load-bearing and stated in the
  document; do not let a later edit put rock in the Nexus's rows or columns east of the ridge.**

## Deliberately held open

- **Q32 and Q33 are not closed**, though Milestone 2's Definition of Done asks for it. Both are specific
  to the raid-defence mission, and Q39 could still move which mission opens the campaign. Close them in
  the same pass that answers Q39.
- **Q38** is proceeded-under-recommendation: the 60×20 size exists so the map scrolls at the 80×24
  terminal floor and fits whole at the viewport maximum.
- **Q34's line still holds.** Nothing here authors a Commander Army. Every unlock is a role, not an id.

## Loose ends worth a future session's time

1. **Round length is a guess.** 720 ticks is arithmetic. `grid <map> --headless --json` in a shell loop
   settles it in a minute; do that before anyone watches the mission.
2. **There is no dedicated worker producer in the Citizen content.** Milestone 7 needs one or needs the
   barracks to produce both. Recommendation is in `what-a-mission-looks-like.md` Section 3.6.
3. **The `script` array shape** in `what-a-mission-looks-like.md` Section 3.4 is Q32's Option A made
   precise, simplified to one verb. The five determinism rules there are the part Milestone 6 needs;
   rule 3 (skip-and-warn on a blocked spawn) is the one a naive implementation gets wrong.
4. **The pre-Nexus interface idea** (`where-to-start.md`, Opening 2 discussion, and
   `who-leads-and-what-happens.md`) has no milestone. It is the best creative idea in the pass and the
   most expensive; if it survives Mario's read, it needs its own costing rather than being folded into
   Milestone 9.
