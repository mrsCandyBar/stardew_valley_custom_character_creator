const { SDV_Name } = require("../../modDetails");

// --- Beach event: "Do you ever feel like you don't belong anywhere?" (9999008) ---
// eventSequence items are joined with "/" when the build runs.
// This event has no fork.
const eventName = `9999008/f ${SDV_Name} 2000/w sunny`;

const eventSequence = [
  // Setup: music, location, actors
  "none",
  "12 38",
  `farmer 11 34 2 ${SDV_Name} 14 39 2`,
  "skippable",
  "playMusic sweet",

  // Farmer walks over
  "move farmer 0 3 2",
  "pause 2000",

  // Dialogue
  `speak ${SDV_Name} "Do you ever feel like you don't belong anywhere?"`,
  "pause 1000",
  "move farmer 0 2 1",
  "pause 500",
  `move ${SDV_Name} 0 0 3`,
  "pause 1000",
  `speak ${SDV_Name} "$4For a long time, I thought silence was the only thing I deserved. But... when you're around, the quiet doesn't feel heavy anymore."`,
  "emote farmer 32",
  "pause 2000",
  `textAboveHead ${SDV_Name} "...thank you. {{ PlayerName }}"`,
  "pause 1000",
  "end",
];

module.exports = { beachBelongEvent: { eventName, eventSequence } };
