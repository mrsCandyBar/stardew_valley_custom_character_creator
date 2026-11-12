const { SDV_Name } = require("../modDetails");

// --- Custom character sprite (Characters/<SDV_Name>) ---
const spriteTarget = `Characters/${SDV_Name}`;
const spriteFromFile = "assets/custom_sprites.png";

const spriteChange = {
  Action: "Load",
  Target: spriteTarget,
  FromFile: spriteFromFile,
};

module.exports = { spriteChange };
