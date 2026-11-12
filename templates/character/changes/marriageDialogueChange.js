const { SDV_Name } = require("../modDetails");

// --- Marriage dialogue (Characters/Dialogue/MarriageDialogue) ---
// Each key is a dialogue entry; keys that include the character's name use SDV_Name.
// Each item in a lines array is one "#"-separated section,
// joined back together with "#" when the build runs.
const marriageDialogueTarget = "Characters/Dialogue/MarriageDialogue";

const indoorMorningKey = `Indoor_Morning_${SDV_Name}`;
const indoorMorningLines = [
  "Placeholder marriage dialogue for indoorMorning (part 1).",
  "$1Placeholder marriage dialogue for indoorMorning (part 2).",
];

const indoorNightKey = `Indoor_Night_${SDV_Name}`;
const indoorNightLines = [
  "Placeholder marriage dialogue for indoorNight (part 1).",
  "$1Placeholder marriage dialogue for indoorNight (part 2).",
];

const outdoorKey = `Outdoor_${SDV_Name}`;
const outdoorLines = [
  "Placeholder marriage dialogue for outdoor (part 1).",
  "$1Placeholder marriage dialogue for outdoor (part 2).",
];

const oneRoomKey = `OneRoom_${SDV_Name}`;
const oneRoomLines = [
  "Placeholder marriage dialogue for oneRoom (part 1).",
  "$1Placeholder marriage dialogue for oneRoom (part 2).",
  "$1Placeholder marriage dialogue for oneRoom (part 3).",
];

const funKey = "fun_12";
const funLines = [
  "Placeholder marriage dialogue for fun (part 1).",
  "$1Placeholder marriage dialogue for fun (part 2).",
  "$1Placeholder marriage dialogue for fun (part 3).",
  "$1Placeholder marriage dialogue for fun (part 4).",
];

const rainyDayKey = `Rainy_Day_${SDV_Name}`;
const rainyDayLines = [
  "Placeholder marriage dialogue for rainyDay (part 1).",
  "$1Placeholder marriage dialogue for rainyDay (part 2).",
  "$1Placeholder marriage dialogue for rainyDay (part 3).",
];

const patioKey = `patio_${SDV_Name}`;
const patioLines = [
  "Placeholder marriage dialogue for patio (part 1).",
  "$1Placeholder marriage dialogue for patio (part 2).",
  "$1Placeholder marriage dialogue for patio (part 3).",
  "$1Placeholder marriage dialogue for patio (part 4).",
];

const marriageDialogueChange = {
  Action: "EditData",
  Target: marriageDialogueTarget,
  Entries: {
    [indoorMorningKey]: indoorMorningLines.join("#"),
    [indoorNightKey]: indoorNightLines.join("#"),
    [outdoorKey]: outdoorLines.join("#"),
    [oneRoomKey]: oneRoomLines.join("#"),
    [funKey]: funLines.join("#"),
    [rainyDayKey]: rainyDayLines.join("#"),
    [patioKey]: patioLines.join("#"),
  },
};

module.exports = { marriageDialogueChange };
