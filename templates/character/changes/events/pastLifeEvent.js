const { SDV_Name } = require("../../modDetails");

// --- Elliott's House event: journal / past life (9999002) ---
// eventSequence items are joined with "/" when the build runs.
const eventName = `9999002/f ${SDV_Name} 500`;

// Name of the fork the player's answer jumps to
const forkName = "thePastMatters";

const eventSequence = [
  // Setup: music, location, actors
  "none",
  "4 5",
  `farmer 3 8 0 ${SDV_Name} 3 4 3`,
  "skippable",
  "pause 1000",
  "playMusic eerie",
  `textAboveHead ${SDV_Name} "... {{ PlayerName }}?"`,
  "pause 5000",

  // Dialogue
  `move ${SDV_Name} 0 0 2`,
  "pause 1000",
  `speak ${SDV_Name} "$7Placeholder event dialogue."`,
  `move ${SDV_Name} 0 2 2`,
  "pause 600",
  `move ${SDV_Name} 0 1 2`,
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,
  "pause 500",
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,
  "pause 800",
  `speak ${SDV_Name} "Placeholder event dialogue."`,
  "pause 800",
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  "pause 600",
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,

  // Question and fork
  `question fork0 "Placeholder question? #Placeholder answer 1 #Placeholder answer 2"`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  "pause 1000",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  "",
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  "pause 1000",
  "stopMusic",
  "end",
];

module.exports = { pastLifeEvent: { eventName, eventSequence, forkName, forkSequence } };
