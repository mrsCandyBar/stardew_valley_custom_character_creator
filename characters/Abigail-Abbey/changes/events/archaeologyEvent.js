const { SDV_Name } = require("../../modDetails");

// --- Archaeology House event (9999004) ---
// eventName is the event's key: <event id>/<conditions>
// eventSequence is the event script. Each item is one "/"-separated command,
// joined back together with "/" when the build runs.
const eventName = `9999004/f ${SDV_Name} 1000`;

// Name of the fork the player's answer jumps to (referenced in the "fork" command below)
const forkName = "carry_it_forward";

const eventSequence = [
  // Setup: music, location, actors
  "none",
  "15 11",
  `farmer 15 16 0 ${SDV_Name} 11 10 0`,
  "skippable",
  "playMusic sweet",
  "pause 500",
  `textAboveHead ${SDV_Name} "..."`,

  // Farmer walks in
  "move farmer 0 -6 0",
  "pause 1000",
  "move farmer 0 0 3",
  "pause 500",
  "emote farmer 32",
  "pause 500",

  // Greeting
  `move ${SDV_Name} 0 0 1`,
  `move ${SDV_Name} 1 0 1`,
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  `move ${SDV_Name} 1 0 1`,
  "pause 1000",

  // Dialogue
  `speak ${SDV_Name} "$6Placeholder event dialogue."`,
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,
  `move ${SDV_Name} -1 0 3`,
  "pause 800",
  `speak ${SDV_Name} "$8Placeholder event dialogue."`,
  "pause 800",
  `speak ${SDV_Name} "$2Placeholder event dialogue."`,
  "pause 1000",
  `move ${SDV_Name} 1 0 1`,
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,

  // Question and fork
  `question fork0 "Placeholder question? #Placeholder answer 1 #Placeholder answer 2"`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `move ${SDV_Name} 0 0 0`,
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  `emote ${SDV_Name} 32`,
  "pause 2000",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  "pause 1000",
  `textAboveHead ${SDV_Name} "Thank you, {{ PlayerName }}"`,
  "pause 3000",
  "stopMusic",
  "end",
];

module.exports = { archaeologyEvent: { eventName, eventSequence, forkName, forkSequence } };
