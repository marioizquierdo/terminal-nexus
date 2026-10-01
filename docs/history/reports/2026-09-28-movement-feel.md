# Gate report — Milestone 5, Gate 5H: movement feel

**Document role:** Gate evidence report for Gate 5H
**Status:** COMPLETE — PASS, awaiting the owner's look
**Canon version:** 2.23
**Updated:** 2026-09-28
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.22 when the work started. The building session did not edit `specs/`,
  `AGENTS.md`, `docs/milestones/` or `docs/history/feedback/`; it proposed their text in Section 9, and the
  orchestrating session applied it at canon 2.23.
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5H, movement feel.
- **Question this gate answers:** once the Build Phase screen has a clock of its own, can moving
  around a Grid larger than the screen feel fast when the player wants distance and precise when they
  want a tile — held-key speed tiers, a margin that is a share of the view, clicks that scroll by how
  near the edge they land, a camera that slides rather than jumps — with every number live in Debug
  Mode so the owner tunes it by feel?
- **Smallest artifact that can answer it:** the existing `terminal-nexus --spike` screen (and the
  browser playtest page, which runs the same loop) with: a frame timer that runs only while something
  animates; a key-repeat tracker in the input path deciding each arrow's step; a share-of-view scroll
  margin; an armed click that never scrolls (Q58 option B); proportional click-scrolling when exploring
  (feedback F6); recentring on the fast modifier; an eased drawn camera; a cursor flash on a refused
  placement; a lone-Esc timeout; and a Debug Mode popup that scrolls, since the new numbers do not fit
  at 80x24.
- **Automated evidence planned:** injected-clock tests for the speed ramp, the Esc timeout, the camera
  ease and the frame timer (runs only while animating); reducer tests for the share margin, the armed
  click, edge and centre click-scrolling, and recentring; the Debug Mode popup scrolling by keyboard,
  mouse and driver to the same state and frame; every existing "same plan, every adapter" test still
  passing; the architecture check that `src/build` names no clock; the full suite on Node and Bun;
  `tsc`; the validator; the browser page build; screenshots and a GIF, looked at.
- **Human observation planned:** Mario, in iTerm2 and on the browser page — hold an arrow and say
  whether normal-then-fast feels right and whether a tap still lands one tile; click near an edge
  while exploring; place by two clicks near an edge; and flip the Debug Mode flags this report names.
  Nobody but this session has looked yet (Section 5).
- **Explicit exclusions:** placement "juice" (per-building frames, particles — its own later gate);
  a `Shift+click` one-click placement; the `[m] Map` popup (Q59); any change to the Pulse view's own
  timing; saving the flags; measuring the owner's own iTerm2 key-repeat numbers (the flags exist so he
  can tune them there).
- **Stop conditions:** any need for a clock or timer inside the reducer; any change that makes the
  keyboard, mouse and driver paths reach different states; a Node-only import reachable from the
  browser page. None reached.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64 (the cloud session's container) |
| Runtime and exact version | Node 22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `typescript` 7.0.2, `@types/node` 22.20.1, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0; tmux 3.4 for the real-terminal screenshots |
| Hardware, if it affects measurements | not applicable — every timing claim is tested against an injected clock; the one real-time test (the frame timer) asserts counts, not durations |
| Date measured | 2026-09-28 |

Commands, in the order they were run for this report:

```bash
./scripts/check-repository.sh
npm run typecheck
node --test tests/build-motion.test.ts
npm test
npm run test:bun
bun scripts/build-web.mjs
node scripts/playtest.mjs --keys "e Right Right~400 Right~30*14 Left~30 Left~400 Left~30*3 S-Down" --print none
node scripts/playtest.mjs --keys "d Down*6" --png final --print none
node scripts/playtest.mjs --keys "n 1 e click@76,10 click@70,10 click@55,10" --png 3,4,5 --name edge --print none
node scripts/playtest.mjs --keys "n 1 1 click:43,10 click:43,10" --png 4 --name armed --print none
node scripts/capture-spike-screenshots.mjs
```

## 3. What was built

In plain terms: **moving the cursor now has gears, the view slides instead of jumping, and clicks
scroll the map only when that is what the click is for.**

- **A tap moves one tile. Holding an arrow speeds up; turning slows down.** A held arrow moves 2 tiles
  a step, then 4 once it has been held for 300 ms; Shift+Arrow (and Option+Arrow, PageUp/PageDown,
  Home/End) moves 8; and changing direction drops a held arrow to 1 tile a step, for pointing
  precisely after overshooting, until the key is let go. These are the owner's own numbers (slow 1,
  normal 2, fast 4, faster 8). **I kept a single tap at exactly one tile** (the owner's description
  says a hold "starts at normal"): the first repeat a terminal sends after its repeat delay is also one
  tile, and the 2-tile steps begin with the fast repeats after it. Terminals send no key-up, so
  "held" is read from how close together the key's repeats arrive (`src/build/motion.ts`, a pure
  function of the key and the time; the session holds one beside the reducer). The reducer only ever
  sees an ordinary `move-cursor` of the size chosen.
- **The scroll margin is 20% of the view**, of its width for the sides and its height for the top and
  bottom — 10 tiles sideways and 3 up and down at 80x24, 14 and 5 at the largest view. `--scroll-margin`
  now takes a percentage (`25` or `25%`).
- **With a building armed, a click never scrolls the view** (Q58, option B). The first click moves the
  cursor and the preview there; the second click on the same spot is the same tile and places.
- **Exploring, a click near an edge scrolls, further the nearer the edge** (feedback F6). Each edge
  has a zone a third of the view deep; a click in it carries the clicked tile toward the middle by how
  deep into the zone it landed — at the very edge all the way to the middle, at the zone's inner
  boundary not at all. Two columns from the edge scrolls 19 tiles; eight columns in, 8; the middle, 0.
- **The fast move re-centres the view** on the cursor along the axis it moved, rather than dragging
  it to the margin (engine.md's "recentring").
- **The view slides** to its new position over 150 ms, a few frames, fast at first and settling at the
  end — whole tiles at a time. State, commands and scripted playtests all use the camera's target; only
  what is drawn slides. **A click during a slide lands on the tile drawn under the pointer** (the
  session is handed the drawn camera for the mouse).
- **The screen's first frame timer** runs only while something is moving — a slide, a menu row's
  flash, the refused flash — and stops; an idle screen draws once per input as it always did.
- **A refused placement flashes** the whole footprint solid in the status line's red for 250 ms, so an
  eye on the map sees it did not build. Moving off the tile ends the flash.
- **A lone Esc waits 50 ms** for the rest of a key sequence before it counts as Esc, so an arrow or an
  Option+Arrow split across two reads (a slow link) is still one key. And **Esc then a letter or digit
  in one read is now two keys** (only `ESC b`, `ESC f` and `ESC DEL` — Option+Left/Right/Backspace on a
  Mac — stay one). Esc then an arrow in one read is still Option+Arrow, necessarily (Section 7).
- **Debug Mode scrolls.** It has twenty flags now; at 80x24 it shows five at a time, keeps the
  highlighted one in view, and says `^ 4 more` / `v 11 more` above and below. A click on either line,
  or the wheel over the popup, scrolls it.

The new Debug Mode flags, all applying at once:

| Flag | Values | Starts at | The question it serves |
| --- | --- | --- | --- |
| Scroll margin | 0-40% in 5s | 20% (was 3 tiles) | How near the edge before the map scrolls (Q54) |
| Explore click | edges / centres / margin | edges | What a click does to the view with nothing armed (F6; new question, Section 9) |
| Click edge zone | 15, 20, 25, 33, 40, 50% | 33% | How deep the zones where a click scrolls are (F6) |
| Armed click scrolls | off / on | off | May a click scroll the view with a building armed? (Q58) |
| View slide | off, 50, 100, 150, 200, 300, 500 ms | 150 ms | How long the view takes to slide |
| Fast move centres | on / off | on | Does the fast move bring the view along with the cursor? |
| Slow step | 1-3 tiles | 1 | A tap, and a held arrow after a turn (Q54) |
| Normal step | 1-4 tiles | 2 | Each repeat of a held arrow at first (Q54) |
| Fast step | 2-8 tiles | 4 | Each repeat once held for "Held to go fast" (Q54) |
| Shift step | 3-16 tiles | 8 (was 5) | Shift/Option/PageUp/Home (Q54) |
| Held to go fast | 0-1200 ms | 300 ms | How long before normal becomes fast (Q54) |
| Repeat gap | 50-300 ms | 120 ms | How close two presses must be to count as holding (Q54) |
| Repeat delay | 250-1500 ms | 700 ms | The terminal's pause before it repeats; another arrow within it is a turn (Q54) |
| Slow after a turn | on / off | on | Does a change of direction drop to the slow step? (Q54) |
| Refused cursor | off, 100-600 ms | 250 ms | How long a refused placement flashes |
| Esc timeout | off, 10-200 ms | 50 ms | How long a lone Esc waits for the rest of a key |

Gate 5G's five (smart cursor, opens on, pressed flash, refused flicker, and the margin above) are
unchanged, listed after these.

Where the code is:

- `src/build/motion.ts` (new): the speed ramp — `rampStep`, pure, and `SpeedRamp`, what the session
  holds.
- `src/build/camera.ts`: `marginForView` / `shareOfSpan` (the share margin, capped so the two sides
  never meet), `centreOn` (recentring) and `edgeClickCamera` (F6's proportional zones).
- `src/build/state.ts`: the margin read as a share; a `move-cursor` marked `fast` recentres; a
  `click-tile` stays still when armed, or scrolls by zone or centres when exploring; a refused place
  records `refusedTry` with a sequence number, the way `ack` does.
- `src/build/keyboard.ts`: `cursorKeyOf` classifies a cursor key (plain arrow, or the fast move); the
  fast move is Debug Mode's "Shift step" long and marked `fast`.
- `src/build/session.ts`: `handleKey`/`handleData` take an optional `{ now, camera }` — the key's
  arrival time (for the ramp) and the drawn camera (for the mouse). Without a time, every arrow is a
  tap, so driver scripts and every test that sends keys without a clock are unchanged.
- `src/build/overlay.ts`: a scrolling list in the one popup shape — `OverlayScroll`, a `more` row
  kind, and `scrollWindow`, derived from the highlight alone so the reducer never needs the popup's
  height.
- `src/build/debug.ts`: the sixteen new flags and their questions; gate 5H's first in the list.
- `src/build/mouse.ts`: the wheel walks a popup's list.
- `src/view/build-live.ts` (new): `BuildAnimation` — the slide, the menu flash and the refused flash as
  pure functions of the state and a time — and `nextFrameDelay`, the frame timer's rule.
- `src/view/key-reader.ts` (new): `KeyReader`, the lone-Esc timeout; `src/view/playback.ts`:
  `incompleteEscapeAt`, and `ESC` + a printable key splits unless it is a bound Meta key.
- `src/view/build.ts`: draws through an optional `camera` (the slide) and an optional `refusedFlash`.
- `src/cli/spike.ts`: the one clock; the frame timer; the Esc timer; `now` is injectable.
- `src/playtest/*`, `scripts/playtest.mjs`: `Name~MS` in key scripts for timed keys; each step's
  cursor and speed tier in the summary.
- `scripts/capture-spike-screenshots.mjs`: six new shots, a `slideGif` that steps `BuildAnimation`
  with a fake clock, and the old shots moved to the new flag order and step sizes.
- `scripts/lib/terminal-capture.mjs`: tmux capture keeps trailing spaces (Section 7).
- `docs/system-design/ui-patterns.md` (scrolling popups; a new "moving around the map" section), `DEVELOPMENT.md`,
  `.claude/skills/playtest/SKILL.md`.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` (both tsconfigs) | pass | no output |
| `npm test` (Node) | **476 / 476 pass** (453 before; +19 movement, +1 each architecture, Debug Mode scrolling, armed click, split-arrow lifecycle) | `tests/build-motion.test.ts` and the others named |
| `npm run test:bun` | **476 pass, 0 fail**, all 38 files | `bun: all test files passed` |
| Speed ramp against an injected clock | tap 1; press, repeat delay, then 1, 1, 2 ... 2, 4 ... after 300 ms held; taps 200 ms apart never speed up; a turn holds at 1 through the repeat delay and until let go; Shift 8 at once; any other key resets | `tests/build-motion.test.ts` |
| Untimed keys are taps | 10 untimed Rights move 10 tiles; timed taps a second apart reach the identical state and frame as untimed keys | `tests/build-motion.test.ts` |
| Share margin | 20% is 10 x 3 tiles at 48 x 16, 14 x 5 at 72 x 24; capped below the middle; the camera first moves 10 tiles from the east edge | `tests/build-motion.test.ts`, `tests/build-spike.test.ts` |
| Armed click never scrolls (Q58) | camera unchanged, second click on the same screen spot places, in all three explore modes; with the flag on, the old camera-shifted-click guarantee still holds | `tests/build-motion.test.ts`, `tests/build-spike.test.ts` |
| Exploring click (F6) | 2 columns from the edge scrolls further than 5; the middle does not; the very edge centres the tile; `centres` and `margin` modes as described | `tests/build-motion.test.ts` |
| Slide, frame timer, refused flash | a slide passes through whole-tile cameras between start and target and ends at the ease time with `busyUntil` null; ease 0 jumps; the live screen drew more than 3 frames during a slide and none while idle, before and after | `tests/build-motion.test.ts` |
| Click during a slide | lands on the tile under the drawn camera | `tests/build-motion.test.ts` |
| Esc timeout | lone Esc held, then Esc; `ESC` + `[A` within the timeout is one Up; `ESC ESC` + `[A` is Option+Up; too late is Esc then the key; a split mouse report is rejoined; timeout 0 holds nothing; `ESC 1` is two keys; live: `ESC` then `[A` in the next read moved the cursor up one | `tests/build-motion.test.ts`, `tests/build-lifecycle.test.ts` |
| Debug Mode scrolls | every flag reachable and in view at 80x24, 104x32, 128x24; the cue counts are right at both ends; a click on the cue and the wheel scroll it; the keys/clicks/driver debug flow is identical in state and frame | `tests/build-debug.test.ts` |
| Every "same plan, every adapter" test | pass (one moved its targets off the new, wider margin — Section 7) | `tests/build-spike.test.ts`, `tests/build-nexus.test.ts`, `tests/build-focus.test.ts`, `tests/build-debug.test.ts` |
| `src/build` names no clock; `build-live`, `key-reader`, `motion` name no clock | pass | `tests/architecture.test.ts` |
| `bun scripts/build-web.mjs` | `wrote dist/terminal-nexus-playtest.html: 150 KB, 81 source files` | build output |
| `./scripts/check-repository.sh` | pass | validator output |

Measurements: none new. The only timing numbers are the flags' starting values, which are guesses for
the owner to tune, not measurements.

## 5. Human observations

Nobody but this session has looked at it yet. What this session saw, in the pictures and the per-step
playtest summaries:

- A scripted hold (`e Right Right~400 Right~30*14 ...`) moved 1, 1, then 2 a step for ten repeats,
  then 4 a step; the Left straight after moved 1 a step through the repeat delay and after it; Shift
  moved 8 (`build-held-arrow.gif`).
- An armed click two tiles inside the new margin left the view exactly where it was, with the preview
  at the clicked tile; the second click placed (`build-armed-click-still.gif`).
- Exploring clicks at 2, 8 and 24 columns from the east edge scrolled the view 19, 8 and 0 tiles
  (`build-explore-edge-click.gif`).
- The slide, drawn at the live loop's own frame interval, takes about ten frames and visibly settles
  at the end (`build-view-slide.gif`).
- The refused flash is a solid red block over the `x` preview, next to the red status line
  (`build-refused-flash.png`).
- Debug Mode at 80x24 shows five flags with `^ 4 more` / `v 11 more` (`build-debug-scrolled.png`).
- A real-terminal shot scrolled to the Grid's south edge showed no solid bar — a screenshot-tool bug,
  fixed (Section 7).

**For Mario:** hold an arrow on the map, and tap it; overshoot and come back; click near each edge
while exploring, and place a building by two clicks near an edge. Then press `d` and try the flags in
Section 9's asks.

## 6. Interpretation

- **Timing never enters the reducer.** Every timed thing is a pure function of the state and a number
  (`motion.ts`, `build-live.ts`, `key-reader.ts`), and the live loop is the only place a clock is read.
  That is what let every timing claim be tested without waiting, and it keeps a driver script a
  replay: an untimed key is a tap, exactly as before.
- **A tap stays one tile.** Precise placement is the common case on a Build Phase screen, and the
  owner's "starts at normal" still holds for a hold: the 2-tile steps start with the repeats. Setting
  "Slow step" to 2 gives the literal reading if he prefers it.
- **Why two repeat timings, not one.** Terminals repeat a held key only after a delay of a few hundred
  milliseconds, then quickly. A single "presses this close are a hold" threshold small enough to tell
  a hold from quick taps (120 ms) cannot also span the repeat delay — so a slow-after-a-turn hold would
  end the moment the terminal paused before repeating. The second number, the repeat delay, is what
  lets it survive, and doubles as the definition of a turn (a different arrow within it).
- **The margin change is mostly sideways.** 20% of 16 rows is 3 — the old number — so at 80x24 the
  owner's change is felt only left and right (3 tiles to 10). At 104x32 it is 14 and 5.
- **"The same plan by every adapter" now means the same plan, not always the same camera.** Q58's
  answer makes the mouse deliberately leave the camera still where arrows would scroll it. Wherever a
  click lands outside the margin, keys and clicks still reach identical states and frames; inside it,
  identical plans and cursors with different cameras, by design.
- **Exploring click: proportional by default.** The canon's guidance says an unarmed click recentres;
  the owner's later F6 feedback asks for proportional scrolling with bigger zones. The proportional
  rule contains recentring (a click at the very edge centres the tile) and does nothing in the middle,
  where a click is usually to inspect. Both, and the old behaviour, are one flag apart.

## 7. Failures, surprises, and discarded approaches

- **The Esc timeout could not fix what it was scheduled to fix.** The trap in gate 5F's report is Esc
  and the next key arriving *in the same read*; a timeout only helps across reads, since there is no
  timing inside one read. What fixes the same-read case is narrower splitting: `ESC` + a printable
  character is now one key only for `b`, `f` and DEL (the Mac's Option+Left/Right/Backspace), so Esc
  then `1` is two keys. **Esc then an arrow in one read is still Option+Arrow** — that is exactly what
  a Mac sends for it — so anything sending keys programmatically must leave a pause after an Esc (the
  tmux screenshot script already does, one key per call). The timeout itself fixes the other direction:
  an arrow, an Option+Arrow or a mouse report split across two reads.
- **The terminal's repeat delay broke the first ramp design.** With one gap threshold, the terminal's
  first repeat (hundreds of ms after the press) read as a new press, which ended every
  slow-after-a-turn hold before it began. Found by writing the turn test; fixed with the second timing
  (Section 6).
- **Two "same plan, every adapter" tests failed on the wider margin.** Their click targets fell inside
  the new 10-tile margin, where an armed click no longer scrolls; one test's keyboard path scrolled the
  camera a row and its click path did not. The plan was identical. One test moved its targets a row up,
  out of the margin, and still compares state and frame whole; the other compares everything but the
  camera; a new test asserts the difference on purpose.
- **Real-terminal screenshots dropped the solid map edge along the bottom.** `tmux capture-pane`
  trims trailing spaces, and a solid bar is inverse-video spaces at the end of a line. Only visible
  once a live shot reached the Grid's south edge (the Shift step going from 5 to 8 took it there).
  `-N` keeps them (`scripts/lib/terminal-capture.mjs`); the game was never wrong.
- **Debug Mode tests walked the list by counting Downs**, so moving the flags broke them all. They now
  walk to a flag by name (`goTo`, and `wheelTo` for the mouse), which survives the next flag too.
- **`--scroll-margin` changed meaning**, from tiles to a percentage: an old note saying
  `--scroll-margin 3` now means 3% (about one tile). The help text says so.
- **Kept, not changed: the mouse wheel still moves 5 tiles**, not the Shift step. It is "the mouse's
  Shift+Arrow" in the canon's words, but a trackpad sends wheel events in bursts, and 8 a notch felt
  like a guess too far without anyone having tried it. Registered below as a small question.
- **Discarded: a separate "turn window" timing.** It would have been a fourth timing flag; the
  terminal's repeat delay already says how long a pause means "stopped".
- **Discarded: easing in sub-tile steps.** A terminal cell cannot be half-scrolled; the slide moves
  whole tiles, rounded from an ease-out curve.
- **Not done: "moving away from where slow began" as a way out of the slow hold** (the owner's
  description). The slow hold ends when the arrow is let go or any other key is pressed; a distance
  limit would be one more number, and holding the corrected arrow at one tile a step is what the old
  screen did anyway. Worth asking once he has felt it.

## 8. Decision

> **PASS**

Every item in gate 5H's definition of done is built, connected end to end in the live terminal loop
and on the browser page, and tested against an injected clock; the reducer still has no clock, and
keyboard, mouse and driver still reach the same plan. What is left is the owner's feel: every number
is a Debug Mode flag with his own numbers or a stated guess as its starting value.

## 9. Canon impact

Proposed by the building session and applied by the orchestrating session at canon 2.23, all as
GUIDANCE (the owner asked to keep going before looking; each number stays a Debug Mode flag he can
change). The popup-scrolling rule is in `docs/system-design/ui-patterns.md`, not yet in `engine.md` 9.2.

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| The scroll margin is a share of the view per axis (20% to start), capped below the middle; a follow rule as before | `engine.md` 3.3 (GUIDANCE for the number) | this gate |
| Cursor speed is decided in the input path from key timing; the reducer sees distances; a tap is one tile | `engine.md` 3.3 / 9.7 | this gate |
| An armed click never scrolls the view (Q58, B) | `engine.md` 9.7, mouse row | this gate; owner's decision recorded by the orchestrator |
| Exploring, a click near an edge scrolls in proportion to its depth into an edge zone | `engine.md` 9.7 | F6; this gate |
| The drawn camera eases; state and commands use the target; the mouse hit-tests the drawn camera | `engine.md` 3.3 / 9.1 | this gate |
| A lone Esc at the end of a read waits a short timeout; `ESC` + printable is one key only for bound Meta keys | `engine.md` 9.7 | this gate |
| A popup list longer than the popup scrolls with a visible "more" cue | `engine.md` 9.2 (popup shape) | this gate |

Questions raised (for the orchestrator to register):

| ID | Question | Recommendation |
| --- | --- | --- |
| Q62 | What does a click on the map do to the view with nothing armed: scroll by how near the edge it is, always centre, or only the margin? | Proportional edges (built as the default); it contains recentring at the very edge and leaves a click in the middle alone |
| Q63 | Should the mouse wheel move the Shift step (8) rather than 5? | Keep 5 until the owner has tried the wheel on his trackpad; a flag is cheap if he wants to compare |

## 10. Next authorized action

The owner feels the flags and says which numbers stay. At his 2026-09-28 "keep going", the
orchestrating session goes on to the "placement juice" gate without waiting for that look.
