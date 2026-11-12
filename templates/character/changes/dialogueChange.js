const { SDV_Name } = require("../modDetails");

// --- Custom dialogue (Characters/Dialogue/<SDV_Name>) ---
// The dialogue is split into small files in changes/dialogue/ so no single file gets huge.
// Each file exports an object of { key: [lines] }. Each item in a lines array is one
// "#"-separated section, joined back together with "#" here when the build runs.
const dialogueTarget = `Characters/Dialogue/${SDV_Name}`;

// To add a new file of dialogue, create it in changes/dialogue/ and add it to this list.
const dialogueFiles = [
  require("./dialogue/introduction"),
  require("./dialogue/monday"),
  require("./dialogue/tuesday"),
  require("./dialogue/wednesday"),
  require("./dialogue/thursday"),
  require("./dialogue/friday"),
  require("./dialogue/saturday"),
  require("./dialogue/sunday"),
  require("./dialogue/generic"),
  require("./dialogue/festivals"),
];

const dialogueEntries = {};
for (const file of dialogueFiles) {
  for (const [key, lines] of Object.entries(file)) {
    if (key in dialogueEntries) {
      throw new Error(`Duplicate dialogue key: ${key}`);
    }
    dialogueEntries[key] = lines.join("#");
  }
}

const dialogueChange = {
  Action: "EditData",
  Target: dialogueTarget,
  Entries: dialogueEntries,
};

module.exports = { dialogueChange };
