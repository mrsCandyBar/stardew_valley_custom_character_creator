// The editable values live in modDetails.json (the interface edits that file).
// This file reads them and adds the values that are worked out at build time.
const {
  // Folder that build.js builds into. The mod gets its own Content Patcher folder inside it,
  // named "[CP] <SDV_Name>-<newCharacterName>" (see modFolderName below).
  // Relative paths are resolved from the project root.
  folderLocation,
  // Name of the new character that replaces them
  newCharacterName,
  // Values written into manifest.json
  Name,
  Author,
  Version,
  Description,
  UniqueID,
  MinimumApiVersion,
} = require("./modDetails.json");

// Name of the Stardew Valley character being replaced (StarDewValley_Name).
// build.js sets this from --name (or the prompt), so it is not written here.
const SDV_Name = process.env.SDV_NAME;

// Name of the folder the mod is built into, e.g. "[CP] Elliott-Sephiroth" for Elliott replaced by Sephiroth
const modFolderName = `[CP] ${SDV_Name}-${newCharacterName}`;

module.exports = {
  SDV_Name,
  newCharacterName,
  folderLocation,
  modFolderName,
  Name,
  Author,
  Version,
  Description,
  UniqueID,
  MinimumApiVersion,
};
