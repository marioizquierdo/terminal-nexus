# Gate report — Milestone 5, Gate 5K: the owner's fourth round

---

## 1. Frame — written before coding

- **Canon version:** 2.25 when the work started; 2.26 at the end.
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5K, the owner's fourth round of feedback
  (`docs/history/feedback/2026-09-29-pr46-round-4.md`, F28-F40) and his pasted settings export.
- **Question this gate answers:** with his exported numbers as the defaults and his map-edge choice as
  the rule, does the Build Phase now behave the way he described it — a building armed where he is
  looking, focus that goes back where it came from, one "active" look for every menu row, a Settings
  popup that gets out of the way — and can a demo open already in the state it is about?
- **Smallest artifact that can answer it:** the same `--spike` screen and browser page, with: an
  arming rule in the reducer and an origin for focus; one active-row drawing function; a message
  popup kind and a scroll bar in the popup shape; a top-bar Esc label; removal sparks on the existing
  toolkit; defaults and deletions in the Experiments list; a start-keys option through the playtest's
  own step delivery; a key-release probe script.
- **Automated evidence planned:** the arming rule (at the cursor, the cheapest gapped then touching
  spot, the 12-tile reach and its ghost, the Nexus start, no last-building rule); focus return by
  origin, for keys and clicks; the active style on all three rows; Explore Map's toggle and
  separator; removal sparks' timing and purity; the Settings layout, restart detection, the message
  popup and the game menu's Restart; the scroll bar's drawing and hit-testing; the Esc label and its
  click; the export adopted as defaults; start keys, including one that cannot be delivered.
- **Human evidence required:** Mario plays gates 5G-5K together, and runs the key-release probe in
  iTerm2 (Q66).
- **Exclusions:** reading key releases (Q66, next gate, after the probe); letter hotkeys for buildings
  (his "press b" read as the building's own key, a digit).
- **Stop conditions:** a clock in the reducer; losing keyboard/mouse/driver parity; an effect touching
  state.

## 2. Environment — pinned, not remembered

Node v22.22.2, Bun 1.3.11; Linux container; Chromium from `/opt/pw-browsers` for PNGs and the page.

```bash
# install
npm ci
# build
bun scripts/build-web.mjs
# test
npm run typecheck && npm test && npm run test:bun && ./scripts/check-repository.sh
# run
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --keys "n 1 1 Enter"           # open in a state
node scripts/probe-key-release.mjs                              # does this terminal report releases?
node scripts/capture-spike-screenshots.mjs                      # regenerate docs/screenshots
```

## 3. What was built

Orchestrated as one agent for the export, then two in parallel (placement and focus; Settings and
popups), merged here, plus the orchestrator's own start-keys and probe work.

- **His export adopted** (F38, F39): build animation 300 ms, glow 250 ms, scroll margin 25%, cursor
  glide 80 ms, hold window 150 ms, refused cursor 150 ms, Esc timeout 100 ms. The three map-edge
  Experiments are deleted: the map's own edge style, the quiet colour and the shared west side are
  the rule (49 tiles at 80 × 24; the floor still measured against a 30-column panel).
- **Arming where the cursor is** (F30): `armingSpot` keeps the building under the cursor when it fits,
  else the cheapest spot within 12 tiles (a tile sideways costs 1, up or down 2), gapped spots first;
  with none, one step right and down drawn as the building (`armGhost`) until a move or a place
  attempt. The cursor opens on the Grid Nexus. The smart cursor and its Experiment are gone.
- **Finishing returns to where it began**: `BuildState.origin`; placing, Esc while placing, and Explore
  Map return to plain navigation (arming began on the map) or the menu (it began there). Tab and a
  second Right arrive in plain navigation.
- **Opens on the menu at Explore Map** (F31); the "Opens on" Experiment is gone.
- **One active style** (F32): `menuRowActive` and `drawMenuRow` draw `>`, the hotkey colour and an
  underline for an armed building, Explore Map open and the Nexus popup open. Explore Map keeps its row
  over a separator above the tile card; `e` toggles it.
- **Removal sparks** (F33): a zero-frame play whose follow-up is `fx.sparks.burst`, timed by the live
  loop from the frame a planned building left the plan.
- **Settings** (F34, F35): rows are name and value; a restart-only change raises a **message** popup
  when Settings closes; the game menu gains `[r] Restart`; the title shows `(k/N)`; Export is the
  list's last row; a line then the description under the list.
- **Scroll bar** (F36): a popup's one scrolling run shows `^ : v` (`▲ ░ ▼`) in its right border when it
  overflows; clicks on its halves scroll.
- **Esc label** (F37): `menu [esc]`, `back [esc]`, `close [esc]` at the top bar's right end, clickable;
  popups carry no `[esc]`.
- **Start in a state** (F40): `--keys` and `#keys=`, through `src/playtest/deliver.ts`, the scripted
  playtest's own step delivery.
- **Key-release probe** (F29): `scripts/probe-key-release.mjs` asks for the kitty keyboard protocol and
  prints each key as press, repeat or release.
- **Working method** (F28): the PR description describes the change from main, skips temporary
  placeholders, and has a Workflow and tools section.

## 4. Automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` (both configs) | clean |
| `npm test` (Node) | 578 / 578 |
| `npm run test:bun` | all files pass |
| `./scripts/check-repository.sh` | passes, canon 2.26, gate 5K |
| `node scripts/capture-spike-screenshots.mjs` | every shot regenerated; two retired shots removed |

New: `tests/build-popups.test.ts` (15); arming, focus and active-row tests in `build-focus`; removal
sparks in `build-placement`; start keys in `build-lifecycle`; the export-as-defaults round trip in
`build-settings`; `build-edge` rewritten around the map's own edge.

## 5. Human observations

- The orchestrator played his flow in the scripted playtest: Tab, arrows to an open area, `1` — the
  Barracks stays under the cursor — Enter places it and leaves the keyboard on the map; `1` again moves
  the cursor to the next good spot; Esc cancels and stays on the map; `e` opens Explore Map with its
  row active over the separator.
- `--keys "n 1 1 Enter"` was run in a real terminal (tmux) and `#keys=` in headless Chromium: both
  open with the power picked and the Barracks placed.
- The probe was run in tmux, which does not answer the kitty query: "presses and OS repeats only".
- **No human has played this build**, and the probe has not been run in iTerm2.

## 6. Interpretation

Every round-4 item is built or, for key releases, answered with a measurement tool and a registered
question. His export settled four questions outright (Q55, Q61, Q65 and the map edge) and retuned
seven numbers; the Experiments list is 28 long instead of 31.

## 7. Failures, surprises, and discarded approaches

- **Straight-line "nearest" built downward.** A 3 × 2 Barracks's nearest gapped spot is three tiles
  below, not four to the right, so a run of arming built a column; he asked for "a few tiles to the
  right". Horizontal moves now cost half as much as vertical ones.
- **The spike's standing Barracks blocks the row**, so the second placement beside the first goes
  below it and the third continues right. Content, not the rule.
- **The only restart Experiment was deleted in the same round** that built the restart warning, so
  the message popup has no live trigger today; its detection is tested with a test-only field list.
- **A Settings restart with buildings planned throws removal sparks** over each: the live loop cannot
  tell a restart from an undo. Harmless, and arguably right.
- **An open-questions edit nearly deleted the Answered table**: the last Section 4 entry's end was
  found by searching for the next `### `, which is in Section 5. The edit script's own size assertion
  stopped it before anything was written; the boundary is now the nearer of `### ` and `## `.
- **`--keys` first did nothing**: the launcher's parser treats unknown options as flags, so the key
  script was dropped silently. It is now a value option.
- **A hold window of 150 ms** (his pick) makes a terminal with a long OS repeat delay lose its first
  repeat — a held key starts as a tap. That is Q66's reason to exist.

## 8. Decision

**PASS** — every item is built with tests or answered with a tool, parity holds, the canon says what
was built. Acceptance is Mario's playtest.

## 9. Canon impact

Canon 2.26: `engine.md` 3.3 (the map's own edge, the shared divider RULE, the 25% margin), 9.2 (popups
with a scroll bar and a message kind, no `[esc]`; the Explore Map panel; a menu row's two states,
RULE), 9.7 (finishing returns to where it began; arming at the cursor; the top-bar Esc label; the game
menu's Restart; Settings without the column); `open-questions.md` (Q55, Q61, Q65 answered; Q57
refined; Q66 registered); AGENTS.md Sections 2 and 4; governance ledger and history.

## 10. Next authorized action

Mario plays gates 5G-5K together, runs `node scripts/probe-key-release.mjs` in iTerm2, and pastes his
settings export. If the probe reports releases, the next gate builds Q66's option A; either way the
next gate waits for his word.
