// Events: the command types, locations and music the editors offer.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// --- Events ---
// An event is a few required settings (id, place, music, viewport, actors) plus optional conditions,
// "skippable", and a list of commands. Each command is { type, args } and is written "<type> <args>" at build time.
// A command type that has a definition below gets its own fields; anything else is a "custom" command (type + args typed in).
const FACING = options([0, 1, 2, 3], (n) => ["up", "right", "down", "left"][n]);
const CUSTOM = "custom";
const actorText = { kind: "text", title: "Who", placeholder: "{name}", narrow: true };
const actorAndWords = (label, wordsKind = "textarea", hideWho = false) => ({
  label,
  fields: [actorText, { kind: wordsKind, title: "Words", placeholder: wordsKind === "dialogue" ? "What they say" : "A $1 at the start changes the portrait" }],
  defaults: ["{name}", ""],
  inHead: hideWho ? 1 : 2,
  hide: hideWho ? [0] : [], // the Who box is hidden for now; its value is kept ("{name}" unless the file said otherwise)
  parse: (args) => {
    const match = /^(\S+) "(.*)"$/s.exec(args);
    return match && [match[1], match[2]];
  },
  compose: ([who, words]) => `${who} "${words}"`,
});
const spaced = (pattern) => (args) => {
  const match = pattern.exec(args);
  return match && match.slice(1);
};
const noFields = (label) => ({ label, fields: [], defaults: [], parse: (args) => (args === "" ? [] : null), compose: () => "" });

const COMMAND_TYPES = {
  speak: actorAndWords("Speak", "dialogue", true),
  textAboveHead: actorAndWords("Text above head", "text"),
  pause: {
    label: "Pause",
    fields: [{ kind: "number", title: "Milliseconds", min: 0, small: true }],
    defaults: ["500"],
    parse: spaced(/^(\d+)$/),
    compose: ([ms]) => ms,
  },
  move: {
    label: "Move",
    fields: [actorText, { kind: "number", title: "Tiles right (negative is left)" }, { kind: "number", title: "Tiles down (negative is up)" }, { kind: "select", title: "Face", options: FACING }],
    defaults: ["farmer", "0", "0", "2"],
    hide: [1, 2, 3], // set with "Show on map" instead
    parse: spaced(/^(\S+) (-?\d+) (-?\d+) ([0-3])$/),
    compose: (values) => values.join(" "),
  },
  emote: {
    label: "Emote",
    fields: [actorText, { kind: "emote", title: "Emote" }],
    defaults: ["{name}", "32"],
    inHead: 2,
    parse: spaced(/^(\S+) (\d+)$/),
    compose: (values) => values.join(" "),
  },
  showFrame: {
    label: "Show frame",
    fields: [actorText, { kind: "number", title: "Sprite frame", min: 0 }],
    defaults: ["{name}", "0"],
    parse: spaced(/^(\S+) (\d+)$/),
    compose: (values) => values.join(" "),
  },
  shake: {
    label: "Shake",
    fields: [actorText, { kind: "number", title: "Milliseconds", min: 0 }],
    defaults: ["{name}", "500"],
    parse: spaced(/^(\S+) (\d+)$/),
    compose: (values) => values.join(" "),
  },
  jump: {
    label: "Jump",
    fields: [actorText],
    defaults: ["{name}"],
    parse: spaced(/^(\S+)$/),
    compose: ([who]) => who,
  },
  playMusic: {
    label: "Play music",
    fields: [{ kind: "music", title: "Track" }],
    defaults: ["sweet"],
    parse: spaced(/^(\S+)$/),
    compose: ([track]) => track,
  },
  stopMusic: noFields("Stop music"),
  playSound: {
    label: "Play sound",
    fields: [{ kind: "text", title: "Sound name", placeholder: "e.g. dwop" }],
    defaults: [""],
    parse: spaced(/^(\S+)$/),
    compose: ([sound]) => sound,
  },
  end: noFields("End"),
};

// Maps with a Data/Events/<place> file in the game: [value, label]
const LOCATIONS = [
  ["Farm", "Farm"], ["FarmHouse", "Farmhouse"], ["Cellar", "Cellar"], ["Town", "Pelican Town"], ["Beach", "Beach"], ["Forest", "Cindersap Forest"],
  ["Mountain", "Mountain"], ["Backwoods", "Backwoods"], ["BusStop", "Bus Stop"], ["Woods", "Secret Woods"], ["Railroad", "Railroad"], ["Desert", "Calico Desert"],
  ["Mine", "The Mines"], ["Sewer", "Sewers"], ["WitchSwamp", "Witch's Swamp"], ["Tent", "Linus' Tent"], ["Temp", "Temporary map (cutscenes)"],
  ["ArchaeologyHouse", "Museum / Library"], ["ElliottHouse", "Elliott's Cabin"], ["Saloon", "Stardrop Saloon"], ["SeedShop", "Pierre's General Store"],
  ["Hospital", "Harvey's Clinic"], ["HarveyRoom", "Harvey's Room"], ["Blacksmith", "Clint's Blacksmith"], ["AnimalShop", "Marnie's Ranch"],
  ["ScienceHouse", "Carpenter's Shop"], ["SebastianRoom", "Sebastian's Room"], ["Sunroom", "Robin's Sunroom"], ["HaleyHouse", "2 Willow Lane (Haley & Emily)"],
  ["JoshHouse", "1 River Road (Alex)"], ["LeahHouse", "Leah's Cottage"], ["ManorHouse", "Mayor's Manor"], ["Trailer", "Trailer (Penny)"],
  ["Trailer_Big", "Trailer (upgraded)"], ["WizardHouse", "Wizard's Tower"], ["SandyHouse", "Oasis"], ["Club", "Casino"], ["BathHouse_Pool", "Spa pool"],
  ["CommunityCenter", "Community Center"],
];

// Music tracks usable as the event's starting music (or "playMusic"): [value, label]
const MUSIC = [
  ["none", "None (silent)"],
  ["spring1", "Spring 1"], ["spring2", "Spring 2"], ["spring3", "Spring 3"], ["summer1", "Summer 1"], ["summer2", "Summer 2"], ["summer3", "Summer 3"],
  ["fall1", "Fall 1"], ["fall2", "Fall 2"], ["fall3", "Fall 3"], ["winter1", "Winter 1"], ["winter2", "Winter 2"], ["winter3", "Winter 3"],
  ["sweet", "Sweet (romantic)"], ["tribal", "Tribal"], ["wavy", "Wavy"], ["woodsTheme", "Secret Woods"], ["SettlingIn", "Settling In"], ["springtown", "Spring Town"],
  ["ragtime", "Ragtime"], ["echos", "Echos"], ["CloudCountry", "Cloud Country"], ["crane_game", "Crane game"], ["distantBanjo", "Distant Banjo"], ["desolate", "Desolate"],
  ["jaunty", "Jaunty"], ["heavy", "Heavy"], ["libraryTheme", "Library"], ["marlon", "Marlon"], ["musicboxsong", "Music box"], ["night_market", "Night market"],
  ["Orange", "Orange"], ["playful", "Playful"], ["poppy", "Poppy"], ["sadpiano", "Sad piano"], ["shimmeringbastion", "Shimmering Bastion"], ["tickTock", "Tick tock"],
  ["WizardSong", "Wizard"], ["EarthMine", "Earth Mine"], ["FrogCave", "Frog Cave"], ["Icicles", "Icicles"], ["Cavern", "Cavern"], ["moonlightJellies", "Moonlight Jellies"],
];
const OTHER_CHOICE = "__other__";

// A dropdown of [value, label] choices. A value that isn't in the list (e.g. typed by hand earlier) is kept as its own choice.
const choiceSelect = (choices, value, title) => dropdown(choices, value, { title, keepUnknown: true });
