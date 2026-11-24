# To do

- [ ] **Visual viewport and actor placement** on the event's map (needs the unpacked game maps, see the events editor notes).
- [ ] **Bring back the "Who" input on Speak commands** if it is needed. It is only hidden: set the third argument of `actorAndWords("Speak", "dialogue", true)` in `interface/js/eventData.js` to `false` (or drop it). The speaker is still saved with the command, `{name}` by default.
