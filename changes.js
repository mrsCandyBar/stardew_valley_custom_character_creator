// Each object in `changes` is added to the "Changes" array in content.json.
// Each change lives in its own file in the changes/ folder.
const { musicChange } = require("./changes/musicChange");

const changes = [musicChange];

module.exports = { changes };
