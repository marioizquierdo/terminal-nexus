---
name: grid-screenshots
description: Run `grid` (the Terminal Nexus engine/editor/replay tool) on a real terminal and capture PNG screenshots of the ASCII view. Use when judging how the composition looks, comparing render tiers, glyph packs, effects on and off, or reduced motion, or when a change touches src/view and someone should see it rather than read a frame as text.
---

# Screenshotting `grid`

The tests assert what a frame *contains*. They say nothing about how it **looks** — spacing,
density, where the eye goes, whether colour helps or clutters. This is how you look at it.

## The two-speed rule

Iterate in text, confirm in pixels. A text frame costs nothing and answers most questions:

```bash
node -e '
const cli = await import("./src/cli/index.ts")
const tl = await import("./src/cli/timeline.ts")
const sc = await import("./src/scenario/index.ts")
const v  = await import("./src/view/index.ts")
const scenario = await cli.importScenario("scenarios/citizens-versus-ravels.ts")
const loaded = sc.loadScenario(scenario)
const timeline = tl.buildTimeline(scenario, loaded.state, loaded.registry, scenario.pulseTicks, scenario.seed)
const view = v.createView(timeline, { ...v.DEFAULT_PRESENTATION, glyphPack: "unicode" })
console.log(v.frameToText(view.snapshotAt(178 * 1000 / 12 + 40, "truecolor", 1)))
'
```

Screenshots are for colour, for the final judgement, and for showing someone. They are expensive to
look at — take few, and make each one answer a question.

## Capturing

```bash
node scripts/capture-screenshots.mjs                      # every shot in the list
node scripts/capture-screenshots.mjs --only mirror-melee  # one of them
```

Output lands in `evidence/screenshots/`. The pipeline is tmux (a real PTY, so the ANSI backend takes
the same path a person gets) → `capture-pane -e` (keeps the escape sequences, so colour survives) →
HTML → headless Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

Add a frame worth looking at by editing the `shots` array at the top of the script. Each entry takes
`name`, `caption`, `scenario`, `tick`, `cols`, `rows`, and optionally `capability`, `glyphs`,
`tileWidth`, `effects`, `reducedMotion`, `expectGate`.

**The tick is exact.** The script pauses the session and steps to the tick you asked for, so a
screenshot lands where you meant rather than wherever the wall clock reached. Find the tick worth
shooting from the log first:

```bash
./bin/grid.ts run scenarios/ravel-cascade.ts 2>&1 >/dev/null | grep -E "blast|death"
```

## Driving it by hand

```bash
tmux new-session -d -s nexus -x 80 -y 24 './bin/grid.ts watch scenarios/ravel-cascade.ts'
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

1. **The worst frame first** (`ascii-effects.md` craft rule 1). Late Pulse, both armies engaged,
   several effects overlapping — `ravel-cascade` at the tick the chain runs. If that reads, the calm
   frames will. Designing the calm frame first guarantees a beautiful opening and an unreadable
   climax.
2. **Monochrome.** It is the acceptance floor, not the degraded mode. If you cannot follow who moved,
   who shot whom, and who died without colour, the frame is not finished.
3. **Both tile widths.** One column per tile squashes the Grid 2:1; two columns at 128 makes tiles
   read square. Anything authored for the wide composition must survive the narrow one.
4. **Effects off** (`--no-effects`). If the fight is unreadable without them, the effects are
   carrying a cue they are not allowed to carry alone.
5. **Reduced motion.** Causality must survive it: you must still be able to tell what hit what.

## Watching it yourself

```bash
./bin/grid.ts watch scenarios/citizens-versus-ravels.ts --glyphs unicode --capability truecolor
./bin/grid.ts watch scenarios/ravel-cascade.ts --capability monochrome --speed 0.5
./bin/grid.ts watch scenarios/citizens-versus-ravels.ts --tile-width 2   # needs 128 columns
```
