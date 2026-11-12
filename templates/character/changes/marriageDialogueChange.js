const { SDV_Name } = require("../modDetails");

// --- Marriage dialogue (Characters/Dialogue/MarriageDialogue) ---
// The dialogue lives in marriageDialogue.json (the interface edits that file) as a list of
// { key, lines }. "{name}" in a key is replaced with SDV_Name, e.g. "Indoor_Morning_{name}".
// Each item in a lines array is one "#"-separated section, joined back together with "#"
// here when the build runs.
const marriageDialogueTarget = "Characters/Dialogue/MarriageDialogue";

const { entries } = require("../marriageDialogue.json");

const marriageEntries = {};
for (const { key, lines } of entries) {
  const finalKey = key.replaceAll("{name}", SDV_Name);
  if (finalKey in marriageEntries) {
    throw new Error(`Duplicate marriage dialogue key: ${finalKey}`);
  }
  marriageEntries[finalKey] = lines.join("#");
}

const marriageDialogueChange = {
  Action: "EditData",
  Target: marriageDialogueTarget,
  Entries: marriageEntries,
};

module.exports = { marriageDialogueChange };
