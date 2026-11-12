const { SDV_Name } = require("../../modDetails");

// --- Beach event: night confession (9999010) ---
// eventSequence items are joined with "/" when the build runs.
const eventName = `9999010/f ${SDV_Name} 2500/t 2000 2400`;

// Name of the fork the player's answer jumps to
const forkName = "declineLove";

const eventSequence = [
  // Setup: music, location, actors
  "none",
  "12 38",
  `farmer 11 34 2 ${SDV_Name} 14 39 2`,
  "skippable",
  "playMusic night_fall",
  "pause 1000",

  // Farmer walks over
  "move farmer 0 5 1",
  "pause 500",
  `move ${SDV_Name} 0 0 3`,

  // Dialogue
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  `move ${SDV_Name} -1 0 3`,
  "pause 600",
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,
  "pause 1000",
  `speak ${SDV_Name} "Placeholder event dialogue."`,
  "pause 1000",
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,
  "pause 1000",
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  "pause 1200",
  `speak ${SDV_Name} "$6Placeholder event dialogue."`,
  "pause 500",
  `speak ${SDV_Name} "$8Placeholder event dialogue."`,

  // Question and fork
  `question fork1 "Placeholder question? #Placeholder answer 1 #Placeholder answer 2"`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `move ${SDV_Name} -1 0 3`,
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  `move ${SDV_Name} -1 0 0`,
  "showFrame farmer 2",
  `showFrame ${SDV_Name} 11`,
  "specificTemporarySprite heart 11 39",
  "playSound dwop",
  "pause 1000",
  "showFrame farmer 2",
  `showFrame ${SDV_Name} 11`,
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  "showFrame farmer 2",
  "emote farmer 20",
  "pause 500",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  `speak ${SDV_Name} "$6Placeholder event dialogue."`,
  `emote ${SDV_Name} 34`,
  "pause 500",
  "stopMusic",
  "end",
];

module.exports = { beachConfessionEvent: { eventName, eventSequence, forkName, forkSequence } };
