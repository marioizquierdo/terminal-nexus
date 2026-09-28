---
name: pr-description
description: Write or update a pull request description for Terminal Nexus. Use whenever opening a PR, pushing commits to an open PR, or rewriting a PR body. Produces a phone-readable description that leads with what the player will see, a Demo section sized to the change (a code block, screenshots, a GIF, or a playable page — the cheapest one that shows it), the decisions waiting on Mario as Experiments to flip, and keeps gate and canon bookkeeping in a collapsed footer.
---

# Writing a pull request description

## Who reads it

Mario, on whatever device he has — often his iPhone (the GitHub app or mobile Safari), sometimes a
laptop or another machine. He merges without reading the diff, then plays the build. The description is his only briefing: in under a minute he must learn **what
changed on screen, how to try it, and what he needs to decide**.

It is not the gate report. The gate report is the record for the next agent; link it from the
footer and do not repeat it.

## Rules

- **Lead with behaviour.** "Tab now moves between the menu and the map", not "focus is reducer
  state". Internal refactors get at most one bullet.
- **Plain English.** No section numbers, no question ids like Q57, no "per canon", no RULE or
  GUIDANCE, no gate letters in the body. Game words are fine (Grid, Build Phase, Nexus Pulse, Nexus
  power); process words (gate, canon, ledger, milestone) belong only in the footer.
- **No "Mario said X".** At most "(from your playtest)" after the change it prompted.
- **Short.** 150-400 words above the footer. Bullets of one or two lines. No table wider than two
  columns — it will not fit a phone.
- **Pictures over prose.** A screenshot or a GIF of the flow beats a paragraph describing it.
- **Honest.** Say what no human has tried yet and what is known to be broken.

## Title

The player-visible change, under 70 characters. A trailing "(gate 5F)" is allowed. For tooling, the
thing a person can now do: "Scripted playtests that make GIFs without a terminal".

## Body, in this order

**What** — two or three sentences: what you will notice.

**Changes** — player-visible bullets, "before -> after" where it helps. At most one bullet for
internal work.

**Demo** — how to see the change, and what to look for while you do. One section: the pictures, the
playable page and the steps to try all live here (it replaced separate "Try it" and "Screenshots"
sections). **Size it to the change** — the cheapest layer that shows it, because a playable page
costs far more to build and publish than a code block:

| The change… | The Demo is… |
|---|---|
| doesn't change what's on screen (tooling, docs, a refactor) | a short code block — a command and its output, or the few screen lines that moved — or no Demo at all |
| changes how something **looks** | 1-4 screenshots (before/after pairs stacked, before first) |
| is about **movement or timing** | an animated GIF of the flow (under about 1 MB) |
| needs to be **played** to judge (a feel, an interaction, a flow) | a playable page, plus the GIF or screenshots of its key moment |

A text screen from the `playtest` skill in a code block is often enough for a layout change and costs
nothing to host. When there is a playable page, give it two sub-headings:

- **On Claude Web Artifact** — the private page link first (it works from his phone, his laptop, any
  device signed in to claude.ai), then 3-6 numbered steps with exact keys, each ending in what should
  happen: "3. Press Space — the Barracks rises next to the Nexus." Say which keys a phone's key bar
  cannot send (a held key's repeat, for instance).
- **On MacOS** — copy-paste commands for his own terminal, in one code block: e.g.
  `git fetch && git checkout <branch> && git pull && ./bin/terminal-nexus.ts`, and any flag the demo
  needs (`--settings "..."` to start with particular Experiments).

Without a playable page, the numbered steps go straight under **Demo** with the MacOS commands.

**Decisions** — each open choice: the question in plain words, the default this PR picked, and how to
flip it. In the Build Phase that is almost always an **Experiment** (the bottom of the Settings popup:
Esc, then `s`), so give the exact keys: "press `d` to jump to the Experiments, go down to Armed click
scrolls, press Right to flip it, and tell me which feels better." Mario asked to be asked this way.
End the section with the export line, so his answer comes back as data rather than a description:
"When it feels right, press `e` in Settings (**Export settings**) — it is copied to your clipboard and
saved to `~/.terminal-nexus/settings-export.txt` — and paste it as a comment here." An agent that
reads an exported block back starts the game with it (`./bin/terminal-nexus.ts --spike --settings
"<text>"`, or `node scripts/playtest.mjs --settings "<text>"`, or `#settings=<url-encoded text>` on
the browser page) to see what he saw. Omit the section if there are none.

**Known issues** — omit if none.

**Checks** — one line, e.g. `Type check clean · Node 414/414 · Bun 413/413 · repo checks pass`.

Then the collapsed footer:

```markdown
<details><summary>Project bookkeeping</summary>

- Gate: 5F — PASS (or: not a gate)
- Report: `evidence/gate-5f-report.md`
- Canon changes: None (or what changed, and the new version)
- Questions: opened Q60; answered Q57

</details>
```

Then the session's attribution lines — **exactly once**, at the very end. If the tool or the host
adds a footer of its own, do not add a second copy. The GitHub connector's `create_pull_request`
has been seen appending a "Generated by Claude Code" line under the body it was given; read the PR
back after creating it, and if a second footer appeared, set the body again with
`update_pull_request` (which leaves it as sent). Two PRs have ended up with two footers.

## Pictures that display on a phone

The repository is public, so an image committed on the branch displays inline from its raw URL:

```markdown
![After: the Hatchery placed](https://raw.githubusercontent.com/marioizquierdo/terminal-nexus/<commit-sha>/evidence/screenshots/<name>.png)
```

- **After** images: pin to the pushed head commit (`git rev-parse HEAD` after pushing), never to the
  branch name — the branch moves and old descriptions would silently show new pictures.
- **Before** images: pin to `origin/main`'s commit, and only if the file exists there
  (`git cat-file -e origin/main:evidence/screenshots/<name>.png`).
- **Look at every image yourself before linking it** (open the PNG with the Read tool). An image
  captured one key early is worse than none.
- Make them with the `playtest` skill (`node scripts/playtest.mjs ... --png final` or `--gif`, with
  `--out evidence/screenshots`); keep a GIF under about 1 MB.

## Pushing more commits to an open PR

Rewrite the description to describe the PR as it now stands, and re-pin the screenshot URLs to the
new head commit. No "Update:" sections, no changelog of the PR's own history.

## Before submitting

- [ ] The title says what the player (or developer) can now see or do, under 70 characters.
- [ ] Every image was opened and checked; URLs are pinned to commit SHAs.
- [ ] The Demo is the cheapest layer that shows the change, and its steps were run exactly as written.
- [ ] No section numbers, question ids or gate letters above the footer.
- [ ] 150-400 words above the footer.
- [ ] The attribution lines appear exactly once, at the end.

## Example

Bad:

> Q57 built to its recommendation: focus after a placement returns to wherever the arming came from
> (engine.md 9.7); lockReason split into editLock and commitLock.

Good:

> After you place a building, the keyboard goes back to where you armed it from: the menu if you used
> the menu, the map if you pressed a digit. A waiting Nexus power pick now only blocks starting the
> Pulse; you can build freely before choosing.
