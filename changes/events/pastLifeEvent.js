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
  `speak ${SDV_Name} "$7...How long were you standing there?"`,
  `move ${SDV_Name} 0 2 2`,
  "pause 600",
  `move ${SDV_Name} 0 1 2`,
  `speak ${SDV_Name} "$0Excuse me... I wasn't expecting company."`,
  "pause 500",
  `speak ${SDV_Name} "$0I was just... keeping a journal. Jotting down fragments."`,
  "pause 800",
  `speak ${SDV_Name} "Trying to make sense of how a life can derail so entirely... how everything went so terribly wrong before I even realized the path I was standing on was... fracturing..."`,
  "pause 800",
  `speak ${SDV_Name} "$4It's foolish to dwell on it. Out here, the days just... blur into quiet. But the ink dries the same."`,
  "pause 600",
  `speak ${SDV_Name} "$0Tell me... do you ever miss your past life? Before all of this?"`,

  // Question and fork
  `question fork0 "My past life... #(Honestly) Yes, sometimes it's hard to let go. #(Reassuringly) No. Everything I need is right here."`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `speak ${SDV_Name} "$4...I see. At least one of us has found some clarity, then."`,
  "pause 1000",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  "",
  `speak ${SDV_Name} "$1(A faint, guarded smile touches his lips) ...Perhaps you're right. Thank you for... staying."`,
  "pause 1000",
  "stopMusic",
  "end",
];

module.exports = { pastLifeEvent: { eventName, eventSequence, forkName, forkSequence } };
