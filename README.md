# stardew_valley_custom_character_creator
Create and replace any Stardew Valley character in a builder that writes the custom files for you.

## Usage

```
node build.js
```

When you run `node build.js`, the files are built to the `folderLocation` set in [modDetails.js](modDetails.js).

The default `folderLocation` (`./dist`) is listed in [.gitignore](.gitignore), so build output isn't committed. If you change `folderLocation` to a folder inside this project, add it to `.gitignore` too.

## Configuration

`modDetails.js` holds the build settings:

| Variable | Description | Default |
| --- | --- | --- |
| `folderLocation` | The folder the built files are written to. Relative paths are resolved from the project root. The folder is created if it doesn't exist. | `./dist` |
| `Name` | Mod name, written to `manifest.json`. | `My Character Replacement - Elliot to Sephiroth` |
| `Author` | Mod author, written to `manifest.json`. | `PastelBeans_` |
| `Version` | Mod version, written to `manifest.json`. | `1.0.0` |
| `Description` | Mod description, written to `manifest.json`. | `Replaces Elliot with Sephiroth.` |
| `UniqueID` | Mod unique ID, written to `manifest.json`. | `PastelBeans_.ElliotToSephiroth` |
| `MinimumApiVersion` | Minimum SMAPI version, written to `manifest.json`. | `4.0.0` |
| `SDV_Name` | StarDewValley_Name: the character being replaced. Used by the change files to build targets like `Characters/<SDV_Name>` and keys like `Outdoor_<SDV_Name>`. | `Elliott` |

## Changes

[changes.js](changes.js) collects the objects that go into the `Changes` array of `content.json`. Each change lives in its own file in the [changes/](changes/) folder, where its variables are declared at the top and pulled into the object. To add a change, create a file in `changes/`, import it in `changes.js`, and add it to the `changes` array. Keeping them separate makes it easy to debug one change at a time (just remove it from the array).

### Long strings are arrays

Stardew packs many values into one long string separated by a character (`/` for events, gift tastes and schedules, `#` for dialogue). To keep these readable, each one is written as an array with one section per item, and joined back together with the separator when the build runs.

### Current changes

| File | Target | Notes |
| --- | --- | --- |
| [spriteChange.js](changes/spriteChange.js) | `Characters/<SDV_Name>` | Loads the custom sprite sheet. |
| [portraitChange.js](changes/portraitChange.js) | `Portraits/<SDV_Name>` | Loads the custom portraits. |
| [giftTastesChange.js](changes/giftTastesChange.js) | `Data/NPCGiftTastes` | `giftTasteLines` is joined with `/`. |
| [dialogueChange.js](changes/dialogueChange.js) | `Characters/Dialogue/<SDV_Name>` | Combines the files in [changes/dialogue/](changes/dialogue/), joining each entry with `#`. |
| [marriageDialogueChange.js](changes/marriageDialogueChange.js) | `Characters/Dialogue/MarriageDialogue` | Each entry's lines are joined with `#`. |
| [eventChange.js](changes/eventChange.js) | `Data/Events/ArchaeologyHouse`, `ElliottHouse`, `Beach`, `Farm` | Combines the files in [changes/events/](changes/events/), joining sequences with `/`. |
| [scheduleChange.js](changes/scheduleChange.js) | `Characters/schedules/<SDV_Name>` | Each schedule's stops are joined with `/`. Not tested in-game yet. |
| [musicChange.js](changes/musicChange.js) | `Data/AudioChanges` | Custom music track. |

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

Everything below is built to `folderLocation` when you run `node build.js`:

| Output | Description |
| --- | --- |
| `content.json` | Content Patcher file. `Changes` is filled from `changes.js`. |
| `manifest.json` | SMAPI manifest, filled in from the values in `modDetails.js`. |
| `assets/` | A copy of the project's `assets` folder. |
