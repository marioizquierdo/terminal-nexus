# Terminal Nexus — next steps and carry-over

**Document role:** The queue: what waits on Mario, what comes next, and the small work that has piled up beside the milestones
**Status:** WORKING — keep it short; delete an item when it is done, and move a decision into `specs/open-questions.md` when it becomes one
**Updated:** 2026-09-29 (after Milestone 5 was accepted and gate 6A, the Nexus Pulse from `p, y` to a result, was built)
**License:** Apache-2.0

Milestones say what the game must become (`milestones/`); this says what is waiting *right now*, and
the cleanup that does not belong to any gate.

## 1. Waiting on Mario

- **Play gate 6A's Nexus Pulse and send an export.** Plan something, press `p`, then `y`, and watch it
  to the result. Then press `d`: the first Experiments now are the ending's own — Alarm lead, Walk-back
  delay, Walk-back time, Centre on Nexus — and the last two are the raid and your units (Raid: none
  is a Pulse nobody comes to, TIME'S UP; Your units: none loses the Nexus). Settings, `e` (Export),
  paste it as a comment; an agent starts the game with `--settings "<text>"` and settles each
  Experiment it answers (`AGENTS.md` Section 2, item 1). The questions for him: does the alarm read
  as anticipation or as noise, is the result clear without being told, and do the timings feel right?
- **Run the key-release probe in iTerm2.** `node scripts/probe-key-release.mjs`, hold an arrow, let it
  go, tap it, `q`. If the lines say `release`, Q66's tier 3 is buildable there (section 4).
- **One question:** was "press `b`" an example of a key or a request for letter hotkeys? (Q67.)

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
docs/next-steps.md, docs/ui-patterns.md (sections 0 and 7c) and evidence/gate-6a-report.md (its
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
- **The status line under a popup mid-Pulse still says "Build committed - N planned."** True, but stale;
  the Pulse's own message returns when the popup closes.
- **No live numbers on the map cursor during a Pulse** (Explore Map's card is the Build Phase's), and
  the enemy's opening force is visible in the Build Phase — hiding it (player projection) is later work.
- **Watch again** replays a Pulse that was already resolved; it cannot, and must not, resolve a new one.

**From the Build Phase:**

- **The map's own Barracks sits right of the first free spot**, so arming a second Barracks goes below
  it and the third continues to the right. That is content, not the rule; a different starter map
  would not show it.
- **The restart-needed message has no live trigger**: no Experiment needs a restart today. The
  detection is tested with a test-only list; when the first restart-only Experiment appears, play it.
- **Explore Map's key help** is `arrows move · e/esc back · shift+arrow fast move · bksp remove`; "tab
  menu" no longer fits at 80 columns. Tab still works.
- **Q62, Q63, Q64** are still open and observable (the exploring click, the wheel step, the light
  theme's light). Ask him when he has an export.
- **A Settings restart with buildings planned throws removal sparks** over each; harmless, and arguably
  right, but the live loop cannot tell a restart from an undo.

## 4. Q66 — key releases, as progressive enhancement

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
| Rename `debug.ts` / `DebugFlags` / `BuildState.debug` / `debug-*` to say "experiments" | Debug Mode became Settings; the code still says debug | ~200 mechanical lines; a pull request of its own so the diff is pure rename |
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
