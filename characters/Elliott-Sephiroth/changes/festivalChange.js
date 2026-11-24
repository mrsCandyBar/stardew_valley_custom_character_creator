const { SDV_Name } = require("../modDetails");

// --- Festival dialogue (Data/Festivals/<festival id>) ---
// What the character says when you talk to them at a festival. festivalDialogue.json (the interface
// edits that file) is a list of { key, lines }. A key is a festival id, optionally followed by ":" and a variant:
//   spring24             year 1            -> "<SDV_Name>"
//   spring24:y2          year 2 onwards    -> "<SDV_Name>_y2"
//   spring24:spouse      married, year 1   -> "<SDV_Name>_spouse"
//   spring24:spouse_y2   married, year 2+  -> "<SDV_Name>_spouse_y2"
// Each item in a lines array is one "#"-separated section, joined back together with "#" here.
// Only the character's own keys are added to each festival's data, so the rest of it is left alone.
const FESTIVALS = ["spring13", "spring24", "summer11", "summer28", "fall16", "fall27", "winter8", "winter25"];
const VARIANTS = ["", "y2", "spouse", "spouse_y2"];

const { entries } = require("../festivalDialogue.json");

const byFestival = {};
for (const { key, lines } of entries) {
  const [festival, variant = ""] = key.split(":");
  if (!FESTIVALS.includes(festival) || !VARIANTS.includes(variant)) {
    throw new Error(`Unknown festival dialogue key: ${key}`);
  }
  const entryKey = variant ? `${SDV_Name}_${variant}` : SDV_Name;
  const target = (byFestival[festival] ??= {});
  if (entryKey in target) {
    throw new Error(`Duplicate festival dialogue key: ${key}`);
  }
  target[entryKey] = lines.join("#");
}

const festivalChanges = Object.entries(byFestival).map(([festival, festivalEntries]) => ({
  Action: "EditData",
  Target: `Data/Festivals/${festival}`,
  Entries: festivalEntries,
}));

module.exports = { festivalChanges };
