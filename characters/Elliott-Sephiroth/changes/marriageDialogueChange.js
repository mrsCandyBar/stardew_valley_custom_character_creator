const { SDV_Name } = require("../modDetails");

// --- Marriage dialogue (Characters/Dialogue/MarriageDialogue) ---
// Each key is a dialogue entry; keys that include the character's name use SDV_Name.
// Each item in a lines array is one "#"-separated section,
// joined back together with "#" when the build runs.
const marriageDialogueTarget = "Characters/Dialogue/MarriageDialogue";

const indoorMorningKey = `Indoor_Morning_${SDV_Name}`;
const indoorMorningLines = [
  "Good morning my love. If you need any heavy lifting done on the farm today, just say the word. ",
  "$1Consider it an official request.",
];

const indoorNightKey = `Indoor_Night_${SDV_Name}`;
const indoorNightLines = [
  "You're back late. I was tempted to bring you home... ",
  "$1Come, sit down. Tell me about your day.",
];

const outdoorKey = `Outdoor_${SDV_Name}`;
const outdoorLines = [
  "Being your partner in this quiet valley... it is a victory I never sought, ",
  "$4yet it is the greatest one I have.",
];

const oneRoomKey = `OneRoom_${SDV_Name}`;
const oneRoomLines = [
  "This space is... peaceful. I am unaccustomed to luxury, ",
  "$2but a soldier appreciates a well-maintained base of operations. Not to brag but... ",
  "$4I get to wake up beside the best view in the entire valley everyday.",
];

const funKey = "fun_12";
const funLines = [
  "I tried to feed the chickens. ",
  "$7They completely ignored my authority! ",
  "$5I suppose my presence isn't very... vexing to a flock of birds. ",
  "$7It was... humbling.",
];

const rainyDayKey = `Rainy_Day_${SDV_Name}`;
const rainyDayLines = [
  "The rain reminds me of the storms over Midgar, ",
  "$2but there is no acid in this water. It is just... nature. ",
  "$6Stay inside today if you can. I do not wish for you to catch a cold.",
];

const patioKey = `patio_${SDV_Name}`;
const patioLines = [
  "My movements are... slowing down. ",
  "$8Not from age! it's because the edge is gone! ",
  "$1I no longer feel the need to destroy. I only feel the urge to protect this land. ",
  "$6To protect you.",
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
