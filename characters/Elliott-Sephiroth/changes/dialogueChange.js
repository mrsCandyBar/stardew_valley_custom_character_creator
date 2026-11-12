const { SDV_Name } = require("../modDetails");

// --- Custom dialogue (Characters/Dialogue/<SDV_Name>) ---
// The dialogue lives in dialogue.json (the interface edits that file) as a list of
// { key, lines }. Each item in a lines array is one "#"-separated section, joined back
// together with "#" here when the build runs.
// Day keys are a day (Mon, Tue, Wed, Thu, Fri, Sat, Sun) with an optional heart count after it,
// e.g. "Mon" or "Mon4". Other keys are things like "Introduction", "one" or "Festival_Egg".
const dialogueTarget = `Characters/Dialogue/${SDV_Name}`;

const { entries } = require("../dialogue.json");
const { items: giftItems } = require("../giftTastes.json");

const dialogueEntries = {};
for (const { key, lines } of entries) {
  if (key in dialogueEntries) {
    throw new Error(`Duplicate dialogue key: ${key}`);
  }
  dialogueEntries[key] = lines.join("#");
}

// Reactions to specific gifts live in giftTastes.json but the game reads them from the dialogue file,
// under AcceptGift_(O)<id>. Each is a sprite face ($0 to $8) followed by the text.
for (const { item, face, text } of giftItems) {
  const key = `AcceptGift_(O)${item}`;
  if (key in dialogueEntries) {
    throw new Error(`Duplicate dialogue key: ${key}`);
  }
  dialogueEntries[key] = `${face}${text}`;
}

const dialogueChange = {
  Action: "EditData",
  Target: dialogueTarget,
  Entries: dialogueEntries,
};

module.exports = { dialogueChange };
