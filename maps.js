// Reads the game's unpacked maps (game_assets/Maps, made with StardewXnbHack) for the events editor's map view.
// Only what is needed to draw a map: its size, tile layers and the tilesheet images it uses.
const fs = require("fs");
const path = require("path");

const MAPS_DIR = path.join(__dirname, "game_assets", "Maps");

const attrs = (text) => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));

// A file inside MAPS_DIR, found without caring about letter case (Trailer_Big is Trailer_big.tmx), or null.
// `name` may hold folders ("Mines/mine") but never leaves MAPS_DIR.
function findFile(name, extension) {
  const parts = name.replace(/\\/g, "/").split("/");
  if (!parts.length || parts.some((part) => !/^[\w() .-]+$/.test(part) || part.startsWith("."))) return null;
  let dir = MAPS_DIR;
  for (let i = 0; i < parts.length; i++) {
    const want = (i === parts.length - 1 ? parts[i] + extension : parts[i]).toLowerCase();
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return null;
    }
    const match = entries.find((entry) => entry.toLowerCase() === want);
    if (!match) return null;
    dir = path.join(dir, match);
  }
  return dir;
}

// The tilesheet image for a source such as "spring_town" or "Mines\mine". The maps already name the season's sheet.
const tilesheetFile = (source) => findFile(source, ".png");

function readMap(name) {
  const file = findFile(name, ".tmx");
  if (!file) return null;
  const xml = fs.readFileSync(file, "utf8");
  const header = attrs(/<map [^>]*>/.exec(xml)[0]);

  const tilesets = [...xml.matchAll(/<tileset ([^>]*)>([\s\S]*?)<\/tileset>/g)].flatMap(([, tag, body]) => {
    const set = attrs(tag);
    const image = /<image ([^>]*)>/.exec(body);
    if (!image) return [];
    const { source } = attrs(image[1]);
    return [{ firstgid: Number(set.firstgid), columns: Number(set.columns), tileWidth: Number(set.tilewidth), tileHeight: Number(set.tileheight), image: source.replace(/\\/g, "/"), found: !!tilesheetFile(source) }];
  });

  const layers = [...xml.matchAll(/<layer ([^>]*)>(?:\s*<properties\s*\/>|\s*<properties>[\s\S]*?<\/properties>)?\s*<data encoding="csv">([\s\S]*?)<\/data>/g)].map(([, tag, csv]) => ({
    name: attrs(tag).name,
    tiles: csv.split(",").map((n) => Number(n.trim()) >>> 0),
  }));

  return { name, width: Number(header.width), height: Number(header.height), tileWidth: Number(header.tilewidth), tileHeight: Number(header.tileheight), tilesets, layers };
}

module.exports = { readMap, tilesheetFile };
