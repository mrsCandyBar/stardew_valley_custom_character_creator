// Define the variables for a change first, then pull them into its object.

// --- Example: custom music track (Data/AudioChanges) ---
const musicEntryKey = "crisis-core-theme-the-terrible-truth-takeharu-ishimoto";
const musicId = "crisis-core-theme-the-terrible-truth-takeharu-ishimoto";
const musicFilePath = "{{AbsoluteFilePath: assets/crisis-core-theme-the-terrible-truth-takeharu-ishimoto.ogg}}";

const musicChange = {
  Action: "EditData",
  Target: "Data/AudioChanges",
  Entries: {
    [musicEntryKey]: {
      ID: musicId,
      Category: "Music",
      FilePaths: [musicFilePath],
      StreamedVorbis: true,
      Looped: false,
    },
  },
};

module.exports = { musicChange };
