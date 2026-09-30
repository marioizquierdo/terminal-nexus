# Terminal Nexus agent instructions

**Canon version:** 2.27

These instructions apply to every coding agent and human-assisted coding session in this repository.

Section 4 below summarises invariants that are stated authoritatively in `specs/`. It is a summary,
and when it disagrees with the canon the canon wins — the validator checks that the version above
matches `specs/README.md`, so a canon bump that forgot this file fails the build.

Terminal Nexus is a specification-driven project. The specifications are not decoration around the
code — they remain the project's authority even now that Milestone 1's code exists: the canon
controls product truth, the code implements only what the active gate authorizes. Treat the
specifications as the operating contract.

## 0. Orient in one command

```bash
./scripts/check-repository.sh
```

It prints the canon version and the active gate, and it enforces the canon's structural invariants.
Run it first, and run it again before you hand back work — it is the fastest sanity check on the
canon, though it is not the only feedback loop any more: `grid` (`./bin/grid.ts`, `DEVELOPMENT.md`
has the commands) resolves and reports on an actual battle, and `npm test` runs the test suite across
two runtimes. A `.claude/skills/grid` skill has `grid`'s CLI, report grammar, and scenario-authoring
workflow in more detail than this file does — read it before re-deriving any of that from source.
A `.claude/skills/playtest` skill (`node scripts/playtest.mjs`) presses keys on the Build Phase
screen without a terminal and returns every step's screen as text, PNGs or a GIF — the quickest way
to see a change working and to make a pull request's pictures. `bun scripts/build-web.mjs` builds
the **browser playtest page** — the real menu, Build Phase and Pulse playback in one HTML file, for
playing from a phone or any other device during review; publish it as a private page on the pull
request only when a change must be played to be judged — a picture, a GIF or a code block is cheaper
and often enough (Section 5; `DEVELOPMENT.md` has the details).

## 1. Start with authority, not code

Read in this order:

1. [`specs/terminal-nexus-concept.md`](specs/terminal-nexus-concept.md);
2. [`specs/README.md`](specs/README.md) and the milestone marked **CURRENT**, through its
   **Active gate**;
3. [`specs/open-questions.md`](specs/open-questions.md) Section 4 — what is undecided and why;
4. [`specs/project-governance.md`](specs/project-governance.md), especially the execution ledger and
   bounded autonomy;
5. only the supporting canon sections named by the current gate;
6. existing source, tests, evidence, and recent changes.

The canon controls product truth. The current gate controls implementation. Future milestones are
context, not authorization.

Before changing code, state:

- the current question;
- the smallest artifact that can answer it;
- required automated and human evidence;
- exclusions and stop conditions.

Write them into a copy of [`specs/templates/gate-report.md`](specs/templates/gate-report.md) rather
than only into the chat. If they are not clear from the repository, that itself is the finding — say
so before building something to fill the gap.

## 2. Current authorization

**Milestone 1 is accepted.** Both gates — 1A, the Pulse Playground, and 1B, quality and effects — are
implemented, evidenced, merged, and formally accepted by the owner (2026-08-26,
`specs/project-governance.md` Section 5). Nothing about Milestone 1 itself is open work for a new
session; [`milestones/milestone-01-grid-battles.md`](milestones/milestone-01-grid-battles.md) says so
at its own top.

**The roadmap went campaign-first, per the owner's own direction, at the same time** — and building
the campaign's first level turned out to need most of the game's still-unbuilt systems at once, so it
is a sequence of ten focused milestones, not one. They are tracked in
**[`milestones/`](milestones/)**, their own folder, separate from versioned `specs/` since a milestone
is a tracker checked off during work, not a document that only changes at a named canon version — read
[`milestones/README.md`](milestones/README.md) first for the full sequence and why it looks this way.

**Milestone 2 is accepted.** [`milestones/milestone-02-campaign-design.md`](milestones/milestone-02-campaign-design.md)
— Design and Orientation (re-scoped at canon 2.11) fixed the vocabulary of the single-player modes
([`specs/game-modes.md`](specs/game-modes.md) — Campaign and Challenge), the build order, the few
PERIMETER decisions the UX build needs, and — at canon 2.12–2.16 — the Citizen Nexus's character, the
three starting Commanders (Vasse, Averno, Dob Hunter, with no upfront choice screen), what a Nexus
power does, the two openings sharing one map, a bounded objective taxonomy replacing fixed Pulse
counts, and the Commander Army's own composition list. Gate 2D closed 2026-09-12 when Mario confirmed
the design, answered Q45 and Q46, and gave the composition list himself. Nothing about Milestone 2
itself is open work for a new session.

**Milestone 3 is accepted** (2026-09-21). `terminal-nexus` launches into a real top-level menu built
on the same terminal stack `grid` proved, with a reusable list shape, keyboard/mouse/driver adapters,
one shared disposer (`src/cli/lifecycle.ts`), a Settings screen that persists, and honest placeholders
for the two modes that have no milestone built yet. Nothing about it is open work.

**Milestone 5 gate 5A is accepted** (2026-09-21). The viewport rule of `engine.md` 3.3 — written
before the kernel existed and executed by nothing until now, because Gate 1A deliberately used a Grid
that fit the screen whole — finally runs: a Grid larger than the screen, a camera the cursor drags at
a 3-tile margin, edge markers and a position readout in place of the minimap the canon refuses to
have, and structures armed by a digit or a click and placed at the cursor. Three input assumptions
were replaced by measurements at canon 2.17; they are in Section 4 below and in `engine.md` 9.7.

**Milestone 5 gate 5B is accepted** (2026-09-21). The Build Phase has a construct menu in two groups
under one digit sequence, a cost and one line of effect per row, a budget that runs down and dims
what it can no longer afford, and a panel that answers a refused placement with its reason and its
tile. Four rules earned by building it are at canon 2.18, in Section 4 below.

**Milestone 5 gate 5C is built and merged, across two rounds, but not yet formally accepted**
(2026-09-22). Scrolling now works across the whole supported viewport range and needed no change to
do it; the footer and the side panel share one list of key bindings. A second round acted on Mario's
own live feedback: the arrow edge markers are gone, replaced by a border that goes solid where the
map ends and dim where it does not, with a second, switchable scrollbar option next to it
(`--edge-style scrollbar`); the armed construct row carries an explicit marker; and five small bugs
found along the way are fixed. Mario merged it and said "I like the changes," and two things stayed
his to judge. **The first is now resolved (2026-09-26): no scrollbar; the border reads as the everyday
lighter line wherever there is more Grid to scroll to, and as a heavier, doubled line only where a
side has actually reached the Grid's own edge (canon 2.19).** The second — whether the marker and
cursor read as intended — is untouched and still open.

**Milestone 5 gate 5D is built and reported (PASS), but not yet formally accepted** (2026-09-22,
report 2026-09-23). The Build Phase opens on a Nexus power draft — two placeholder powers, not real
Milestone 8 content — that may not be skipped; `p` asks once, in plain yes/no terms, whether to end
the Build Phase and start the Nexus Pulse, and accepting locks every other action but not cursor
movement. A dedicated test proves keyboard, mouse, and a driver script land on the identical
committed state.

**Milestone 5 gate 5E is built and reported (PASS), awaiting Mario's look** (2026-09-26). He ran the
merged build in iTerm2 and gave two rounds of direct feedback; everything small and local in it is
built. The interface is readable in daylight; the Grid is a closed rectangle of its own whose sides
read light where there is more Grid and heavy (`===`) where the map ends — the missing line directly
above and below the Grid was why its edge looked "arbitrary"; a second click on the same tile places
(Q52, reversing Q50) and Space places like Enter; the tile just built on no longer shows a false
refusal; a refused placement is answered on a typed status line with its tile — quietly while
looking, in red once tried — over a grey block of `x`; the key help is trimmed; Option+Arrow is the
fast move and no longer leaves the screen. What reshapes the screen or needs a clock became gates
5F-5H, with every decision in canon (`engine.md` Sections 3.1, 3.3, 9.2, 9.7 at canon 2.19) and every
undecided fork in `open-questions.md` (Q53-Q59), each with a recommendation.

**Milestone 5 gate 5F is built and reported (PASS), awaiting Mario's look** (2026-09-26). The menu
is on the left of the Grid, the top and bottom bars run the whole width, and the screen opens with
the keyboard on the menu: Tab moves between the menu and the Grid, Up/Down and Space work the menu,
and arming from it puts the cursor one tile beside the last thing planned, so a run of buildings needs
no arrow key. After a placement focus goes back to wherever the arming came from (Q57's
recommendation, built); Esc is one level of cancel. The Nexus power pick is a "[n] Nexus Powers (1)"
entry at the top of the menu that opens a popup over the Grid only when asked, and a waiting pick
refuses only the commit. Two things were found only by looking at screenshots and are fixed — a short
Grid's menu ran over the bottom bar, and the highlight bar was three colours — and one question was
registered (Q60: does the popup close itself after a pick?).

**Gate 5F's second round is built and reported (PASS), awaiting Mario's look** (2026-09-27). His
playtest of 5F became three plain modes (menu, placing, exploring), one cancel (Esc, `x`, right click)
ending in an exit question, clicks that focus before they activate, one popup shape, an information
panel, and a solid map edge. **Two documents now carry the interface's rules and the feedback's
state: [`docs/ui-patterns.md`](docs/ui-patterns.md) — follow it on every new screen — and
[`docs/feedback/2026-09-27-build-phase-playtest.md`](docs/feedback/2026-09-27-build-phase-playtest.md),
where every owner item is built, scheduled or contested; an orchestrator session works through what is
still open there before gate 5G.**

**After round 2 (2026-09-27, canon 2.20)**, Mario agreed three things and they are built: the Nexus
Powers popup closes on the pick (Q60); the map's west edge is its own column beside a plain menu
divider (feedback F17); and the browser playtest page exists, as a development tool whose rule is in
`specs/engine.md` 10.2 and Section 4 below. The Pulse playback's `q` now also finishes the playback
(F16), which Milestone 6's Pulse-to-Build-Phase handover needed.

**Milestone 5 gate 5G is built and reported (PASS), awaiting Mario's look** (2026-09-27): `d` or
`[d] debug` in the top bar opens a popup of live experiments — the smart cursor, the scroll margin,
whether the screen opens on the menu or the map (Q61), and the menu's flash timings — each naming the
question it serves, changed with Left/Right, restarted with `[r]`, never saved.

**Milestone 5 gate 5H is built and reported (PASS), awaiting Mario's feel** (2026-09-28): the Build
Phase has its first frame timer; a tap moves one tile, a held arrow speeds up (2 then 4), Shift moves
8, and turning slows to 1; the scroll margin is 20% of the view; an armed click never scrolls the view
(Q58) and an exploring click near an edge scrolls further the nearer it is (F6, Q62); the view slides;
a refused placement flashes; a lone Esc waits 50 ms; Debug Mode — now twenty flags, every one of those
numbers — scrolls.

**Milestone 5 gate 5I is built and reported (PASS), awaiting Mario's look** (2026-09-28): a placed
building plays its own short run of frames, then stands lit with a few sparks around it, all
presentation, all four numbers in Debug Mode, off under reduced motion.

**Milestone 5 gate 5J is built and reported (PASS), awaiting Mario's playtest** (2026-09-28): his
third round of feedback, from playing the 5G-5I demo page
([`docs/feedback/2026-09-28-pr46-playtest.md`](docs/feedback/2026-09-28-pr46-playtest.md), F18-F27).
Debug Mode became **Settings** — Esc or `q` opens a game menu with Settings and Quit, the player's own
settings are saved, and **Experiments** sit at the bottom (`d` jumps there) with an **export** to paste
into a pull request and `--settings` to read it back. One press moves 1 tile, a held arrow 2 then 4,
Shift jumps 12; the view slides and the cursor glides on every move; a click on a menu row activates
it; armed clicks scroll and a double click places; `[e] Explore Map` is first and follows the cursor;
the map edge is quieter, with its glyph and a shared west side as Experiments (settled at 5K); and presentation is
four named families (animations, particles, shading, tweens) with the placement juice on them. 5G-5I
were reworked by it rather than superseded, and all of them await his playtest together.

**Milestone 5 gate 5K is built and reported (PASS), awaiting Mario's playtest** (2026-09-29): his
fourth round and his settings export
([`docs/feedback/2026-09-29-pr46-round-4.md`](docs/feedback/2026-09-29-pr46-round-4.md), F28-F40).
Arming puts a building where the cursor is (or the nearest good spot, a free column to the right);
placing or Esc goes back to where it began — the map in plain navigation, or the menu; the Build Phase
opens on the menu at Explore Map; every menu row has one active style (`>`), Explore Map included, its
row over a separator above the tile details; removal throws sparks; Settings has a position count, a
scroll bar in the popup border, Export as its last row, and a message popup when a change needs a
restart; the top bar's right end names what Esc does and popups carry no `[esc]`; his numbers are the
defaults and the map's own edge on the shared divider is the rule; and `--keys`/`#keys=` open the game
in a state. Q66 — reading key releases where the terminal reports them — waits on
`node scripts/probe-key-release.mjs` in his iTerm2.

**Milestone 5 is accepted** (2026-09-29). Mario played and merged the Build Phase work (gates 5D-5K,
tested together) and the polish pull request after it, and gave his word that Milestone 5 is accepted
and Milestone 6 is promoted. Every "awaiting Mario" line about gates 5C-5K above is resolved by that;
[`milestones/milestone-05-build-phase.md`](milestones/milestone-05-build-phase.md) is COMPLETE and kept
as a historical record, and nothing in it is open work.

The current milestone is **[`milestones/milestone-06-pulse-phase.md`](milestones/milestone-06-pulse-phase.md)
— the Nexus Pulse Phase** (promoted 2026-09-29): can a player start the Pulse from a completed Build
Phase, watch the unmodified kernel resolve it, see a legible ending with Recall, and land in the next
Build Phase? Its active gate is **6A — Start, end, Recall**: Start Nexus Pulse as an explicit action from
the Build Phase's Start button, the end condition, the stop / finish-in-flight / Recall sequence, and a
result a viewer can read unprompted. **Gate 6A is built and reported (PASS), awaiting Mario's playtest**
(2026-09-29, `evidence/gate-6a-report.md`; reworked twice from his feedback the same day):
**`[s] Start Pulse`**, the menu's last row — reached by Up and Down like every other, since a menu can
always be walked with Up, Down and Enter alone — opens a "Battle Round 1" screen announcing the round,
and Enter, Space or `[s] Start` starts the Pulse on the Build Phase's own screen — the unmodified kernel
resolves the committed plan plus a placeholder crew and raid — with a countdown timer in the title, a
score, a feed of events, pause / speed / step / watch-again, and an ending of the timer flashing and a
light sweeping the map's border like a lighthouse in the last three seconds, a cease fire, the survivors
walking home and a plain result (won, lost, drawn or timed out, and why). **Red is kept for the player's
own Nexus being hurt** — its first hit, very low health, a lost Pulse — faint and brief. Recall, which
the rules described and no code ran, is built for the first time in `src/match/`, beside the kernel;
the kernel is untouched. The ending's timings, the red's switch, and the raid's and the crew's size are
Experiments (`d`); the interface rules are `docs/ui-patterns.md` sections 6 and 7c. **Do not start 6B** (the loop back into
the next Build Phase and the trigger runner) or 6C (automatic production) without Mario's word. **Mario
asked on 2026-09-28 to keep going without waiting to look at each gate first**: he tests several merged
changes together, then plays, exports his Experiments, and pastes them into the pull request.

**The menu spike is built and reported, awaiting Mario's playtest** (2026-09-30,
`evidence/menu-spike-report.md`; feedback
[`docs/feedback/2026-09-30-menu-spike.md`](docs/feedback/2026-09-30-menu-spike.md), F52-F60, on a pull
request of its own): the reorganisation of the Build Phase menu that 6A's round 3 left for a spike
(F51). Every row either opens a popup or gives the map something to do, and an active row reads
`[x] Name  >>`; a focus arrow flies from the row to the cursor, which blinks when it lands (both
Experiments); Left and Right stay on the menu; the menu is one list with `$ 100` on its top line; a
building being placed shows its card in the panel; the bottom bar is one line of contextual help; and
the game menu has a Controls and hotkeys page. It does not start 6B.

So the authorised work for a new session is, in order:

1. **whatever the owner's most recent feedback asks for**, if any exists since
   `specs/project-governance.md`'s ledger last entry — check before assuming either that nothing is
   outstanding or that everything still is; **a pasted settings export is feedback**: start the game
   with it (`--settings`), and settle each Experiment it answers — adopt the value as the default,
   delete the Experiment, record the answer;
2. **the current milestone's active gate** — gate 6A has nothing left to build until he has played
   it (and Q66 waits on his key-release probe); the next gate waits for his word, and when it comes it
   is the next gate in the build order
   [`milestones/README.md`](milestones/README.md) carries. Milestone numbers are identities, not an
   order — read that table's build-order column, and take one gate per session unless the owner's own
   prompt asks for more.

Each milestone names exactly what it needs in its own "Depends on" line, and its gates are the unit
of work.
Do not build a second resource, storage or warehouses beyond what Milestone 7 specifically needs, real
routing/pathfinding fixes, visibility filtering, the replay format, multiplayer, any level beyond
PERIMETER and RIGHT OF SALVAGE, any campaign but the Citizen opening, a real save/progression system
beyond the flat unlock record Milestone 4 reads, sound, packaging, remote delivery, a mod loader, or a
Rust/Go migration unless an accepted gate result authorizes it. **Do not author the full Citizens
Commander Army**: Milestone 8 builds the Commander mechanic and one named Commander (Vasse) for
PERIMETER specifically — see that milestone's own Q34 for the exact line between that and Milestone
12's still-reserved real roster selection.

**How to run what exists:** the `.claude/skills/grid` skill and `DEVELOPMENT.md` — read one of them
rather than re-deriving `grid`'s CLI or the test commands here.

End with a `PASS`, `REVISE`, `STOP`, or `BLOCKED` evidence report. **Do not continue to the next gate
merely because time remains.** Finishing early with a clean, well-evidenced answer is the intended
outcome, not a shortfall.

## 3. How much authority does a statement have?

Most of the design canon is a recommendation written before the thing existed. Every section of
[`specs/engine.md`](specs/engine.md) declares which kind it is:

- **RULE** — committed; something already depends on it. Changing it needs Mario and a canon bump.
- **GUIDANCE** — a recommendation, not yet earned by working code. Follow it by default; depart when
  the work shows better and say why in the gate report.

Most of it is GUIDANCE.

**Descriptive completeness is not authorization.** If you find yourself building something because it
is described in a document, stop and check the marker and the active gate.

## 4. Architectural invariants

**The three worlds.** State is what is true; the Pulse is how it changes; presentation is what it
looks like. Only the Pulse mutates state. Presentation can never influence the Pulse. The two random
streams — seeded gameplay, free cosmetic — never touch. A match must resolve with the renderer
deleted, and the renderer must be replaceable without one simulation test changing.

- The deterministic rules kernel is authoritative and imports no terminal, clock, network, or
  presentation implementation.
- Simulation produces canonical state and ordered semantic events. Events carry meaning, not
  appearance; renderers never reverse-engineer cells back into mechanics.
- Player projection removes hidden information before presentation.
- The play surface is the **Grid**; the replica on it is a **Grid Nexus**. The retired word for it
  is rejected by the validator. <!-- stale-ok -->
- The Grid has five layers — terrain, obstacles, workers, units, air. **Layers define render order.
  They do not define collision**: collision is a mask composed from a chosen set of layers, so a unit
  can be blocked by a building on another layer while sharing a tile with a worker.
- **Coordinates:** `(0,0)` is the north-west tile, `x` grows east, `y` grows south, `n` is `y - 1`.
  Scenario rows read north to south. One convention, every module.
- **Speed tier is initiative, and lower acts first** — for movement claims and attacks alike. It is
  not a movement rate; that is `movementRate`.
- Every entity has an anchor, a footprint, and a facing. **Units as well as structures may span
  several tiles**, and that matters strategically. A mover tests its whole footprint against its
  mask. Range measures to the nearest occupied tile.
- The viewport is clamped to between 48 × 16 and 72 × 24 tiles; the cursor drives scrolling at a
  margin (a share of the view, 25% — the owner's pick; the number is GUIDANCE);
  there is no minimap — the weight of the Grid pane's sides is the "more Grid" signal (the footer's
  position readout was retired at canon 2.27). 80 × 24 is the floor and the acceptance target; since
  the bottom bar became one line it shows 49 × 18 tiles. **The margin is a follow rule,
  not an invariant**: at the Grid's own edge the camera has nowhere to go and the cursor reaches the
  edge of the screen, which is correct — there is no more Grid to reveal.
- Grid orientation is a rendering choice. Portrait and landscape change no coordinate.
- Terminal composition produces an engine-owned structured cell frame. Cells carry style **roles**,
  never literal colors.
- OpenTUI, direct ANSI, browser, SSH, mobile, and future graphical renderers are adapters. The
  terminal library and the JavaScript runtime are independent choices.
- **The browser playtest page is a development tool, never a platform**: it runs the terminal's own
  screen loops through a stand-in terminal and converts only frames, input bytes and settings storage;
  nothing reachable from it may import a Node-only module (the build fails if one does). A terminal at
  80 × 24 stays the acceptance target. State fingerprints use a plain-JavaScript SHA-256 so both
  places compute the same hashes.
- Presentation may interpolate, skip, pause, accelerate, reduce motion, or recolor without changing
  simulation.
- Corruption effects live in the `effects` band or above; they never remove the only carrier of a
  required semantic cue.
- Effects are pure functions of absolute presentation time. `f(t)` never depends on `f(t-1)`.
  Presentation has **four families** — animations (an entity's own frames), particles, shading
  (glyphless colour) and tweens (interpolation) — and an animation's completion is **scheduled data,
  never a callback** (`specs/ascii-effects.md` 1.2).
- Gameplay randomness is one seeded PRNG — **PCG32**, with published vectors. Cosmetic randomness is
  a **hash of an effect instance's identity, never a stream**: a stream's answers depend on how many
  times it has been asked, which is exactly what effect purity forbids.
- The **compositor** enforces the corruption law. An effect cell that would replace an entity's glyph
  is dropped; the only write allowed onto an occupied cell is a glyphless attribute change.
- A **Grid Nexus is a flag on a content definition**, never a content id the kernel recognises.
- Faction identity lives in the glyph family and the effect language; ownership keeps the colour, so
  a mirror match stays legible and monochrome stays whole.
- Content is TypeScript-first and mostly declarative.
- The playable content boundary is a Commander Army: a faction and Grid Nexus, a Commander, starting
  units and structures, blueprints and the tech tree that unlocks them, upgrades, Nexus powers, and
  Specials — canon 2.16's parts list (`specs/commander-armies.md` Section 2.1). **A faction is a
  wide pool; a Commander Army fields a few of them.** The match only ever sees an army. **Whether an
  army is well modeled as a "deck of cards" is explicitly retracted, not even GUIDANCE** — a Commander
  Army is several different systems, and which shape actually fits is for building and playing to
  show. **A Commander Army's structures form a real, inspectable tech tree**, mostly shared across a
  faction's Commanders; completing one can unlock its dependents through the same `unlockStructure`
  effect a Nexus power already produces, gated by construction, never by a second resource. A
  **Special** is cast once per match, during a Build Phase the player chooses, for a short-lived
  bonus — modeled like a small Nexus-power pool but match-scoped rather than dealt each Build Phase.
- **Every interactive action is a named command.** Keyboard, mouse, and a driver (for agents and
  tests) are three adapters onto one vocabulary; every menu item displays its hotkey and is clickable
  with identical effect — **a click activates what it lands on** (owner, 2026-09-28): a click on a
  building's row arms it at once with its preview at the cursor, whatever had focus, and only the
  keyboard has a "highlighted, not yet chosen" state; the driver can inject raw key and mouse events
  and read the cell frame back.
  **Three bindings are measured rather than assumed** (gate 5A): Shift+Arrow has two live sequence
  families and several terminals send none at all, so a modifier-free fallback is required, not
  optional; and the mouse wheel moves the *cursor* five tiles rather than a camera of its own, because
  a second camera is the pan mode the scrolling rule forbids. **A second click on the same tile places
  the armed structure** — compared by tile, never by screen position, so a click that scrolled the
  view cannot place on a neighbour (Q52, reversing gate 5A's one-click Q50); **a quick double click on
  one spot places where its first click pointed**, timed in the input path (gate 5J). **Keyboard focus is
  reducer state, on the menu or the Grid, and the menu orchestrates the Build Phase**: a structure is
  armed only while the Grid has focus, and **finishing goes back to where it started** (Q57, refined
  2026-09-29): placing or Explore Map begun on the map returns to plain navigation there; begun on the
  menu, to the menu, disarmed. **Arming puts the building where the cursor is** when it fits, else the
  cheapest spot within 12 tiles (sideways cheaper than up or down) leaving a free tile around it —
  never beside the last building placed; the cursor opens on the Grid Nexus. **Esc, `x` and a right
  click are one cancel** that goes back one level — popup, then placing or Explore Map to where it
  began, then the map to the menu — and on the menu opens the **game menu** (`[s] Settings`,
  `[c] Controls and hotkeys`, `[r] Restart`, `[q] Quit`); `q` opens it too, `?` opens the Controls
  page directly, and only Ctrl+C quits at once. Leaving always asks. **Left and Right on the menu
  only flicker the row**; the keyboard stays there (canon 2.27). **A menu row that hands the keyboard
  to the map** (a building armed, Explore Map opened) sends a **focus arrow** to the cursor, which
  blinks when it lands — presentation, timed in the live loop from a sequence number the reducer
  records (`BuildState.handoff`); a placement back on the menu flashes its row once.
  **The top bar's right end says what Esc does** — `menu [esc]`, `back [esc]`, `close [esc]` — and a
  click on it is Esc; no popup carries its own `[esc]`. A click scrolls
  the view near its edges, armed or not (gate 5J, reversing Q58). How far a key moves the cursor is
  timed in the input path, and every animation — including the camera's slide and the cursor's
  glide, which interpolate every move — in the view; never the reducer.
- **The Build Phase panel is one list** (canon 2.27): what is left to spend as `$ 100` on its top
  line, in the cost column; `[e] Explore Map`, a blank line, `[n] Nexus`, a blank line, every building
  in catalog order with its cost (no group headings), and `[s] Start Pulse` on its last line — no help
  text, no radius preview until something has a radius (Q30). **A card replaces the menu** while
  Explore Map is open (what is under the cursor) or a building is being placed (that building): its
  header is the row that opened it, drawn active, with a separator under it; `x`, Esc or a click on
  the panel goes back. **A menu row has two states**: highlighted (the keyboard's bar, only while the
  menu has focus) and **active** — `[x] Name  >>`, the hotkey colour, underlined — while its action is
  under way: a building armed, Explore Map open, the Nexus popup or the Battle Round screen open — one
  style for all. **Every popup is one shape** — a title and rows as data,
  options naming the command a click sends, at most one scrolling list with a scroll bar in its right
  border, drawn and hit-tested from the same placement; a **message** is the shape with nothing to
  choose, closed by Esc or a click outside — and is
  drawn last in the `chrome` band, never in a band of its own. **A refused placement is
  answered on the bottom line, and names its tile**; **affordability is reported before any tile
  problem**. Should the menu grow groups again, they share **one digit sequence**.
- **The bottom bar is one line, the contextual line** (canon 2.27): the last command's answer while
  it has one, otherwise a hint for where the keyboard is, from one list of situations
  (`src/build/help.ts`); an answer lapses at the next command that says nothing. Every key is on the
  **Controls and hotkeys** page. A message is typed — text, a tone (`hint` among them), and the tile it
  is about, if any — never a bare string, and a tone resolves onto style roles in one place
  (`src/view/status.ts`). **The Grid
  pane is a closed rectangle** whose sides carry the "more Grid this way" signal as weight: a light
  line where the view can scroll further, and **the map's own edge** where the map ends — a style the
  map names for itself (a solid inverse-video bar when it names none), in the quieter edge colour, the
  same weight on all four sides and in every glyph pack. **The menu's divider is its west side**, so
  the Grid has that column: 49 tiles at 80 × 24, which stays the floor.
- **A mission is a sequence of Build Phase / Nexus Pulse cycles driven by triggers.** Simulation
  actions run inside the kernel as validated intents; presentation actions never touch state. A
  scripted Pulse is still a Pulse.
- **A mode is data over one match loop and one army shape.** Campaign (first-time experience,
  canon) and Challenge (seeded runs with a draft between battles) are the two single-player modes;
  nothing below a mode knows which one it serves. Every card carries `rarity`, `tier`, and `role`.
- **Each Nexus is named for its faction** — Citizen Nexus, Ravel Nexus, Feudal Nexus, Glitch Nexus,
  Alder Nexus, with Prime/Grid appended where it matters. No proper names in canon, code, or
  interface.
- **A Nexus power is a name and one plain line of description.** No player-facing classification; the
  effect kinds (`unlockStructure`, `spawnUnits`, `modifyContent`, `modifyRule`, `modifyCommander`,
  `reveal`) are code names. **A dealt Nexus power may not be skipped** — it is almost always strictly
  advantageous, so there is nothing to protect against by declining one; Alder alone converts a power
  into their own "honor" currency, and even that may be locked out at tutorial difficulty. **A
  mission has goals, not a fixed length** — a bounded `ObjectiveDefinition`, resolved by the
  scenario/trigger layer one level above the kernel's own unchanged victory check, which stays the
  fallback for Skirmish and Challenge battles.
- **Campaign and Challenge are uncorrelated.** Challenge keeps its own progression — basic Commander
  packages from the start, more unlocked by playing Challenge itself — so nobody is locked out of
  Challenge content by disliking the Campaign. The Campaign's bonus goals add a few more unlocks,
  only for things Challenge hasn't already unlocked; a soft, dismissible message recommends the
  Campaign first, but never blocks Challenge.
- Prime Nexuses remain at home and replicate Grid Nexuses; avoid stale teleportation language.
- Player-facing phases are **Build Phase** and **Nexus Pulse**; use those names consistently.
- **Lore is a platform, not a plot** (`specs/terminal-nexus-lore.md` Section 10.6). This is a terminal
  game with icons: complexity grows through units and powers, never through story; every named
  character must earn its place by teaching a mechanic; budgets are ceilings (a briefing is a
  paragraph, a bark is 3–8 words); there is **one timeline**; and the setting deliberately
  under-specifies so players and their agents can extend it. What the project has to prove is that
  ANSI characters are exciting and legible — when a session must choose between enriching the story
  and making the Grid clearer, **the Grid wins**.
- Prefer direct code for the current proof. Extract a framework only after two real uses reveal the
  boundary.

## 5. Working method

- Keep changes small, reviewable, and within the current gate.
- **Prefer the missing connection over the missing polish.** A gate that is honest, connected, and
  ugly is worth more than one that is beautiful and dead-ends — playing the whole thing is what says
  which part deserved the polish, and it usually is not the part you expected.
- Preserve unrelated work; never use destructive Git commands to clear an incidental problem.
- Pin runtime and dependency versions used as evidence. Re-check official sources; never copy a
  remembered version.
- Separate measurements from interpretation.
- Do not label an untested platform supported.
- Keep fixtures, seeds, snapshots, commands, and measurements reproducible.
- Add or update tests with behavioral changes.
- Treat owner validation as separate from automated correctness.
- Ask before changing a locked decision, widening scope, adding a service or secret, publishing
  artifacts, or pushing directly to `main`.
- Update `README.md`, `DEVELOPMENT.md`, the dev container, CI, and agent instructions together when
  canonical development commands change.
- **Ask Mario to feel a choice through an Experiment** (owner direction, 2026-09-26 and 2026-09-28:
  "The agent should feel free to add experimental flags anytime they need particular feedback from
  me, so I can try with and without them, adjust speed settings, etc until it feels right").
  **Settings** (Esc, then `s`, in the Build Phase) holds the player's own saved settings and, at its
  bottom, **Experiments**: live-editable flags, some applied at once, some on restart
  (`src/build/debug.ts` is the list); `d` jumps straight to them. When a session has a fork the owner
  should feel rather than read about — a timing, a look, a movement rule, or whether a new feature
  should exist at all — add an Experiment defaulting to the recommended answer and **ask him in plain
  words to flip it**: "press `d`, set Armed click scrolls to off, and tell me which you prefer." Then
  **ask him to paste the export into the pull request**: Settings' **Export settings** (`e`) copies
  every setting and experiment as `name = value` text, changed experiments first; reproduce what he
  had with `--settings "<pasted text>"` (`terminal-nexus --spike` or `scripts/playtest.mjs`) or
  `#settings=` on the browser page. A new behaviour whose worth is in doubt ships with an on/off
  Experiment, so he can switch it off without a rebuild. This is Section 6's "make it observable" in
  its preferred form, ahead of a command-line flag or a registered question. Every Experiment names
  the question it serves and is **normally deleted before its pull request is accepted**; a few stay
  longer or graduate into real Settings. Settings is only in the Build Phase today; a screen without
  it falls back to a command-line flag.
- **Size the pull request's Demo to the change** (owner, 2026-09-28: "we have to be a little more
  smart about how many tokens we spend building a playable demo"): a code block or nothing for a
  change that does not show on screen, screenshots for one that changes how things look, a GIF for
  movement or timing, and a playable page only when it must be played to be judged. The
  `pr-description` skill has the layers and the "On Claude Web Artifact" / "On MacOS" shape.

- **When the owner sends feedback**, follow the `feedback-round` skill (log his words, turn them into a
  gate, split the work across agents by files, merge, write the canon, regenerate the evidence,
  rewrite the pull request). What the last four rounds taught is in
  [`docs/lessons-learned.md`](docs/lessons-learned.md); the goals behind his feedback, which decide
  when two rules disagree, are `docs/ui-patterns.md` section 0; how the game could run on other
  hosts is [`docs/portability.md`](docs/portability.md); and what is waiting — including the prompt to
  start the next milestone — is [`docs/next-steps.md`](docs/next-steps.md).

### Write for a person, not for the filing system

Everything a human reads — pull request descriptions, chat replies, commit messages, and any document
written for Mario rather than for the next agent — says **what the thing is**, not where it is filed.

- Bad: "per `engine.md` Section 5.4, and proceeding under Q38's recommendation."
- Good: "the Nexus offers the player a small choice of upgrades each round — nobody has designed what
  those are yet."

Mario does not have the section numbers memorised and should not have to. A sentence he has to look up
before he can judge it is a sentence that has failed. Name the actual rule, decision, or idea in plain
English; if the source genuinely matters, put it in parentheses after the idea, never instead of it.

Internal shorthand is still fine **where the audience is the next agent** — a note inside a design
document's "notes for the next session" section, a comment in the open-questions register, a code
comment. The test is simply who is reading. When in doubt, write the sentence out.

The same goes for the project's own vocabulary. Words like *gate*, *canon*, *belief ramp* and
*Manifest* are shorthand this repository invented; define one the first time it appears in anything
Mario reads, or use ordinary words instead.

## 6. When the canon does not answer you

This will happen. It is expected, and there is a procedure — see
[`specs/open-questions.md`](specs/open-questions.md) Section 2.

1. **Decide it yourself** if it is reversible: module boundaries, names, local data shapes, test
   organization, diagnostics. Governance Section 2 already grants this. Do not ask.
2. **Make it observable** if you can. A parameter, toggle, or side-by-side fixture that lets Mario
   *look* at both answers beats a paragraph arguing for one. This is the preferred move and it is
   cheap far more often than it looks. In the Build Phase the form is an **Experiment** in Settings,
   which he flips with `d` and reports back by pasting the export — and the pull request asks him to
   (Section 5).
3. **Register it** if it is genuinely the owner's call: add a `Q<n>` row with the question, why it
   blocks, the options, their costs, and **a recommendation**. The validator rejects an `OPEN`
   question with no recommendation, because a question without one just moves the work to Mario.
4. **Keep going.** State the assumption you are proceeding under and finish everything the answer
   does not touch. Stop entirely only when proceeding under any assumption would waste the work.

## 7. Verification

Until the product runtime is selected, run:

```bash
./scripts/check-repository.sh
```

When a gate adds commands, record exact install, build, test, and run instructions in its evidence
and promote the accepted ones into `DEVELOPMENT.md`.

**For simulation work** — Gate 1A, and every kernel change after it:

- the same scenario, seed, and tick count produce identical final-state and event hashes across many
  runs;
- resolving in one call equals resolving tick by tick;
- the kernel calls no clock and no `Math.random`, and imports nothing from a renderer — assert it,
  do not assume it;
- changing only the cosmetic seed changes nothing about state or events;
- no two entities overlap in a collision mask that includes both their layers, ever;
- arbitration terminates under a bounded pass count with a decreasing progress measure;
- every rule has a named scenario file that exercises it, checked in and runnable.

**For terminal work**, once a gate authorizes it:

- structured-cell snapshots, identical across backends;
- keyboard and mouse-event receipt;
- resize suspension and recovery from the same presentation time;
- alternate-screen and cursor cleanup;
- `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure through one idempotent disposer;
- non-TTY behavior;
- monochrome ASCII and explicit color modes;
- startup, frame-time, changed-cell, and output-byte evidence.

The lifecycle cases matter most. A renderer that drops frames is a tuning problem; a renderer that
leaves the terminal in raw mode is a reason to reject it.

## 8. Finishing a session

Leave the repository in a state the next session can pick up cold:

- [ ] `./scripts/check-repository.sh` passes;
- [ ] the gate report is filled in and ends with `PASS` / `REVISE` / `STOP` / `BLOCKED`;
- [ ] every command in the report has been run verbatim;
- [ ] new questions are registered with recommendations;
- [ ] the commit message says what question the change answers;
- [ ] anything you learned the hard way is written down, not just fixed.

Section 7 of the gate report — failures, surprises, and discarded approaches — is the highest-value
thing you can leave behind. An empty one usually means it was skipped rather than that nothing went
wrong.

## 9. Canon maintenance

After an accepted gate:

1. update the [`specs/project-governance.md`](specs/project-governance.md) ledger and history;
2. promote only evidence-backed conclusions into the focused authority document;
3. move answered questions into the register's Answered section and cite the ID in the commit;
4. update locked and open decisions;
5. revise the next milestone only after owner acceptance;
6. increment the shared canon version for semantic changes — the validator will name the documents
   you missed;
7. update links and run repository validation.

Do not recreate a monolithic specification. Lore goes in the lore document, engine rules in the
engine, playable content in Commander Armies, mission content in campaigns, undecided things in the
open-questions register.

## 10. Licensing and safety

- Code, protocols, schemas, scripts, tests, technical docs, and build config are Apache-2.0.
- Lore, fiction, characters, dialogue, ASCII art, and visual direction are CC BY-SA 4.0.
- Keep mixed scopes identifiable and preserve third-party attribution.
- Studying a referenced project's approach is free; copying its art, glyph sets, or palettes is not.
- Never commit API keys, tokens, credentials, `.env` files, personal data, or generated secrets.
