const { SDV_Name } = require("../../modDetails");

// --- Elliott's House event: piano / staying as a friend (9999006) ---
// eventSequence items are joined with "/" when the build runs.
const eventName = `9999006/f ${SDV_Name} 1500`;

// Name of the fork the player's answer jumps to
const forkName = "i_will_stay";

const eventSequence = [
  // Setup: music, location, actors
  "none",
  "4 7",
  `farmer 3 8 0 ${SDV_Name} 8 4 0`,
  "skippable",
  "move farmer 0 -4 0",
  "pause 200",
  "move farmer 3 0 1",
  "pause 500",
  "playMusic sweet",
  "pause 120000",

  // Dialogue
  `move ${SDV_Name} 2 0 1`,
  `speak ${SDV_Name} "$7Placeholder event dialogue."`,
  "pause 2000",
  `speak ${SDV_Name} "$5Placeholder event dialogue."`,
  "pause 1200",
  `speak ${SDV_Name} "$8Placeholder event dialogue."`,
  "pause 1000",
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,

  // Question and fork
  `question fork1 "Placeholder question? #Placeholder answer 1 #Placeholder answer 2"`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  "pause 500",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  `shake ${SDV_Name} 500`,
  "pause 500",
  "stopMusic",
  "end",
];

module.exports = { pianoEvent: { eventName, eventSequence, forkName, forkSequence } };
