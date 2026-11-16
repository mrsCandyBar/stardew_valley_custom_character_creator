// Builds items.json (the list the item picker shows) from the unpacked game file Objects.json.
// Run from the project root after replacing Objects.json or springobjects.png:  node interface/gameSprites/makeItems.js
// Only items drawn from springobjects.png are kept. Items on other sheets (e.g. Objects_2) have no icon here.
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const objects = JSON.parse(fs.readFileSync(path.join(dir, "Objects.json"), "utf8")).content;

const items = Object.entries(objects)
  .filter(([, o]) => !o.Texture || o.Texture === "Maps\springobjects")
  .map(([id, o]) => ({ id, name: o.Name, sprite: o.SpriteIndex }))
  .sort((a, b) => {
    const [na, nb] = [Number(a.id), Number(b.id)];
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    if (!isNaN(na)) return -1; // numbered items first, then named ones
    if (!isNaN(nb)) return 1;
    return a.id.localeCompare(b.id);
  });

fs.writeFileSync(path.join(dir, "items.json"), JSON.stringify(items));
console.log(`Wrote ${items.length} of ${Object.keys(objects).length} items to items.json`);
