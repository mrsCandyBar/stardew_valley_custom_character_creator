// Mail tab.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// --- Mail ---
// A letter is { id, subject, text, items: [{ item, count }], money, trigger, friendshipPoints, condition, delivery, once }.
// The build writes it to Data/Mail and adds a trigger action (Data/TriggerActions) that sends it.
const MAIL_TRIGGERS = [["DayStarted", "When a day starts"], ["DayEnding", "When a day ends"]];
const MAIL_DELIVERY = [["Today", "In today's mailbox"], ["Tomorrow", "In tomorrow's mailbox"]];

// The letter the way the game shows it: the text, the gifts that come with it, and the subject as the title
function letterPreview(letter, items) {
  const names = (id) => items.find((i) => i.id === id)?.name || `(O)${id}`;
  const gifts = [
    ...letter.items.map(({ item, count }) => el("div", { className: "letter-gift" }, itemIcon(items.find((i) => i.id === item)), el("span", { textContent: `${names(item)}${count > 1 ? ` x${count}` : ""}` }))),
    ...(letter.money > 0 ? [el("div", { className: "letter-gift", textContent: `${letter.money}g` })] : []),
  ];
  return el(
    "div",
    { className: "letter" },
    el("p", { className: "letter-subject", textContent: letter.subject || "(no subject)" }),
    el("p", { className: "letter-text", textContent: letter.text || "(no text)" }),
    ...(gifts.length ? [el("div", { className: "letter-gifts" }, ...gifts)] : [])
  );
}

function createMailEditor(section) {
  const { title, hint } = section.dataset;
  let mail = [];
  let loaded = false;
  let items = []; // the picker's item list, loaded with the tab
  let preview = null; // the letter open in the pane

  const message = el("p", { className: "editor-message", hidden: true });
  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };

  const list = el("div");
  const addId = el("input", { placeholder: "Letter ID, e.g. FirstLetter", title: "Letter ID" });
  const addButton = actionButton("Add letter");
  const addRow = controlRow(addId, addButton);
  section.append(el("h2", { textContent: title }), el("p", { className: "hint", textContent: hint }), message, list, addRow);

  const field = (label, control, note) => el("div", { className: "field" }, el("span", { textContent: label }), el("div", {}, control, ...(note ? [el("small", { textContent: note })] : [])));
  const number = (letter, key, min, max) => bindValue(el("input", { type: "number", min, max, value: letter[key] }), letter, key, { parse: (v) => Number(v) || 0 });

  function showLetter(letter) {
    preview = letter;
    showInPane(`Letter: ${letter.id}`, letterPreview(letter, items), () => (preview = null));
  }

  function giftRows(letter) {
    const box = el("div");
    const draw = () => {
      box.replaceChildren(
        ...letter.items.map((entry) => {
          const count = bindValue(el("input", { type: "number", min: 1, max: 999, value: entry.count, title: "How many" }), entry, "count", { parse: (v) => Number(v) || 1 });
          const remove = removeX("Remove", () => {
            letter.items = letter.items.filter((e) => e !== entry);
            draw();
          });
          const pick = itemButton(items, () => entry.item, (id) => {
            if (letter.items.some((e) => e !== entry && e.item === id)) {
              showMessage(`(O)${id} is already attached to ${letter.id}.`);
              return false; // keep showing the old item
            }
            showMessage("");
            entry.item = id;
          });
          return controlRow(pick, count, remove);
        })
      );
      let next = "74";
      const choose = itemButton(items, () => next, (id) => void (next = id));
      const add = actionButton("Attach item");
      add.addEventListener("click", () => {
        if (letter.items.some((e) => e.item === next)) return showMessage(`(O)${next} is already attached to ${letter.id}.`);
        showMessage("");
        letter.items.push({ item: next, count: 1 });
        draw();
      });
      box.append(controlRow(choose, add));
    };
    draw();
    return box;
  }

  function card(letter) {
    const subject = bindValue(el("input", { value: letter.subject, placeholder: "The title in the mailbox" }), letter, "subject");
    const text = bindValue(el("textarea", { value: letter.text, rows: 7, placeholder: "Dear @,", title: "Letter text" }), letter, "text");
    const trigger = bindValue(choiceSelect(MAIL_TRIGGERS, letter.trigger, "When to send"), letter, "trigger");
    const delivery = bindValue(choiceSelect(MAIL_DELIVERY, letter.delivery, "Where it arrives"), letter, "delivery");
    const condition = bindValue(el("input", { value: letter.condition, placeholder: "e.g. PLAYER_HAS_MAIL Current SomeOtherLetter Received" }), letter, "condition");
    const once = checkbox(letter.once !== false, (checked) => (letter.once = checked));

    const refresh = () => preview === letter && showLetter(letter);
    for (const node of [subject, text]) node.addEventListener("input", refresh);

    const view = actionButton("Preview", () => (preview === letter ? closePane() : showLetter(letter)));
    const remove = removeX("Remove this letter", () => {
      if (preview === letter) closePane();
      mail = mail.filter((l) => l !== letter);
      render();
    });
    const heading = () => `${letter.id}${letter.subject ? ` - ${letter.subject}` : ""}`;
    const details = collapsible(
      { className: "entry event", open: !!letter.open, summary: heading(), onToggle: (open) => (letter.open = open) },
      field("Subject", subject, "The title shown in the mailbox (the part after [#] in the game's mail data)."),
      field("Letter", text, "@ is the player's name. A new line is a line break. {newName} is the new character's name, e.g. sign it -{newName}. {name} is the Stardew character's name."),
      field("Attached items", giftRows(letter), "Optional. They come with the letter."),
      field("Attached money", number(letter, "money", 0, 10000000), "Optional. In gold. 0 means none."),
      el("h4", { textContent: "When it is sent" }),
      field("Trigger", trigger),
      field("Friendship points", number(letter, "friendshipPoints", 0, 3500), `With ${"{name}"}. 250 points is 1 heart. 0 means no friendship needed.`),
      field("Extra condition", condition, "Optional. Another game state query, joined to the friendship points with a comma."),
      field("Arrives", delivery),
      el("label", { className: "check indent" }, once, " Only send it once (untick to send it again every time the condition is met)"),
      controlRow(view, remove)
    );
    subject.addEventListener("input", () => (details.summary.textContent = heading()));
    return details;
  }

  function render() {
    list.replaceChildren(...(mail.length ? mail.map(card) : [el("p", { className: "empty", textContent: "None yet." })]));
  }

  addButton.addEventListener("click", () => {
    const id = addId.value.trim();
    if (!/^\w{1,60}$/.test(id)) return showMessage("Give the letter an ID (letters, numbers and _ only).");
    if (mail.some((l) => l.id === id)) return showMessage(`${id} already exists.`);
    showMessage("");
    mail.push({ id, subject: "", text: "Dear @,\n\n   -{newName}", items: [], money: 0, trigger: "DayStarted", friendshipPoints: 500, condition: "", delivery: "Today", once: true, open: true });
    addId.value = "";
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
        mail = (await api(`/api/mail?folder=${encodeURIComponent(folder)}`)).mail;
        loaded = true;
      } catch (err) {
        mail = [];
        loaded = false;
        showMessage(err.message);
      }
      addRow.hidden = !loaded;
      render();
    },
    async save(folder) {
      if (!loaded) return;
      try {
        // "open" is only for the page, so it isn't saved
        await postJson("/api/mail", { folder, mail: mail.map(({ open, ...letter }) => letter) });
        showMessage("");
      } catch (err) {
        showMessage(err.message);
        throw new Error(`${title}: ${err.message}`);
      }
    },
  };
}
