const { SDV_Name } = require("../modDetails");

// --- Custom schedule (Characters/schedules/<SDV_Name>) ---
// The schedules live in schedule.json (the interface edits that file) as a list of { key, lines }.
// A key is a weekday (Mon), a season (spring, summer, fall, winter) or a day of a season (spring:1).
// Each item in a lines array is one stop: <time> <location> <x> <y> <facing>.
// The array is joined back together with "/" when the build runs.
// NOTE: not tested in-game yet.
const scheduleTarget = `Characters/schedules/${SDV_Name}`;

const { entries } = require("../schedule.json");

const scheduleEntries = {};
for (const { key, lines } of entries) {
  if (key in scheduleEntries) {
    throw new Error(`Duplicate schedule key: ${key}`);
  }
  scheduleEntries[key] = lines.join("/");
}

const scheduleChange = {
  Action: "EditData",
  Target: scheduleTarget,
  Entries: scheduleEntries,
};

module.exports = { scheduleChange };
