# stardew_valley_custom_character_creator
Create and replace any Stardew Valley character in a builder that writes the custom files for you.

## Usage

```
node build.js --name Elliott --folder characters/Elliott-Sephiroth
```

| Option | Description |
| --- | --- |
| `--name`, `-n` | The Stardew Valley character being replaced (e.g. `Elliott`). Becomes `SDV_Name` in the character's files. |
| `--folder`, `-f` | The character folder holding `modDetails.js`, `changes.js` and `assets/`. Can be anywhere on disk. |

If either option is missing, `node build.js` asks for it. `node build.js --help` shows the usage.

When you run `node build.js`, the files are built to the `folderLocation` set in that character folder's `modDetails.js`, inside a Content Patcher folder named `[CP] <SDV_Name>-<newCharacterName>` (e.g. `dist/[CP] Elliott-Sephiroth`).

The default `folderLocation` (`./dist`) is listed in [.gitignore](.gitignore), so build output isn't committed. If you point `folderLocation` at another folder inside this project, add it to `.gitignore` too.

## Characters

Each character lives in its own folder, so one project can hold many characters. [characters/Elliott-Sephiroth/](characters/Elliott-Sephiroth/) is the working example.

```
characters/Elliott-Sephiroth/
  modDetails.js   build settings and manifest values
  changes.js      collects the changes for content.json
  changes/        one file per change
  assets/         the character's images and music
```

To add a character, copy an existing folder, edit its files, and run the build with `--folder` pointing at it. The folder doesn't need to be inside this project.

### modDetails.js

| Variable | Description | Example |
| --- | --- | --- |
| `folderLocation` | The folder the mod folder is built into. Relative paths are resolved from the project root. Created if it doesn't exist. | `./dist` |
| `newCharacterName` | Name of the new character replacing `SDV_Name`. Used in the mod folder name and the display name change. | `Sephiroth` |
| `modFolderName` | Name of the folder the mod is built into, made from `SDV_Name` and `newCharacterName`. | `[CP] Elliott-Sephiroth` |
| `Name` | Mod name, written to `manifest.json`. | `My Character Replacement - Elliot to Sephiroth` |
| `Author` | Mod author, written to `manifest.json`. | `PastelBeans_` |
| `Version` | Mod version, written to `manifest.json`. | `1.0.0` |
| `Description` | Mod description, written to `manifest.json`. | `Replaces Elliot with Sephiroth.` |
| `UniqueID` | Mod unique ID, written to `manifest.json`. | `PastelBeans_.ElliotToSephiroth` |
| `MinimumApiVersion` | Minimum SMAPI version, written to `manifest.json`. | `4.0.0` |
| `SDV_Name` | StarDewValley_Name: the character being replaced. Not written in the file: `build.js` sets it from `--name` (or the prompt), and the change files use it to build targets like `Characters/<SDV_Name>` and keys like `Outdoor_<SDV_Name>`. | set at run time |

## Changes

`changes.js` in the character folder collects the objects that go into the `Changes` array of `content.json`. Each change lives in its own file in the character's `changes/` folder, where its variables are declared at the top and pulled into the object. To add a change, create a file in `changes/`, import it in `changes.js`, and add it to the `changes` array. Keeping them separate makes it easy to debug one change at a time (just remove it from the array).

### Long strings are arrays

Stardew packs many values into one long string separated by a character (`/` for events, gift tastes and schedules, `#` for dialogue). To keep these readable, each one is written as an array with one section per item, and joined back together with the separator when the build runs.

### Current changes (Elliott-Sephiroth)

| File | Target | Notes |
| --- | --- | --- |
| `spriteChange.js` | `Characters/<SDV_Name>` | Loads the custom sprite sheet. |
| `portraitChange.js` | `Portraits/<SDV_Name>` | Loads the custom portraits. |
| `displayNameChange.js` | `Data/Characters` | Sets `DisplayName` to `<newCharacterName>?`. |
| `giftTastesChange.js` | `Data/NPCGiftTastes` | `giftTasteLines` is joined with `/`. |
| `dialogueChange.js` | `Characters/Dialogue/<SDV_Name>` | Combines the files in `changes/dialogue/`, joining each entry with `#`. |
| `marriageDialogueChange.js` | `Characters/Dialogue/MarriageDialogue` | Each entry's lines are joined with `#`. |
| `eventChange.js` | `Data/Events/ArchaeologyHouse`, `ElliottHouse`, `Beach`, `Farm` | Combines the files in `changes/events/`, joining sequences with `/`. |
| `scheduleChange.js` | `Characters/schedules/<SDV_Name>` | Each schedule's stops are joined with `/`. Not tested in-game yet. |
| `musicChange.js` | `Data/AudioChanges` | Custom music track. |

### Dialogue files

Each file in `changes/dialogue/` exports an object of `{ key: [lines] }`. Files: `introduction`, `monday` to `sunday` (each tier, like `Mon`, `Mon2`, `Mon4`), `generic` (`one` to `eight`) and `festivals`. To add more, create a file there and add one `require` line to the list in `dialogueChange.js`. A duplicate key across files stops the build with an error.

### Event files

Each file in `changes/events/` exports `eventName` and `eventSequence`, plus `forkName` and `forkSequence` if the event has a fork. `eventChange.js` turns each into its entries and groups them by target.

| File | Event | Target |
| --- | --- | --- |
| `archaeologyEvent.js` | 9999004 | `ArchaeologyHouse` |
| `pastLifeEvent.js` | 9999002 | `ElliottHouse` |
| `pianoEvent.js` | 9999006 | `ElliottHouse` |
| `beachBelongEvent.js` | 9999008 | `Beach` |
| `beachConfessionEvent.js` | 9999010 | `Beach` |
| `farmSunriseEvent.js` | 9999014 | `Farm` (work in progress) |

## Output

Everything below is built to `<folderLocation>/<modFolderName>` when you run `node build.js`:

| Output | Description |
| --- | --- |
| `content.json` | Content Patcher file. `Changes` is filled from the character's `changes.js`. |
| `manifest.json` | SMAPI manifest, filled in from the character's `modDetails.js`. |
| `assets/` | A copy of the character folder's `assets` folder. |
