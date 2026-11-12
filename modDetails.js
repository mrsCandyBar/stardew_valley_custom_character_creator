// Folder that build.js writes its output files into.
// Change this to wherever you want the mod files to land
// (e.g. your Stardew Valley "Mods/YourModName" folder).

const folderLocation = "./dist";

// Values written into manifest.json
const Name = "My Character Replacement - Elliot to Sephiroth";
const Author = "PastelBeans_";
const Version = "1.0.0";
const Description = "Replaces Elliot with Sephiroth.";
const UniqueID = "PastelBeans_.ElliotToSephiroth";
const MinimumApiVersion = "4.0.0";

// Name of the Stardew Valley character being replaced
const SDV_Name = "Elliott"; // StarDewValley_Name

module.exports = {
  SDV_Name,
  folderLocation,
  Name,
  Author,
  Version,
  Description,
  UniqueID,
  MinimumApiVersion,
};
