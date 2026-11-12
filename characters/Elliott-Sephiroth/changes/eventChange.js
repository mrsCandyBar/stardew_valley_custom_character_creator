const { SDV_Name } = require("../modDetails");

// --- Events (Data/Events/<location>) ---
// The events live in events.json (the interface edits that file) as a list of events. Each one is
// { id, location, conditions, music, viewport, actors, skippable, commands, forkName?, forkCommands? }.
// "{name}" anywhere in the file is replaced with SDV_Name. Content Patcher tokens like {{ PlayerName }} are left alone.
//
// An event is written as the key "<id>/<conditions...>" and a script of "/"-separated commands:
// music, viewport, actors, then "skippable" (optional), then the commands, each written as "<type> <args>".
// A fork (the answer jumped to by a "fork" command) is its own entry whose key is the fork name.
const { events } = require("../events.json");

const folder = "Data/Events";
const fill = (text) => text.replaceAll("{name}", SDV_Name);
const toText = ({ type, args }) => fill(type === "raw" ? args : args ? `${type} ${args}` : type);

// Turns an event into its entries: the event itself and, if it has one, its fork.
function toEntries({ id, conditions, music, viewport, actors, skippable, commands, forkName, forkCommands }) {
  const key = fill([id, ...conditions].join("/"));
  const sequence = [fill(music), fill(viewport), fill(actors), ...(skippable ? ["skippable"] : []), ...commands.map(toText)];
  const entries = { [key]: sequence.join("/") };
  if (forkName) {
    entries[fill(forkName)] = (forkCommands || []).map(toText).join("/");
  }
  return entries;
}

// One EditData change per location, in the order the locations first appear.
const byLocation = new Map();
for (const event of events) {
  if (!byLocation.has(event.location)) byLocation.set(event.location, {});
  const entries = byLocation.get(event.location);
  for (const [key, value] of Object.entries(toEntries(event))) {
    if (key in entries) throw new Error(`Duplicate event key in ${event.location}: ${key}`);
    entries[key] = value;
  }
}

const eventChanges = [...byLocation].map(([location, entries]) => ({
  Action: "EditData",
  Target: `${folder}/${location}`,
  Entries: entries,
}));

module.exports = { eventChanges };
