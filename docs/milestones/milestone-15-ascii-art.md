# Milestone 15 — ASCII Art

**Status:** PLANNED
**Depends on:** nothing built; where it sits in the build order is Mario's call

The owner, 2026-10-14, after the Commander's portrait ([his words](../history/feedback/2026-10-13-commander-armies.md)):
"we're relying on the LLM model capability to make some ASCII art, but consistently they come not very pretty. So I
think we're going to need a better approach ... Perhaps we install a tool that we can run to generate ASCII art.
Perhaps we make a workflow collaboration between an image model that can probably generate the art with good
sensitivity. And then the LLM can take that image and turn it into actual ASCII art ... and try to take advantage
of ANSI ... we are going to benefit from that to create art for basically all of the units."

Every piece of art so far — the Commander's portrait and her death vignette, a building's growth frames, a unit's
death frames — was drawn by hand in a prompt. This milestone gives the project a way to make art that looks good on
purpose, and repeatably, before the units need it.

## Question

Is there a workflow — research, a tool, an image model and a pass by hand — that makes ASCII and ANSI art for a
unit, a portrait or a vignette that a person calls good, at the sizes the screen gives it, inside the Grid's rules
(style roles and not colours, the monochrome floor, plain ASCII with the optional Unicode pack)?

## Steps

Not started. Each waits for Mario's word, and the order is a first guess.

### Step 15A — What makes good ASCII art

- [ ] Research, written up: what the best ASCII and ANSI artists and the games this one comes from do (silhouette
      first, a reading at a glance, line weight, negative space, shading ramps, half blocks and colour), building on
      [`ascii-art-references.md`](../game-design/ascii-art-references.md).
- [ ] The tools that turn an image into text (chafa, jp2a, ascii-image-converter, libcaca and the like), each tried on
      the same pictures at the sizes the game uses, with what each is good for.
- [ ] Rules for the game's art, as a design document: sizes (a Grid glyph, a card's portrait, a vignette), what
      a Commander's art builds on (her symbol, below), and what the monochrome floor keeps.

### Step 15B — The workflow

- [ ] A pipeline a session can run: a prompt for an image model (a silhouette on a plain ground, at the target's
      shape), the conversion tool, then the hand pass that fixes what the tool gets wrong; with the style roles
      applied, never colours.
- [ ] A skill for it, and a script where one helps. Where an image model needs a key, it comes from the environment,
      never the repository.

### Step 15C — Art for what is on screen

- [ ] The Commander's portrait and her vignette frames redrawn with it; then a portrait for each unit's card.
- [ ] Every piece shown before and after, judged by Mario.

## A rule it starts from

**A Commander's symbol is her identity, and her art builds on it** (the owner: "the symbology and the icon used to
represent the commander is important in the identity, and it should be kind of related, not just arbitrary"). Her
glyph on the Grid is chosen for who she is, and her portrait and her vignette grow out of it.

## Out of scope

A Grid glyph's size (a unit is still the glyph its tile holds), colours outside the style roles, and art for content
no milestone builds.
