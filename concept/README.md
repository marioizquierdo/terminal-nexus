# Terminal Nexus — concept art

**Document role:** Index of visual concept pieces and the canon questions each one raises
**Status:** Reference. Concept art is a proposal, not canon
**Canon version:** 2.1
**Updated:** 2026-08-20
**License:** CC BY-SA 4.0

## 1. What this folder is for

Concept art shows what the game should feel like before the game can show it. It is deliberately
ahead of the specification, which means it will disagree with canon — and those disagreements are
the useful part. Each piece below is indexed with the deltas it implies, so a later session can tell
"the art is ahead of us here" apart from "the art is stale here."

**Concept art never overrides canon.** When a piece and a specification disagree, the disagreement
becomes a row in [`../specs/open-questions.md`](../specs/open-questions.md) and Mario decides.

## 2. Files

Three pieces were provided on 2026-08-20. Drop the image files into this folder with the names
below; this index refers to them by those names.

| File | Subject |
| --- | --- |
| `01-nexus-pulse.png` | Nexus Pulse in progress — full battlefield with sidebar readouts |
| `02-build-phase.png` | Build Phase — structure placement with ghost, radius, and validation |
| `03-intercept-cutscene.png` | Cutscene — Commander intercept dialogue over an ASCII tableau |

> The image binaries are not yet committed. This index was written from the pieces as shown, and is
> accurate to them; add the files and this section needs no other change.

## 3. `01-nexus-pulse.png` — Nexus Pulse

A resolving Pulse. A 48x18 battlefield with a numbered column ruler and row labels, a right sidebar
carrying Nexus state, Commander state, and both force compositions, and a control footer reading
`[SPACE] PAUSE  [.] STEP  [Q] QUIT`.

**What it gets right, and should be preserved:**

- The sidebar is *state*, not telemetry: `NEXUS CRITICAL`, `INTEGRITY 06%`, `STATUS ENGAGED`. It
  tells a story at a glance, which is exactly the Pulse's job.
- Citizen structures read as interlocking armour — `[=H=]`, `=[=H=]:` chains — and Ravel forces read
  as scattered diagonals and `X`s. The factions are distinguishable by *shape* before colour, which
  is the legibility law working.
- Terrain `#`, resource `*`, salvage `$` are punctuation. Actors are letters. That matches the
  semantic grammar in lore Section 9 without anyone having to enforce it.
- The `-----> ` movement trails give one-cell actors direction and weight. This is the cheapest,
  most effective thing in the whole image.

**Deltas against canon:**

| Delta | Canon says | Question |
| --- | --- | --- |
| Tiles are drawn **two columns wide**, putting the full frame near 130-180 columns | 48x18 battlefield inside **80x24** | **Q1 — answered.** Tile width is adaptive: one column at 80, two at 128+. This art is the wide composition, and it is now reachable |
| `>x<` appears as a battlefield unit across three columns | MVP actors occupy one tile | **Q3** |
| Header reads `DAYTIME PULSE (AUTOMATIC)` | Phases are **Build Phase** and **Nexus Pulse** | Terminology only; "daytime" has no canon meaning. Drop it |
| Sidebar shows `SALVAGE` and `ENERGY` as separate readouts | One resource per match | **Q2 — answered.** Salvage yields the same resource; redraw as one counter |
| `ENERGY 18%` sits beside `INTEGRITY 06%` as Nexus state | Nexus energy is a state readout | **Q2 — answered.** The art was right: energy is state, not currency |
| Faction populations shown as `CITIZENS 128 / RAVELS 243` | Supply is a shared population cap | Consistent if these are supply totals; the label should say so |

## 4. `02-build-phase.png` — Build Phase

Placement of an Outpost. A cursor, a translucent ghost of the structure, its radius preview, a
connection path back to the Nexus, blocked cells marked `X`, hidden enemy territory as `?`, and a
`PLACEMENT: LEGAL` panel that spells out **why**: *Connected to Nexus. Clear terrain. Outside enemy
range.*

**What it gets right:**

- That validation panel is the best single idea in the concept set. Milestone 3 asks whether
  arranging a base is "pleasant and understandable"; a placement rule that explains itself in three
  short clauses is most of the answer, and it is far better than a red cell and no reason.
- Hidden information is drawn as `?` rather than omitted. The player can see *that* there is
  something they cannot see — which preserves tension without leaking the plan.
- The keyboard-first footer (`[1-5] SELECT  [↑↓←→] MOVE  [ENTER] PLACE  [U] UNDO  [C] COMMIT`) maps
  cleanly onto the interaction list in engine Section 10.3, undo included.
- A legend strip naming every glyph in play. Worth keeping permanently, not just in concept.

**Deltas against canon:**

| Delta | Canon says | Question |
| --- | --- | --- |
| `RADIUS +4` on the selected Outpost | Default build radius is **two tiles**; outposts project farther | **Q5** — probably not a conflict at all, since this is an Outpost |
| Header reads `PHASE: VEIL` and `TURN 04` <!-- stale-ok --> | Phases are **Build Phase** and **Nexus Pulse** | Stale: predates the canon 2.0 rename. The repository validator now rejects this word in specs |
| Single `RES 160` counter | One resource per match | **Q2 — answered** in this piece's favour |
| Construct menu: Outpost 60, Barracks 80, Wall 20, Farm 40, Supply 50 | No costs are locked | Not a conflict. It is a useful **first cost hypothesis** for Milestone 4 — a five-item menu at a 20-80 spread, which is the right order of magnitude for a 5-12 minute match |
| No warehouse in the construct menu | Warehouses provide global storage | Consistent with **Q7**'s recommendation that storage pressure stalls workers in place. Worth noting the art independently reached the simpler economy |

## 5. `03-intercept-cutscene.png` — Commander intercept

Two Commanders facing each other across a Nexus pyramid rendered in fine ASCII linework, with a
dialogue box below carrying speaker badges and two lines:

> `@: You crossed half a galaxy for this ruin?`
> `g: No. For what woke beneath it.`

**What it gets right:**

- This is lore Section 1's "rhyme at four resolutions" rule demonstrated rather than described. The
  speaker badge is the battlefield glyph, boxed in the faction's own geometry: `@` in Citizen orange
  in a hard-angled frame, `g` in Ravel pink and acid green in a jagged one. The one-cell glyph, the
  badge, and the portrait are visibly the same character.
- The dialogue is two lines and does the work of a paragraph. That is the campaign voice target from
  lore Section 10 hit exactly — establish motive, open a mystery, get out.
- The Nexus is drawn as an impossible light-structure receding into a city that is clearly *beneath*
  something. It sells "the buried ruin had not grown, it had remembered its size" without narrating
  it.
- `SIGNAL SOURCE: BELOW` as the only status text. Dry, institutional, and ominous — the humour
  register lore Section 10 asks for.

**Deltas against canon:**

| Delta | Canon says | Question |
| --- | --- | --- |
| Portrait linework needs box-drawing and extended glyphs | Baseline is seven-bit ASCII, with Unicode as an explicit optional mode | Not a conflict — cutscenes are not the battlefield. But **the ASCII-safe fallback for portraits must be authored, not generated**, and this piece is the argument for why that matters |
| The `g` badge suggests a named Ravel Commander | No rosters exist before Milestone 4 | Not a conflict. Keep it as art direction, do not let it become a stat block |

## 6. Standing observations

**The art won Q1, halfway.** These pieces read well largely because they have room to breathe, and
that argument carried: tile width is now adaptive, and this is what the wide composition is for. The
80-column composition remains the acceptance target, so the open work is proving a single-width frame
can read nearly this clearly. If a session gets there, record it loudly.

**The concept set has no reduced-motion, monochrome, or resize-gate frame.** Every piece is the
happy path at full capability. Before Gate 1B, it is worth drawing the same battlefield in
monochrome — that frame is the one the legibility law is actually about, and drawing it is cheaper
than discovering the problem in code.

## 7. Adding a piece

1. Drop the file here with a numbered, hyphenated, descriptive name.
2. Add a section: what it gets right and should be preserved, then a delta table against canon.
3. Any delta that is a real decision becomes a row in
   [`../specs/open-questions.md`](../specs/open-questions.md) with a recommendation.
4. Concept art is CC BY-SA 4.0. Third-party references must be attributed and must not be traced.
