const { SDV_Name } = require("../modDetails");

// --- Custom gift tastes (Data/NPCGiftTastes) ---
// The values live in giftTastes.json (the interface edits that file). The gift taste string is
// "/"-separated fields, and the game reads them as five dialogue + item list pairs, in this order:
//   0-1   love    (reaction line, item ids)
//   2-3   like
//   4-5   dislike
//   6-7   hate
//   8-9   neutral
// Reactions to specific items are not part of this string (the game ignores extra fields). They are
// written to the dialogue as AcceptGift_(O)<id> by dialogueChange.js.
// A reaction line is a sprite face ("$0" to "$8", stored with the $) followed by the text.

const { generic, categories } = require("../giftTastes.json");

const reaction = ({ face, text }) => `${face}${text}`;

const giftTasteLines = [
  ...[
    ["love", "loves"],
    ["like", "likes"],
    ["dislike", "dislikes"],
    ["hate", "hates"],
    ["neutral", "neutral"],
  ].flatMap(([taste, category]) => [reaction(generic[taste]), categories[category].join(" ")]),
];

const giftTasteTarget = "Data/NPCGiftTastes";
const giftTasteString = giftTasteLines.join("/");

const giftTastesChange = {
  Action: "EditData",
  Target: giftTasteTarget,
  Entries: {
    [SDV_Name]: giftTasteString,
  },
};

module.exports = { giftTastesChange };
