# To do

- [ ] **Visual viewport and actor placement** on the event's map (needs the unpacked game maps, see the events editor notes).
- [ ] **Bring back the "Who" input on Speak commands** if it is needed. It is only hidden: set the third argument of `actorAndWords("Speak", "dialogue", true)` in `interface/js/eventData.js` to `false` (or drop it). The speaker is still saved with the command, `{name}` by default.
- [ ] **Convert `interface/js/` to ES modules.** The files are plain scripts that share globals, so `index.html` has to load them in a fixed order (a few top-level constants such as `FACING` are built from helpers in earlier files). Switching to `<script type="module">` with explicit `import`/`export` would make each file's dependencies visible and remove the load-order rule. It touches every file, so do it as its own pass and re-run the before/after click-through checks.

--------------------------------------------
Final checks before committing to Nexus Mods 

Update Beach and Winter Outfits (stop gap)
Update BG core dialogue for wedding and theatre
TownsFolk and secret notes
Spouse Room

• Proposal (Data/EngagementDialogue): Contains Elliott0 and Elliott1—the lines he speaks right after you hand him the Mermaid's Pendant and during the three days leading up to the wedding.
• Custom generic lines (Strings/StringsFromCSFiles & Data/ExtraDialogue): Things like receiving a Stardrop from your spouse, reacting to a birthday gift, or commenting when you rummage through a trash can pull from these files. (In Stardew Valley 1.6, you can override many of these per-NPC directly inside Characters/Dialogue/Elliott using keys listed on the Stardew Valley Wiki Dialogue page.)
• Speech bubbles (Strings/SpeechBubbles): The tiny overhead text pop-ups that appear automatically when he walks past certain spots or enters buildings (for example, greeting Gus at the Saloon or walking on the beach).
• Quests & Special Orders (Data/Quests & Data/SpecialOrders): Elliott has a couple of Help Wanted delivery quests and a bulletin board Special Order (or dialogue reacting to completed orders) that reference his name and personality.
• Cabin inspection text (Strings/StringsFromCSFiles): Clicking on the piano, desk, or bookshelves inside his beach cabin triggers text boxes describing Elliott's writing and belongings.

Not tested with other mods yet

done:
  • Duck Feather (AcceptGift_(O)444): Elliott has a custom line commenting on using the feather as a quill/writing pen.
  • Squid Ink (AcceptGift_(O)814): Elliott has a custom line about using the ink for his writing.
  • Stardrop Tea (AcceptGift_(O)StardropTea): Added in 1.6, every villager—including Elliott—has a unique reaction line for Stardrop Tea.

• Special gifts (Characters/Dialogue/Elliott keys): 
    Make sure your main dialogue file includes overrides for 
      AcceptBouquet (dating), 
      RejectBouquet (low hearts), 
      RejectMermaidPendant (not ready to marry), 
      GiveBirth, 
      and Spouse_MonstersInHouse (if Wilderness farm monsters are toggled on).