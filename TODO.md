# To do

- [ ] **Visual viewport and actor placement** on the event's map (needs the unpacked game maps, see the events editor notes).
- [ ] **Bring back the "Who" input on Speak commands** if it is needed. It is only hidden: set the third argument of `actorAndWords("Speak", "dialogue", true)` in `interface/js/eventData.js` to `false` (or drop it). The speaker is still saved with the command, `{name}` by default.
- [ ] **Convert `interface/js/` to ES modules.** The files are plain scripts that share globals, so `index.html` has to load them in a fixed order (a few top-level constants such as `FACING` are built from helpers in earlier files). Switching to `<script type="module">` with explicit `import`/`export` would make each file's dependencies visible and remove the load-order rule. It touches every file, so do it as its own pass and re-run the before/after click-through checks.
