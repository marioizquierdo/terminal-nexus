# Terminal Nexus — ASCII art references

**Document role:** Non-authoritative research: where to learn terminal art, and what to take from each
**Status:** Reference. [`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 9 remains the authority
**Canon version:** 2.7
**Updated:** 2026-08-21
**License:** Apache-2.0 for the analysis; linked works belong to their authors

Terminal Nexus is betting that a `@` can carry a commander and a row of `#` can feel engineered.
That bet has been won before, repeatedly, by people who wrote down how they did it. This file
collects those sources and — more usefully — says what each one is *for*.

Nothing here is a rule. When this document and lore Section 9 disagree, lore wins.

## 1. The one lesson that outranks the rest

> Being easy to parse is not a property of ASCII. It is a property of good design. ASCII invites
> minimalism, but it does not hand it to you.

This is the recurring finding across the roguelike community's two decades of argument about
glyphs, and it is worth internalising before drawing anything. Caves of Qud is the standing
cautionary example: a beautiful, deeply committed ASCII game whose surfaces got dense enough that
players report being attacked by enemies they never saw. Its own remedies — rigorous colour coding
by category, and a "disable floor textures" option — are the fix, and both are *design*, not
character choice.

Terminal Nexus has a sharper version of this problem than a roguelike does. A roguelike player
studies a still frame at their own pace. A Nexus Pulse viewer watches a moving frame at ours,
already knowing they cannot intervene. If they cannot read it in motion, the whole product promise —
*watch symbols turn your plan into a legible story* — fails, and no amount of lore rescues it.

Practical consequence: **the busiest frame is the design target, not the prettiest one.** Author the
late-Pulse scrum first and the calm opening second.

## 2. Cogmind — the closest relative, and the best documentation

[Grid Sage Games](https://www.gridsagegames.com/blog/) is the single most valuable resource here.
Cogmind is a commercial sci-fi roguelike built entirely from CP437 characters, with ~1,000 procedural
particle effects and hand-drawn art for every item, and its developer wrote most of it down.

| Post | What to take |
| --- | --- |
| [ASCII Particle Effects](https://www.gridsagegames.com/blog/2014/03/particle-effects/) and [MORE ASCII Particle Effects](https://www.gridsagegames.com/blog/2014/04/ascii-particle-effects/) | The reference implementation of what Terminal Nexus calls effect recipes. Read these before writing the first one |
| [Cogmind ASCII Art, the Making of](https://www.gridsagegames.com/blog/2014/03/cogmind-ascii-art-making/) | Process for drawing hundreds of small pieces that stay consistent with each other |
| [ASCII Art](https://www.gridsagegames.com/blog/2014/03/ascii-art/) and the [Gallery](https://www.gridsagegames.com/blog/2014/12/cogmind-ascii-art-gallery/) | What a finished corpus looks like. Useful for calibrating ambition |
| [Genre Innovation](https://www.gridsagegames.com/cogmind/innovation.html) | How presentation ideas were chosen and rejected |

Two specifics worth stealing outright:

**Effects need visual progression.** Cogmind deliberately made early-game and late-game versions of
the same effect family read as the same *kind* of thing at different intensities. Terminal Nexus
needs exactly this for upgrade tiers and for Nexus integrity states — a level-3 defence should look
like a level-1 defence that grew up, not like a different game.

**Similar weapons must look similar, different weapons must not.** Lore Section 9 already says
"ordinary weapons need distinct physical languages so every event does not become the same computer
effect." Cogmind's blog is the worked example of enforcing that across a large weapon set, and of
how much bookkeeping it takes.

## 3. Tools for drawing

| Tool | Platform | Use for |
| --- | --- | --- |
| [REXPaint](https://www.gridsagegames.com/rexpaint/) | Windows, works under Wine | The standard. Built in-house for Cogmind and released free. Layers, a palette workflow, and an export format designed for game import. See [Roguelike Development with REXPaint](https://www.gridsagegames.com/blog/2015/07/roguelike-development-rexpaint/) |
| [Playscii](http://vectorpoem.com/playscii/) | Windows, macOS, Linux, open source | Cross-platform alternative with **animation** support. The closer fit if the Commander portraits ever need to move |
| [Durdraw](https://github.com/cmang/durdraw) | Linux, Unix, macOS terminal | ANSI/ASCII **animation** authored in the terminal itself. Closest to the medium we ship in |
| [chafa](https://hpjansson.org/chafa/) | Cross-platform CLI | Image to ANSI conversion, with genuinely good 16-colour mapping. Useful for turning a reference sketch into a starting grid |

For Terminal Nexus specifically, the workflow that matters is **draw in a real editor, export as
data, import as a typed definition.** Lore Section 9's "rhyme at four resolutions" rule only holds if
the one-cell glyph and the inspection portrait live in the same repository and can be diffed. Hand-
editing portraits inside TypeScript string literals will not survive the second faction.

The recommendation is to defer picking one until Gate 1B actually needs a portrait, then pick the
one whose export format is easiest to parse — that is the only criterion that matters to us.

## 4. Where the craft lives

[**16colo.rs**](https://16colo.rs/) is the ANSI/ASCII art archive — every textmode artpack since the
early 1990s, the accumulated output of the BBS art scene. It is the deepest well of pure textmode
composition that exists, and it is worth an afternoon before committing to a visual language.

Two caveats before mining it. Most of it is CP437 with a 16-colour CGA palette, built for an
80-column canvas and no motion — beautiful, but a still-image tradition. And Terminal Nexus has
committed to seven-bit ASCII as its baseline (lore Section 9, engine Section 9.6), which rules out
the block-drawing characters that carry most scene art. Take the **composition** — silhouette,
negative space, how a few marks imply mass — and leave the charset.

[Hans Petter Jansson's *The worst ANSI art renderer, except for all the others*](https://hpjansson.org/blag/2019/01/07/the-worst-ansi-renderer-except-for-all-the-others/)
is the best writeup of what actually happens when you map arbitrary imagery onto character cells —
required reading before anyone proposes an image-to-ASCII pipeline for portraits.

[Roguelike Radio, Episode 83: ASCII](http://www.roguelikeradio.com/2013/12/episode-83-ascii.html) is
the community arguing the whole question out loud, including the readability objections.

## 5. What modern terminals can actually do

The constraint has moved. [notcurses](https://github.com/dankamongmen/notcurses) is the honest survey
of the ceiling: 24-bit colour, pixel protocols such as Sixel, and a demo (`notcurses-demo`) that is
the fastest way to see what a terminal will do before you decide what to ask of it. Its own
documentation notes that capabilities are "substantially reduced in ASCII" — which is a warning worth
taking seriously, and also a reminder that Terminal Nexus chose the reduced tier deliberately, for
reasons the concept document defends.

For prior art on how far a TUI can be pushed without leaving text:

- [awesome-ratatui](https://github.com/ratatui/awesome-ratatui) — the widest catalogue of
  currently-good-looking terminal applications, whatever language you end up in;
- [Charm](https://charm.sh/) — Bubble Tea, Lip Gloss, and the Wish SSH server; the state of the art
  in *feel*, and the reference point if hosted SSH ever becomes decision-critical;
- [OpenTUI](https://github.com/anomalyco/opentui) — the current Gate 1A candidate.

The general observation from the 2026 TUI resurgence is that every ecosystem has converged on one
toolkit — Ratatui in Rust, Bubble Tea in Go, Textual in Python, Ink in Node — and that terminal
applications now routinely ship gradients, mouse support, and inline images. Terminal Nexus is
swimming against that current on purpose: it wants the *cell*, not the widget, and the reason is
that a cell is a game rule and a widget is not.

## 6. The classics, and what each is actually good for

Lore Section 9 names four precedents. Concretely:

- **NetHack** — semantic glyph assignment and inspection. The model for "the simulation knows
  `unit.worker`, never `w`". Also the model for how much a player will happily learn.
- **Brogue** — restrained lighting and terrain colour. The best argument that a small palette used
  consistently beats a large one used expressively. Directly relevant to Terminal Nexus's rule that
  colour never carries meaning alone.
- **Dwarf Fortress** — meaning accumulating through simulation rather than through art. The reason
  Terminal Nexus's persistence rules (survivors, salvage, ruins) are worth their complexity. Its
  Steam tileset release is also the standing proof that an optional readable mode does not betray an
  ASCII game.
- **Cogmind** — everything in Section 2.

## 7. Concrete practices for this project

Distilled into things a session can actually do:

1. **Author the worst frame first.** Late Pulse, both armies engaged, three effects overlapping. If
   that reads, the calm frames will. [`ascii-effects.md`](ascii-effects.md) carries this and the rest
   of the craft rules as the effect system's own contract.
2. **Test in monochrome before colour.** Not after. Colour added to a legible monochrome frame is an
   enhancement; colour holding an illegible frame together is a defect that ships.
3. **Fresh eyes are the only real test.** Lore Section 9 already mandates this. It is the acceptance
   criterion of Gates 1B and 1C for a reason — the author of a glyph cannot see it any more.
4. **Motion is a drawing tool, not decoration.** Anticipation, trail, recoil, debris, settle. A
   one-cell actor gets its weight almost entirely from the four frames around it. This is also the
   cheapest answer to Q3 in [`open-questions.md`](open-questions.md).
5. **Negative space is material.** The most common failure in game ASCII is filling the grid.
   Terminal Nexus has a 48 x 16 Grid and needs some of it to be empty for the rest to read.
6. **Every effect needs a reduced-motion form that keeps the causality.** Decide it when authoring
   the effect, not in a later accessibility pass.

## 8. Licensing note

Everything linked here belongs to its authors. Studying an approach is free; copying a glyph set, a
palette, or a piece of art is not. Terminal Nexus art must be original or explicitly licensed and
attributed — see `CONTRIBUTING.md`. CP437 art from the archive is in particular **not** ASCII-safe
and is not importable under our baseline regardless of licence.
