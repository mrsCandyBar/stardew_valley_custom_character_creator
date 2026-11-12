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
  `speak ${SDV_Name} "$4...You're awake early. I was just watching the sunrise over the crops."`,
  "pause 800",
  `move ${SDV_Name} 0 -1 0`,
  `speak ${SDV_Name} "$0For years, I thought mornings only brought new burdens. New orders to follow. New expectations to crush."`,
  "pause 1000",
  `speak ${SDV_Name} "$7Look at this place. It's quiet. The earth doesn't ask me to be a weapon or a legend... it just asks to be tended."`,
  "pause 1200",
  `speak ${SDV_Name} "$1(He turns to you, a completely unburdened, radiant expression crossing his face) And you... you showed me that a man isn't defined by the shadow of his past, but by who he chooses to hold in the light."`,
  "pause 1000",
  `speak ${SDV_Name} "$4Thank you for giving me a home when I had nowhere left to fall. I am entirely yours."`,
  `jump ${SDV_Name}`,
  "pause 500",
  "stopMusic",
  "end",
];

module.exports = { farmSunriseEvent: { eventName, eventSequence } };
