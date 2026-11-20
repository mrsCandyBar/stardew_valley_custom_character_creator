// Finds the game's own events for a character so build.js can switch them off.
// It reads the game's unpacked Data/Events (made with StardewXnbHack, the same unpack the maps come from).
// Set STARDEW_CONTENT to the "Content (unpacked)" folder if it isn't in the usual Steam spot.
const fs = require("fs");
const path = require("path");

const CANDIDATES = [
  process.env.STARDEW_CONTENT,
  "C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley/Content (unpacked)",
  "C:/Program Files/Steam/steamapps/common/Stardew Valley/Content (unpacked)",
].filter(Boolean);

const findEventsDir = () => CANDIDATES.map((dir) => path.join(dir, "Data", "Events")).find((dir) => fs.existsSync(dir));

// NPCs whose friendship (f) or marriage (O) an event needs. "p Gus" (Gus has to be in the room) doesn't make it his event.
function npcsIn(conditions) {
  const names = new Set();
  for (const condition of conditions) {
    const match = condition.match(/^[fO] (\w+)/);
    if (match) names.add(match[1]);
  }
  return names;
}

// Returns { "<location>": ["<event key>", ...] } for events that are only about this character.
// Group events that need other NPCs too (e.g. the 10-heart Saloon scenes) are left, since they belong to those NPCs as well.
// Returns null if the game's unpacked events can't be found.
function findDefaultEvents(npc) {
  const dir = findEventsDir();
  if (!dir) return null;
  const found = {};
  // Plain "<Location>.json" only: the "<Location>.de-DE.json"-style files are translations
  for (const file of fs.readdirSync(dir).filter((f) => /^[A-Za-z_]+\.json$/.test(f))) {
    const events = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    for (const key of Object.keys(events)) {
      const npcs = npcsIn(key.split("/").slice(1));
      if (npcs.size === 1 && npcs.has(npc)) (found[path.basename(file, ".json")] ||= []).push(key);
    }
  }
  return found;
}

// EditData changes that remove those events (a null entry deletes it in Content Patcher)
function disableChanges(npc) {
  const found = findDefaultEvents(npc);
  if (!found) return null;
  return Object.entries(found).map(([location, keys]) => ({
    Action: "EditData",
    Target: `Data/Events/${location}`,
    Entries: Object.fromEntries(keys.map((key) => [key, null])),
  }));
}

module.exports = { disableChanges };
