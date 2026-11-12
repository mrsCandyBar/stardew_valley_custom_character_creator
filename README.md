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

## Interface

Run `node server.js` and open http://localhost:3000 for a form that edits a character's `modDetails.json` and runs the build.

- **Save** (bottom right) writes the form to the selected character's `modDetails.json`.
- **Build & open dist folder** saves, runs `build.js` and opens the built folder.
- **New character** asks for the character being replaced and the new name, then copies [templates/character/](templates/character/) into `characters/<Replacing>-<NewName>` with the names filled in. The template uses placeholder text, and its `assets/` folder starts empty, so add `custom_sprites.png` and `custom_portraits.png`.

- **Assets** lets you upload the portraits (`custom_portraits.png`), sprites (`custom_sprites.png`) and a music track (`.ogg`) into the selected character's `assets/` folder, replacing the old file. **View** shows the image, or **Play** plays the track. The music file name is stored in the character's `music.json`, which `musicChange.js` reads; with no track set there is no music change.

- **Dialogue** and **Marriage dialogue** list every entry as a card. Under *Day dialogue*, add a day (Mon to Sun) with an optional heart count (1 to 14), which makes keys like `Sun` or `Sun4`. Under *Other dialogue*, add any key, e.g. `Introduction` or `Festival_Egg`. Each line you type in a card is one `#` section. Save writes `dialogue.json` and `marriageDialogue.json`.
- **Schedule** works the same way. Add a schedule for a day of the week (`Mon`), a season (`spring`, `summer`, `fall`, `winter`) or one day of a season (`spring:1`); every one of them is optional. Each line in a card is one stop (`600 Beach 34 39 0`). Any other key, such as `Rain`, goes under *Other schedules*. Save writes `schedule.json`.

The interface only edits the mod details, assets, dialogue and schedule so far. Events and the other changes are still edited in their `.js` files.

## Characters

Each character lives in its own folder, so one project can hold many characters. [characters/Elliott-Sephiroth/](characters/Elliott-Sephiroth/) is the working example.

```
characters/Elliott-Sephiroth/
  modDetails.js   build settings and manifest values
  changes.js      collects the changes for content.json
  changes/        one file per change
  assets/         the character's images and music
  music.json      file name of the custom music track (blank for none)
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
| `dialogueChange.js` | `Characters/Dialogue/<SDV_Name>` | Reads `dialogue.json`, joining each entry's lines with `#`. |
| `marriageDialogueChange.js` | `Characters/Dialogue/MarriageDialogue` | Reads `marriageDialogue.json`, joining each entry's lines with `#`. `{name}` in a key becomes `SDV_Name`. |
| `eventChange.js` | `Data/Events/ArchaeologyHouse`, `ElliottHouse`, `Beach`, `Farm` | Combines the files in `changes/events/`, joining sequences with `/`. |
| `scheduleChange.js` | `Characters/schedules/<SDV_Name>` | Reads `schedule.json`, joining each schedule's stops with `/`. Not tested in-game yet. |
| `musicChange.js` | `Data/AudioChanges` | Custom music track. |

### Dialogue data

`dialogue.json`, `marriageDialogue.json` and `schedule.json` each hold `{ "entries": [{ "key": "Mon4", "lines": ["..."] }] }`. Day keys are `Mon` to `Sun` with an optional heart count after them (`Sun`, `Sun4`, up to `Sun14`). Other keys are things like `Introduction`, `one` and `Festival_Egg`. A duplicate key stops the build with an error. Edit them in the interface or by hand.

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
