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
  "playMusic crisis-core-theme-the-terrible-truth-takeharu-ishimoto",
  "pause 120000",

  // Dialogue
  `move ${SDV_Name} 2 0 1`,
  `speak ${SDV_Name} "$7...You stood there through the whole song. You didn't turn away... when the notes grew heavy."`,
  "pause 2000",
  `speak ${SDV_Name} "$5They called me a perfection. A masterpiece. A monster... right to my face when the paths split and everyone turned their backs. Genesis... Angeal... they all left me to carry the quiet."`,
  "pause 1200",
  `speak ${SDV_Name} "$8And yet, you're still here. Standing in this damp little shack, acting as though I'm... human."`,
  "pause 1000",
  `speak ${SDV_Name} "$4I don't need grand empires or legacy. I just... I am so tired of being alone..."`,

  // Question and fork
  `question fork1 "Tell me, are you actually going to stay? As a real friend?#(Step forward and smile) I'm not going anywhere. You're stuck with me.#(Nod gently) Through the quiet and the heavy days, I'll stay."`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `speak ${SDV_Name} "$1(His hands tremble slightly over the piano keys, a soft, broken relief washing over his expression) ...A real friend. I think... I could learn what that means with you."`,
  "pause 500",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  `speak ${SDV_Name} "$4(He looks down, hiding a watery smile as his shoulders finally relax) Thank you... That is all I ever really wanted to hear."`,
  `shake ${SDV_Name} 500`,
  "pause 500",
  "stopMusic",
  "end",
];

module.exports = { pianoEvent: { eventName, eventSequence, forkName, forkSequence } };
