# stardew_valley_custom_character_creator
Create and replace any Stardew Valley character in a builder that writes the custom files for you.

## Usage

```
node build.js
```

When you run `node build.js`, the files are built to the `folderLocation` set in [modDetails.js](modDetails.js).

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

## Changes

[changes.js](changes.js) collects the objects that go into the `Changes` array of `content.json`. Each change lives in its own file in the [changes/](changes/) folder, where its variables are declared at the top and pulled into the object. To add a change, create a file in `changes/`, import it in `changes.js`, and add it to the `changes` array. Keeping them separate makes it easy to debug one change at a time (just remove it from the array).

The included example, [changes/musicChange.js](changes/musicChange.js), is a `Data/AudioChanges` music entry with three variables:

| Variable | Used for |
| --- | --- |
| `musicEntryKey` | The key of the entry inside `Entries` |
| `musicId` | The entry's `ID` |
| `musicFilePath` | The entry's `FilePaths` item |

## Output

Everything below is built to `folderLocation` when you run `node build.js`:

| Output | Description |
| --- | --- |
| `content.json` | Content Patcher file. `Changes` is filled from `changes.js`. |
| `manifest.json` | SMAPI manifest, filled in from the values in `modDetails.js`. |
| `assets/` | A copy of the project's `assets` folder. |
