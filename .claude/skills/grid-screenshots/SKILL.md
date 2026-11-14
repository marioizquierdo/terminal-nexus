---
name: grid-screenshots
description: Screenshots of `grid`'s ASCII view on a real terminal (tmux, PNG): judge how a composition looks, compare render tiers, glyph packs, effects on and off, or reduced motion. Use when a change touches src/view, or when a battle's look, not its text frame, is the question.
---

# Screenshotting `grid`

The tests assert what a frame *contains*; this is how you look at how it **looks**. The pipeline (tmux, a real PTY,
Chromium as the renderer) is described in [`DEVELOPMENT.md`](../../../DEVELOPMENT.md), "Seeing a change".

The Build Phase screen belongs to the `playtest` skill (`scripts/playtest.mjs`): it renders frames in-process, so a
picture can never be captured one key early, and it makes GIFs. This skill's tmux pipeline is for `grid` battles, the
menu, and the shots whose subject is the real terminal path itself (startup, resize, real modified-key and mouse
bytes).

## The two-speed rule

Iterate in text, confirm in pixels. A text frame costs nothing and answers most questions:

```bash
node -e '
const tl = await import("./src/cli/timeline.ts")
const op = await import("./src/skirmish/opening/index.ts")
const ts = await import("./src/skirmish/sandboxes.ts")
const v  = await import("./src/view/index.ts")
const opening = await ts.loadSandbox("citizens-versus-ravels")
const loaded = op.openBattle(opening)
const timeline = tl.buildTimeline(opening, loaded.state, loaded.registry, opening.pulseTicks, opening.seed)
const view = v.createView(timeline, { ...v.DEFAULT_PRESENTATION, glyphPack: "unicode" })
console.log(v.frameToText(view.snapshotAt(178 * 1000 / 12 + 40, "truecolor")))
'
```

Screenshots are for colour, for the final judgement, and for showing someone. Each costs attention to look at, so take
few and let each answer a question.

## Capturing

```bash
node scripts/capture-screenshots.mjs                      # every shot in the list
node scripts/capture-screenshots.mjs --only mirror-melee  # one of them
node scripts/capture-screenshots.mjs --force              # re-render even unchanged shots
```

Output lands in `.playtest/screenshots/` (git-ignored; `--out <folder>` changes it). Chromium is the
one `scripts/lib/terminal-capture.mjs` locates (`CHROMIUM_PATH`, else the newest Playwright
Chromium). Send keys with `sendKey`/`sendKeys` from that file (one tmux call per key, then a short
pause, because an Esc and the next key in one read become one Option+key) and photograph with
`settledPane` after `waitFor` has seen the text the shot is about.

Add a frame worth looking at by editing the `shots` array at the top of the script. Each entry takes
`name`, `caption`, `save` (a sandbox's id), `tick`, `cols`, `rows`, and optionally `colors`, `glyphs`,
`theme`, `effects`, `reducedMotion`, and `expectGate` (true for a shot of a terminal too small
for the composition, where playback freezes behind the too-small notice).

**The tick is exact**: the script pauses the session and steps to the tick you asked for. Find the tick worth shooting
from the log first:

```bash
./bin/grid.ts sandboxes/rules/ravel-cascade --headless | grep -E "blast|death"
```

## Driving it by hand

```bash
tmux new-session -d -s nexus -x 80 -y 24 './bin/grid.ts sandboxes/rules/ravel-cascade'
timeout 10 bash -c 'until tmux capture-pane -t nexus -p | grep -q "TERMINAL NEXUS"; do sleep 0.2; done'
tmux send-keys -t nexus -l ' '          # pause
tmux send-keys -t nexus -l ',,,,,,,,,,' # ten ticks forward
tmux capture-pane -t nexus -p           # plain text
tmux capture-pane -t nexus -e -p        # with colour
tmux send-keys -t nexus -l 'q'; tmux kill-session -t nexus
```

Use `-l` on `send-keys`: without it tmux reads `,` and `[` as key names.

| Key | Does |
| --- | --- |
| `space` | pause and resume |
| `.` `,` | step one frame, step one tick |
| `[` `]` | slower, faster |
| `r` | restart from tick 0 |
| `q` | quit, restoring the terminal |

## What to look at, and in what order

Done when the worst frame has passed all five checks.

1. **The worst frame first** ([`effects.md`](../../../docs/system-design/effects.md), "Craft rules"): late in a battle,
   both armies engaged, several effects overlapping (`ravel-cascade` at the tick the chain runs). If that reads, the
   calm frames will.
2. **Monochrome.** It is the acceptance floor: every fact must read in it, though it is not the look the
   game is made for. If you cannot follow who moved, who shot whom, and who died without colour, the
   frame is not finished.
3. **Round on screen.** A tile is one column, a cell about twice as tall as it is wide, and a row counts
   two columns in every distance, so whatever the rules measure — a blast, an aura, a reach — looks as
   wide as it is tall. A shape that looks twice as tall as it is wide is being drawn by some other
   measure than the rules' (`src/grid/reach.ts` is the rules' own).
4. **Effects off** (`--no-effects`). If the fight is unreadable without them, the effects are
   carrying a cue they are not allowed to carry alone.
5. **Reduced motion.** Causality must survive it: you must still be able to tell what hit what.

## Watching it yourself

```bash
./bin/grid.ts sandboxes/showcase/citizens-versus-ravels --glyphs unicode --colors truecolor
./bin/grid.ts sandboxes/rules/ravel-cascade --colors monochrome --speed 0.5
./bin/grid.ts sandboxes/showcase/citizens-versus-ravels --reduced-motion
```
