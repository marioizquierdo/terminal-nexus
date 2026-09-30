# Terminal Nexus — next steps and carry-over

**Document role:** The queue: what waits on Mario, what comes next, and the small work that has piled up beside the milestones
**Status:** WORKING — keep it short; delete an item when it is done, and move a decision into `specs/open-questions.md` when it becomes one
**Updated:** 2026-09-30 (the menu spike's third round, feedback F77-F81 and his third export, on the same pull request; earlier: its second round and a general review, the menu spike, Milestone 5 accepted and gate 6A)
**License:** Apache-2.0

Milestones say what the game must become (`milestones/`); this says what is waiting *right now*, and
the cleanup that does not belong to any gate.

## 1. Waiting on Mario

- **Gate 6A's ending, in words.** His 2026-09-30 export settled its timings (the walk home waits
  500 ms and takes a second, a heavy raid, no units of his own), and they are the defaults now; what
  he has not said is whether the flashing timer and the light round the border read as anticipation
  rather than an alarm, whether the red is rare and faint enough, and whether the result is clear
  without being told.
- **Run the key-release probe in iTerm2.** `node scripts/probe-key-release.mjs`, hold an arrow, let it
  go, tap it, `q`. If the lines say `release`, the Key releases Experiment's `auto` reads them there;
  if they say `legacy`, `auto` and `off` feel the same in iTerm2 (section 4).
- **One question:** was "press `b`" an example of a key or a request for letter hotkeys? (Q67.)
- **One more:** should the player ever read the word "Pulse"? The start screen says Battle Round; the menu
  row and the running screen still say Pulse (Q68). The menu spike did not change the words, since he
  did not ask; his list of actions said "Start next battle round".
- **Play the menu spike's third round** (the same pull request; `evidence/menu-spike-report.md`):
  taps that speed up only when asked (the third quick tap moves 2, three more move 4), a held arrow at
  a steady pace, the scroll bar's textured thumb, and the Battle Round screen breathing. Press `d`:
  **Hold window** (200 ms), **Key releases** (auto / off — the comparison he asked for; the probe below
  says whether his iTerm2 answers at all), **Battle Round pulse** (2000 ms), and the placeholder
  Pulse's **Raid** and **Your units**. The breath shows only at 256 colours or millions (his settings
  have millions). Then the dedicated navigation session (section 4).

## 2. The next gate: 6B — the loop back into the next Build Phase

Milestone 6 (`milestones/milestone-06-pulse-phase.md`) has three gates: **6A** start, end, Recall
(built, awaiting his playtest); **6B** the loop back into the next Build Phase, and the trigger
runner's simulation band; **6C** minimal automatic production. **6B waits for his word** — he has
tested several merged gates together before, so it is likely to come with the 6A export. Take one gate
per session.

**A prompt to start 6B in a fresh session** (edit the first paragraph to match what he said):

```text
Read CLAUDE.md and follow AGENTS.md.

Mario has played gate 6A (the Nexus Pulse from p, y to a result) and merged it. Treat this message as
his word that 6A is accepted and that 6B is the Active gate. Record that first, as its own commit.
If he pasted a settings export, settle each Experiment it answers before anything else.

Then orient: run ./scripts/check-repository.sh; read milestones/milestone-06-pulse-phase.md,
docs/next-steps.md, docs/ui-patterns.md (sections 0 and 14) and evidence/gate-6a-report.md (its
sections 7 and 9 are the carry-over).

Take gate 6B only — the loop: after Recall, the next Build Phase, until the mission's triggers end it;
the trigger runner's simulation band (spawn, order, commitPlan, win, lose) as validated data;
PERIMETER's three waves as the fixture; Q36 resolved or deferred with a reason. The kernel is
Milestone 1's; a change to it is a finding, not an assumption. End with a gate report and a pull
request written with the pr-description skill. Do not start 6C.
```

## 3. Carry-over (small, none blocking)

**From gate 6A** (the Nexus Pulse on screen; `evidence/gate-6a-report.md` sections 7 and 9 have the reasons):

- **The spike's Pulse is placeholder data.** Five units of yours at one muster point, a raid of seven
  at the far edge, a 30-second limit, one seed (`spikePulse` in `src/build/catalog.ts`); the Raid and
  Your units Experiments size them. PERIMETER's real map, units and waves are 6B's, and those two
  Experiments are deleted then.
- **The Barracks trains nothing yet** — its own blurb says "trains troopers each Pulse", and the kernel
  has no production until 6C.
- **Only the player's survivors walk home.** Recall regroups every survivor by the rule in
  `engine.md` Section 5, but the raid has no producer and no Nexus in the spike, so its survivors stay
  where they stood — visible in a lost Pulse. What a raid's leftovers do between Pulses is a 6B
  question once there are several.
- **The walk home is a straight glide** over whole tiles, with no routing; it may cross rock, which a
  two-second flourish can afford.
- **No live numbers on the map cursor during a Pulse** (Explore Map's card is the Build Phase's), and
  the enemy's opening force is visible in the Build Phase — hiding it (player projection) is later work.
- **Watch again** replays a Pulse that was already resolved; it cannot, and must not, resolve a new one.

**From the Build Phase:**

- **The map's own Barracks sits right of the first free spot**, so arming a second Barracks goes below
  it and the third continues to the right. That is content, not the rule; a different starter map
  would not show it.
- **The restart-needed message has no live trigger**: no Experiment needs a restart today. The
  detection is tested with a test-only list; when the first restart-only Experiment appears, play it.
- **Q62, Q63, Q64** are still open and observable (the exploring click, the wheel step, the light
  theme's light). Ask him when he has an export.
- **A Settings restart with buildings planned throws removal sparks** over each; harmless, and arguably
  right, but the live loop cannot tell a restart from an undo.

**From the menu spike** (`evidence/menu-spike-report.md` section 7 has the reasons):

- **The Controls page is written by hand** (`controlsPage` in `src/build/help.ts`). A new key needs a
  line there as well as in `src/build/keyboard.ts`; a test holds every bracketed key a *hint* names to a
  real binding, but the page's own lines are checked by eye.
- **The focus arrow on a shallow diagonal** steps a row every few columns, a comet of `-` with a `\` at
  each step; in Unicode `━` and `╲`. Worth his eye along with the Experiment.
- **The card while placing shows what is being built, never what is under the cursor**; a player who
  wants to read a building on the map while placing presses Esc, then `e`.

**From the menu spike's second round** (`evidence/menu-spike-report.md` section 7 has the reasons):

- **Three same-state tests click tiles chosen outside the click's edge zones** (build-spike,
  build-nexus, build-experiments): if the owner changes the click edge zone, those tiles need moving.
- **The committed plan's fallback panel still prints `[esc] menu`**, key first, beside the top bar's
  own `menu [esc]`; it only shows when no Pulse can start. Removing the line is one edit.
- **The title screen's menu does not speed up when held** — it stops at its ends and jumps, but has no
  clock of its own to time a held key by, and only four rows.

## 4. Navigation and key releases

### Polish navigation in a session of its own

The owner asked for this note (third round, 2026-09-30, F79: "Just do some changes here, and add a note
that we need to come back to polish navigation again on another dedicated session").

**Built in the third round**, on the map cursor and in every Build Phase list alike (`src/build/motion.ts`;
the reducer still sees only ordinary `move-cursor` and `highlight` commands):

- **Taps speed up by counting.** Taps of one arrow each within `doubleTapMs` of the one before are a run
  that keeps its speed; the third tap since the speed last changed (or the run began), if it came within
  `fastTapMs`, doubles it: 1, 1, 2 — then 2, 2, 4 — and 4 is the top. A slower gap, another arrow or any
  other key starts over at 1. *Reading taken:* the second doubling uses the first one's rule (three taps,
  the last quick); his words could also mean three double taps of any pace — one line in `moveStep` if so.
- **A hold runs at the game's own cadence**: at most one move per `holdMoveMs` (on average exactly that
  when the keyboard repeats faster), `holdFirstStep` a move, `holdLongStep` once it has repeated for
  `holdLongMs`. A hold breaks a run of taps, so the tap after it is one tile. The fast move is unchanged.
- **How a repeat is told from a tap**: with key events the terminal says so; without, a press within the
  hold window (the Experiment, 200 ms by default) of the one before is a repeat.
- **Key releases (auto / off)**, applied at once: on `auto` the Build Phase asks the terminal for the kitty
  keyboard protocol, pushes its flags if it answers and pops them on every way out through the one
  disposer (tested: `q q`, Ctrl+C in both forms, Esc then `q`, SIGINT, SIGTERM, a render failure, a
  setup failure). With it on, Esc arrives whole and needs no wait. The browser page plays such a
  terminal from `keydown`/`keyup`. Scripts can send `Right/repeat`, `Right/release`; the playtest
  summary prints each move (`tap 2`, `hold 0`).

**First guesses** (`src/build/tuning.ts`): his own numbers — `doubleTapMs`, `fastTapMs`,
`tapsToSpeedUp`, `tapTopStep` — and the hold cadence, which is ours: `holdMoveMs`, `holdFirstStep`,
`holdLongStep`, `holdLongMs`. The hold window's 200 is his "I would try".

**Measure first**, in his iTerm2: `node scripts/probe-key-release.mjs`. Does it answer the kitty query,
and do held keys say `repeat` then `release`? What are his keyboard's repeat delay and interval (the
`+N ms` column while holding)? Then play with Key releases `auto` and `off` and compare. tmux and SSH may
not pass the protocol through — measure, do not assume.

**Left for that session:**

- Tune the hold cadence to his feel — make its four numbers Experiments for the session if he wants to
  turn them live.
- A learned hold window (tier 2 below): measure the first held run's repeat gap and set the window from
  it, rather than a fixed 200 ms.
- With key events, a hold still waits for the operating system's first repeat before moving on the
  cadence. A timer of the game's own in the live loop could start it sooner and stop at the release —
  with a safety stop for a release that never comes.
- Without the protocol a lone Esc still waits a moment (`escTimeoutMs`); Windows Terminal's win32-input-mode is not read;
  the title screen's menu has no timing at all; the page's hidden typing field sends no releases.
- A terminal that answers the question after a very quick quit would print its answer into the shell —
  not seen, not guarded.

### The design

The decision is `specs/open-questions.md` Q66; this is the working design. Principle: **the plain path
always works; a host that offers more makes it better.**

- **Tier 1 (floor).** Every move is also one key (tap = 1 tile, Shift/PageUp/PageDown = 12), so no hold
  is ever required. True today.
- **Tier 2 (timing; the terminal today).** Keep the ramp. Replace the hand-tuned "Hold window" default
  with **a learned one**: on the first held run, measure the gap between repeats, keep the median, and
  set the window to about twice it, so a slow OS repeat delay stops turning a hold's first repeat into
  a tap. Keep the Experiment as an override. Treat "nothing for the window" as the release.
- **Tier 3 (releases).** When the host reports them, a press moves exactly one tile; a hold is press
  … release and runs on the game's **own repeat cadence** (a fixed interval and the 1 → 2 → 4 curve),
  ignoring the OS repeat entirely. This is "regular 1 block intervals" for taps and a steady, tunable
  speed for holds.
- **Detecting a host.** Terminal: send the kitty query (`CSI ? u`) followed by Device Attributes
  (`CSI c`, which every terminal answers), so "answered the second, not the first" means no protocol.
  If supported, push flags with `CSI > 3 u` (disambiguate + report event types) and **pop them on every
  exit path** through the one disposer (`q`, `SIGINT`, `SIGTERM`, a crash) — leaving a terminal in
  that mode is the failure to avoid. Browser: `keydown`/`keyup`, always. Windows Terminal:
  win32-input-mode. `scripts/probe-key-release.mjs` already does the query and prints every event.
- **What it costs elsewhere.** With the protocol on, keys arrive as `CSI … u`, so the decoder learns a
  second form (and a lone Esc stops needing its 100 ms wait, which also ends the Esc-versus-Option
  ambiguity). `tmux`, `screen` and SSH hops may not pass it through — measure, do not assume.
- **Parity.** The reducer still gets `move-cursor` commands; only the input path changes. A test feeds
  the same intent as timed presses and as press/release events and asserts the same positions.
- **Ship it behind an Experiment** ("Key releases": auto | off) so Mario can compare, and after the
  input event with a `phase` exists (`docs/portability.md`, item 1) — that seam is the real work.

## 5. Cleanup and refactor queue

| Item | Why | Size |
| --- | --- | --- |
| Compact `AGENTS.md` Section 2's per-gate paragraphs into two lines each plus a link | It is ~130 lines every session reads first; the detail lives in the tracker and the gate reports | **due now — Milestone 5 was accepted 2026-09-29**; its own small pull request, since a docs-only diff is easy to review |
| Screenshot flows set Experiments with `--settings`, not "Down*6" | Every added or removed Experiment shifts a count (three recounts this round) | a morning; only the flows that set a value, not the ones that show the popup |
| A `ScreenHost` interface and an `InputEvent` with `phase` | Fewer TTY fakes, real key releases, gamepad and touch-hold | see `docs/portability.md` section 4 |
| One launch-options module for the command line and `#settings=` / `#keys=` | A new option can reach one and not the other | small |
| A host-conformance test: run a key script through the terminal path and the page (headless Chromium) and compare frames | Turns the by-hand check we did into a test | small to medium |

## 6. Not measured yet (so not claimed)

- iTerm2: key releases (the probe), Option and Esc handling as measured in gate 5A's table, OSC 52
  clipboard once "Applications in terminal may access clipboard" is on.
- Any terminal but iTerm2 and tmux: WezTerm, Ghostty, kitty, Alacritty, Windows Terminal, GNOME/VTE.
- The playtest page on a real phone and on an iPad with a hardware keyboard (Esc, Option).
- The thin map-edge glyphs on a terminal font that lacks box-drawing weights.
