// Pickers shared by several editors: portrait face button and the item picker.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// --- Portrait face button ---
const FACE_COUNT = 9; // $0 to $8
const PORTRAIT_SHEET_WIDTH = 270; // the sheet is scaled to this width (two faces per row), so each face tile is half of it

// A button showing the portrait for reaction.face ("$4" etc). Clicking steps to the next face.
// If no portrait is uploaded the image fails to load and the "$n" text shows instead.
function faceButton(reaction, portraitUrl) {
  const button = el("button", { type: "button", className: "face-button", title: "Click for the next face" });
  button.style.backgroundSize = `${PORTRAIT_SHEET_WIDTH}px auto`;
  const probe = new Image();
  let hasImage = true;
  probe.onerror = () => {
    hasImage = false;
    draw();
  };
  probe.src = portraitUrl;

  function draw() {
    const n = Number(reaction.face.slice(1)) || 0;
    button.setAttribute("aria-label", `Portrait face ${reaction.face}. Click for the next face.`);
    if (hasImage) {
      button.textContent = "";
      button.style.backgroundImage = `url("${portraitUrl}")`;
      const tile = PORTRAIT_SHEET_WIDTH / 2;
      button.style.backgroundPosition = `-${(n % 2) * tile}px -${Math.floor(n / 2) * tile}px`;
    } else {
      button.style.backgroundImage = "";
      button.textContent = reaction.face;
    }
  }

  button.addEventListener("click", () => {
    reaction.face = `$${(Number(reaction.face.slice(1)) + 1) % FACE_COUNT}`;
    draw();
  });
  draw();
  return button;
}

// --- Item picker ---
// gameSprites/items.json is { id, name, sprite }[] built by gameSprites/makeItems.js from the unpacked game files.
// "sprite" is a tile index in gameSprites/springobjects.png (24 tiles per row, 16px each).
const SHEET_COLUMNS = 24;
const SHEET_ROWS = 39;
const ICON_SCALE = 2; // draw each 16px tile at 32px
let itemsPromise = null;
const loadItems = () => (itemsPromise ??= api("/gameSprites/items.json").catch((err) => ((itemsPromise = null), Promise.reject(err))));

function itemIcon(item) {
  const size = 16 * ICON_SCALE;
  const icon = el("span", { className: "item-icon" });
  if (item) {
    icon.style.backgroundImage = 'url("/gameSprites/springobjects.png")';
    icon.style.backgroundSize = `${SHEET_COLUMNS * size}px ${SHEET_ROWS * size}px`;
    icon.style.backgroundPosition = `-${(item.sprite % SHEET_COLUMNS) * size}px -${Math.floor(item.sprite / SHEET_COLUMNS) * size}px`;
  }
  return icon;
}

// One shared dialog with a search box and a table (icon, name, number).
// Single mode resolves to the chosen id, or null if closed. Multi mode (checkboxes, "Done" button) resolves to the array of
// ticked ids, or null if cancelled; `current` is then the array of ids already ticked, and numbers are shown without "(O)".
let itemDialog;
function pickItem(items, current, multi = false) {
  if (!itemDialog) {
    const search = el("input", { type: "search", placeholder: "Search by name or number", className: "item-search" });
    const tbody = el("tbody");
    const thead = el("thead");
    const empty = el("p", { className: "empty", textContent: "No items match.", hidden: true });
    const done = actionButton("Done", undefined, { primary: true });
    const table = el("table", { className: "item-table" }, thead, tbody);
    itemDialog = createDialog({ head: [search, done], closeLabel: "Cancel" }, table, empty);
    Object.assign(itemDialog, { search, tbody, thead, empty, done });
  }
  const { search, tbody, thead, empty, done } = itemDialog;

  return new Promise((resolve) => {
    let chosen = null;
    const selected = new Set(multi ? current : []);
    const heads = [...(multi ? [""] : []), "Icon", "Name", "Number"];
    thead.replaceChildren(el("tr", {}, ...heads.map((h) => el("th", { textContent: h }))));
    done.hidden = !multi;
    done.onclick = () => {
      chosen = [...selected];
      itemDialog.close();
    };

    const fill = () => {
      const q = search.value.trim().toLowerCase();
      const shown = items.filter((i) => !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
      tbody.replaceChildren(
        ...shown.map((i) => {
          const isCurrent = multi ? selected.has(i.id) : i.id === current;
          const box = multi ? el("input", { type: "checkbox", checked: isCurrent, tabIndex: -1 }) : null;
          const row = el(
            "tr",
            { tabIndex: 0, className: isCurrent ? "current" : "" },
            ...(multi ? [el("td", {}, box)] : []),
            el("td", {}, itemIcon(i)),
            el("td", { textContent: i.name }),
            el("td", { className: "num", textContent: multi ? i.id : `(O)${i.id}` })
          );
          const choose = () => {
            if (multi) {
              selected.has(i.id) ? selected.delete(i.id) : selected.add(i.id);
              box.checked = selected.has(i.id);
              row.classList.toggle("current", box.checked);
            } else {
              chosen = i.id;
              itemDialog.close();
            }
          };
          row.addEventListener("click", (event) => {
            if (event.target === box) event.preventDefault(); // the row toggles it; avoid toggling twice
            choose();
          });
          row.addEventListener("keydown", (event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), choose()));
          return row;
        })
      );
      empty.hidden = shown.length > 0;
    };
    search.oninput = fill;
    itemDialog.onclose = () => resolve(chosen);
    search.value = "";
    fill();
    itemDialog.showModal();
    tbody.querySelector(".current")?.scrollIntoView({ block: "center" });
    search.focus();
  });
}

// A button showing the chosen item's icon, name and number. Clicking opens the table to pick another.
function itemButton(items, getId, onPick) {
  const button = el("button", { type: "button", className: "item-button", title: "Click to choose an item" });
  const draw = () => {
    const id = getId();
    const item = items.find((i) => i.id === id);
    button.replaceChildren(itemIcon(item), el("span", { className: "item-name", textContent: item ? item.name : "Unknown item" }), el("span", { className: "item-num", textContent: `(O)${id}` }));
  };
  button.addEventListener("click", async () => {
    const id = await pickItem(items, getId());
    if (id !== null && onPick(id) !== false) draw();
  });
  draw();
  return button;
}
