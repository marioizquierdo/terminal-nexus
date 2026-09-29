# Gate report — Milestone 5, Gate 5J: the owner's third round

**Document role:** Gate evidence report for Gate 5J
**Status:** COMPLETE — PASS, awaiting the owner's playtest
**Canon version:** 2.25
**Updated:** 2026-09-28
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.24 when the work started; 2.25 at the end.
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5J, the owner's third round of feedback
  (`docs/feedback/2026-09-28-pr46-playtest.md`, F18-F27), from his play of the 5G-5I browser page.
- **Question this gate answers:** with everything he asked for built, does the Build Phase become
  something he can tune himself — Settings with Experiments he can flip and export back to us — and
  do moving, clicking and exploring feel right by keyboard and mouse alike?
- **Smallest artifact that can answer it:** the same `terminal-nexus --spike` screen and browser
  page, with: a game menu and a Settings popup in the existing popup shape; an export as text plus
  `--settings` to read it back; the arrow ramp simplified in the input path; a tween module and a
  cursor glide in the live loop; the click rules changed in the reducer and a double click in the
  session; the menu order and an Explore Map panel; three map-edge Experiments; an animation track
  module and two generic effect recipes with the placement juice moved onto them.
- **Automated evidence planned:** reducer, adapter and driver tests for every new command; the same
  plan by keyboard, mouse and driver; export → import round trip and forgiving parse; the ramp's
  timings as pure functions; the glide and slide as pure functions with `busyUntil`; the animation
  track's requests (play with each stacking policy, cancel, speed change, finish, follow-ups) in any
  evaluation order; light and sparks against the corruption law; the edge consistent on four sides.
- **Human evidence required:** Mario plays gates 5G-5J together (his plan) on the browser page and in
  iTerm2, and pastes his settings export into the pull request.
- **Exclusions:** anything beyond his round-3 items; the title screen's Settings keeps only the player
  settings; no removal animation (Q65); cancel/speed/finish are built and tested but not used live.
- **Stop conditions:** a change that would need the reducer to read a clock; an effect that would
  touch state; losing keyboard/mouse/driver parity.

## 2. Environment — pinned, not remembered

- Node v22.22.2, Bun 1.3.11 (both as run for the results below); Linux container; Chromium from
  `/opt/pw-browsers` for PNGs and the browser page.

```bash
# install
npm ci
# build
bun scripts/build-web.mjs            # the browser playtest page
# test
npm run typecheck && npm test && npm run test:bun && ./scripts/check-repository.sh
# run
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --settings "placeLight = rainbow"   # start from an export
node scripts/playtest.mjs --settings "mapEdge=half" --glyphs unicode --keys "e" --png final
```

## 3. What was built

Orchestrated as five parallel pieces of work, each on its own copy of the branch, merged here.

- **Settings with Experiments** (F19). Esc on the menu, `q`, or the top bar's `[esc] menu` open a game
  menu (`[s] Settings`, `[q] Quit`, `[esc] Back to the game`); leaving still always asks. Settings is
  one scrolling popup: the player's own settings (background, colour depth, symbols, reduced motion,
  saved), then **Experiments** — every former Debug Mode flag, never saved — then Restart and
  **Export settings**. `d` opens it at the Experiments. The export is `name = value` text, changed
  experiments first with the default each replaced, then the settings, then the rest, with the build's
  commit; the adapter copies it (OSC 52 / the browser clipboard) and writes
  `~/.terminal-nexus/settings-export.txt`. `--settings` (terminal and scripted playtest) and
  `#settings=` or a paste box (browser page) read it back, forgivingly. `src/build/settings.ts`,
  `src/build/settings-export.ts`.
- **Movement** (F20, F21). `src/build/motion.ts` rewritten: one press 1 tile; a press of the same arrow
  within the 500 ms hold window 2; 4 once the run has lasted 300 ms; a different arrow or any other key
  starts over. Shift and its fallbacks jump 12, a held Shift at most every 150 ms. The slow step and
  slow-after-a-turn are deleted. `src/view/tween.ts` (new) is the one interpolation module: the camera
  slide now uses it, and a new cursor glide (100 ms) moves the drawn cursor and its preview across the
  view; reduced motion snaps both.
- **Mouse and Explore Map** (F22-F24). A click on a menu row activates it from any focus; a building
  is armed with its preview at the cursor. Armed clicks scroll the view like exploring ones, and a
  double click on one screen cell within 400 ms places where the first click pointed (the session
  times it; the reducer sees a click on that tile). After a mouse action the menu shows no
  highlight bar. `[e] Explore Map` is the first entry; its panel, headed EXPLORE MAP, follows the
  cursor. War Chest gives 2000.
- **Map-edge Experiments** (F25): the edge glyph (solid, half block, heavy, double, shade, the map's
  own), its colour (strong, dim, quiet — a new `chrome.edge` role, now the default), and a shared west
  side that gives the Grid the divider's column. A map may name its own edge style
  (`BuildContext.edgeStyle`; PERIMETER's is a dashed fence).
- **The presentation toolkit** (F26, F27): four named families — animations, particles, shading,
  tweens. `src/view/animation.ts` holds the animation asset and the track (play with replace / queue /
  ignore, cancel, speed change, finish; completion follow-ups as scheduled data).
  `fx.structure.place` became the general `fx.sparks.burst` (`effects/particles.ts`) and
  `fx.light.flash` (`effects/shading.ts`); a placement is one play whose follow-ups are the light and
  the sparks.
- **Working method** (F18): the `pr-description` skill's Demo section, sized in layers; AGENTS.md and
  CLAUDE.md ask for feedback through Experiments and a pasted export.

## 4. Automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` (both configs) | clean |
| `npm test` (Node) | 550 / 550 |
| `npm run test:bun` | all files pass |
| `./scripts/check-repository.sh` | passes, canon 2.25, gate 5J |
| `node scripts/capture-spike-screenshots.mjs` | every shot regenerated, three flows updated for the 12-tile jump and the new row count |

New test files: `tests/animation.test.ts` (15), `tests/build-edge.test.ts` (10),
`tests/build-settings.test.ts`; extended: effects, placement, motion, focus, spike, nexus, playtest,
web. The two frame-budget tests failed once each **while four agents were building on the same machine**
(load average about 10) and pass alone and in every later full run; the placement frame's p95 was
measured before and after the toolkit merge under the same load and did not move (4-6 ms either way).

## 5. Human observations

- The orchestrating session played the flows through the scripted playtest at 80×24: the opening
  screen (Explore Map highlighted first), Explore Map following the cursor, Esc → the game menu,
  `d` → Experiments, the export popup, the Nexus popup's War Chest (2000), and Mario's own mouse flow
  — click the map twice, click Hatchery, click a tile twice: placed, back on the menu with no bar.
- The map-edge options were looked at as PNGs in both themes; half block in the quiet colour reads
  thinner and calmer than the bar.
- **No human has played this build.** That is Mario's step.

## 6. Interpretation

Every round-3 item is built. The rules he stated directly are now defaults (1 → 2 → 4, Shift 12,
interpolation everywhere, clicks that activate, armed clicks that scroll with a double click to
place, Explore Map first, a quieter edge, War Chest 2000); everything that is a matter of feel is an
Experiment he can flip and export. The one reversal of an earlier decision — an armed click never
scrolling (Q58, option B) — is recorded as answered by his own words.

## 7. Failures, surprises, and discarded approaches

- **Parallel work collides in the shared files.** Five agents touched `debug.ts`, `state.ts`,
  `session.ts`, `build.ts` and the screenshot script at once. Four merged cleanly or with a few
  lines; the Settings work conflicted in eight files and was rebased by the agent that wrote it, which
  knew both sides best. Instructing each agent to append flags in a block of its own and never reorder
  existing ones kept `debug.ts` conflict-free.
- **Key scripts that count rows break whenever an Experiment is added.** Every new flag moved a
  "`Up*N`" and a "v N more" in the screenshot script; they were recounted twice. Addressing an
  Experiment by name in scripts would remove this.
- **A held Shift repeats faster than a 12-tile jump can be seen**, so repeats inside 150 ms are
  dropped; the tmux screenshot flows had to put a key between two jumps.
- **F22 and F23 pull against each other**: Explore Map hides the menu, but a mouse player wants the
  menu beside the map. Resolved as: a click on the map from the menu keeps the menu; every keyboard
  way onto the map opens Explore Map; a click on the Explore Map panel gives the menu back.
- **Mario's F22 wording expected armed clicks to scroll**, which the agent building F22 did not
  change (it was Q58's still view). The orchestrator added it with a double click, so a scrolled view
  never makes the second click land elsewhere.
- **Spark scatter changed** (the recipe name is part of the identity hash) and two sparks on one tile
  now merge to `&` through the shared merge table — visible, harmless.
- **Settings at 80×24 shows four rows at a time**, since a popup lives inside the Grid pane. It works
  and scrolls; a bigger terminal shows more.
- **One unexplained tmux run** during the Settings work exported the wrong background; three later
  runs and the automated test were correct.

## 8. Decision

**PASS** — every item of the round is built with tests, keyboard/mouse/driver parity holds, and the
canon says what was built. Acceptance is Mario's playtest.

## 9. Canon impact

Canon 2.25: `engine.md` 3.3 (the ramp and the jump, clicks that scroll and double clicks,
interpolation), 9.2 (the Explore Map panel), 9.5 (placement as a play with follow-ups), 9.7 (menu clicks
activate, the game menu, Settings and Experiments, the export); `ascii-effects.md` 1.2 (the
presentation toolkit, RULE) and its vocabulary (`fx.sparks.burst`, `fx.light.flash`);
`open-questions.md` (Q58 answered; Q54 and Q63 updated; the protocol names Experiments); AGENTS.md and
CLAUDE.md (Experiments and the export, the Demo sized to the change); governance ledger and history.

## 10. Next authorized action

Mario plays gates 5G-5J together and pastes his settings export into the pull request. A session
that receives it starts the game with `--settings`, adopts each value he settled as a default,
deletes those Experiments, and records the answers (Q54, Q61-Q65 among them). The next gate waits
for his word.
