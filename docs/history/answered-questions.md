# Terminal Nexus — answered questions

_Questions Mario has answered, with the decision and the document that now owns it. Ids are permanent and never reused._

Rows move here with the date, the decision, and the document that now owns it.

| ID | Answered | Decision | Now owned by |
| --- | --- | --- | --- |
| Q30 | 2026-09-21 | **A, built.** The Build Phase panel is the construct menu, what is left to spend, the selected item's cost and effect, and the reason a placement was refused — and **no radius preview**, because nothing in the content that exists has a radius. Gate 5B built exactly the recommendation and the panel came out shorter than gate 5A's, not longer: the blocks it replaced were reporting things already visible on the Grid | [`engine.md`](../system-design/grid-engine.md) Section 9.2; [`docs/history/milestones/milestone-05-build-phase.md`](milestones/milestone-05-build-phase.md) |
| Q50 | 2026-09-21 | **A click places the armed structure — no second click to confirm.** Mario, shown both behaviours side by side: "Click to place looks good to me too. We can always implement undo or destroy later, for now this is good." (Undo and remove already exist: `u` and Backspace.) The toggle is deleted rather than kept as a setting. **Revisited 2026-09-26, see Q52** | [`engine.md`](../system-design/grid-engine.md) Section 9.7, whose own recommendation this confirms; [`docs/history/milestones/milestone-05-build-phase.md`](milestones/milestone-05-build-phase.md) |
| Q52 | 2026-09-26 | **Reversed: a second click on the same tile places it, not the first.** Owner, after living with gate 5D's build: "the building is placed right away, but there should be a confirmation... the default should require a second click." A future `Shift+click` is planned as a one-click escape hatch, not built now. Q50's own asymmetry finding (a first click can scroll the camera, so a second click at the same *screen position* lands on a different *tile*) is what makes this safe to re-adopt: the check is on tile identity, not screen position | [`engine.md`](../system-design/grid-engine.md) Section 9.7 |
| Q66 | 2026-09-30 | **A — the three tiers, behind the Key releases Experiment (auto / off), built before the probe ran in his iTerm2** because the owner asked to compare the two himself (third round on the menu spike, F79: "We should enable/disable reading key-press in the settings, so I can test how it feels when the system provides it vs when it does not"). On auto the Build Phase asks for the kitty keyboard protocol and switches it on if the terminal answers, and the one disposer switches it off on every exit path; a press is then a tap, a repeat belongs to a hold and a release ends it. A classic terminal, or off, falls back to timing: a press within the hold window of the one before is a repeat. The browser page does the same from its key-down and key-up events. Only how a repeat is recognised differs, never where the cursor goes; a test holds that. Left for the navigation session: whether iTerm2 answers (the probe), a learned hold window, and a hold timer of the game's own | [`engine.md`](../system-design/grid-engine.md) 3.3, 9.7, 10.1 (canon 2.29); `../src/view/key-events.ts`, `../src/build/motion.ts` |
| Q70 | 2026-10-01 | **B — a side whose Grid Nexus stands is never wiped out; built the same day.** Mario, after playing the loop across rounds (feedback F102): "the player should only lose when the nexus is destroyed or if there's a specific losing condition on the campaign level." A Pulse goes on until the Nexus falls or time runs out, and a mission may add a losing condition of its own. Built ahead of the Commander step, whose Vasse made it urgent: with her in the squads, the old rule let a plan that built nothing win PERIMETER | [`pulse.md`](../system-design/pulse.md), the victory rule; `src/pulse/victory.ts`; `scenarios/nexus-stands.map.json` |
| Q34 | 2026-10-03 | **Build the Commander now, and her deck with her.** Mario on the Commander's pull request (feedback F104, F105): "this milestone is more about building the concept of the commander and less about polishong this mission or vasse's health. Make sure that the commander deck is properly organized, and properly integrated with the campaign." Vasse, her mechanic and her deck are built at the size of the bench content; a mission names the deck it plays and overrides it, because the Campaign develops it level by level; the Citizens' roster, its balance and her four powers still wait. The note that PERIMETER should not force her death stands as a known issue, behind his "don't worry that much about level balance yet" | [`commander-armies.md`](../game-design/commander-armies.md) (what is built: a Commander's deck), [`campaigns.md`](../game-design/campaigns.md) (a mission names the player's deck) |
| Q71 | 2026-10-03 | **A — the coming raid is free, and the Build Phase shows its intent.** Mario (feedback F108): "The enemy units should be visible without nexus powers, reading the enemy intent is very important for basic ui/ux interaction." The Incoming wave Experiment is settled as shown and removed; the Build Phase shows what each group goes for first, along which way, how many and when, from the kernel's own prediction on the plan as it stands. A `reveal` power must show what the free view cannot; Early Warning's line is the Nexus draft step's to rewrite | [`ui-patterns.md`](../system-design/ui-patterns.md) (the incoming wave), [`scripted-opponent.md`](../game-design/scripted-opponent.md), [`commander-armies.md`](../game-design/commander-armies.md) (what a Nexus power does) |
| Q68 | 2026-10-04 | **B — Battle Round everywhere the player reads.** Mario (feedback F119): "let's settle in Battle Rounds. Please remove the term 'waves'. We can refer to it as Nexus Pulse in lore and design, but Battle Round is better for the player and UI." The interface names the battle Battle Round wherever it names it (the menu row, the bottom line, the popups, the cards); Nexus Pulse stays the lore's and the design's word and the code's; a route counts rounds with `round=` only, and "wave" left the game and the documents | [`grid-engine.md`](../system-design/grid-engine.md) (vocabulary: round, Battle Round, group), [`ui-patterns.md`](../system-design/ui-patterns.md), [`routing.md`](../system-design/routing.md) |
| Q72 | 2026-10-05 | **A — beside her.** Mario, after playing the Commander's fourth round (feedback F122): "commander quotes, definitely behind her, it looks cool when they 'speak' during battle" (read as the Experiment's "beside her", its only choice on the map). Her lines show beside her `@` on the map, in the panel whenever she is out of view; the Vasse's voice Experiment is settled and deleted, and its "in the feed" and "off" choices with it | [`ui-patterns.md`](../system-design/ui-patterns.md) (her voice in battle); `src/view/pulse-voice.ts` |
| Q24 | 2026-10-06 | **E — rows x2, settled.** Mario played the four Ground choices: "Rose X2 definitely feels better. That's gonna be our choice"; with its math drawn for him, he merged the exploration as its record and settled it in the next pull request ("we will settle the choice and cleanup on the next PR"). Units stand tall: a cell is two half-rows of ground, so a row counts two columns in every distance and every step, and a step up or down moves both halves at once, in twice the time; melee is touching. A tile is one column wide at every size, which reverses Q1's two columns at 128. Every content reach is a whole number of rows, even or 1 for touching, and a reach the rules work out from one rounds up to whole rows, groups are set down round, and a card says a reach's shape. The Ground Experiment, its other three choices and the Ground test level are gone. Square bodies, every unit two columns wide, wait in reserve in case fronts feel unfair in play | [`grid.md`](../system-design/grid.md) (distance, placement), [`pulse.md`](../system-design/pulse.md) (movement, melee, flight, the build range), [`presentation.md`](../system-design/presentation.md) (tile width), [`ui-patterns.md`](../system-design/ui-patterns.md) (cards, the Controls page) |
| Q60 | 2026-09-27 | **B — the popup closes on the pick.** The owner, asked directly ("does the Nexus Powers popup close itself after you pick a power? My recommendation is that it closes"), agreed. Open, pick, and the player is back on the menu; the status line and the entry's "1 active" confirm it, and reopening the popup shows the pick listed as active. Esc still closes it without a pick. The register's own written recommendation was A (stay open); the question was put to him with B recommended, on the grounds that the pick is confirmed in two other places and the open popup cost a key on every Build Phase | [`engine.md`](../system-design/grid-engine.md) 9.7 (canon 2.21); `../src/build/state.ts` (`pickNexus`) |
| Q56 | 2026-09-27 | **A solid bar, on all four sides.** Owner, after playing gate 5F: "The grid borders need to also use the 'thick' version horizontally... it should use something that is more clear... The rectangle needs to be a rectangle." A side that has reached the map's edge is drawn as an inverse-video cell — the same weight horizontally and vertically, in every glyph pack and in monochrome — and a corner is solid where a solid side runs into it. Replaces the `=` / bold `|` pair gate 5E built | [`engine.md`](../system-design/grid-engine.md) 3.3 (canon 2.21); `../src/view/build-frame.ts` (`drawChrome`) |
| Q57 | 2026-09-27 | **A — always back to the menu**, reversing the recommendation gate 5F built. Owner: "I like keeping that as the main orchestrator, so when a building is placed, the focus should always come back to the menu." A placement also disarms: a building is armed only while the map has focus. Esc returns focus to the menu (and on the menu asks "Exit the game?"); Backspace stays "remove". The digit path is now "digit, arrows, Enter" per building **Refined 2026-09-29 (F30): finishing returns to where it began** — the map in plain navigation when the arming began there, the menu when it began on the menu | [`engine.md`](../system-design/grid-engine.md) 9.7 (canon 2.21, 2.26); `../src/build/state.ts` (`place`) |
| Q58 | 2026-09-28 | **Yes — an armed click scrolls like any other, and a quick double click places where its first click pointed**, reversing option B, which gate 5H built. Owner, after playing the demo page (feedback F22): "then I can keep clicking on the grid with the ghost building placement cursor to keep scrolling, and double click will place the building." A double click is two left clicks on the same screen cell within 400 ms (an Experiment); the input path sends the second as a click on the first one's tile, so the reducer's compare-by-tile rule (Q52) still holds and a slow second click on a moved view still never places on a tile nobody pointed at. The still view stays one Experiment away ("Armed click scrolls") | [`engine.md`](../system-design/grid-engine.md) 3.3 and 9.7 (canon 2.25); `../src/build/session.ts` (`lastArmedClick`) |
| Q55 | 2026-09-29 | **Both halves built; the smart cursor replaced.** Interpolation: the view slides and the cursor glides (gates 5H and 5J). Placement: the owner (feedback F30) — "selecting a building should always try the 'recommended nearest empty space' for the building, but that should be based on the previous cursor location (or on top of the nexus by default), not on the last placed building." Arming now keeps the building where the cursor is when it fits, else the cheapest spot within 12 tiles (sideways cheaper than up or down) leaving a free tile around it, else one step right and down drawn as the building rather than refused; the cursor opens on the Grid Nexus. The "Smart cursor" Experiment is deleted | [`engine.md`](../system-design/grid-engine.md) 9.7 (canon 2.26) |
| Q65 | 2026-09-29 | **Yes — removing a planned building throws the same sparks a placement does.** Owner (feedback F33): "Canceling a placed building should also have spark effect, it's easy to do :)". The building still leaves the plan at once; the sparks are presentation over the ground it stood on | [`ascii-effects.md`](../system-design/effects.md) Section 5 (`fx.sparks.burst`) (canon 2.26) |
| Q61 | 2026-09-29 | **A — the menu, with the highlight on Explore Map.** Owner (feedback F31): "When the build mode is launched, the focus should be on the Menu, at the Explore Map option. No need to have a experiment setting for this. This allows the user to press 'Enter' or 'e' to move the cursor into the map, but also allows them to press 'down' to see more options." The "Opens on" Experiment is deleted | [`engine.md`](../system-design/grid-engine.md) 9.7 (canon 2.26) |
| Q1 | 2026-08-20 | **Tile width is adaptive presentation capability**: one column per tile in the 80x24 composition, two columns per tile at 128 columns or wider. Same tiles, same actors, same revealed information — only the composition changes. The 80x24 floor is preserved and the concept art's look is reachable on a wide terminal **Revisited 2026-10-06, see Q24**: once a row counts two columns, two columns a tile would draw every reach twice as wide as it is tall, so a tile is one column wide at every size | [`engine.md`](../system-design/grid-engine.md) Section 9.3 |
| Q2 | 2026-08-20 | **One resource.** Salvage recovers the same resource rather than a second one. Nexus energy is a state readout, not a currency. A second resource is an addition a later microgame may earn; it is not assumed | [`engine.md`](../system-design/grid-engine.md) Section 6 |
| Q3 | 2026-08-20 | **Units may span multiple tiles.** Large units are a normal, strategically important case, not a later extension — a Ravel raider drawn `>x<` is one unit occupying three tiles. The collision system tests a mover's whole footprint against its mask; damage and destruction apply to the entity, not the tile | [`engine.md`](../system-design/grid-engine.md) Section 3.5 |
| Q4 | 2026-08-21 | **The corruption law.** Corruption is drawn in the `effects` band and above, never in `units` or `structures`; it may add, overdraw, and unsettle, but never remove or replace the only cell carrying a required semantic cue. Recorded as decided because the rule was already RULE in the engine, restated in the lore, and listed among the locked product decisions — the register was the only document still calling it open | [`engine.md`](../system-design/grid-engine.md) Section 9.4 |
| Q6 | 2026-08-20 | **Packaging and remote delivery leave Milestone 1.** First split into an independent gate, then deferred out of the milestone entirely when it was refocused onto the Pulse — they answer no question the game currently has | [`docs/history/milestones/milestone-01-grid-battles.md`](milestones/milestone-01-grid-battles.md) |
| Q10 | 2026-08-21 | **DROPPED as mis-scoped.** Engine determinism was never in question: the kernel, its event log, and replay stay exact, and the features that depend on them are untouched. Whether a mission's *interface* misreports a total for narrative effect is campaign writing, decided when campaigns are designed | [`campaigns.md`](../game-design/campaigns.md), at Milestone 5 |
| Q11 | 2026-08-21 | **Alder refuse artificial Nexus power — conceptual.** Simplicity and growth instead: little or no Nexus draft, and more complexity in the structures they can build. Direction, not a locked mechanic | [`terminal-nexus-lore.md`](../game-design/lore.md) Section 8.5 and [`commander-armies.md`](../game-design/commander-armies.md) Section 4 |
| Q17 | 2026-08-21 | **Resolved by an unrelated fix, not decided among its options.** Four-way movement and Manhattan distance (Q15's fix, shipped for legibility) removed the degenerate tie itself: under Chebyshev a rank-deployed army had every enemy at the same distance; under Manhattan the same layout does not, because the axis the old metric ignored (`min(|dx|,|dy|)`) is exactly the one Manhattan keeps. Verified, not assumed: `citizen-mirror-skirmish.ts` (rank-deployed) now pairs each attacker with a distinct nearest opponent from tick 1, no stampede | [`grid/coords.ts`](../../src/grid/coords.ts) `gridDistance`; `docs/milestones/open-questions.md` Q15 |
| Q25 | 2026-08-26 | **A confirmed (256-colour tier stays derived from `rgb`; 16-colour stays hand-authored) and C shipped**: `CellStyle.fade`, a `fgRole`-only 0–1 scalar resolved only at `color256`/`truecolor`, narrowly scoped to `fx.damage.flash` per a recorded departure from craft rule 7. B and D not done, per the recommendation | [`engine.md`](../system-design/grid-engine.md) Section 9.1; [`ascii-effects.md`](../system-design/effects.md) craft rule 7; `src/view/roles.ts`, `src/view/frame.ts`, `src/view/effects/composite.ts`, `src/view/effects/recipes.ts` |
| Q29 | 2026-08-26 | **Recall is the existing end-of-Pulse regroup rule, named, not a new mechanic.** Confirmed directly by Mario's own description of the Pulse phase: "instantly recall all units back to their proper location next to their home buildings" — exactly `engine.md` Section 5's existing rule, Option A | [`docs/history/milestones/milestone-06-pulse-phase.md`](milestones/milestone-06-pulse-phase.md) |
| Q42 | 2026-09-09 | **No player-facing taxonomy; a bounded union in code.** A power is a name and one plain line saying what it does (*"Factory Permit — Unlocks building: Factory"*). The effect kinds — `unlockStructure`, `spawnUnits`, `modifyContent`, `modifyRule`, `modifyCommander`, `reveal` — are engineering names the player never sees | [`commander-armies.md`](../game-design/commander-armies.md) Section 4.5; [`engine.md`](../system-design/grid-engine.md) Section 5.4 |
| Q43 | 2026-09-10 | **No upfront Commander choice.** A new player starts Vasse's mission 1 directly; completing it unlocks Averno and Dob Hunter as two new campaign-menu rows, each their own opening on the same maps. Save slots are per Commander (`campaigns.md` Section 4.3) | [`campaigns.md`](../game-design/campaigns.md) Section 4.3; [`docs/history/milestones/milestone-03-game-menu.md`](milestones/milestone-03-game-menu.md) |
| Q44 | 2026-09-09 | **Missions have goals, not fixed lengths.** A main goal (usually "destroy the enemy Grid Nexus"; also survive/capture/accumulate shapes) plus an optional bonus goal that unlocks Challenge content. A Pulse counter shows only when the goal is about Pulses. Canon 2.12's fixed 3/4/5-Pulse contract survives as a pacing estimate only | [`campaigns.md`](../game-design/campaigns.md) Section 4.3 |
| Q47 | 2026-09-10 | **One map file, roles swapped — no second map authored.** The Ravel opening's mission 1 reuses PERIMETER's literal Grid: the raid's staging area becomes Dob's starting camp, the Citizen base becomes the scripted defender, and his objective is `destroyNexus` targeting the fabricator. Only `playerArmy`, `opponentArmies`, `objective`, and the trigger list's perspective change | [`campaigns.md`](../game-design/campaigns.md) Section 4.3 |
| Q48 | 2026-09-10 | **Bonus goals are shown in the briefing, not revealed as a surprise.** A player decides whether to play toward one from the start, the same way the main goal is already stated (Q44) | [`campaigns.md`](../game-design/campaigns.md) Section 4.3 |
| Q41 | 2026-09-12 | **Unlocks only, confirmed — and Challenge's own progression is the primary source.** Playing Challenge unlocks more of the faction's pool directly; the Campaign's bonus goals add a few more, only if Challenge has not already unlocked them. No permanent stat buffs, ever | [`game-modes.md`](../game-design/game-modes.md) Section 3.2 |
| Q45 | 2026-09-12 | **No skip, in general.** A dealt Nexus power is close to strictly advantageous, unlike a typical deckbuilder's rares, so there is no dilution to protect against and no reason to decline one. Alder alone may convert a power into "honor," their own faction mechanic — and even that may be locked out at tutorial difficulty **Reversed for now 2026-10-05** (feedback F127): Mario, "Nexus Powers should be optional for now, it's easier for testing if I can just start a round"; a round starts with the pick unmade, and the Nexus draft step decides with him whether it stays optional once the powers are real | [`commander-armies.md`](../game-design/commander-armies.md) Section 4.5 |
| Q46 | 2026-09-12 | **Challenge keeps its own progression, uncorrelated with the Campaign.** A run starts from a basic Commander package unlocked from the beginning; playing Challenge itself unlocks more. The Campaign's bonus goals add a few more, only for things not already unlocked. Playing Challenge without ever touching the Campaign is always allowed — a dismissible "we recommend the Campaign first" message is the only nudge | [`game-modes.md`](../game-design/game-modes.md) Section 3.2 |
| Q37 | 2026-09-01 | **Yes — a spike, and wider than the row's Option A.** Mario: "Scrolling in the map and placing selected bases is the part that needs more attention and will need a spike to verify assumptions." Not only static mockups: an interactive spike of cursor scrolling and placement, driven through keyboard, mouse, and the driver alike, that also verifies which target terminals deliver Shift+Arrow | [`docs/history/milestones/milestone-05-build-phase.md`](milestones/milestone-05-build-phase.md); [`engine.md`](../system-design/grid-engine.md) Section 9.7 |
| Q32 | 2026-09-12 | **A tick-gated trigger list (Option A).** PERIMETER's raid is a second, one-sided placement block with tick-gated triggers (`{ atTick, action }`), authored and validated the same way a `.map.json` file already is — not a policy module. Generalised at canon 2.10 into the trigger model every mission now uses | [`docs/history/milestones/milestone-02-campaign-design.md`](milestones/milestone-02-campaign-design.md) Section 4.4; [`campaigns.md`](../game-design/campaigns.md) Section 2.1 |
| Q33 | 2026-09-12 | **Author around Q15's dead end (Option A).** PERIMETER's approach lane is off-axis from the Nexus by design, not a kernel routing fix. Q15 stays open and unowned until a mission's own design genuinely cannot be authored around it | [`docs/history/milestones/milestone-02-campaign-design.md`](milestones/milestone-02-campaign-design.md) Section 4.3 |
| Q8 | 2026-10-01 | **Answered in practice.** Option A: the Grid has an `air` layer from the start, and a test proves an air entity shares a tile with a ground unit in both directions. The Ravel roster has since authored two real air units (the buzzard and the corsair; `scenarios/air-crossing.map.json`) | [`grid.md`](../system-design/grid.md) (layers); `../../tests/grid.test.ts`, `../../src/content/ravel.ts` |
| Q9 | 2026-10-01 | **Answered in practice.** Option A: facing is presentation-only, derived from the last step or from the current target when stationary, and nothing in the rules reads it. It stays in state so a renderer need not guess a direction; whether it should ever affect a rule (firing arcs, rear damage) is a design change for whichever faction wants it | [`grid.md`](../system-design/grid.md) (placement, footprint, anchor and facing); `../../src/pulse/perception.ts` |
| Q12 | 2026-10-01 | **Answered in practice.** Option A: an 8-row frame budget, so 80 × 24 stays a literal floor. `grid watch` splits it 3 header and 3 footer; the Build Phase draws 6 rows of chrome and measures the floor against 8, giving the two spare rows to the Grid | [`grid.md`](../system-design/grid.md) (viewport and screen size); `../../src/view/compose.ts`, `../../tests/build-camera.test.ts` |
| Q16 | 2026-10-01 | **Answered in practice.** Option A: a Grid smaller than the minimum viewport is centred in the full 48 × 16 pane, so the frame is the same size whatever scenario is loaded. Option C (shrinking the frame) is refused: the 80 × 24 floor is a RULE | [`presentation.md`](../system-design/presentation.md) (composition); `../../src/view/compose.ts` |
| Q18 | 2026-10-01 | **Answered in practice.** Option A, now a RULE: faction identity lives in the glyph family and the effect language, and ownership keeps the colour, so a mirror match stays legible and monochrome stays whole. The `ravel-mirror-skirmish` fixture sits beside the Citizen one. A faction-shaded colour (option B) or player-chosen skins (option C, the owner's long-term wish) would each be a design change in a pull request of its own | [`presentation.md`](../system-design/presentation.md); `../../src/view/theme.ts` (`playerRole`) |
| Q21 | 2026-10-01 | **Answered in practice.** Option B, built 2026-08-24: the light theme's `player.a`/`player.b` were retuned by lightness only (hue and saturation held), lifting their contrast with each other from 1.08:1 to 3.23:1; the dark theme's pair was left alone. The two roles could not move symmetrically: a light background rewards darkening a role far more than lightening one, so `player.b` moved much further than `player.a`. A test holds the 3:1 floor and was written to fail if the retune regressed | `../../src/view/roles.ts`, `../../tests/roles.test.ts`; [`2026-08-26-quality-and-effects.md`](reports/2026-08-26-quality-and-effects.md) |
| Q36 | 2026-10-01 | **Answered in practice: no kernel change.** A defensive mission's goal is read one level above the kernel by the trigger runner (`{ event: "pulse.end", pulse: 3 }` then `win`, with a `lose` on the player's Nexus falling listed before it), and the kernel's plain tick-limit draw stays a neutral draw. The result screen keeps the fight's own words and adds the mission's verdict, so the draw does not read as success on its own and does not need a new victory branch. What the build found instead is Q70: annihilation, not time-out, is what bends a defence mission | [`pulse.md`](../system-design/pulse.md) (a mission's goal never reaches the kernel); `../../src/mission/perimeter.ts`; [`2026-09-30-round-loop-and-missions.md`](reports/2026-09-30-round-loop-and-missions.md) |
| Q39 | 2026-10-01 | **Answered in practice.** Declarative triggers: a mission is typed object literals of conditions and actions, never a function, and the vocabulary grows in code one typed kind at a time with a named scenario. The narrow-hook door for a shape too odd for the vocabulary is documented, not built, and a hook two missions need becomes a vocabulary entry | [`campaigns.md`](../game-design/campaigns.md); `../../src/mission/types.ts` |
| Q49 | 2026-10-01 | **Answered in practice.** Both halves of option A were built, as the **Incoming wave** Experiment (shown by default): the Build Phase draws the next round's arrivals on the map, see-through, and the Explore Map card states each one's intention. The principle stands: anything a player needs to judge a Build Phase decision should be on screen during the Build Phase, so a Nexus power whose value cannot be known until after the Pulse should not be dealt | `../../src/build/all-settings.ts` (`incoming`); [`2026-09-30-round-loop-and-missions.md`](reports/2026-09-30-round-loop-and-missions.md) |
| Q54 | 2026-10-01 | **Answered in practice, and superseded.** The owner's four speed tiers were built, then replaced at his word ("the progressive acceleration is working really well") by counting taps: a tap moves 1 and a run of taps doubles its speed every third tap if the last was quick, up to 4; a held arrow runs at the game's own cadence, 1 tile a move and then 2; Shift is a jump, not a speed. The slow step, the held-key ramp (`rampMs`, `holdStep`, `fastStep`) and the percentage margin as a flag were retired. Every number is a tuned value or an Experiment under `d` | [`input.md`](../system-design/input.md) (taps, holds and releases); `../../src/build/all-settings.ts`, `../../src/build/motion.ts` |
| Q62 | 2026-10-01 | **Answered in practice.** Proportional edge zones: a click inside a zone a quarter of the view deep carries the tile toward the middle in proportion to its depth, and a click in the middle leaves the view alone. "Centres every click" and "margin only" are gone, and so is the Experiment that compared them. The zone depth is the tuned value `clickZone`; an armed click scrolls the same way | [`input.md`](../system-design/input.md) (bindings); `../../src/build/tuning.ts`, `../../src/build/all-settings.ts` |
| Q64 | 2026-10-01 | **Answered in practice.** Option A: a placed building's light pulls its characters toward the theme's strongest ink, so on the light theme it is the darkest ink and the building darkens as it finishes, like ink setting. A warm glow role of its own (option B) stays one role and a colour per theme away if Mario, having played the light theme, wants it | [`effects.md`](../system-design/effects.md) (`fx.light.flash`); `../../src/view/effects/shading.ts` |

### Q50 — answered

Registered 2026-09-21 by gate 5A, which built both click behaviours behind a toggle because
[`engine.md`](../system-design/grid-engine.md) Section 9.7 called the choice "a feel decision the spike makes observable as
a toggle rather than argues about". **Decided: a click places it** — Mario, having tried both.

Worth recording for whoever revisits it, because the toggle turned up something an argument would
not have. The two behaviours are not symmetric. A click moves the cursor, and moving the cursor
scrolls the map, so a first click within three tiles of the edge of the screen slides the whole Grid
under the pointer — and the second click at the same spot on screen then lands on a *different tile*
and places there without complaint. Pressing Enter instead is unaffected, and the screen offers it,
but "click the same place twice" is the gesture that mode is named for. Placing on the first click
has no second click and cannot hit this at all.

**What keeps the decision safe is that a plan is revisable**: `u` undoes the last placement and
Backspace removes the one under the cursor, both built in gate 5A. If some future Build Phase action
is genuinely irreversible, confirmation belongs on that one action rather than on every click — and
this row is where to start reading before adding it.

`engine.md` 9.7's own "observable as a toggle" sentence is now stale, and its wording change is in
gate 5A's report (Section 9) so that it lands with that gate's other canon changes in one version
bump rather than two.

**Revisited 2026-09-26 — see Q52.** The account above is left exactly as it was written; it is still
the honest record of what Mario decided on 2026-09-21 and why. It stopped being current five days
later, on his own further playtest.

### Q52 — answered

Registered and answered the same day, 2026-09-26, reversing Q50 directly. Mario, after playing the
merged Build Phase in a real terminal: "Click to place building: the building is placed right away,
but there should be a confirmation. Perhaps later we can create a 'shift click' to auto-confirm, but
the default should require a second click." **Decided: a second click on the same tile places it; the
first only moves the cursor there and shows the armed preview.** A later `Shift+click` as a one-click
escape hatch is noted as a real idea and explicitly not built yet.

This reopens exactly the asymmetry Q50's own writeup found and rejected — a first click within the
scroll margin can slide the Grid under the pointer, so a second click at the same *screen position*
lands on a different *tile*. What makes it safe to re-adopt anyway: the reducer's placement check
(`src/build/state.ts`'s `applyBuildCommand`, `click-tile` case) already compares tile identity, not
screen position — `withCursor`'s own `moved` result is true whenever the resolved tile differs from
the cursor's current one, camera shift included. A second click after the camera moved is therefore
correctly read as a *first* click on a new tile (arm/preview only), never a mis-click that places on
the wrong one; it just means the player's "second click" needs one more click to actually confirm,
which is a milder cost than Q50's original bug (a silent wrong placement) rather than the same one
recurring.

`engine.md` 9.7 carries the reversal; `docs/history/milestones/milestone-05-build-phase.md` gate 5E is where it
gets built.

### Q46 — answered

Mario, 2026-09-12: "Generally speaking, we should keep Campaign and Challenges uncorrelated. Some
players may not like the campaign mode, and that should not stop them from unlocking all the
content. But we can have a small trick here. The Challenge mode has a progression similar to Slay
the Spire; it starts with the basic commander decks, and as you play you unlock more and more
content... The Campaign can also unlock content on the Challenge mode, but only a few things and
only if they are not already unlocked. If a player wants to play the Challenge mode without playing
the campaign, we will show a message that says 'We recommend you play the Campaign first' but still
allow them to proceed if they insist."

None of Q46's original three options was quite right, because all three assumed Challenge draws its
starting roster from Campaign progress. The actual answer inverts that: **Challenge is
self-sufficient.** It ships with basic Commander packages available from the start, and playing
Challenge itself is what unlocks the rest of the faction pools — directly, the same way Slay the
Spire's own meta-progression works, with no dependency on the Campaign at all. The Campaign is a
**secondary, additive** source of the same unlocks: a bonus goal may grant one, but only if Challenge
hasn't already granted it first — the two tracks write to one shared unlock set, never overwrite or
duplicate each other, and neither gates the other. The one place they touch the player directly is a
soft, dismissible nudge the first time Challenge opens before the Campaign has been touched.

### Q45 — answered

Mario, 2026-09-12: "Most upgrades on this game are strictly better. This is not exactly like in Slay
the Spire, where adding cards to the deck automatically dilute the good cards. Here, they are nexus
powers, almost always advantageous. The only faction that can skip powers is Alder, that grants them
'honor' that they can cash into other things, it's their specific mechanic. If we do Alder campaigns
later, we can just 'lock' options at the 'tutorial' level... So in general no, there's no way to skip
the Nexus Powers."

This closes the row outright rather than choosing among its three options: the premise behind
"skippable in Challenge" (Option A) and "skippable with banking" (Option C) was that declining a
power protects a build from dilution, the way skipping a card does in a deckbuilder. That premise is
false here — a Nexus power is close to strictly good, so there is nothing to protect against by
declining one. Option B, always mandatory, is the answer, with exactly one named exception: **Alder**,
whose faction mechanic converts a would-be power into "honor" spent elsewhere. Even that exception is
optional to expose — a tutorial-level Alder campaign may lock the conversion out entirely, the same
way many strategy games gate an advanced mechanic behind a difficulty or content tier.

### Q41 — answered

Folded into Q46's answer, 2026-09-12: unlocks are the only thing that persists between runs, and the
mechanism is now concrete rather than assumed — Challenge's own progression is the primary writer to
that unlock set, with the Campaign's bonus goals as a secondary, non-duplicating source. Nothing about
the row's own reasoning (never a power ladder; a difficulty ladder once someone has won a run) changed.

### Q42 — answered

Mario, canon 2.13: "Nexus powers don't have to be classified as 'permit' or 'revision'. There's no
need to classify them so strictly, and this will add too many new terms (note they would need to be
different per faction to match their styles). The power name can have the naming: 'Factory Permit',
but the description should just say what it does: 'Unlocks building: Factory'. We will keep track of
all power types in code, using names that make sense for the code, not for the faction."

The half of the canon 2.12 proposal that survives is the half that was load-bearing: **a small
bounded union of effect kinds**, which is what lets a card, a panel, and a schema be sized before
Milestones 5, 8, and 11 render them. The half dropped is the player-facing taxonomy — six capitalised
instrument names, renamed per faction, would have been five vocabularies for a player to learn in
exchange for nothing they could act on.

So: to a player, a power is a **name and one plain line**. In code the kinds are `unlockStructure`,
`spawnUnits`, `modifyContent`, `modifyRule`, `modifyCommander`, and `reveal`
([`commander-armies.md`](../game-design/commander-armies.md) Section 4.5). One design point is kept from the
original proposal: `reveal` exists so that information is a card a player spends a pick on rather
than something the HUD gives away.

### Q44 — answered

Mario, canon 2.13: "About number of pulses, we don't need to make it strict. Instead, we will have a
few different goals for each mission."

**Neither of the row's options was chosen, because the question was mis-framed.** It asked whether a
mission's *fixed length* is shown to the player; the answer is that a mission does not have a fixed
length. It has a **goal**, and the length falls out of it. Most goals are "destroy the enemy Grid
Nexus"; others are "survive N Pulses," "capture and hold X by Pulse N," "accumulate X of Y," "keep Z
alive." A Pulse counter appears in the header when the goal is about Pulses and not otherwise — which
resolves the original tension without a rule, since the mission that wants the dread of a countdown
gets one and the rest do not.

Missions also gain **bonus goals**: harder, optional, achievement-shaped, and the thing that unlocks
content for Challenge mode ([`campaigns.md`](../game-design/campaigns.md) Section 4.3). That is now the coupling
between the two modes.

**This narrows Q36 rather than answering it.** Q36 asks whether a defensive mission needs a victory
shape the kernel lacks; a mission-goal system is exactly the general form its Option B guessed at, so
what remains of Q36 is the narrower kernel question — does the victory check accept a mission-supplied
objective, and at what cost to a RULE. Still Milestone 6's, still on evidence.

### Q48 — answered

Mario, 2026-09-10: "Campaign levels could have a main mission, and a bonus goal (basically an
achievement)... I want to see what you are able to imagine" — asked as part of a wider design pass,
not as a fork with named options. Resolved here as GUIDANCE rather than put to Mario as a question:
bonus goals are stated in the briefing alongside the main goal (Q44), never revealed only at debrief.
See [`campaigns.md`](../game-design/campaigns.md) Section 4.3.

### Q47 — answered

Resolved as GUIDANCE while writing up the two openings Q43 settled: does the Ravel opening need its
own map, or does it reuse PERIMETER's? One map, roles swapped — the raid's staging area becomes Dob
Hunter's camp, the Citizen base becomes the scripted defender. See
[`campaigns.md`](../game-design/campaigns.md) Section 4.3.

### Q43 — answered

Mario, 2026-09-10: "Perhaps we can just start with Vasse, so we have a more controlled start, and
after that first level is completed, the Averno and Dob Hunter campaigns become unlocked." No
Commander-choice screen at the top level — a new player starts Vasse's mission 1 directly, and
completing it unlocks the other two openings as campaign-menu rows. See
[`campaigns.md`](../game-design/campaigns.md) Section 4.3; withdraws the "selection screen for three" instruction an
earlier draft gave Milestone 3.

### Q37 — answered

Registered 2026-08-26 as "does Milestone 5 need a design spike," recommending a static ASCII mockup
pass (Option A) at the start of that milestone. Answered by Mario's design notes of 2026-09-01, which
became canon 2.10: the spike is wanted, and its subject is narrower and more demanding than a layout
mockup — **scrolling the map and placing selected structures**, "the part that needs more attention,"
with assumptions to *verify* rather than frames to look at. The same notes fix what the spike must
exercise: every menu item by hotkey and by click with identical effect, cursor movement by arrow and
by Shift+Arrow five tiles at a time, and all of it drivable by an agent for playtesting.

So the answer is Option A's *timing* (a short, explicit step opening Milestone 5, before the real
build) with a different *artifact*: an interactive spike, not a static one, scoped to scrolling and
placement, run through all three input adapters of [`engine.md`](../system-design/grid-engine.md) Section 9.7, and
recording which of the project's target terminals actually deliver modified arrow keys — the one
assumption in the keymap that a terminal can silently break. The static mockups at the viewport
range's extremes remain a cheap thing to produce along the way; they are no longer the deliverable.

### Q33 — answered

Registered 2026-08-26 as whether PERIMETER's map needs a real fix for Q15's on-axis routing dead end.
**Decided: author around it (Option A).** The approach lane is off-axis from the Nexus by
construction — free, and it ships Level 1 without depending on a kernel fix this milestone does not
own. Q15 itself stays open and unowned by any single milestone until a mission's own design genuinely
cannot be authored around it. [`docs/history/milestones/milestone-02-campaign-design.md`](milestones/milestone-02-campaign-design.md)
Section 4.3.

### Q32 — answered

Registered 2026-08-26 as how a scripted, non-adaptive mission opponent is authored as content.
**Decided: a tick-gated trigger list (Option A), not a policy module.** PERIMETER's raid is a second,
one-sided placement block with `{ atTick, action }` triggers, authored and validated the same way a
`.map.json` file already is. Generalised at canon 2.10 into the full trigger model every mission now
uses — a condition and a list of simulation/presentation-band actions
([`campaigns.md`](../game-design/campaigns.md) Section 2.1). [`docs/history/milestones/milestone-02-campaign-design.md`](milestones/milestone-02-campaign-design.md)
Section 4.4.

### Q29 — answered

Registered 2026-08-26 and answered the same day, by the owner's own next message rather than by a
separate decision. The question was whether "Recall" — a word Mario used alongside "the nexus pulse"
that appears nowhere in canon — named a new mid-Pulse withdrawal mechanic (the more common genre
meaning) or the existing, automatic end-of-Pulse regroup rule in
[`engine.md`](../system-design/grid-engine.md) Section 5: "At Pulse end survivors regroup near home producers. Orphans are
adopted by the nearest compatible producer or regroup near the Grid Nexus."

Mario's own description of what the Pulse-phase milestone should do settles it in his own words:
"Decide when the pulse is over, make stopping battle animation, start heading back, and **instantly
recall all units back to their proper location next to their home buildings**." That is the existing
rule exactly — automatic, at Pulse end, no player action, units returning to their home producers —
which is Option A, adopted without needing anything new built.

The consequence is small and entirely presentational: the rule already runs, so what
[`docs/history/milestones/milestone-06-pulse-phase.md`](milestones/milestone-06-pulse-phase.md) owes is one
clear beat on screen when it fires, not a kernel change. Option B (a player-triggered Nexus power that
withdraws units mid-Pulse) stays available for a later mission whose design actually needs it — it
would be real new kernel surface, decided on that mission's own evidence, not inherited from this row.

### Q25 — answered

Owner, 2026-08-24, after watching the sixth round's effects: "I think the color scheme needs to
define *transparency* that would adapt the color to the backend color. The code would process the
final true color, and then the final pass would turn that into monochrome or 16 colors by closest
approximation. If we are not doing this already, make sure this architecture is part of the grid tech
and the effects."

**Half of this is already the architecture.** A cell carries `fgRole`, never a colour
([`engine.md`](../system-design/grid-engine.md) Section 9.1, RULE), and roles are resolved to colour at the very last pass —
`frameToAnsi` → `sgrOf` → `sgrFor` (`src/view/frame.ts`, `src/view/roles.ts`). Nothing composes in
colour and nothing stores one. So "process the colour, then a final pass turns it into the tier" is
the shape that already runs. What is *not* derived is the table: `PALETTE[theme][role]` hand-authors
three independent values per role — `ansi`, `indexed`, `rgb` — and `sgrFor` picks one. The question is
whether `rgb` should become the single source and the other two a computation.

**Measured, not assumed** (nearest-match by squared RGB distance, against the xterm renderings the
project's own capture tooling already uses, dark theme):

| Tier | Roles whose derived value differs from the hand-authored one |
| --- | ---: |
| 256-colour | 10 of 18 differ, but 11 of 18 land within 12 RGB units — mostly the same colour |
| **16-colour** | **9 of 18 differ, and three of the differences are damaging** |

The 16-colour failures are specific and they are not tuning noise:

- **`chrome.muted` derives to ANSI 90** — the exact "bright black" value an owner playtest already
  had removed, because it compounds with the `dim` attribute every `chrome.muted` cell also carries.
  `src/view/roles.ts`'s own comment records that fix. A naive derivation reinstates a fixed bug.
- **`player.a` and `player.b` both derive to ANSI 90** — the two sides collapse to the *same grey*.
  That is the Q21 contrast complaint made maximally worse, at the one tier with the least room.

A perceptual metric does not rescue it: OKLab, with and without chroma weighting, reproduces the
hand-authored choice on 0–1 of the 9 disputed roles and still sends `player.a` to grey. The cause is
structural rather than a bad formula — **the 16-colour palette contains no desaturated entries**, only
eight hues, eight brights, and greys. Any nearest-match of a deliberately muted design colour lands on
grey, because grey genuinely *is* the nearest colour. The hand-authored 16-colour row is not
approximating the RGB badly; it is answering a different question — *which of eight hues keeps these
things apart* — which is exactly what the file's own comment claims it is for.

The transparency half is a separate decision with a separate gate. `CellStyle`'s shape is printed
inside a **RULE** block in [`engine.md`](../system-design/grid-engine.md) Section 9.1; adding a field to it needs owner
acceptance and a canon bump ([`AGENTS.md`](../../AGENTS.md) Section 3). It also brushes craft rule 7 in
[`ascii-effects.md`](../system-design/effects.md) Section 3 — "Terminals have no alpha. Decay is not fade-out" —
which is GUIDANCE, and would need an explicit, recorded departure rather than a quiet one. What it
buys is real and already wanted: the compositor's lighting stack
(`src/view/effects/composite.ts`, built for the owner's "the white color can stack... then dim
slowly") currently has only the four steps `dim`/plain/`bold`/`inverse` to express intensity, because
there is no continuum to express it on.

| Option | Cost |
| --- | --- |
| A. **Derive 256 only; keep 16 hand-authored; monochrome unchanged.** One truecolor source of truth, one computed tier, one tier that stays a deliberate distinguishability table with a comment saying why | Small and measured. Keeps every fix the 16-colour row already encodes, removes the hand-authoring burden where it buys nothing (11 of 18 already agree within 12 RGB units), and leaves the pipeline honest: the owner's "final pass" exists, it is just a lookup on one leg. Does not by itself deliver transparency |
| B. **Derive every tier, with a per-role override table for where derivation is wrong** | Superficially the owner's ask in full. In practice the 16-colour leg needs overrides on roughly half its roles, at which point it is a hand-authored table wearing a computation's clothes — more machinery, same values, and a new way to silently regress when someone adds a role and forgets the override |
| C. **A + transparency: add one scalar to `CellStyle`** (`fade` / `alpha`, 0–1), applied *by the resolver* — blend the role's RGB toward the theme's `BACKGROUND_RGB`, then quantize. The cell still carries a role and a number, so 9.1's "never a colour" stays literally true | Delivers what the owner actually described, and upgrades the flash-stacking continuum already asked for. Costs a canon amendment to a RULE-marked type, a recorded departure from craft rule 7, and an honest limit: direct ANSI does not paint a background, so this blends toward an *assumed* theme background, not the terminal's real one (OSC 11 probing was already rejected as unreliable, `roles.ts`) |
| D. **True alpha over whatever is beneath in the band stack**, rather than over the background | The version that sounds most like "transparency" and costs the most: `composeBands` is deliberately colour- and capability-agnostic, so this moves colour resolution earlier, into composition, and gives up the property that one composed frame serves every tier — which a test currently asserts by comparing tiers. Not worth it for the effect being chased |

**Recommendation: C, in two steps, and only after looking at it.** Do A first and put it in front of
the owner as a side-by-side at both tiers — it is cheap, it is measurable, and if the derived
256-colour tier reads worse than the hand-authored one on a real fight frame, that is worth knowing
before anything larger is built on it. Then bring C's one-scalar amendment to the owner as an explicit
canon change with a screenshot of what it buys, rather than shipping a new `CellStyle` field and
asking afterwards. **Do not do B or D**: B is measured above as machinery that reproduces a hand table,
and D pays for an architecture change with a property the test suite currently relies on.

Q21 (palette contrast) overlaps this directly and should be answered in the same pass — its
recommendation is a lightness retune of `player.a`/`player.b`, and the truecolor values are the thing
a derived pipeline would make the single source of truth.

**Option A built, evidenced, and observable, 2026-08-24** (`src/view/roles.ts`). `PALETTE` no longer
hand-authors an `indexed` field at all — `Swatch` carries only `ansi` (hand-authored 16-tier) and `rgb`
(the single truecolor source); `sgrFor`'s `color256` case reads a `DERIVED_256` lookup computed once at
module load by nearest-match (squared RGB distance, the xterm 6x6x6 cube plus its 24-step greyscale
ramp) against each role's own `rgb`. The 16-colour tier is untouched and stays hand-authored, exactly as
recommended, with the "why" now written directly into `roles.ts`'s own PALETTE comment rather than only
in this row — re-running `scripts/measure-palette-derivation.mjs` today correctly shows "0/18 would
change" for 256 (there is no longer a separate hand column to disagree with) and unchanged 9/18 (dark) /
6/18 (light) for 16, confirming the 16-tier finding that justified *not* deriving it is still live; the
script's own header now says so. Monochrome unchanged (still emits nothing, still asserted by a test).

Made observable per the gate instructions, not just built: `docs/screenshots/
palette-derivation-256-hand-authored.png` and `-derived.png` are the identical real fight frame
(`citizens-versus-ravels`, tick 178) at the 256-colour tier, once per formula, sent directly to the
owner — the two read as close to indistinguishable at a glance, which is the expected result the
measurement predicted (11/18 roles already landed within 12 RGB units) rather than a surprise.
`docs/screenshots/palette-reference.png` (regenerated from the live table) is the full role-by-role
reference. **Still OPEN**: A is applied, not yet accepted — if the owner judges derived reads worse on
a frame he looks at himself, that is exactly the finding this staged approach exists to surface before
anything else is built on it.

**The transparency half (C) — prototyped, explicitly NOT built.** `CellStyle` in `src/view/frame.ts` is
unchanged; adding a `fade` field is a RULE amendment (engine.md 9.1) and a recorded departure from craft
rule 7 (`ascii-effects.md` Section 3), both of which need Mario and a canon bump, not a session's
judgement — so nothing here ships one. What exists instead: `scripts/prototype-fade-resolver.mjs`, a
throwaway script that drives the *real* `fx.damage.flash` recipe and the *real* `mergeEffectCells`
for "today," and a small local (script-only) resolver — one scalar `fade` (0–1) blended toward
`BACKGROUND_RGB[theme]`, exactly C's recommended shape — for "prototype," rendered side by side as
`docs/screenshots/prototype-fade-resolver.png` and sent directly to the owner. It shows two things
concretely rather than arguing for them: (1) stacking — today's real compositor reaches only 2
distinguishable states for a stack of simultaneous flashes (bold, then inverse, saturating
immediately), where a continuous fade keeps six sampled stack sizes visibly distinct; (2) decay — a
solo flash's own presentation window is a flat on/off pulse today (nothing in the vocabulary varies
*within* one flash's short life), where a fade scalar can express "then dim slowly" as an actual
gradient. Bring this to the owner as an explicit canon-amendment proposal with the screenshot, per the
recommendation — not decided here.

**A verified bug found and fixed while building the "today" half honestly** (presentation-only,
`src/view/effects/recipes.ts`): `fx.damage.flash` set both `bold` and `inverse` unconditionally, which
`composite.ts`'s own `lightWeight` (1 base + 1 bold + 1 inverse = 3) already meets from a *single*
flash — `resolveLighting`'s `inverse` threshold is `>= 3`, so the round-six stacking mechanism the
owner asked for had no visible effect at all for the one recipe it was built for: one hit and ten
simultaneous hits on the same tile rendered pixel-identical. The compositor's own doc comment already
described the intended shape ("`fx.damage.flash` alone is weight 2 (plain-bold)") — the recipe just
never matched it, undetected because the existing `mergeEffectCells` stacking test exercises the
compositor's arithmetic with a hand-built cell, never this recipe's actual output. Fixed to `bold`
only; a new test now exercises the real recipe through the real compositor together, closing that gap.
Unrelated to the fade prototype's own conclusion, but found *while* building it, and worth recording
here rather than only in the gate report since it changes what "today" actually shows.

**Decided, 2026-08-26.** Mario confirmed both forks in the same round of feedback that formally
accepted Milestone 1 ([`project-governance.md`](README.md) Section 5): "Keep it derived
(recommended)" for A, and "Yes, build it for real" for C — decided from the standing evidence already
in front of him (the hand-authored/derived 256-colour screenshots and the transparency prototype's own
screenshot, both sent in round seven), not from a fresh artifact shown in this pass.

A stands exactly as built above: the 256-colour tier derives from `rgb`, the 16-colour tier stays
hand-authored, and nothing about that changes.

C shipped for real. `CellStyle.fade` ([`engine.md`](../system-design/grid-engine.md) Section 9.1, now RULE) is a
`fgRole`-only scalar, `0` (the role's own colour) to `1` (the theme's background), resolved only at
`color256`/`truecolor` — `color16` and `monochrome` ignore it entirely, unchanged from before it
existed. `fx.damage.flash` (`src/view/effects/recipes.ts`) now decays across its own window instead of
a flat pulse (`fade: progressOf(instance, context)`, held off under reduced motion, provably
byte-identical there to the recipe's whole pre-amendment behaviour); `resolveLighting`
(`src/view/effects/composite.ts`) sums a continuous version of the same scalar across a stack
(brightness `1 − fade` summed and clamped, converted back to a fade) alongside the existing four-step
`dim`/plain/`bold`/`inverse` ladder, not replacing it. [`ascii-effects.md`](../system-design/effects.md) craft
rule 7 now records the departure by name, narrowly scoped to this one recipe — every other effect in
the vocabulary still decays by thinning, exactly as the rule describes. `scripts/
prototype-fade-resolver.mjs` is deleted; its evidence screenshot
(`docs/screenshots/prototype-fade-resolver.png`) is kept, since it is now part of the historical
record of how this question was decided, not a preview of shipped behaviour. `scripts/
capture-damage-flash-fade.mjs` supersedes it, driving the real, shipped recipe, compositor, and
`sgrFor` end to end — no resolver of its own — producing `docs/screenshots/damage-flash-fade.png`.
Canon bumped 2.7 → 2.8 for the RULE amendment and the recorded GUIDANCE departure, across every
document under `specs/` and `concept/` plus `AGENTS.md`.

### Q17 — answered

Closed as bookkeeping on 2026-08-21, by empirical re-check rather than by choosing among its own
options: nobody decided to break Chebyshev ties differently. Q15's four-way-movement fix (a
legibility change, unrelated to targeting) changed the distance metric from Chebyshev
(`max(|dx|,|dy|)`) to Manhattan (`|dx|+|dy|`), and that alone dissolves the specific problem this
question was about.

The mechanism: under Chebyshev, two armies facing each other across a wide horizontal gap with `dy`
small have `max(|dx|,|dy|) = |dx|` for every pair — `dy` is *discarded* by the metric whenever the
horizontal gap dominates, which is exactly "deployed in a rank" — so every enemy really was the same
distance away, and the tie-break decided everything. Manhattan never discards either axis: distance
is `|dx| + |dy|`, so two defenders at the same `dx` but different `dy` are no longer tied. Checked
directly rather than assumed: running `citizen-mirror-skirmish.ts` — a rank-deployed fixture, the
same shape Q17's finding was measured against — now produces `engage` events pairing each attacker
with a distinct, natural opposite number (`A:trooper#1 -> B:trooper#2`, `A:trooper#3 -> B:trooper#4`,
...) from the first tick, not a stampede onto one target.

None of Q17's three options were chosen. Option A ("keep nearest, ties by entity id") turned out to
already be the right answer once the metric changed — no rule was rewritten. `citizens-versus-ravels.ts`'s
column-staggered deployment is no longer load-bearing for this specific reason, but it is still kept:
it is also good asymmetric-army design, not only a stampede workaround, and re-arranging a working,
evidenced fixture on a "no longer strictly necessary" technicality is not worth the churn.

### Q11 — answered

Mario, 2026-08-21, at concept level: **Alder refuse artificial power from the Nexus.** They want
simplicity and growth instead. Mechanically that reads as *less* where the Nexus is involved and
*more* where their own biology is: little or no Nexus draft, and a wider, more varied catalogue of
structures they can grow.

This is lore direction rather than a locked mechanic. Whether the draft is absent entirely or a small
grown pool, and how far the structure catalogue widens to compensate, stays undefined until a
milestone authorizes Alder content. The three options the register offered are superseded — the
answer keeps A's honesty about refusal while moving the depth into structures rather than into a
second progression system.

### Q4 — answered

Closed as bookkeeping on 2026-08-21, during the canon-consistency audit, rather than by a fresh
decision. The recommendation the row carried had already been promoted everywhere it mattered:
[`engine.md`](../system-design/grid-engine.md) Section 9.4 carries it as **RULE**, `terminal-nexus-lore.md` Section 9
restates it, `project-governance.md` Section 7 lists it among the locked product decisions, and
`AGENTS.md` repeats it as an architectural invariant. The register was the last document still
describing it as waiting on Mario, and a register that contradicts the canon is worse than no
register — the whole value of this file is that it can be trusted about what is settled.

If the locked-decisions entry was not intended as acceptance, reopen this row; nothing else changes.

### Q10 — dropped

Mario, 2026-08-21: the question conflated two separate things. The deterministic kernel is one — and
replay and fast-forward depend on it, so nothing narrative may touch it. Campaign story writing is
the other, and campaigns are designed later.

Nothing in the belief ramp asks the kernel, the event log, or a replay to be anything but exact; the
device only concerned what a mission's *interface* displays. That is a writing decision belonging to
the mission that wants it, so it needs no canon fork. [`campaigns.md`](../game-design/campaigns.md) Section 4.1
keeps one line of guidance — the engine's record is never part of a narrative device — and the rest
waits for Milestone 5.

### Q3 — answered

Recorded in full in the Git history of this file at canon 2.2. Mario settled it directly: large units
exist and matter. [`engine.md`](../system-design/grid-engine.md) Section 3.5 carries the placement rule and Section 3.4.1
carries the collision consequence.

### Q1 — answered

Recorded in full in the Git history of this file at canon 2.1. The decision above is the durable
part; [`engine.md`](../system-design/grid-engine.md) Section 9.3 now carries the rule.

### Q2 — answered

Recorded in full in the Git history of this file at canon 2.1. [`engine.md`](../system-design/grid-engine.md) Section 6
now carries the rule.

### Q6 — answered

Recorded in full in the Git history of this file at canon 2.1. Superseded in scope at canon 2.2 when
Milestone 1 was refocused onto the Pulse and delivery left the milestone altogether.
[`docs/history/milestones/milestone-01-grid-battles.md`](milestones/milestone-01-grid-battles.md) carries the gate structure;
[`project-governance.md`](README.md) Section 5 carries delivery as its own gated
workstream.

### Q56 — answered

**Question:** Q56 — The heavy border's vertical glyph, and whether a corner reacts to it

**Status:** ANSWERED 2026-09-27 — a solid bar on all four sides, at the owner's direction (the Answered table above has the decision). The original entry follows.

`engine.md` 3.3 now says a border side that has actually reached the Grid's own edge reads as a
heavier, doubled run — `=` for a horizontal (top/bottom) run, the owner's own example. The ASCII pack
has no equally clean doubled *vertical* bar: a real doubled-bar character (`‖`/`║`) is not ASCII,
contradicting the pack's own "everything here is one cell wide, ASCII-safe is the baseline" premise
(`theme.ts`); `#` is already `terrain.rock`'s glyph and would read as rock on the very same screen;
`H` reads as a letter, not a line. Separately, the four corners are drawn as a single plain glyph
today regardless of the sides beside them (`drawChrome`'s own comment: a soft run "never looks broken
at the point itself"); once a side can read *heavy*, a `+` corner meeting a doubled `=` run is a real
weight mismatch exactly where the eye rests first on a rectangle.

| Option | Cost |
| --- | --- |
| A. **Leave verticals as plain `|` even when heavy**, accepting an asymmetry between axes | Simplest; but a Grid that fits the viewport (every side heavy at once) would read heavy on top/bottom and ordinary on the sides, undercutting the "one visual statement" the whole point of the whole-grid-heavy case is |
| B. **Reuse a different existing glyph for a heavy vertical** — e.g. two adjacent `|` is impossible in one cell, but a bold/inverse attribute on the ordinary `|` could carry the same "heavier" idea without a new character, at the cost of leaning on colour/attribute rather than shape (this project's own preference is shape that survives monochrome) | Keeps ASCII-only and one-cell-wide; whether attribute-only "heavy" reads as clearly as a doubled character is unverified |
| C. **Give the Unicode pack a clean answer (heavy box-drawing characters, e.g. `━`/`┃`) and accept the ASCII pack simply has no heavy vertical**, leaving it plain there | The Unicode pack is not the acceptance target; ASCII stays the floor, so this leaves the floor with the asymmetry option A already costs |

**Recommendation: B**, tried as a comparison against A rather than argued — attribute-only weight is
cheap to build and screenshot beside the horizontal `=`, and this project already prefers observable
comparisons to a guessed pick (Section 2 of this register). Corners: give the whole-Grid-heavy case
(only) its own corner glyph too, since that is the one case where all four sides agree and the visual
mismatch is most visible; leave corners exactly as today whenever sides merely differ between light
and heavy, since the existing reasoning for a plain corner there still holds.

### Q57 — answered

**Question:** Q57 — After a placement, where does keyboard focus go — and what returns it to the menu?

**Status:** ANSWERED 2026-09-27 — A, "always back to the menu", at the owner's direction, reversing the recommendation below (the Answered table above has the decision). The original entry follows.

Two statements in canon pull opposite ways once focus exists. `engine.md` 9.7's fast path — **the
armed item stays armed after placing, so a run is one digit followed by arrows and Enter** — assumes
arrows keep moving the Grid cursor after a placement. The owner's own sketch of the focus toggle
(2026-09-26) returns focus to the menu after every placement: "then the focus comes back to the menu,
the user can click enter/space again to build another building". If focus always returns to the
menu, the second arrow press of the fast path moves the menu highlight instead of the cursor, and the
path a proficient player types without looking breaks. Separately, the same sketch returns focus with
"esc or delete" — but the Mac key labelled delete sends Backspace, which is already "remove the
planned structure under the cursor", so one key cannot mean both.

| Option | Cost |
| --- | --- |
| A. **Always back to the menu** after a placement, as sketched | The keyboard-only flow reads exactly as described; the digit-then-arrows fast path breaks on its second placement, which is the one flow canon calls the proficient player's |
| B. **Always stay on the Grid** | The fast path is untouched; the menu-driven flow needs a Tab or an Esc after every placement to pick again, which is what the sketch was trying to remove |
| C. **Back to wherever the arming came from**: arming from the menu (highlight, then Enter/Space) returns focus to the menu after a placement; arming by digit (or a click on a row) keeps focus on the Grid | Both flows work as their users expect; the rule is one more thing to explain, and the key help must show where focus is — which convention 1 (`engine.md` 9.7) already demands once arrows can mean two things |

For the key that returns focus: **Esc** (disarm, and back to the menu — the same "cancel" it already
is), Tab (toggle), and a right click (which is already Esc). Backspace stays "remove under the
cursor" in both focuses.

**Recommendation: C**, with A and B as a Debug Mode choice so the owner can feel all three rather
than read about them. C keeps the one path canon promised a proficient player while delivering the
flow the owner sketched, and with gate 5F's smart cursor (Q55) the sketched flow needs no arrow keys
at all: down, down, space arms and lands the cursor on a free tile, space places and returns to the
menu, space arms again at the next free tile, and so on.

### Q30 — answered

Built rather than argued, at gate 5B. The recommendation was followed exactly — construct menu,
budget, the selected item's cost and effect, the reason a refusal happened, and no radius preview —
and the result is worth one sentence for whoever reopens the scope question: **the smaller panel came
out shorter *and* more useful than the one it replaced**, because four of gate 5A's six blocks were
reporting things the Grid already showed. A panel that narrates state grows; a panel that answers
questions does not. [`engine.md`](../system-design/grid-engine.md) Section 9.2 now carries the contents.

### Q58 — answered

**Question:** Q58 — Should a click with something armed be allowed to scroll the view?

**Status:** ANSWERED 2026-09-28 — reversed to scrolling, with a double click (the Answered table has
the decision). The original entry follows.

Q52 made placement by mouse a two-click gesture, safe because the second click is compared by tile,
not by screen position: when the first click lands inside the scroll margin, the camera follows the
cursor and the tile under the pointer changes, so a second click on the same spot is correctly read
as a first click on a new tile. Correct — but from the player's side, they clicked the same place
twice and nothing was built. With a three-tile margin that happens only near the Grid pane's edges;
at the ~20% margin the owner asked for (Q54), it is roughly a fifth of the pane on every side.

| Option | Cost |
| --- | --- |
| A. **Keep today's behaviour**: an armed click scrolls like any cursor move | Nothing to build; the "nothing happened" second click becomes common as the margin widens |
| B. **An armed click moves the cursor but never the camera**; the follow rule applies again at the next keyboard move or wheel step | The confirming click always lands on the tile the preview is on. A bend to 3.3's "the cursor drives the camera" for one input — acceptable because the margin is already a follow rule, not an invariant (gate 5A) — and a cursor can briefly sit inside the margin, which the margin rule's own wording already allows at the Grid's edge |
| C. Compare the confirming click by screen position again | Q50's own finding: after a scroll, the same screen cell is a different tile, and this would place on it — rejected |

**Recommendation: B.** It keeps both of Q52's properties — two deliberate clicks, and never a
placement on a tile the player did not click — and removes the one surprise left. An unarmed click is
unaffected: it is the "click to centre" the owner asked for (gate 5H), where moving the view is the
whole point.

### Q60 — answered

**Question:** Q60 — After a Nexus power is picked, does the popup stay open until Esc, or close itself?

**Status:** ANSWERED 2026-09-27 — B, "close on the pick", at the owner's direction (the Answered table above has the decision). The original entry follows.

Gate 5F's Nexus Powers popup, per the milestone tracker, "holds focus until Esc". So after a pick it
stays open, showing "Nothing waiting" and the pick listed as active with its one line of
description. That costs one key on every Build Phase's most common path (open, pick, close), and the
same line is already on screen elsewhere: the menu entry reads "1 active" and the status line says
"Reserve Fund picked."

| Option | Cost |
| --- | --- |
| A. **Stay open until Esc** (built) | One extra key per Build Phase; the player sees the pick land in the "active" list before leaving, and the popup never closes under them |
| B. **Close on the pick** | One key saved; the confirmation is the status line and the menu entry alone. A player who meant to read the active list afterwards has to reopen it |

**Recommendation: A, with B one Debug Mode field away.** Once Milestone 8 deals more than one power,
or several over a campaign, the popup becomes the place to read what is active, and closing it the
instant something changes there would hide the change. Until then the owner's feel is the better
judge, and gate 5G makes that a toggle rather than a rebuild.

### Q61 — answered

**Question:** Q61 — Does the Build Phase open with the keyboard on the menu or on the map?


**Status:** ANSWERED 2026-09-29 — A, the menu, at Explore Map (the Answered table has the decision). The original entry follows.

Gate 5F opened the Build Phase with the keyboard on the menu, because the owner's eyes went to the
side panel first (2026-09-26) and its first entry is the Nexus power pick the commit will insist on.
Nobody decided it; it was the natural reading of "the menu orchestrates the Build Phase". Opening on
the map would put the cursor in play at once, exploring.

| Option | Cost |
| --- | --- |
| A. **The menu** (as built) | One Tab or Right before the first arrow on the map; the Nexus pick is one Enter away |
| B. The map, exploring | The first thing on screen is the Grid; the menu is one Tab away, and the Nexus pick easier to miss until the commit refuses |

**Recommendation: A**, until Mario has tried both: press `d`, set "Opens on" to map, then `r`. The
flag is deleted once he answers.

### Q65 — answered

**Question:** Q65 — Should undo and Backspace get a short removal animation?


**Status:** ANSWERED 2026-09-29 — yes, sparks (the Answered table has the decision). The original entry follows.

Placement now animates; removal is instant. The building must still leave the plan at once, so a
removal animation would be an effect over empty ground, not a delayed disappearance.

| Option | Cost |
| --- | --- |
| A. **Yes, as its own small gate** after placement has been felt | A second effect family to author |
| B. No; removal stays instant | Asymmetric with placement |

**Recommendation: A**, after the owner has felt placement.

### Q55 — answered

**Question:** Q55 — Smart cursor placement, and interpolated cursor/camera movement: build now or keep in mind?


**Status:** ANSWERED 2026-09-29 — both halves built; the smart cursor replaced by arming where the cursor is (the Answered table has the decision). The original entry follows.

Two further ideas from the same 2026-09-26 feedback, each real but distinct from anything else in this
round: (1) when focus moves to the Grid right after arming a structure from the menu, place the cursor
at the nearest empty tile toward the map's centre, aligned with existing placements so a run forms a
tidy grid with one tile of spacing — a placement heuristic, not a UI wiring detail; (2) render the Grid
pane on its own timer, decoupled from key events, so cursor and camera movement (including the speed
tiers of Q54, and a "click to centre" mouse gesture when nothing is armed) ease toward their target
over several frames instead of jumping — asked directly as "do you think this would be possible?". It
is: `src/cli/spike.ts`'s live loop redraws once per input event today and has no independent frame
timer at all, unlike the Nexus Pulse view, which already proves the same "presentation interpolates,
simulation does not" pattern this would need (`engine.md` Section 1). Neither idea is specified enough
to build blind — the smart-cursor rule needs a precise definition of "aligned, one tile of spacing" for
an irregular existing layout, and the interpolation idea needs its own frame-timer plumbing decision
(when the loop starts and stops, so an idle screen is not redrawing needlessly).

**Recommendation: keep both in mind, build neither in the same pass as Q52/Q53/Q54.** Land the click,
focus, and speed-tier mechanics first — they are what the owner actually asked to be able to use next
— then revisit interpolation as the natural way to make the speed tiers *look* smooth once they exist,
and scope the smart-cursor heuristic as its own small follow-up once there is a real focus-toggle mode
for it to trigger from.

### Q66 — answered

**Question:** Q66 — Should the Build Phase read key releases where the terminal reports them?

**Status:** ANSWERED 2026-09-30 — A, the three tiers, behind the Key releases Experiment (the Answered
table has the decision). The original entry follows.

A classic terminal sends bytes only when a key goes down, and while it is held the operating system
repeats it at its own delay and rate; nothing says when it is let go. So "held" is guessed from the
gaps between presses (`src/build/motion.ts`, tuned by the "Hold window" Experiment), and a quick run
of taps can read as a hold. The owner: "I really hope we can reliably manage key-press vs key-hold on
all platforms, instead of relying on the OS settings … when tapping, I wish we could move the cursor at
regular 1 block intervals. The scroll acceleration makes a lot of sense when holding, but when tapping …
the combination of keep-pressing, releasing, and tapping to adjust would work perfectly well." The
kitty keyboard protocol (kitty, WezTerm, Ghostty, foot, Alacritty, and — unmeasured — recent iTerm2)
reports press, repeat and release; Windows Terminal has win32-input-mode; the browser page has
`keyup`. `node scripts/probe-key-release.mjs` says which kind a terminal is.

**The shape that keeps both worlds working is progressive enhancement, in three tiers**, chosen at
start from what the host says it reports (`docs/milestones/next-steps.md` has the detail):

1. **Floor — no holding needed.** Every move is also a single key (a tap is a tile, Shift or
   PageUp/PageDown jumps 12), so a hold is a convenience and never a requirement. True today.
2. **Timing, when a host reports only presses** (the terminal today): infer a hold from the gaps
   (today's ramp), *learn* the OS repeat interval from the first held run instead of asking the owner
   to tune "Hold window", and read "no event for a while" as a release.
3. **Releases, when a host reports them**: a press moves exactly one tile and nothing else; a hold is
   press … release, run on the game's own repeat cadence with the acceleration curve, ignoring the OS
   repeat rate entirely. That is his "regular 1 block intervals".

Only the input path changes; the reducer still sees ordinary `move-cursor` commands, so keyboard, mouse
and driver stay one plan. A test feeds the same intent as timed presses and as press/release events and
expects the same positions.

| Option | Cost |
| --- | --- |
| A. **The three tiers**: ask for the kitty protocol on start (query, then push flags; pop them on *every* exit path through the one disposer), use the browser's `keydown`/`keyup`, and fall back to timing where a host answers nothing. A bonus: with the protocol on, a lone Esc no longer needs its 100 ms wait | An input event with a `phase` in place of raw bytes (`docs/system-design/portability.md`), a second decoder to keep in step, and terminal-state cleanup that must be right; tmux, SSH and `screen` may not pass the protocol through |
| B. Timing only, everywhere | Nothing new; taps and holds stay a guess shaped by the OS repeat settings |

**Recommendation: A**, behind an Experiment ("Key releases": auto or off) so the owner can compare, after
the probe has been run in his iTerm2 — if it reports releases there, the next gate builds it; if not,
tier 2's learned repeat interval alone is worth building, and tier 3 serves the terminals and the page
that can.

### Q70 — answered

**Question:** Q70 — Should a side whose Grid Nexus still stands lose a Pulse because its units died?

**Status:** ANSWERED 2026-10-01 — B, by Mario (the Answered table has the decision); built the same day. The
original entry follows.

**Status:** OPEN — decision-ready; registered 2026-09-30 from PERIMETER's fixture.

The kernel ends a Pulse the moment one side's mobile units are all dead (annihilation), even when that side's
Grid Nexus stands. In a defence mission this reads oddly: when the player's squads fall in round 2, the round
simply stops, with the raid at the gate, and the flank that was due seven seconds in never comes. The raid's
survivors then carry into round 3 (which is at least consistent: the player sees them in the Build Phase). In an
earlier tuning of the waves, a strong defence's round 3 ended the moment its last swarmer died, the Nexus
untouched, and the mission counted it held.

| Option | Cost |
| --- | --- |
| A. **Keep the rule**: annihilation ends a Pulse whatever stands | No change; a defence round can end before its waves have all come |
| B. **A side with a standing Grid Nexus is never annihilated**: its Pulse goes on until the Nexus falls or the time runs out | A RULE change ([`pulse.md`](../system-design/pulse.md), victory), a named scenario, and the full determinism bar; it also changes Skirmish, where it is arguably right too: "Destroying the enemy Grid Nexus wins" |
| C. **A mission flag**: the runner tells the kernel the defender fields no mobile units, so only its Nexus can lose | No kernel file changes, but it misstates the roster to the kernel to get a different rule — the kind of hidden rule the project refuses |

**Recommendation: B**, decided by playing it: play PERIMETER as it is first (the Next round Experiment and the
waves as built), and if a round ending with the raid at the gate reads wrong to the owner, B is the honest fix.
Until then A stands and the pull request says what it does.

The Barracks that trains makes the rule's edges sharper. A round can now begin with none of the player's units
alive and still field some, trained during it. The kernel counts a side as having fielded units from the round's
opening, and the mission runner widens that each time a raid group arrives; so whether a trooper trained after
the opening ends the round by dying depends on whether it happened to be standing when a later group arrived. In
PERIMETER at a trooper every eight seconds, a plan that builds nothing wins round 3 this way. Option B removes
the timing as well.

### Q34 — answered

**Question:** Q34 — Does building Commander Vasse in Level 1 mean authoring the Citizens Commander Army early?

**Status:** ANSWERED 2026-10-03 — by Mario (the Answered table has the decision); built in the Commander step's second round. The
original entry follows.

**Status:** OPEN — Milestone 8 started on 2026-10-01 and builds under the recommendation, as [`milestone-08-commander.md`](../milestones/milestone-08-commander.md) assumed; the Commander step's pull request says so for Mario to confirm or overturn.

Mario's milestone list puts a real Commander in Level 1: "focus on the first Citizen commander. Develop the
initial draft of Nexus upgrades." Every earlier framing deferred both: `commander-armies.md` ("Do not invent
production-ready stats before Milestone 12 selects the minimum Citizens-versus-Ravels microgame"),
`AGENTS.md`'s standing ban, and the campaign's belief ramp, which spends the Commander death, absence and
restoration beat at Mission 3 (RESTORATION). Building the full roster early locks balance nobody has played;
refusing any Commander mechanic leaves Milestone 8 with nothing to do.

| Option | Cost |
| --- | --- |
| A. **Build the Commander *mechanic* and one named Commander (Vasse) scoped to PERIMETER; keep the upgrade draft to one or two real options; do not treat this as roster selection** | Real, testable work (the death, absence and restoration cadence [`pulse.md`](../system-design/pulse.md) specifies and nothing has built) without locking what `commander-armies.md` reserves. The risk is a later reader mistaking "Vasse exists" for "the Citizens Commander Army is decided", which is why Milestone 8's own definition of done requires its report to say otherwise |
| B. **Defer the Commander to Mission 3**, per the belief ramp, and let Milestone 8 build only the Nexus upgrade draft | Faithful to the narrative plan and cheaper, but leaves PERIMETER without the character its briefing centres on, and Mario asked for the Commander in Level 1 |
| C. **Author the full Citizens Commander Army now** | Contradicts `commander-armies.md` and `AGENTS.md` and locks balance on a roster nobody has played. Named for completeness only |

**Recommendation: A.** The line that makes it safe is the one `commander-armies.md` draws: a Commander Army
is "the complete set of choices legally available to one player in one match". One named Commander's
mechanic plus a two-option draft, with every other choice still from the disposable fixture roster, is not
that. **Separately: PERIMETER's own design should not force Vasse's death**, so the mechanism is testable
without spending RESTORATION's beat two missions early.

**Since the Commander step (2026-10-01):** it does, late. She falls in PERIMETER's last round in every plan
measured, at every health her Experiment offers, so the mission ends with "Vasse fell." though it never shows
her absence or her return. No health keeps her alive there and still lets a plan that builds nothing lose;
holding her back needs an order she can keep (Q69). The figures are in the
[Commander report](../history/reports/2026-10-01-commander-vasse.md).

### Q71 — answered

**Question:** Q71 — How much of what is coming does a player see without spending a pick?

**Status:** ANSWERED 2026-10-03 — A, by Mario (the Answered table has the decision); built in the Commander step's second round. The
original entry follows.

**Status:** OPEN — registered 2026-10-01 from Mario's playtest; waits on Milestone 8's Nexus draft step, which
picks PERIMETER's two powers.

Mario, after playing the loop across rounds: "I would like, for example, that the enemies would have a spawner
where the player can check how many enemies are coming. Or directly see them on the map with intentions." The
design says the opposite in one place: in [`commander-armies.md`](../game-design/commander-armies.md) the `reveal`
effect kind "keeps information something a player spends a pick on rather than something the HUD gives away",
and Vasse's card offers *Early Warning*, "Shows where the next wave arrives, and what is in it". Step 6B already
sides with Mario by default: the Build Phase draws the next round's arrivals on the map, see-through, with their
intention on the Explore Map card (the Incoming wave Experiment, shown). If the screen gives the waves away,
Early Warning has nothing left to show, and the Nexus draft step chooses PERIMETER's two powers knowing which it
is.

| Option | Cost |
| --- | --- |
| A. **The screen shows the round's raid for free**: where each group arrives, how many and of what, and what it means to do, in one place as well as on the map; a `reveal` power shows what that view cannot (the round after next, a group that arrives unannounced, exact timings) | What Mario asked for, and the scripted opponent's deal with the player ("the Nexus is ahead of you", [`scripted-opponent.md`](../game-design/scripted-opponent.md)). Early Warning's line changes to show something beyond the free view, or another power takes its slot. Challenge, where both sides plan hidden, still shows only what is public |
| B. **Where for free, what for a pick**: arrival points and intentions show; the numbers and kinds need Early Warning | Keeps the design's line as written, but the count Mario asked for sits behind a pick in the first mission, where a player has two powers to choose between |
| C. **Nothing for free**: every forecast is a power | Reverses what step 6B built and Mario liked; the first mission is played blind unless the player picks the right card |

**Recommendation: A.** In the Campaign the raid's plan is public by design, and the player's own Nexus telling
them what is coming is the mission's fiction; a pick is better spent on what is genuinely hidden. Decide it
before the Nexus draft step chooses PERIMETER's two powers. The display itself (a count in one place, seen
without exploring the map) waits in [`backlog.md`](../milestones/backlog.md), under the Pulse screen.

### Q68 — answered

**Question:** Q68 — What does the player call a Nexus Pulse?

**Status:** ANSWERED 2026-10-04 — B, by Mario (the Answered table has the decision). The original entry follows.

**Status:** OPEN — decision-ready; registered 2026-09-29 (the owner's feedback on the first Pulse screen).

The confirmation is titled "Battle Round 1", because the owner felt "we may keep the term 'pulse' to
ourselves and instead call this 'battle round'". He also wrote the menu row as "[s] Start Pulse". The design
documents still say the player-facing phases are **Build Phase** and **Nexus Pulse** (`AGENTS.md`), so as built
the popup says Battle Round while the menu row and the running screen's title say Pulse: two names for one
thing on one screen.

| Option | Cost |
| --- | --- |
| A. **As built**: Pulse everywhere but the popup | Two names for one thing; the player learns both |
| B. **Battle Round everywhere the player reads** (`[s] Start Battle Round`, a `BATTLE ROUND 1` panel title, the Nexus popup's "needed before the battle round"); "Pulse" stays the code, design and lore name | A design change (the phase names above) and a sweep of the interface's words; the lore's Nexus Pulse becomes the in-world name only |
| C. Both, with a job each: **Battle Round n** is the round of a mission; **Nexus Pulse** is the thing the Nexus does inside it | Two names on purpose, so a player must be taught which is which |

**Recommendation: B**, decided together with the menu reorganisation the owner has announced, because the
menu row is one of the places the word lives. Until then A stands, and the popup's title and body are data
(`popupSpec`), so B is a change of words.

### Q72 — answered

**Question:** Q72 — Does Vasse's voice add to the battle, or get in its way, and where should her words appear?

**Status:** ANSWERED 2026-10-05 — A, by Mario (the Answered table has the decision). The original entry follows.


**Status:** OBSERVABLE — registered 2026-10-04; the "Vasse's voice" Experiment shows all three answers.

The owner asked for her voice in battle as an experiment: "let's experiment with this to see if it gets into the
battle or enhances the experience even more". Built: a few short lines a Battle Round at the moments that matter,
never more than three besides her fall and a round won, with a quiet gap between them.

| Option | Cost |
| --- | --- |
| A. **Beside her** (the first guess): the line on the map near her `@`, held still about three seconds | Where the eye already is; covers a strip of open ground, never a unit or a building |
| B. **In the feed**: under the panel's recent events, her name over the line | Never covers the map; easy to miss while watching the fight |
| C. **Off**: the battle as it was | Nothing of her in the fight but her `@` and her aura |

**Recommendation: A**, with the panel taking her line whenever she is out of view. If it feels busy, she says
fewer lines a round before her words move to the feed.

### Q24 — answered

**Question:** Q24 — Does the terminal cell's own aspect ratio distort movement and fire enough to fix?

**Status:** ANSWERED 2026-10-06 — E, rows x2, by Mario (the Answered table has the decision). The original entry follows.

**Status:** OPEN — chosen, not yet settled: Mario played the Ground Experiment and chose rows x2 (2026-10-06:
"Rose X2 definitely feels better. That's gonna be our choice"); it becomes the rule, with its retune, once he has
seen the math and says go ([the options, drawn](../history/reports/2026-10-05-tall-tiles-options.md),
[the spike](../history/reports/2026-10-05-tall-tiles-spike.md)).

Owner playtest, 2026-08-22: "it makes movement and diagonal shooting look a bit distorted; too fast when
moving up and down, too slow when moving sideways... Let's explore the vertical-rectangle issue later, for now
just take note." On 2026-10-05: "the range is severely skewed vertically ... one idea would be counting distance
and speed by half vertically", and, choosing: "the map is not important, we will make nee maps later. What
matters is how intuitive it feels for a human player, this is the time to get it right, we can still change all
numbers and formulas to fit." A terminal cell is about twice as tall as it is wide: at one column a tile every
range, aura and build range is drawn twice as tall as it is wide, and a unit walking down the screen looks twice
as fast as one walking across.

| Option | Cost |
| --- | --- |
| A. **As now** (Ground: as now) | Free. Reaches drawn tall, walking down twice as fast on screen; two columns a tile at 128 columns or wider |
| B. **Square tiles** (Ground: square tiles) | No rule changes, every step a tile either way. 24 × 18 tiles at 80 × 24; buildings and units read with gaps (`[ b ]`) until they have two-character art; a step across hops two columns |
| C. **Draw a step up or down over more time** | Not viable: units are drawn on whole tiles, so a slower crawl draws them rows from where they fight, and it fixes no shape |
| D. **Change the acceptance target** | The owner does not want it pursued; named for completeness |
| E. **Rows count double** (Ground: rows x2) | Reaches and walks look right at 80 × 24 with today's art and view. Melee is touching; the build range is counted in rows; every other reach loses half its rows (odd ranges round down); a step up or down is a row at a time, half as often |
| F. **Sideways doubled** (Ground: sideways x2) | E's rule with every number doubled across: up and down as now, across twice as far and as fast, so every reach covers twice the ground and the battle speeds up |
| G. **Hex grid** (drawn only) | The nearest to round; every map, footprint and path redone, rectangular buildings sit badly |
| H. **A tilted camera: rows count three** (drawn only) | Reaches wider than tall, like depth; up and down too coarse at 18 rows |

**Recommendation: play the Ground test under each choice, then PERIMETER under the one that feels best.** Before
he plays, the lean is E, rows x2: it fixes both the shapes and the walk while keeping the whole battle in view at
80 × 24 and today's art; B is the plainest rules if a closer view and new two-column art are acceptable. Whichever
is kept, its choice becomes the rule in one pull request with the retune: the Experiment and the other choices go,
the grid design's distance and the presentation's tile width say the one answer, and the numbers (build range,
her aura, blasts, the engage reach, PERIMETER's raid) are set by feel.
