---
name: grid-screenshots
description: Run `grid` (the Terminal Nexus engine/editor/replay tool) on a real terminal and capture PNG screenshots of the ASCII view. Use when judging how the composition looks, comparing render tiers, glyph packs, effects on and off, or reduced motion, or when a change touches src/view and someone should see it rather than read a frame as text.
---

# Screenshotting `grid`

The tests assert what a frame *contains*; this is how you look at how it **looks**. What the
pipeline is and why (tmux, a real PTY, Chromium as the renderer) is in
[`DEVELOPMENT.md`](../../../DEVELOPMENT.md) section 3.

**For the Build Phase screen, use the `playtest` skill first** (`scripts/playtest.mjs`): it presses
keys without a terminal and renders frames composed in-process, so a picture can never be captured one
key early, and it makes GIFs. This skill's tmux pipeline is for `grid` battles, the menu, and the few
shots whose subject is the real terminal path itself (startup, resize, real modified-key and mouse
bytes).

## The two-speed rule

Iterate in text, confirm in pixels. A text frame costs nothing and answers most questions:

```bash
node -e '
const tl = await import("./src/cli/timeline.ts")
const sc = await import("./src/scenario/index.ts")
const v  = await import("./src/view/index.ts")
const scenario = await sc.loadMapFile("scenarios/citizens-versus-ravels.map.json")
const loaded = sc.loadScenario(scenario)
const timeline = tl.buildTimeline(scenario, loaded.state, loaded.registry, scenario.pulseTicks, scenario.seed)
const view = v.createView(timeline, { ...v.DEFAULT_PRESENTATION, glyphPack: "unicode" })
console.log(v.frameToText(view.snapshotAt(178 * 1000 / 12 + 40, "truecolor")))
'
```

Screenshots are for colour, for the final judgement, and for showing someone. They are expensive to
look at — take few, and make each one answer a question.

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
`name`, `caption`, `scenario`, `tick`, `cols`, `rows`, and optionally `capability`, `glyphs`,
`theme`, `effects`, `reducedMotion`, and `expectGate` (true for a shot of a terminal too small
for the composition, where playback freezes behind the too-small notice).

**The tick is exact.** The script pauses the session and steps to the tick you asked for, so a
screenshot lands where you meant rather than wherever the wall clock reached. Find the tick worth
shooting from the log first:

```bash
./bin/grid.ts scenarios/ravel-cascade --headless | grep -E "blast|death"
```

## Driving it by hand

```bash
tmux new-session -d -s nexus -x 80 -y 24 './bin/grid.ts scenarios/ravel-cascade'
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

1. **The worst frame first** ([`effects.md`](../../../docs/system-design/effects.md) craft rule 1). Late in a battle, both armies engaged,
   several effects overlapping — `ravel-cascade` at the tick the chain runs. If that reads, the calm
   frames will. Designing the calm frame first guarantees a beautiful opening and an unreadable
   climax.
2. **Monochrome.** It is the acceptance floor, not the degraded mode. If you cannot follow who moved,
   who shot whom, and who died without colour, the frame is not finished.
3. **Round on screen.** A tile is one column, a cell about twice as tall as it is wide, and a row counts
   two columns in every distance, so whatever the rules measure — a blast, an aura, a reach — looks as
   wide as it is tall. A shape that looks twice as tall as it is wide is being drawn by some other
   measure than the rules' (`src/grid/reach.ts` is the rules' own).
4. **Effects off** (`--no-effects`). If the fight is unreadable without them, the effects are
   carrying a cue they are not allowed to carry alone.
5. **Reduced motion.** Causality must survive it: you must still be able to tell what hit what.

## Watching it yourself

```bash
./bin/grid.ts scenarios/citizens-versus-ravels --glyphs unicode --capability truecolor
./bin/grid.ts scenarios/ravel-cascade --capability monochrome --speed 0.5
./bin/grid.ts scenarios/citizens-versus-ravels --reduced-motion
```
