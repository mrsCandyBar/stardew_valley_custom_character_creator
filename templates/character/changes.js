// Each object in `changes` is added to the "Changes" array in content.json.
// Each change lives in its own file in the changes/ folder.
const { spriteChange } = require("./changes/spriteChange");
const { portraitChange } = require("./changes/portraitChange");
const { displayNameChange } = require("./changes/displayNameChange");
const { giftTastesChange } = require("./changes/giftTastesChange");
const { eventChanges } = require("./changes/eventChange");
const { dialogueChange } = require("./changes/dialogueChange");
const { marriageDialogueChange } = require("./changes/marriageDialogueChange");
const { scheduleChange } = require("./changes/scheduleChange");

const changes = [
    spriteChange, 
    portraitChange,
    displayNameChange,
    giftTastesChange,
    dialogueChange,
    marriageDialogueChange,
    scheduleChange,
    ...eventChanges
];

module.exports = { changes };
