const { SDV_Name, newCharacterName } = require("../modDetails");

// --- Custom display name (Data/Characters) ---
const displayNameTarget = "Data/Characters";
const displayName = `${newCharacterName}?`;

const displayNameChange = {
  Action: "EditData",
  Target: displayNameTarget,
  Entries: {
    [SDV_Name]: {
      DisplayName: displayName,
    },
  },
};

module.exports = { displayNameChange };
