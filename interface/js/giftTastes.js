// Gifts tab.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// Three parts: the character's generic reactions (a face + text each), the item ids for each category,
// and optional explicit reactions for specific items. Face and item are dropdowns for now.
// TODO (README): swap both dropdowns for clickable pictures.
const GENERIC_ROWS = [
  ["love", "Loved gift"],
  ["like", "Liked gift"],
  ["dislike", "Disliked gift"],
  ["hate", "Hated gift"],
  ["neutral", "Neutral gift"],
];
const CATEGORY_ROWS = [
  ["loves", "Loves"],
  ["likes", "Likes"],
  ["dislikes", "Dislikes"],
  ["hates", "Hates"],
  ["neutral", "Neutral"],
];

function createGiftTastesEditor(section) {
  const { title, hint } = section.dataset;
  let tastes = { generic: {}, categories: {}, items: [] };
  let loaded = false;

  const message = el("p", { className: "editor-message", hidden: true });
  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };

  const genericBox = el("div");
  const categoryBox = el("div");
  const itemList = el("div");
  let items = []; // the picker's item list, loaded with the tab
  let newItemId = "0"; // the item the "Add item" button will add
  const addItem = actionButton("Add item");
  const addRow = controlRow();
  const specificBody = el("div", { hidden: true }, itemList, addRow);
  const toggleSpecific = actionButton("Show specific items", () => {
    specificBody.hidden = !specificBody.hidden;
    toggleSpecific.textContent = specificBody.hidden ? "Show specific items" : "Hide specific items";
  });

  section.append(
    el("h2", { textContent: title }),
    el("p", { className: "hint", textContent: hint }),
    message,
    el("div", { className: "entry-group" }, el("h3", { textContent: "Generic reactions" }), genericBox),
    el("div", { className: "entry-group" }, el("h3", { textContent: "Item categories" }), categoryBox),
    // Hidden by default to keep the page simple. Clicking an item chip above still opens its reaction in the pane.
    el("div", { className: "entry-group" }, el("h3", { textContent: "Specific items" }), toggleSpecific, specificBody)
  );

  // Compact line: the descriptor and a View button on the left, the text box beside them.
  // View opens the reaction in the preview pane, laid out like the game's dialogue box with its portrait face.
  let portraitUrl = "";
  let live = null; // { reaction, paneText } for the reaction open in the pane
  const openers = new Map(); // reaction -> function that opens it in the pane
  const reactionLine = (reaction, descriptor, extra, title = "Specific item", clickToView = false) => {
    // One-line box in the form; a line break can't live in an input, so several sections are shown joined and edited in the pane
    const text = el("input", { placeholder: "Click to write what they say" });
    const multi = () => reaction.text.includes("\n");
    const refreshText = () => {
      text.value = multi() ? reaction.text.split("\n").join("  ↵  ") : reaction.text;
      text.readOnly = multi();
    };
    refreshText();
    const view = actionButton("View");
    text.addEventListener("input", () => {
      reaction.text = text.value;
      if (live && live.reaction === reaction) live.paneText.value = text.value;
      refreshChips();
    });
    const toggleView = () => (live && live.reaction === reaction ? closePane() : open());
    function open() {
      if (live && live.reaction === reaction) return;
      const paneText = el("textarea", { value: reaction.text, rows: 5, placeholder: "What they say" });
      paneText.addEventListener("input", () => {
        reaction.text = paneText.value;
        refreshText();
        refreshChips();
      });
      const face = faceButton(reaction, portraitUrl);
      const me = { reaction, paneText };
      const card = line.closest(".entry");
      const onClose = () => {
        if (live === me) live = null;
        view.classList.remove("selected");
        card?.classList.remove("viewing");
        refreshChips();
      };
      live = me;
      view.classList.add("selected");
      card?.classList.add("viewing");
      refreshChips();
      showInPane(title, el("div", { className: "preview-body centered" }, el("div", { className: "dialogue-box" }, paneText, face), el("p", { className: "hint", textContent: "Click the portrait for the next face. Edits here and in the form stay in step." })), onClose);
    }
    view.addEventListener("click", toggleView);
    // Specific items have no View button: clicking the text opens the view instead
    view.hidden = true; // clicking the text opens the view instead
    text.addEventListener("click", open);
    const line = el("div", { className: "reaction-line" }, el("div", { className: "reaction-who" }, descriptor, view), text, extra || el("span"));
    openers.set(reaction, open);
    return line;
  };

  // One category (loves, likes...): a chip per item id and an Add button that opens the multi-select table. Ids are stored as plain numbers (no "(O)"), in tastes.categories[name].
  function categoryRow(name, label) {
    const row = el("div", { className: "category-row" });
    const ids = () => tastes.categories[name];

    const draw = () => {
      queueMicrotask(refreshChips);
      const chips = ids().map((id) => {
        const item = items.find((i) => i.id === id);
        const remove = el("button", {
          type: "button",
          className: "chip-remove",
          title: "Remove",
          textContent: "×",
          onclick: () => {
            tastes.categories[name] = ids().filter((x) => x !== id);
            draw();
          },
        });
        // Just the icon (name and number show on hover). Ids with no icon, like -4, show as text instead.
        const face = item ? itemIcon(item) : el("span", { className: "item-num", textContent: id });
        const chip = el("span", { className: chipClasses(id),  title: item ? `${item.name} (${id}): click to edit its specific reaction` : id }, face, remove);
        chip.dataset.id = id; // el() sets properties, so a "data-id" prop would not become an attribute
        chip.addEventListener("click", (e) => e.target !== remove && goToItem(id, item));
        return chip;
      });

      const choose = actionButton("Add", async () => {
        const ticked = await pickItem(items, ids(), true);
        if (!ticked) return;
        const known = new Set(items.map((i) => i.id));
        // keep ids the table doesn't know (negative categories etc.) and the order of what was already there
        const kept = ids().filter((id) => !known.has(id) || ticked.includes(id));
        tastes.categories[name] = [...kept, ...ticked.filter((id) => !kept.includes(id))];
        draw();
      });
      row.replaceChildren(
        el("h4", { className: "category-label", textContent: label }),
        el("div", { className: "chips" }, ...(chips.length ? chips : [el("span", { className: "empty", textContent: "None" })])),
        choose
      );
    };
    draw();
    return row;
  }

  // Chip colours: green when the item has specific dialogue, and a ring on the chip whose reaction is open in the pane
  function chipClasses(id) {
    const entry = tastes.items.find((e) => String(e.item) === String(id));
    const viewing = live && live.reaction.item !== undefined && String(live.reaction.item) === String(id);
    return ["chip", "clickable", entry && entry.text.trim() ? "has-text" : "", viewing ? "viewing" : ""].filter(Boolean).join(" ");
  }
  function refreshChips() {
    for (const chip of categoryBox.querySelectorAll(".chip[data-id]")) chip.className = chipClasses(chip.dataset.id);
  }

  // Clicking an item in a category: show its specific reaction, or offer to create one
  function goToItem(id, item) {
    if (!item) return showMessage(`${id} isn't an item in the list, so it can't have a specific reaction.`);
    let entry = tastes.items.find((e) => String(e.item) === String(id));
    if (!entry) {
      if (!confirm(`${item.name} has no specific reaction yet. Create one?`)) return;
      entry = { item: id, face: "$0", text: "" };
      tastes.items.push(entry);
      render();
    }
    showMessage("");
    openers.get(entry)?.(); // the chip is highlighted for as long as this stays open; declining to create leaves the last one as it was
    if (!specificBody.hidden) itemList.children[tastes.items.indexOf(entry)]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function render() {
    openers.clear();
    closePane(); // anything open in the pane belongs to the old rows
    portraitUrl = assetUrl("portrait"); // one fetch per render, and picks up a re-uploaded portrait
    genericBox.replaceChildren(
      ...GENERIC_ROWS.map(([name, label]) => {
        return el("div", { className: "entry" }, reactionLine(tastes.generic[name], el("span", { className: "key", textContent: label }), null, label));
      })
    );

    categoryBox.replaceChildren(
      el("div", { className: "category-grid" }, ...CATEGORY_ROWS.map(([name, label]) => categoryRow(name, label))),
      el("p", { className: "hint", textContent: "Click Add to choose items from the table. Ids that aren't items in the file (like -4 for fish, or universal_neutral) are kept if they're already there." })
    );

    itemList.replaceChildren(
      ...(tastes.items.length
        ? tastes.items.map((entry) => {
            const item = itemButton(
              items,
              () => entry.item,
              (id) => {
                if (tastes.items.some((e) => e !== entry && e.item === id)) {
                  showMessage(`(O)${id} already exists.`);
                  return false; // keep showing the old item
                }
                showMessage("");
                entry.item = id;
              }
            );
            const remove = removeX("Remove", () => {
              closePane();
              tastes.items = tastes.items.filter((e) => e !== entry);
              render();
            });
            return el("div", { className: "entry" }, reactionLine(entry, item, remove, "Specific item", true));
          })
        : [el("p", { className: "empty", textContent: "None yet. Optional." })])
    );

    addRow.replaceChildren(itemButton(items, () => newItemId, (id) => void (newItemId = id)), addItem);
  }

  addItem.addEventListener("click", () => {
    if (tastes.items.some((e) => e.item === newItemId)) return showMessage(`(O)${newItemId} already exists.`);
    showMessage("");
    tastes.items.push({ item: newItemId, face: "$0", text: "" });
    render();
  });

  return {
    async load(folder) {
      showMessage("");
      try {
        items = await loadItems();
      } catch (err) {
        items = [];
        showMessage(`Couldn't load the item list (gameSprites/items.json): ${err.message}`);
      }
      try {
        tastes = await api(`/api/gift-tastes?folder=${encodeURIComponent(folder)}`);
        loaded = true;
      } catch (err) {
        loaded = false;
        showMessage(err.message);
      }
      addRow.hidden = !loaded;
      genericBox.hidden = categoryBox.hidden = !loaded;
      if (loaded) render();
      else itemList.replaceChildren();
    },
    async save(folder) {
      if (!loaded) return;
      try {
        await postJson("/api/gift-tastes", { folder, tastes });
        showMessage("");
      } catch (err) {
        showMessage(err.message);
        throw new Error(`${title}: ${err.message}`);
      }
    },
  };
}
