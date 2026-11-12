const fs = require("fs");
const path = require("path");
const readline = require("readline/promises");

const USAGE = `Usage: node build.js --name <SDV character> --folder <character folder>

  --name,   -n   The Stardew Valley character being replaced (e.g. Elliott)
  --folder, -f   Folder containing modDetails.js, changes.js and assets/

If either is missing you will be asked for it.`;

// Reads "--flag value", "--flag=value" or "-f value" from the command line.
function getArg(flags) {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    for (const flag of flags) {
      if (args[i] === flag) return args[i + 1];
      if (args[i].startsWith(`${flag}=`)) return args[i].slice(flag.length + 1);
    }
  }
  return undefined;
}

// Reads the next line of input (works for typed and piped input).
async function ask(lines, question) {
  process.stdout.write(question);
  const { value } = await lines.next();
  return (value || "").trim();
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(USAGE);
    return;
  }

  let name = getArg(["--name", "-n"]);
  let folder = getArg(["--folder", "-f"]);

  if (!name || !folder) {
    const rl = readline.createInterface({ input: process.stdin });
    const lines = rl[Symbol.asyncIterator]();
    try {
      if (!name) name = await ask(lines, "Character name (e.g. Elliott): ");
      if (!folder) folder = await ask(lines, "Path to the character folder: ");
    } finally {
      rl.close();
    }
  }

  if (!name || !folder) {
    console.error("A character name and a folder are both required.\n");
    console.error(USAGE);
    process.exit(1);
  }

  const characterDir = path.resolve(folder);
  for (const required of ["modDetails.js", "changes.js"]) {
    if (!fs.existsSync(path.join(characterDir, required))) {
      console.error(`Missing ${required} in ${characterDir}`);
      process.exit(1);
    }
  }

  // The character's files read the name from SDV_NAME, so set it before loading them.
  process.env.SDV_NAME = name;
  const {
    folderLocation,
    modFolderName,
    Name,
    Author,
    Version,
    Description,
    UniqueID,
    MinimumApiVersion,
  } = require(path.join(characterDir, "modDetails.js"));
  const { changes } = require(path.join(characterDir, "changes.js"));

  console.log(`Building ${name} from ${characterDir}`);

  const outDir = path.resolve(__dirname, folderLocation, modFolderName);
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

  // Copy the character's assets folder into the output folder
  const assetsSrc = path.join(characterDir, "assets");
  if (fs.existsSync(assetsSrc)) {
    const assetsDest = path.join(outDir, "assets");
    fs.cpSync(assetsSrc, assetsDest, { recursive: true });
    console.log(`Copied ${assetsSrc} to ${assetsDest}`);
  } else {
    console.warn(`No assets folder in ${characterDir}, skipping.`);
  }
}

main();
