// Each object in `changes` is added to the "Changes" array in content.json.
// Each change lives in its own file in the changes/ folder.
const { musicChange } = require("./changes/musicChange");
const { spriteChange } = require("./changes/spriteChange");
const { portraitChange } = require("./changes/portraitChange");

const { giftTastesChange } = require("./changes/giftTastesChange");

const { eventChanges } = require("./changes/eventChange");

const changes = [spriteChange, portraitChange, giftTastesChange, ...eventChanges, musicChange];

module.exports = { changes };
