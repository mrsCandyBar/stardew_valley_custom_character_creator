const { SDV_Name } = require("../modDetails");

// --- Custom gift tastes (Data/NPCGiftTastes) ---
// Each item in this array is one "/"-separated section of the gift taste string.
// The array is joined back together with "/" when the build runs.

const giftTasteLines = [

  // Generic gift taste lines for the character
  "$4Placeholder: reaction to a loved gift (generic).",
  "$1Placeholder: reaction to a liked gift (generic).",
  "$0Placeholder: reaction to a neutral gift (generic).",
  "$7Placeholder: reaction to a disliked gift (generic).",
  "$8Placeholder: reaction to a hated gift (generic).",

  // Generic gift taste lines for item categories
  "769 74 637 279 591 340",                 // Loves
  "335 336 82 84 170 221 578 771 773",      // Likes
  "394 24 109 172",                         // Dislikes
  "168 169 909 910 818",                    // Hates
  "universal_neutral",                      // Neutral

  // Explicit gift taste lines for specific items
  "(O)769 $4Placeholder: reaction to this specific item.",
  "(O)74 $8Placeholder: reaction to this specific item.",
  "(O)109 $7Placeholder: reaction to this specific item.",
  "(O)170 $4Placeholder: reaction to this specific item.",
  "(O)172 $5Placeholder: reaction to this specific item.",
  "(O)221 $3Placeholder: reaction to this specific item.",
  "(O)279 $4Placeholder: reaction to this specific item.",
  "(O)578 $1Placeholder: reaction to this specific item.",
  "(O)591 $4Placeholder: reaction to this specific item.",
  "(O)637 $3Placeholder: reaction to this specific item.",
  "(O)771 $6Placeholder: reaction to this specific item.",
  "(O)773 $4Placeholder: reaction to this specific item.",
  "(O)818 $8Placeholder: reaction to this specific item.",
  "(O)340 $4Placeholder: reaction to this specific item.",
  "(O)909 $5Placeholder: reaction to this specific item.",
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
