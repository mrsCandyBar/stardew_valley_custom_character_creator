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
  `speak ${SDV_Name} "$1You came. I... hoped you would. Even out here in the dark."`,
  `move ${SDV_Name} -1 0 3`,
  "pause 600",
  `speak ${SDV_Name} "$0For a long time, I believed my path was meant to be walked alone. That 'anyone' who got too close would only find ruin..."`,
  "pause 1000",
  `speak ${SDV_Name} "...or a monster pretending to be a man."`,
  "pause 1000",
  `speak ${SDV_Name} "$0The villagers... they smile, and I've... 'learned' to accept their kindness. But you... "`,
  "pause 1000",
  `speak ${SDV_Name} "$4You didn't just accept me. You stayed... when the music stopped. when I had... nothing to offer but my broken history."`,
  "pause 1200",
  `speak ${SDV_Name} "$6And I realize now... I don't just want you as a friend who shares the quiet."`,
  "pause 500",
  `speak ${SDV_Name} "$8I want you to be my anchor. My home... More than anyone else could ever be..."`,

  // Question and fork
  `question fork1 "Do you want to be more than friends? #(Blush) I would like that more than anything #(Smile softly, but say nothing)."`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `move ${SDV_Name} -1 0 3`,
  `speak ${SDV_Name} "$1I'm ready to let go of who I was. Because who I want to be... is right here, with you."`,
  `move ${SDV_Name} -1 0 0`,
  "showFrame farmer 2",
  `showFrame ${SDV_Name} 11`,
  "specificTemporarySprite heart 11 39",
  "playSound dwop",
  "pause 1000",
  "showFrame farmer 2",
  `showFrame ${SDV_Name} 11`,
  `speak ${SDV_Name} "$4You're the only future I want."`,
  "showFrame farmer 2",
  "emote farmer 20",
  "pause 500",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  `speak ${SDV_Name} "$6Then I will wait. I won't rush you... We'll face whatever comes, together."`,
  `emote ${SDV_Name} 34`,
  "pause 500",
  "stopMusic",
  "end",
];

module.exports = { beachConfessionEvent: { eventName, eventSequence, forkName, forkSequence } };
