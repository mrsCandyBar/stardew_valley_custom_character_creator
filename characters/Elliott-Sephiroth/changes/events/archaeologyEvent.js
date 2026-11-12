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
  `speak ${SDV_Name} "$1{{ PlayerName }}! what a nice surprise to see you here."`,
  `move ${SDV_Name} 1 0 1`,
  "pause 1000",

  // Dialogue
  `speak ${SDV_Name} "$6I find myself drawn to this library. These old texts... they speak of empires rising and falling on the whims of a few."`,
  `speak ${SDV_Name} "$0It reminds me of the archives I used to study in. Before everything fell apart..."`,
  `move ${SDV_Name} -1 0 3`,
  "pause 800",
  `speak ${SDV_Name} "$8I look at the choices I made, the loyalty I gave to things that only brought ruin... "`,
  "pause 800",
  `speak ${SDV_Name} "$2...and I wonder if a person like me can ever truly... 'live' with the choices I have made in my... past."`,
  "pause 1000",
  `move ${SDV_Name} 1 0 1`,
  `speak ${SDV_Name} "$0Tell me... "`,

  // Question and fork
  `question fork0 "When you carry a burden that cannot be erased, nor fixed... how do you live with it? #(Be honest) You carry it forward, but don't let it define you.#(Offer comfort) You focus on the present. What you can do in the here and now."`,
  `fork ${forkName}`,

  // Default ending (no fork)
  `move ${SDV_Name} 0 0 0`,
  `speak ${SDV_Name} "$1The present... You make it sound so simple. But... perhaps it is possible."`,
  `emote ${SDV_Name} 32`,
  "pause 2000",
  "stopMusic",
  "end",
];

// The fork's own sequence
const forkSequence = [
  `speak ${SDV_Name} "$4...Carry it forward... Perhaps you're right. Thank you. I will... try"`,
  "pause 1000",
  `textAboveHead ${SDV_Name} "Thank you, {{ PlayerName }}"`,
  "pause 3000",
  "stopMusic",
  "end",
];

module.exports = { archaeologyEvent: { eventName, eventSequence, forkName, forkSequence } };
