const { archaeologyEvent } = require("./events/archaeologyEvent");
const { pastLifeEvent } = require("./events/pastLifeEvent");
const { pianoEvent } = require("./events/pianoEvent");
const { beachBelongEvent } = require("./events/beachBelongEvent");
const { beachConfessionEvent } = require("./events/beachConfessionEvent");
const { farmSunriseEvent } = require("./events/farmSunriseEvent");

// Turns an event into its entries: the event itself and, if it has one, its fork.
// Sequences are joined with "/" here.
function toEntries({ eventName, eventSequence, forkName, forkSequence }) {
  const entries = { [eventName]: eventSequence.join("/") };
  if (forkName) {
    entries[forkName] = forkSequence.join("/");
  }
  return entries;
}

const folder = "Data/Events";

// --- Data/Events/ArchaeologyHouse ---
const archaeologyHouseTarget = `${folder}/ArchaeologyHouse`;

const archaeologyHouseChange = {
  Action: "EditData",
  Target: archaeologyHouseTarget,
  Entries: {
    ...toEntries(archaeologyEvent),
  },
};

// --- Data/Events/ElliottHouse ---
const elliottHouseTarget = `${folder}/ElliottHouse`;

const elliottHouseChange = {
  Action: "EditData",
  Target: elliottHouseTarget,
  Entries: {
    ...toEntries(pastLifeEvent),
    ...toEntries(pianoEvent),
  },
};

// --- Data/Events/Beach ---
const beachTarget = `${folder}/Beach`;

const beachChange = {
  Action: "EditData",
  Target: beachTarget,
  Entries: {
    ...toEntries(beachBelongEvent),
    ...toEntries(beachConfessionEvent),
  },
};

// --- Data/Events/Farm ---
const farmTarget = `${folder}/Farm`;

const farmChange = {
  Action: "EditData",
  Target: farmTarget,
  Entries: {
    ...toEntries(farmSunriseEvent),
  },
};

const eventChanges = [archaeologyHouseChange, elliottHouseChange, beachChange, farmChange];

module.exports = { eventChanges };
