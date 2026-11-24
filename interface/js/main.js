// Wires everything together: the editors, the dialogue sub-tabs, the tabs and the first load.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

const editors = [
  ...[...document.querySelectorAll(".dialogue-editor")].map(createEditor),
  ...[...document.querySelectorAll(".gift-editor")].map(createGiftTastesEditor),
  ...[...document.querySelectorAll(".events-editor")].map(createEventsEditor),
  ...[...document.querySelectorAll(".mail-editor")].map(createMailEditor),
];
const loadEditors = () => Promise.all(editors.map((editor) => editor.load(folderSelect.value)));
async function saveEditors() {
  for (const editor of editors) await editor.save(folderSelect.value);
}

// --- Dialogue sub-tabs: Day and Other are the two halves of the dialogue editor ---
const subButtons = [...document.querySelectorAll(".subtab")];
const subSections = { dialogue: document.getElementById("sub-dialogue"), marriage: document.getElementById("sub-marriage"), festival: document.getElementById("sub-festival") };
let currentSub = "day";

function showSub(name) {
  if (!subButtons.some((b) => b.dataset.sub === name)) name = "day";
  currentSub = name;
  for (const b of subButtons) {
    const active = b.dataset.sub === name;
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
  }
  const dialogueShown = name === "day" || name === "other";
  subSections.dialogue.hidden = !dialogueShown;
  subSections.marriage.hidden = name !== "marriage";
  subSections.festival.hidden = name !== "festival";
  for (const part of subSections.dialogue.querySelectorAll(".part-day")) part.hidden = name !== "day";
  for (const part of subSections.dialogue.querySelectorAll(".part-other")) part.hidden = name !== "other";
  closePane();
  try {
    history.replaceState(null, "", `#dialogue/${name}`);
  } catch {}
}
subButtons.forEach((b) => b.addEventListener("click", () => showSub(b.dataset.sub)));

// --- Tabs ---
const tabButtons = [...document.querySelectorAll(".tab")];
const tabPanels = [...document.querySelectorAll(".panel")];

function showTab(name, focus = false) {
  if (!tabButtons.some((t) => t.dataset.tab === name)) name = tabButtons[0].dataset.tab;
  for (const tab of tabButtons) {
    const active = tab.dataset.tab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  }
  for (const panel of tabPanels) panel.hidden = panel.dataset.panel !== name;
  closePane(); // the pane belongs to the tab that filled it; this also stops any audio playing in it
  try {
    history.replaceState(null, "", name === "dialogue" ? `#dialogue/${currentSub}` : `#${name}`); // a refresh stays on this tab
  } catch {}
}

tabButtons.forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
document.querySelector(".tabs").addEventListener("keydown", (event) => {
  const current = tabButtons.findIndex((t) => t.getAttribute("aria-selected") === "true");
  const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  let next = move === undefined ? (event.key === "Home" ? 0 : event.key === "End" ? tabButtons.length - 1 : -1) : (current + move + tabButtons.length) % tabButtons.length;
  if (next < 0) return;
  event.preventDefault();
  showTab(tabButtons[next].dataset.tab, true);
});
// "#dialogue/marriage" opens a sub-tab; the old "#marriage" and "#festival" links still land in the right place
const [hashTab, hashSub] = location.hash.slice(1).split("/");
showSub(hashSub ?? { marriage: "marriage", festival: "festival" }[hashTab]);
showTab({ marriage: "dialogue", festival: "dialogue" }[hashTab] ?? hashTab);

init(); // last, so everything above is defined before the first load
