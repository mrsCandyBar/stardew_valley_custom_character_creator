const { SDV_Name, newCharacterName, UniqueID } = require("../modDetails");

// --- Mail (Data/Mail) and the trigger that sends it (Data/TriggerActions) ---
// The letters live in mail.json (the interface edits that file) as a list of
// { id, subject, text, items: [{ item, count }], money, trigger, friendshipPoints, condition, delivery, once }.
// "{name}" anywhere in the file is replaced with SDV_Name, and "{newName}" with the new character's name (use that to sign a letter). Content Patcher tokens like {{ PlayerName }} are left alone.
//
// A letter is written "<text>[ %item ... %%][#]<subject>", with "^" as a line break.
// Each letter's key is "<UniqueID>_<id>", so it can't clash with other mods.
const { mail } = require("../mail.json");

const fill = (text) => text.replaceAll("{name}", SDV_Name).replaceAll("{newName}", newCharacterName);
const keyOf = (id) => `${UniqueID}_${id}`;

function toLetter({ subject, text, items = [], money = 0 }) {
  const attachments = [];
  if (items.length) attachments.push(`%item object ${items.map(({ item, count }) => `${item} ${count}`).join(" ")} %%`);
  if (money > 0) attachments.push(`%item money ${money} ${money} %%`);
  const body = fill(text).replace(/\s*\r?\n/g, "^");
  return `${[body, ...attachments].join(" ")}[#]${fill(subject)}`;
}

function toAction(letter) {
  // friendshipPoints is the points with SDV_Name (250 points = 1 heart); any other game state query goes in `condition`
  const conditions = [
    ...(letter.friendshipPoints > 0 ? [`PLAYER_FRIENDSHIP_POINTS Current ${SDV_Name} ${letter.friendshipPoints}`] : []),
    ...(letter.condition ? [fill(letter.condition)] : []),
  ];
  const id = keyOf(letter.id);
  return {
    Id: id,
    Trigger: letter.trigger,
    ...(conditions.length ? { Condition: conditions.join(", ") } : {}),
    Actions: [`AddMail Current ${id} ${letter.delivery}`],
    // Sent once by default. Untick "once" and it is sent again every time the trigger fires and the condition is true.
    ...(letter.once === false ? { MarkActionApplied: false } : {}),
  };
}

const mailEntries = {};
const actionEntries = {};
for (const letter of mail) {
  const key = keyOf(letter.id);
  if (key in mailEntries) throw new Error(`Duplicate mail ID: ${key}`);
  mailEntries[key] = toLetter(letter);
  actionEntries[key] = toAction(letter);
}

// Nothing is added when there are no letters
const mailChanges = mail.length
  ? [
      { Action: "EditData", Target: "Data/Mail", Entries: mailEntries },
      { Action: "EditData", Target: "Data/TriggerActions", Entries: actionEntries },
    ]
  : [];

module.exports = { mailChanges };
