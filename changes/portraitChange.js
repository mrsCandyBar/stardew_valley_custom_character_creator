const { SDV_Name } = require("../modDetails");

// --- Custom character portrait (Portraits/<SDV_Name>) ---
const portraitTarget = `Portraits/${SDV_Name}`;
const portraitFromFile = "assets/custom_portraits_v2.png";

const portraitChange = {
  Action: "Load",
  Target: portraitTarget,
  FromFile: portraitFromFile,
};

module.exports = { portraitChange };
