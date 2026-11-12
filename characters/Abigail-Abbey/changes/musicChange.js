// --- Custom music track (Data/AudioChanges) ---
// The file name lives in music.json (the interface writes it when you upload a track).
// With no file set, there is no music change and nothing is added to content.json.
const { file } = require("../music.json");

let musicChange = null;

if (file) {
  // The track's id is its file name without the extension, e.g. "my-song" for "my-song.ogg".
  const musicId = file.replace(/\.[^.]+$/, "");

  musicChange = {
    Action: "EditData",
    Target: "Data/AudioChanges",
    Entries: {
      [musicId]: {
        ID: musicId,
        Category: "Music",
        FilePaths: [`{{AbsoluteFilePath: assets/${file}}}`],
        StreamedVorbis: true,
        Looped: false,
      },
    },
  };
}

module.exports = { musicChange };
