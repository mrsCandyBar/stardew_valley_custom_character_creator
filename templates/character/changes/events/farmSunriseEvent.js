const { SDV_Name } = require("../../modDetails");

// --- Farm event: sunrise (9999014) ---
// Work in progress: not refined yet, to be reworked after full mod testing.
// eventSequence items are joined with "/" when the build runs.
// This event has no fork.
const eventName = `9999014/f ${SDV_Name} 3500/d-1`;

const eventSequence = [
  // Setup: music, location, actors
  "none",
  "15 11",
  `farmer 64 15 0 ${SDV_Name} 63 15 0`,
  "playMusic morning_memories",
  "pause 1000",

  // Dialogue
  `move ${SDV_Name} 1 0 2`,
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  "pause 800",
  `move ${SDV_Name} 0 -1 0`,
  `speak ${SDV_Name} "$0Placeholder event dialogue."`,
  "pause 1000",
  `speak ${SDV_Name} "$7Placeholder event dialogue."`,
  "pause 1200",
  `speak ${SDV_Name} "$1Placeholder event dialogue."`,
  "pause 1000",
  `speak ${SDV_Name} "$4Placeholder event dialogue."`,
  `jump ${SDV_Name}`,
  "pause 500",
  "stopMusic",
  "end",
];

module.exports = { farmSunriseEvent: { eventName, eventSequence } };
