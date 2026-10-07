# The Nexus Pulse (2026-10-07)

Mario merged the draft's design (pull request 67) and asked for part of it built, the in-match draft renamed the
Nexus Pulse, new claims about the tech tree written down, and the game's words reviewed. These notes continue
[`2026-10-07-draft-design.md`](2026-10-07-draft-design.md)'s numbering. His words are voice transcription, kept as
they arrived. Built on a new pull request as step 8C. Status values: **Built**, **Scheduled**, **Open**,
**Contested**.

### F152 — The rules read well, legendary included

> merged. And I like the direction! The design rules for how to design cards are strong, and will be very useful
> for modders too. The drafting rules to differentiate common, uncommon, rare and legendary are easy to
> understand, the roles and rule about not repeating roles, the modifiers about repeatable powers, and special
> power drafting abilities for certain factions and commanders make it for an awesome asymmetric experience.

**Built.** The design had three rarities; his list has four, so legendary is the fourth, above rare. The cards, the
loader and the dealer know it, and a legendary is dealt only by a slot of the schedule that asks for one, never as a
stand-in for a rarity that ran out. No schedule asks for one yet: the hand every few rounds that would deal them is
still for later.

### F153 — Three cards a hand

> I wonder if we should show 2 or 3 picks. My intuition says 3 because all games use this. We will worry about
> improving the UI later.

**Built.** The game's schedule deals three cards a round, War Chest beside them under the fourth digit, and so does
PERIMETER's own. A hand deals fewer only when the pool has run out.

### F154 — Build some of it: rarity, roles, modifiers, requirements, a schedule a level can change

> Let's go ahead and implement some of the new design! We don't need to do all of it, but we can add rarity and
> role properties to the cards, define some special modifiers (repeatable, double chance during first 3 rounds,
> etc.), build dependencies (added to draft after another power has been enabled, or after a building has been
> placed, etc.), and implement a simple initial Nexus Pulse schedule. The schedule can be override by the campaign
> level (so we can ensure certain powers show up at the right round).

**Built.** Every Nexus power carries a rarity and a role, from short lists the loader checks. Modifiers: repeatable
(as before), and a chance raised for some rounds ("twice as likely in rounds 1 to 3", which Reserve Callup now has).
Requirements: a power kept, a building standing as the round opens (Drill Schedule needs a Barracks) or a round
reached; and upgrades, a power dealt only once the one it upgrades is kept and listed in its place once kept itself
(Drill Schedule II, the third wave). The game's schedule ramps by round: an uncommon in round 1, two from round 2, a
rare from round 4. A level may give its own schedule and make sure of a power in a round: PERIMETER's round 2 deals
Aid Station Permit first, unless it was kept already. This answers the question the draft's design left him, a
schedule or a chance that rises: a schedule, with a chance on each card.

### F155 — The Nexus Pulse, still optional, and a milestone of its own later

> I think we can rename the Nexus Draft phase to the term "Nexus Pulse", so we can finally give this term a home.
> The Nexus Pulse signals the start of a new round. Let's still not make it mandatory for now. Perhaps we will need
> to design a milestone dedicated only to improving the Nexus Pulse experience, with dedicated UI and more specific
> powers.

**Built**, the name: the popup is titled NEXUS PULSE, the menu row reads Nexus Pulse, a new round opens on "The
Nexus Pulse deals a new hand", and the design and lore documents call the battle a Battle Round everywhere, so the
Nexus Pulse has only its new meaning. The pick stays optional. **Scheduled**, the milestone: a planned milestone
for the Nexus Pulse's own moment on screen and more powers, waiting for his word.

### F156 — The tech tree in plain sight; upgrades in the details, and sometimes on the map

> This new PR will double down on the drafting mechanics, review design docs, write a few new claims like the state
> of the tech tree should be always visible through buildings in the grid and build-menu items. Unit and building
> upgrades are visible when exploring the details on the unit or building, and some-times have effects on the gird
> [grid] icon, background, aura, particles or other effects.

**Built**, as design: the state of the tech tree is always in sight, as the buildings standing on the Grid and the
rows of the build menu, never in a hidden list; an upgrade, a unit's or a building's, shows in the details Explore
Map opens on it, and may also change how it looks on the Grid (its glyph, its background, an aura, particles). What
already does so is named: a Barracks with Drill Schedule says its waves on its card, and Standing Order's reach shows
around Vasse.

### F157 — The game's words, reviewed

> Let's make sure to review game nomenclature consistency. We are now deciding on calling the drafting phase:
> "Nexus Pulse" (which in game design and lore can still be explained as this powerful moment when the Nexus speaks
> to the commander), but also we are deciding how to name all of the drafting mechanics around nexus powers, and
> building-based tech tree.

**Built**: one list of the words, in the glossary, with what each names. A round is a Nexus Pulse, a Build Phase and
a Battle Round. The Nexus Pulse's words are the hand, the pool, rarity, role, the schedule, a chance, a requirement,
an upgrade, keep and ACTIVE; the tech tree's are unlock, building upgrade and the build menu, which replaces both
"construct menu" and "construction menu". The engine still calls the battle step "the Pulse" in code and in a
mission's data (`pulses`, `pulseTicks`); renaming them is registered (Q76), since a modder reads them.
