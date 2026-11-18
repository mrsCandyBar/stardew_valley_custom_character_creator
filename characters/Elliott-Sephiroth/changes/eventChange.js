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
// A { type: "repeat", times, commands } group is written out `times` times (the game has no loops)
const expand = (list) => list.flatMap((c) => (c.type === "repeat" ? Array.from({ length: c.times }, () => expand(c.commands)).flat() : [c]));
const toText = ({ type, args }) => fill(type === "raw" ? args : args ? `${type} ${args}` : type);

// Turns an event into its main entry and, if it has one, its fork entry. Forks are kept apart so they can go last.
function toEntries({ id, conditions, music, viewport, actors, skippable, commands, forkName, forkCommands }) {
  const key = fill([id, ...conditions].join("/"));
  const sequence = [fill(music), fill(viewport), fill(actors), ...(skippable ? ["skippable"] : []), ...expand(commands).map(toText)];
  const fork = forkName ? [fill(forkName), expand(forkCommands || []).map(toText).join("/")] : null;
  return { event: [key, sequence.join("/")], fork };
}

// One EditData change per location, in the order the locations first appear.
// Each location lists all of its events first (in order), then all of its forks.
const byLocation = new Map();
for (const event of events) {
  if (!byLocation.has(event.location)) byLocation.set(event.location, { main: [], forks: [] });
  const group = byLocation.get(event.location);
  const { event: main, fork } = toEntries(event);
  group.main.push(main);
  if (fork) group.forks.push(fork);
}

function toEntryMap(location, { main, forks }) {
  const entries = {};
  for (const [key, value] of [...main, ...forks]) {
    if (key in entries) throw new Error(`Duplicate event key in ${location}: ${key}`);
    entries[key] = value;
  }
  return entries;
}

const eventChanges = [...byLocation].map(([location, group]) => ({
  Action: "EditData",
  Target: `${folder}/${location}`,
  Entries: toEntryMap(location, group),
}));

module.exports = { eventChanges };
