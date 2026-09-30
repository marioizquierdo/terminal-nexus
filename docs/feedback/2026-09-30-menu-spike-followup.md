# The menu spike — the owner's notes at the merge (2026-09-30)

**Document role:** The owner's notes when he merged the menu spike, item by item, with what became of each
**Status:** WORKING — every item is Built, Scheduled, Open or Contested
**Updated:** 2026-09-30
**License:** Apache-2.0

Mario merged the menu spike (pull request 49, rounds 1-3) and sent these notes the same day "for a
smaller follow-up PR". They continue [`2026-09-30-menu-spike-round-3.md`](2026-09-30-menu-spike-round-3.md)'s
numbering. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F82 — The merge

> fucking As man! this was a really cool one. Merged.

**Noted.** The menu spike's three rounds are merged; this follow-up is a pull request of its own.

### F83 — Every popup breathes; the Battle Round screen opens with a double flash

> Popup pulse effect is very nice, but it is so subtle that I didn't even notice. This subtle version
> works well for all popups because it is very unobstrussive. For the battle round popup, add an
> additional opening effect that overrides the default border pulse. Give it a initial double flash
> pulse, with more contrast range, that works as a highlight, then it stays on the default pulse
> animation. Refactor code to account for new abstraction.

**Built.** Every popup's border now breathes with the same subtle breath — the Nexus powers, the game
menu, Settings, Controls, the export, a message and the Battle Round screen — restarting from rest when
one popup replaces another. The Battle Round screen opens with a **double flash**: two quick pulses of the
border most of the way to the title's colour, each lit fast and fading slowly (220 ms each, 90 ms apart),
then it breathes like the rest, from rest, with no jump. A popup's border effect is now one small idea —
an optional *opening* that plays once and overrides, then the steady *breath* — and which popup has which
opening is a one-line table in the view. The Experiment is now **Popup pulse** (every popup; an old
export's "Battle Round pulse" still reads), and two new ones let him feel the flash: **Battle Round
flash** (how long each flash lasts; off turns it off) and **Flash strength** (how far it brightens, 80%;
the breath goes 40%). Reduced motion and monochrome keep every border still; at 16 colours the flash shows
as two steps and the breath does not.

### F84 — A building's card: title, subtitle, description, stats

> Building card: theren's no need to show the "planned" or "to build" state. That is obvious from the
> rest of the UI. Instead, use that subtitle space for the subtitle explanation. The text below should
> be longer explanation with more details if needed. For now, just elaborate a little more on the
> examples. So the cards have title, subtitle, description, stats. I am also thinking that there may be
> modifications for the way it looks when building, exploring during build phase, or exploring during
> battle. For example, the title may not be needed when building because it is already the menu item on
> top. But don't worry about this now, we will address it later during other polish rounds. Just add a
> subtitle for now and cleanup/prepare the code for possible changes later, keep it simple whenever
> possible and directly linked to the abstraction.

**Built.** No card says "planned", "standing" or "to build" any more. A card is four parts: a **title**
beside the icon, a **subtitle** under it (one line on what the thing is for — "Trains troopers", "Spawns
swarmers", "Shoots what comes close", "Your base: guard it", and for bare ground "Buildings can go here",
"Blocks everything", "Resources lie here"), a **description** of two or three plain sentences, and the
**numbers**. The words live with the content (`src/content/cards.ts`), not in the drawing, and are written
to fit the narrow panel at 80 × 24 (a test holds every card to it). One function builds a card and one
draws it; the drawing function is named as the place where placing, exploring in the Build Phase and
exploring during a Pulse could later look different — nothing of that is built yet, as he said. The menu
hint for a building now quotes its subtitle.

### F85 — Settings in sections, and one ladder from experiment to constant

> Let's improve the settings window a little more. Instead of having general settings and then
> experiments, make more groups, and leave an extra space between sections. We may implement expanding a
> section later, but for now just keep it with title and settings in the section. This will allow us to
> add more settings and will be easier for me to find them. Add a section specially for keyboard
> navigation, and add a few more settings back, preparing for the upcoming round of polish for keyboard
> navigation. Refactor the code to account for the hierarchy of settings, some are experimental (for
> me), some are in-game user-facing settings, and some are constants in code only. We may promote
> settings to be user-facing, change sections, move them into constants (so we can still refer and
> update them), and at some point we can cleanup and solidify the constants and move them closer to
> their code module because they no longer need tuning. This system is very powerful and it is allowing
> communication between you and me, thanks!

**Built.** Settings is in titled sections with a blank line before each: **Display** (saved: background,
colour depth, symbols, reduced motion), **Keyboard navigation** (Experiments: the hold window, key
releases, and back for the navigation polish round the tap run window, the quick tap, taps to speed up,
the fastest tap, the hold pace, when a hold goes faster and by how much, and the jump distance — all at
today's values, and changing any of them changes the very next key), **Effects** (the popup pulse and the
Battle Round flash), and the **placeholder Pulse** (raid, your units); Export settings stands apart at the
end. Headings and blank lines are never rows: Up and Down step over them, and the title's count counts
only real rows. Underneath, **every setting is declared once, in one list, with its tier** — *player*
(shown and saved), *experiment* (shown for him, not saved, exported) or *tuned* (a constant in code) — and
its section, label, question, values and default (`src/build/all-settings.ts`). Moving a setting between
tiers or sections is a one-word edit; code reads any setting through one lookup that does not care which
tier it is on, and promoting one away from *tuned* makes the compiler point at every place that still
reads it as a constant. Old exports still read: a renamed setting maps to its new name, a settled one is
skipped quietly. When a constant no longer needs tuning it can later move next to the code that uses it.

### F86 — A prompt for the next milestone

> Then, give me a prompt to copy-paste into a new session to start working on the next milestone :)

**Built.** The prompt is in `docs/next-steps.md` section 2, and in the reply: the next step is gate 6B,
the loop back into the next Build Phase (Milestone 6 has three steps — 6A, 6B, 6C — before Milestone 7).
