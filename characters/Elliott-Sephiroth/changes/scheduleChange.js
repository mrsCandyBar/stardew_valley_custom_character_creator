const { SDV_Name } = require("../modDetails");

// --- Custom schedule (Characters/schedules/<SDV_Name>) ---
// Each key is a schedule (season, season:heart level, or weekday).
// Each item in a schedule array is one stop: <time> <location> <x> <y> <facing>.
// The array is joined back together with "/" when the build runs.
// NOTE: not tested in-game yet.
const scheduleTarget = `Characters/schedules/${SDV_Name}`;

const schedules = {
  winter: [
    "600 Beach 34 39 0",
    "1100 Forest 103 13 2",
    "1500 Mountain 30 11 0",
    "2200 Beach 28 39 2",
  ],
  "winter:4": [
    "600 Beach 34 39 0",
    "1100 Mountain 30 11 0",
    "1600 BusStop 5 10 2",
    "2200 Beach 28 39 2",
  ],
  "winter:7": [
    "600 BusStop 2 11 1",
    "1100 Mountain 30 11 0",
    "1600 BusStop 8 10 2",
    "2100 Beach 28 39 2",
  ],
  spring: [
    "600 Mountain 13 10 2",
    "1100 Railroad 15 36 2",
    "1500 Mountain 30 11 0",
    "2100 Beach 28 39 2",
  ],
  summer: [
    "600 Beach 34 39 0",
    "1000 Town 10 59 0",
    "1330 Town 14 62 2",
    "1600 Town 47 80 0",
    "2100 Beach 28 39 2",
  ],
  fall: [
    "600 Forest 35 70 2",
    "1030 Forest 2 9 0",
    "1400 Forest 73 39 2",
    "1800 Mountain 30 11 0",
    "2200 Beach 28 39 2",
  ],
  Fri: [
    "600 Forest 2 9 0",
    "1200 Forest 35 70 2",
    "1600 Forest 73 39 2",
    "2200 Beach 28 39 2",
  ],
  Wed: [
    "600 Town 10 59 0",
    "1200 Town 47 80 0",
    "1700 Town 14 62 2",
    "2200 Beach 28 39 2",
  ],
};

const scheduleEntries = {};
for (const [key, stops] of Object.entries(schedules)) {
  scheduleEntries[key] = stops.join("/");
}

const scheduleChange = {
  Action: "EditData",
  Target: scheduleTarget,
  Entries: scheduleEntries,
};

module.exports = { scheduleChange };
