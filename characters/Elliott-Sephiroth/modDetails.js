// Folder that build.js builds into. The mod gets its own Content Patcher folder inside it,
// named "[CP] <SDV_Name>-<newCharacterName>" (see modFolderName below).
// Relative paths are resolved from the project root.
const folderLocation = "./dist";

// Values written into manifest.json
const Name = "My Character Replacement - Elliot to Sephiroth";
const Author = "PastelBeans_";
const Version = "1.0.0";
const Description = "Replaces Elliot with Sephiroth.";
const UniqueID = "PastelBeans_.ElliotToSephiroth";
const MinimumApiVersion = "4.0.0";

// Name of the Stardew Valley character being replaced (StarDewValley_Name).
// build.js sets this from --name (or the prompt), so it is not written here.
const SDV_Name = process.env.SDV_NAME;

// Name of the new character that replaces them
const newCharacterName = "Sephiroth";

// Name of the folder the mod is built into, e.g. "[CP] Elliott-Sephiroth"
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
