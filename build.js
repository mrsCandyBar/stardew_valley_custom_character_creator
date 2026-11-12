const fs = require("fs");
const path = require("path");
const {
  folderLocation,
  Name,
  Author,
  Version,
  Description,
  UniqueID,
  MinimumApiVersion,
} = require("./modDetails");
const { changes } = require("./changes");

const outDir = path.resolve(__dirname, folderLocation);
fs.mkdirSync(outDir, { recursive: true });

function writeJson(fileName, data) {
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}

// content.json
writeJson("content.json", {
  Format: "2.0.0",
  Changes: changes,
});

// manifest.json
writeJson("manifest.json", {
  Name,
  Author,
  Version,
  Description,
  UniqueID,
  EntryDll: null,
  MinimumApiVersion,
  UpdateKeys: [],
  ContentPackFor: {
    UniqueID: "Pathoschild.ContentPatcher",
  },
  Dependencies: [
    {
      UniqueID: "Pathoschild.ContentPatcher",
      IsRequired: true,
    },
  ],
});

// Copy the assets folder into the output folder
const assetsSrc = path.join(__dirname, "assets");
const assetsDest = path.join(outDir, "assets");
fs.cpSync(assetsSrc, assetsDest, { recursive: true });
console.log(`Copied ${assetsSrc} to ${assetsDest}`);
