// PERIMETER — Mission 1 — as the trigger list the runner plays: three Pulses, the raid arriving in three
// waves, and the hold (campaigns.md sketches it).
//
// **Played on the Build Phase's starter map**, not PERIMETER's own: whether that map needs
// real scrolling is still an open question (Q38), and it exists only as a sketch. The regions below
// are named for this map's landmarks — the gap in the northern ridge, the open flats to the east — and a real map would carry its
// own. The units are the disposable fixture rosters from the first battles (Citizen troopers and
// marksmen, "two squads"; Ravel runners and raiders): the campaign design decided on no new content.
//
// **The wave sizes are a first tuning, not balance**: chosen against this map and the starter
// construct menu so that the first Pulse is a probe the starting squads can meet, the second needs
// something built, and the third needs most of what the mission's credits buy
// (docs/history/reports/2026-09-30-round-loop-and-missions.md has the outcomes measured against scripted plans).
//
// The round texts are placeholder writing in PERIMETER's register ("plain, military, correct"), inside
// the lore budget; the briefing and debrief written in campaigns.md are the designed ones, and the mission-cutscenes
// milestone is where they are shown.

import type { MissionDefinition } from "./types.ts"

const RUNNER = "unit.ravel.runner"
const RAIDER = "unit.ravel.raider"
const SLINGER = "unit.ravel.slinger"

export const PERIMETER: MissionDefinition = {
  id: "mission.citizen.perimeter",
  name: "Perimeter",
  pulses: 3,
  // Thirty seconds a Pulse, as the placeholder Pulse was: time enough for a wave to cross the map.
  pulseTicks: 360,
  // "PULS", the placeholder Pulse's seed, so the first round's randomness is the one 6A was tuned on.
  seed: 0x50554c53,
  // The Barracks trains troopers, round after round: what makes a second round show something the
  // first did not. How often, and how many a round, are the Experiments' (`src/build/all-settings.ts`).
  trains: [{ structure: "structure.citizen.barracks", unit: "unit.citizen.trooper" }],
  regions: [
    // Beside the Nexus, toward where the raid comes from: where the starting squads stand.
    { id: "muster", x: 21, y: 9, width: 3, height: 3 },
    // North of the gap in the ridge — the raid's way in.
    { id: "ridge", x: 40, y: 0, width: 4, height: 2 },
    // The open flats east of the base — the second wave's flank.
    { id: "east-flats", x: 50, y: 9, width: 5, height: 3 },
    // The player's Grid Nexus: what every raid advances on.
    { id: "nexus", x: 17, y: 10, width: 3, height: 2 },
  ],
  triggers: [
    {
      id: "squads",
      when: { pulse: 1, tick: 0 },
      do: [
        {
          spawn: {
            side: "A",
            // "Commander Vasse holds the ground with what walked out of the annex: two squads" (the
            // briefing). Listed first, so she takes the muster's centre with the squads around her: listed
            // last she stood at their edge and fell in round 2 behind every Turret plan measured. She
            // arrives once; when she falls, the rules between rounds bring her back.
            units: [
              { unit: "unit.citizen.vasse", count: 1 },
              { unit: "unit.citizen.trooper", count: 3 },
              { unit: "unit.citizen.marksman", count: 2 },
            ],
            at: "muster",
            group: "squads",
          },
        },
      ],
    },
    {
      id: "wave-1",
      when: { pulse: 1, tick: 0 },
      do: [
        {
          spawn: {
            side: "B",
            units: [
              { unit: RUNNER, count: 3 },
              { unit: RAIDER, count: 2 },
            ],
            at: "ridge",
            group: "probe",
            order: { advance: "nexus" },
            intent: "Probe the line at the ridge.",
          },
        },
      ],
    },
    {
      id: "wave-2",
      when: { pulse: 2, tick: 0 },
      do: [
        {
          spawn: {
            side: "B",
            units: [
              { unit: RUNNER, count: 4 },
              { unit: RAIDER, count: 3 },
            ],
            at: "ridge",
            group: "second-wave",
            order: { advance: "nexus" },
            intent: "Break through at the ridge.",
          },
        },
      ],
    },
    {
      id: "wave-2-flank",
      // Seven seconds in: a flank that arrives while the main wave is already engaged.
      when: { pulse: 2, tick: 84 },
      do: [
        {
          spawn: {
            side: "B",
            units: [{ unit: RAIDER, count: 2 }],
            at: "east-flats",
            group: "flank",
            order: { advance: "nexus" },
            intent: "Come round from the east.",
          },
        },
      ],
    },
    {
      id: "wave-3",
      when: { pulse: 3, tick: 0 },
      do: [
        {
          // The raid's own Build Phase plan for the push: a den north of the ridge, its forward camp.
          commitPlan: { side: "B", structures: [{ contentId: "structure.ravel.den", anchor: { x: 46, y: 0 } }] },
        },
        {
          spawn: {
            side: "B",
            units: [
              { unit: RUNNER, count: 6 },
              { unit: RAIDER, count: 4 },
              { unit: SLINGER, count: 3 },
            ],
            at: "ridge",
            group: "push",
            order: { advance: "nexus" },
            intent: "The push: take the Nexus.",
          },
        },
      ],
    },
    {
      id: "wave-3-reserve",
      when: { pulse: 3, tick: 96 },
      do: [
        {
          spawn: {
            side: "B",
            units: [
              { unit: RUNNER, count: 3 },
              { unit: RAIDER, count: 3 },
            ],
            at: "east-flats",
            group: "reserve",
            order: { advance: "nexus" },
            intent: "The reserve, from the east.",
          },
        },
      ],
    },
    // Listed before the hold on purpose: at the last Pulse's end both could hold, and the first `win` or
    // `lose` in list order decides.
    { id: "fallen", when: { event: "nexus.destroyed", side: "A" }, do: [{ lose: true }] },
    { id: "hold", when: { event: "pulse.end", pulse: 3 }, do: [{ win: true }] },
  ],
  roundText: {
    1: "A hostile force is inbound from the ridge. Hold the perimeter.",
    2: "They are back, and there are more. Watch the east.",
    3: "This is the push. Hold until their schedule ends.",
  },
  // The debrief's own first sentence (campaigns.md) for the hold.
  endText: { won: "The perimeter held.", lost: "The Nexus fell." },
}
