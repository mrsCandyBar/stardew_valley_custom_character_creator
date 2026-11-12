const form = document.getElementById("form");
const folderSelect = document.getElementById("folder");
const status = document.getElementById("status");
const output = document.getElementById("output");
const buildButton = document.getElementById("build");
const saveButton = document.getElementById("save");
const modFolderName = document.getElementById("modFolderName");

const DETAIL_FIELDS = [
  "SDV_Name",
  "folderLocation",
  "newCharacterName",
  "Name",
  "Author",
  "Version",
  "Description",
  "UniqueID",
  "MinimumApiVersion",
];

function setStatus(text, isError = false) {
  status.textContent = text;
  status.classList.toggle("error", isError);
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(data.error || "Request failed");
    error.output = data.output;
    throw error;
  }
  return data;
}

function postJson(url, body) {
  return api(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function readDetails() {
  const details = {};
  for (const key of DETAIL_FIELDS) details[key] = form[key].value.trim();
  return details;
}

function updateModFolderName() {
  modFolderName.value = `[CP] ${form.SDV_Name.value}-${form.newCharacterName.value}`;
}

async function loadDetails() {
  try {
    const details = await api(`/api/mod-details?folder=${encodeURIComponent(folderSelect.value)}`);
    for (const key of DETAIL_FIELDS) form[key].value = details[key];
    updateModFolderName();
    loadAssets();
    loadEditors();
    output.hidden = true;
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function init(selectFolder) {
  try {
    const { folders } = await api("/api/characters");
    folderSelect.innerHTML = folders.map((f) => `<option>${f}</option>`).join("");
    if (selectFolder) folderSelect.value = selectFolder;
    if (folders.length) await loadDetails();
    else setStatus("No character folders found in characters/.", true);
  } catch (err) {
    setStatus(`${err.message}. Is server.js running?`, true);
  }
}

folderSelect.addEventListener("change", loadDetails);
form.SDV_Name.addEventListener("input", updateModFolderName);
form.newCharacterName.addEventListener("input", updateModFolderName);

saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  try {
    await postJson("/api/mod-details", { folder: folderSelect.value, details: readDetails() });
    await saveEditors();
    setStatus(`Saved the details, dialogue, marriage dialogue, schedule, gift tastes and events to ${folderSelect.value}`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    saveButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.checkValidity()) {
    showTab("details"); // the empty required field is in this tab, and a hidden field can't show its message
    form.reportValidity();
    return;
  }
  buildButton.disabled = true;
  output.hidden = true;
  setStatus("Building...");
  try {
    await saveEditors();
    const result = await postJson("/api/build", { folder: folderSelect.value, details: readDetails() });
    output.textContent = result.output;
    output.hidden = false;
    setStatus("Saved and built. Opened the folder in Explorer.");
  } catch (err) {
    setStatus(err.message, true);
    if (err.output) {
      output.textContent = err.output;
      output.hidden = false;
    }
  } finally {
    buildButton.disabled = false;
  }
});

// --- New character ---
const newDialog = document.getElementById("newDialog");
const newForm = document.getElementById("newForm");
const newError = document.getElementById("newError");

document.getElementById("new").addEventListener("click", () => {
  newForm.reset();
  newError.hidden = true;
  newDialog.showModal();
});
document.getElementById("newCancel").addEventListener("click", () => newDialog.close());

newForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { folder } = await postJson("/api/characters", {
      replacing: newForm.replacing.value,
      newName: newForm.newName.value,
    });
    newDialog.close();
    await init(folder);
    setStatus(`Created ${folder} with placeholder text.`);
  } catch (err) {
    newError.textContent = err.message;
    newError.hidden = false;
  }
});


// --- Assets: portrait, sprite and music uploads ---
const assetRows = [...document.querySelectorAll(".asset")];

function assetUrl(kind) {
  // The timestamp stops the browser showing an old copy after a re-upload.
  return `/api/asset?folder=${encodeURIComponent(folderSelect.value)}&kind=${kind}&t=${Date.now()}`;
}

function showPreview(row) {
  const kind = row.dataset.kind;
  const preview = row.querySelector(".preview");
  const el = document.createElement(kind === "music" ? "audio" : "img");
  if (kind === "music") el.controls = true;
  else el.alt = `${kind} preview`;
  el.src = assetUrl(kind);
  preview.replaceChildren(el);
  preview.hidden = false;
  if (kind === "music") el.play().catch(() => {}); // fine if the browser blocks autoplay; the controls still work
}

function hidePreview(row) {
  const preview = row.querySelector(".preview");
  preview.querySelector("audio")?.pause();
  preview.replaceChildren();
  preview.hidden = true;
}

function setAssetState(row, text, isError = false) {
  const state = row.querySelector(".asset-state");
  state.textContent = text;
  state.classList.toggle("error", isError);
}

async function loadAssets() {
  let assets;
  try {
    assets = await api(`/api/assets?folder=${encodeURIComponent(folderSelect.value)}`);
  } catch (err) {
    assets = {};
  }
  for (const row of assetRows) {
    hidePreview(row);
    const asset = assets[row.dataset.kind] || {};
    row.querySelector(".view").disabled = !asset.exists;
    row.querySelector(".upload").textContent = asset.exists ? "Replace" : "Upload";
    setAssetState(row, asset.exists ? `Current: ${asset.name}` : "Nothing uploaded yet.");
  }
}

for (const row of assetRows) {
  const kind = row.dataset.kind;
  const input = row.querySelector("input[type=file]");
  const view = row.querySelector(".view");

  row.querySelector(".upload").addEventListener("click", () => input.click());
  view.addEventListener("click", () => (row.querySelector(".preview").hidden ? showPreview(row) : hidePreview(row)));

  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    setAssetState(row, "Uploading...");
    try {
      const res = await fetch(
        `/api/asset?folder=${encodeURIComponent(folderSelect.value)}&kind=${kind}&name=${encodeURIComponent(file.name)}`,
        { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAssetState(row, `Saved to ${data.saved}`);
      view.disabled = false;
      row.querySelector(".upload").textContent = "Replace";
      if (!row.querySelector(".preview").hidden) showPreview(row); // refresh an open preview
    } catch (err) {
      setAssetState(row, err.message, true);
    } finally {
      input.value = "";
    }
  });
}

// --- Keyed list editors (dialogue, marriage dialogue and schedule share this) ---
// Each list is entries of { key, lines }. A "group" describes one kind of key that is built from
// one or more dropdowns (e.g. day + heart count), so every part of it is optional to add.
// Keys that match no group go in the "other" list, where the key is typed in.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SEASONS = ["spring", "summer", "fall", "winter"];
const MAX_HEARTS = 14;
const MAX_SEASON_DAY = 28;

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const options = (values, label = (v) => v) => values.map((v) => ({ value: String(v), label: label(v) }));
// A number written without leading zeros, within min..max, or null
const inRange = (text, min, max) => (/^(0|[1-9]\d*)$/.test(text) && Number(text) >= min && Number(text) <= max ? text : null);

const SEASON_OPTIONS = options(SEASONS, (s) => (s === "fall" ? "fall (autumn)" : s));

// Mon, Mon4 ... Sun14: a day with an optional heart count.
const dayHeartsGroup = {
  title: "Day dialogue",
  empty: "None yet. Days and heart counts are optional.",
  addLabel: "Add day dialogue",
  fields: [
    { title: "Day", options: options(DAYS) },
    { title: "Heart count (optional)", options: [{ value: "", label: "No heart count" }, ...options(range(1, MAX_HEARTS), (h) => `${h} hearts`)] },
  ],
  parse(key) {
    const match = new RegExp(`^(${DAYS.join("|")})(\\d{1,2})?$`).exec(key);
    if (!match) return null;
    if (match[2] === undefined) return [match[1], ""];
    return inRange(match[2], 1, MAX_HEARTS) ? [match[1], match[2]] : null;
  },
  compose: ([day, hearts]) => day + hearts,
};

const EDITORS = {
  dialogue: {
    groups: [dayHeartsGroup],
    otherTitle: "Other dialogue",
    otherPlaceholder: "e.g. Introduction, one, Festival_Egg",
  },
  marriage: {
    groups: [dayHeartsGroup],
    otherTitle: "Other dialogue",
    otherPlaceholder: "e.g. Indoor_Morning_{name}, fun_12",
  },
  schedule: {
    groups: [
      {
        title: "Day of the week",
        empty: "None yet. Optional.",
        addLabel: "Add day",
        fields: [{ title: "Day", options: options(DAYS) }],
        parse: (key) => (DAYS.includes(key) ? [key] : null),
        compose: ([day]) => day,
      },
      {
        title: "Season",
        empty: "None yet. Optional.",
        addLabel: "Add season",
        fields: [{ title: "Season", options: SEASON_OPTIONS }],
        parse: (key) => (SEASONS.includes(key) ? [key] : null),
        compose: ([season]) => season,
      },
      {
        title: "Day of a season",
        empty: "None yet. Optional.",
        addLabel: "Add day of season",
        fields: [
          { title: "Season", options: SEASON_OPTIONS },
          { title: "Day of the season", options: options(range(1, MAX_SEASON_DAY), (d) => `day ${d}`) },
        ],
        parse(key) {
          const match = new RegExp(`^(${SEASONS.join("|")}):(\\d{1,2})$`).exec(key);
          return match && inRange(match[2], 1, MAX_SEASON_DAY) ? [match[1], match[2]] : null;
        },
        compose: ([season, day]) => `${season}:${day}`,
      },
    ],
    otherTitle: "Other schedules",
    otherPlaceholder: "e.g. Rain, marriage_Mon",
  },
};

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function fieldSelect(field, value) {
  const select = el("select", { title: field.title }, ...field.options.map((o) => el("option", { value: o.value, textContent: o.label })));
  select.value = value;
  return select;
}

function createEditor(section) {
  const { type, title, hint } = section.dataset;
  const { groups, otherTitle, otherPlaceholder } = EDITORS[type];
  const OTHER = -1;
  let entries = []; // { key, text (one line per section), group: index into groups, or OTHER }
  let loaded = false;

  const groupOf = (key) => {
    const index = groups.findIndex((g) => g.parse(key));
    return index < 0 ? OTHER : index;
  };

  section.append(
    el("h2", { textContent: title }),
    el("p", { className: "hint", textContent: hint }),
    el("p", { className: "editor-message", hidden: true })
  );
  const message = section.querySelector(".editor-message");

  const lists = []; // one list element per group, then the "other" list last
  const addRows = [];

  // One block per group: heading, cards, and a row of dropdowns to add another
  groups.forEach((group, index) => {
    const list = el("div");
    const selects = group.fields.map((field) => fieldSelect(field, field.options[0].value));
    const button = el("button", { type: "button", className: "secondary", textContent: group.addLabel });
    button.addEventListener("click", () => {
      const key = group.compose(selects.map((s) => s.value));
      if (hasKey(key)) return showMessage(`${key} already exists.`);
      add({ key, text: "", group: index });
    });
    const row = el("div", { className: "add-row" }, ...selects, button);
    lists.push(list);
    addRows.push(row);
    section.append(el("div", { className: "entry-group" }, el("h3", { textContent: group.title }), list, row));
  });

  const otherList = el("div");
  const addKey = el("input", { placeholder: otherPlaceholder, title: "Key" });
  const addOtherButton = el("button", { type: "button", className: "secondary", textContent: "Add" });
  const otherRow = el("div", { className: "add-row" }, addKey, addOtherButton);
  addRows.push(otherRow);
  section.append(el("div", { className: "entry-group" }, el("h3", { textContent: otherTitle }), otherList, otherRow));

  addKey.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addOtherButton.click();
  });
  addOtherButton.addEventListener("click", () => {
    const key = addKey.value.trim();
    if (!key) return showMessage("Type a key first.");
    if (hasKey(key)) return showMessage(`${key} already exists.`);
    add({ key, text: "", group: groupOf(key) }); // a key that fits a group moves into it
    addKey.value = "";
  });

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  const hasKey = (key, except) => entries.some((e) => e !== except && e.key === key);

  function card(entry) {
    const head = el("div", { className: "entry-head" });
    if (entry.group !== OTHER) {
      const group = groups[entry.group];
      const values = group.parse(entry.key);
      const selects = group.fields.map((field, i) => fieldSelect(field, values[i]));
      const label = el("span", { className: "key", textContent: entry.key });
      const rename = () => {
        const next = selects.map((s) => s.value);
        const key = group.compose(next);
        if (hasKey(key, entry)) {
          showMessage(`${key} already exists.`);
          selects.forEach((s, i) => (s.value = values[i]));
          return;
        }
        showMessage("");
        values.splice(0, values.length, ...next);
        entry.key = key;
        label.textContent = key;
      };
      selects.forEach((s) => s.addEventListener("change", rename));
      head.append(...selects, label);
    } else {
      const key = el("input", { value: entry.key, title: "Key" });
      key.addEventListener("input", () => (entry.key = key.value));
      head.append(key);
    }
    head.append(
      el("button", {
        type: "button",
        className: "secondary",
        textContent: "Remove",
        onclick: () => {
          entries = entries.filter((e) => e !== entry);
          render();
        },
      })
    );

    const text = el("textarea", { value: entry.text, rows: Math.max(2, entry.text.split("\n").length), placeholder: "One line per section" });
    text.addEventListener("input", () => (entry.text = text.value));
    return el("div", { className: "entry" }, head, text);
  }

  function render() {
    const none = (text) => el("p", { className: "empty", textContent: text });
    groups.forEach((group, index) => {
      // Sort by each dropdown's position, so Mon, Mon2, Mon4 ... Tue and spring, spring:1 ... summer read in order
      const rank = (e) => group.parse(e.key).reduce((total, v, i) => total * 100 + group.fields[i].options.findIndex((o) => o.value === v), 0);
      const mine = entries.filter((e) => e.group === index).sort((a, b) => rank(a) - rank(b));
      lists[index].replaceChildren(...(mine.length ? mine.map(card) : [none(group.empty)]));
    });
    const others = entries.filter((e) => e.group === OTHER);
    otherList.replaceChildren(...(others.length ? others.map(card) : [none("None yet.")]));
  }

  function add(entry) {
    entries.push(entry);
    showMessage("");
    render();
  }

  function setLoaded(ok) {
    loaded = ok;
    for (const row of addRows) row.hidden = !ok;
  }

  return {
    async load(folder) {
      showMessage("");
      try {
        const data = await api(`/api/entries?folder=${encodeURIComponent(folder)}&type=${type}`);
        entries = data.entries.map(({ key, lines }) => ({ key, text: lines.join("\n"), group: groupOf(key) }));
        setLoaded(true);
      } catch (err) {
        entries = [];
        setLoaded(false);
        showMessage(err.message);
      }
      render();
    },
    async save(folder) {
      if (!loaded) return;
      const clean = entries.map((e) => ({ key: e.key.trim(), lines: e.text.split(/\r?\n/).filter((line) => line.trim() !== "") }));
      try {
        const seen = new Set();
        for (const { key, lines } of clean) {
          if (!key) throw new Error("An entry has no key.");
          if (seen.has(key)) throw new Error(`The key ${key} is used twice.`);
          seen.add(key);
          if (!lines.length) throw new Error(`${key} needs at least one line.`);
        }
        await postJson("/api/entries", { folder, type, entries: clean });
        showMessage("");
      } catch (err) {
        showMessage(err.message);
        throw new Error(`${title}: ${err.message}`);
      }
    },
  };
}

// --- Gift tastes ---
// Three parts: the character's generic reactions (a face + text each), the item ids for each category,
// and optional explicit reactions for specific items. Face and item are dropdowns for now.
// TODO (README): swap both dropdowns for clickable pictures.
const FACES = range(0, 8).map((n) => ({ value: `$${n}`, label: `$${n}` }));
const MAX_ITEM_ID = 999;
const itemOptions = (extra) => {
  const ids = range(0, MAX_ITEM_ID);
  if (extra !== undefined && !ids.includes(Number(extra))) ids.push(Number(extra)); // an id from the file that's beyond the dropdown
  return options(ids, (n) => `(O)${n}`);
};
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
  const itemSelect = fieldSelect({ title: "Item", options: itemOptions() }, "0");
  const addItem = el("button", { type: "button", className: "secondary", textContent: "Add item" });
  const addRow = el("div", { className: "add-row" }, itemSelect, addItem);

  section.append(
    el("h2", { textContent: title }),
    el("p", { className: "hint", textContent: hint }),
    message,
    el("div", { className: "entry-group" }, el("h3", { textContent: "Generic reactions" }), genericBox),
    el("div", { className: "entry-group" }, el("h3", { textContent: "Item categories" }), categoryBox),
    el("div", { className: "entry-group" }, el("h3", { textContent: "Specific items" }), itemList, addRow)
  );

  // A face dropdown and a text box bound to one { face, text } object
  const reactionFields = (reaction) => {
    const face = fieldSelect({ title: "Sprite face", options: FACES }, reaction.face);
    face.addEventListener("change", () => (reaction.face = face.value));
    const text = el("textarea", { value: reaction.text, rows: 2, placeholder: "What they say" });
    text.addEventListener("input", () => (reaction.text = text.value));
    return [face, text];
  };

  function render() {
    genericBox.replaceChildren(
      ...GENERIC_ROWS.map(([name, label]) => {
        const [face, text] = reactionFields(tastes.generic[name]);
        return el("div", { className: "entry" }, el("div", { className: "entry-head" }, el("span", { className: "key", textContent: label }), face), text);
      })
    );

    categoryBox.replaceChildren(
      ...CATEGORY_ROWS.map(([name, label]) => {
        const input = el("input", { value: tastes.categories[name].join(" "), placeholder: "e.g. 769 74 637" });
        input.addEventListener("input", () => (tastes.categories[name] = input.value.split(/\s+/).filter(Boolean)));
        return el("label", { className: "category-row" }, el("span", { textContent: label }), input);
      }),
      el("p", { className: "hint", textContent: "Item numbers separated by spaces. Negative numbers are whole categories (e.g. -4 for fish) and universal_neutral works too." })
    );

    itemList.replaceChildren(
      ...(tastes.items.length
        ? tastes.items.map((entry) => {
            const item = fieldSelect({ title: "Item", options: itemOptions(entry.item) }, entry.item);
            item.addEventListener("change", () => {
              if (tastes.items.some((e) => e !== entry && e.item === item.value)) {
                showMessage(`(O)${item.value} already exists.`);
                item.value = entry.item;
                return;
              }
              showMessage("");
              entry.item = item.value;
            });
            const [face, text] = reactionFields(entry);
            const remove = el("button", {
              type: "button",
              className: "secondary",
              textContent: "Remove",
              onclick: () => {
                tastes.items = tastes.items.filter((e) => e !== entry);
                render();
              },
            });
            return el("div", { className: "entry" }, el("div", { className: "entry-head" }, item, face, el("span", { className: "key" }), remove), text);
          })
        : [el("p", { className: "empty", textContent: "None yet. Optional." })])
    );
  }

  addItem.addEventListener("click", () => {
    if (tastes.items.some((e) => e.item === itemSelect.value)) return showMessage(`(O)${itemSelect.value} already exists.`);
    showMessage("");
    tastes.items.push({ item: itemSelect.value, face: "$0", text: "" });
    render();
  });

  return {
    async load(folder) {
      showMessage("");
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

// --- Events ---
// An event is a few required settings (id, place, music, viewport, actors) plus optional conditions,
// "skippable", and a list of commands. Each command is { type, args } and is written "<type> <args>" at build time.
// A command type that has a definition below gets its own fields; anything else is a "custom" command (type + args typed in).
const FACING = options([0, 1, 2, 3], (n) => ["up", "right", "down", "left"][n]);
const CUSTOM = "custom";
const actorText = { kind: "text", title: "Who", placeholder: "{name}", size: 10 };
const actorAndWords = (label) => ({
  label,
  fields: [actorText, { kind: "textarea", title: "Words", placeholder: "A $1 at the start changes the portrait" }],
  defaults: ["{name}", ""],
  parse: (args) => {
    const match = /^(\S+) "(.*)"$/s.exec(args);
    return match && [match[1], match[2]];
  },
  compose: ([who, words]) => `${who} "${words}"`,
});
const spaced = (pattern) => (args) => {
  const match = pattern.exec(args);
  return match && match.slice(1);
};
const noFields = (label) => ({ label, fields: [], defaults: [], parse: (args) => (args === "" ? [] : null), compose: () => "" });

const COMMAND_TYPES = {
  speak: actorAndWords("Speak"),
  textAboveHead: actorAndWords("Text above head"),
  pause: {
    label: "Pause",
    fields: [{ kind: "number", title: "Milliseconds", min: 0 }],
    defaults: ["500"],
    parse: spaced(/^(\d+)$/),
    compose: ([ms]) => ms,
  },
  move: {
    label: "Move",
    fields: [actorText, { kind: "number", title: "Tiles right (negative is left)" }, { kind: "number", title: "Tiles down (negative is up)" }, { kind: "select", title: "Face", options: FACING }],
    defaults: ["farmer", "0", "0", "2"],
    parse: spaced(/^(\S+) (-?\d+) (-?\d+) ([0-3])$/),
    compose: (values) => values.join(" "),
  },
  emote: {
    label: "Emote",
    fields: [actorText, { kind: "number", title: "Emote number", min: 0 }],
    defaults: ["{name}", "32"],
    parse: spaced(/^(\S+) (\d+)$/),
    compose: (values) => values.join(" "),
  },
  showFrame: {
    label: "Show frame",
    fields: [actorText, { kind: "number", title: "Sprite frame", min: 0 }],
    defaults: ["{name}", "0"],
    parse: spaced(/^(\S+) (\d+)$/),
    compose: (values) => values.join(" "),
  },
  shake: {
    label: "Shake",
    fields: [actorText, { kind: "number", title: "Milliseconds", min: 0 }],
    defaults: ["{name}", "500"],
    parse: spaced(/^(\S+) (\d+)$/),
    compose: (values) => values.join(" "),
  },
  jump: {
    label: "Jump",
    fields: [actorText],
    defaults: ["{name}"],
    parse: spaced(/^(\S+)$/),
    compose: ([who]) => who,
  },
  playMusic: {
    label: "Play music",
    fields: [{ kind: "text", title: "Track name", placeholder: "e.g. sweet" }],
    defaults: [""],
    parse: spaced(/^(\S+)$/),
    compose: ([track]) => track,
  },
  stopMusic: noFields("Stop music"),
  playSound: {
    label: "Play sound",
    fields: [{ kind: "text", title: "Sound name", placeholder: "e.g. dwop" }],
    defaults: [""],
    parse: spaced(/^(\S+)$/),
    compose: ([sound]) => sound,
  },
  question: {
    label: "Question",
    fields: [
      { kind: "text", title: "Question ID", placeholder: "fork1", size: 8 },
      { kind: "textarea", title: "Question, then each answer", placeholder: "Question?#Answer one#Answer two" },
    ],
    defaults: ["fork1", ""],
    parse: (args) => {
      const match = /^(\S+) "(.*)"$/s.exec(args);
      return match && [match[1], match[2]];
    },
    compose: ([id, words]) => `${id} "${words}"`,
  },
  fork: {
    label: "Fork (jump to the answer's path)",
    fields: [{ kind: "text", title: "Fork name", placeholder: "the event's fork name" }],
    defaults: [""],
    parse: spaced(/^(\S+)$/),
    compose: ([name]) => name,
  },
  end: noFields("End"),
};

const COMMON_LOCATIONS = ["Farm", "FarmHouse", "Town", "Beach", "Forest", "Mountain", "ElliottHouse", "ArchaeologyHouse", "Saloon", "SeedShop", "Hospital", "Railroad", "Woods", "Desert"];

function commandField(field, value, onInput) {
  let node;
  if (field.kind === "select") node = fieldSelect(field, value);
  else if (field.kind === "textarea") node = el("textarea", { value, rows: 2, title: field.title, placeholder: field.placeholder || "" });
  else {
    node = el("input", { type: field.kind === "number" ? "number" : "text", value, title: field.title, placeholder: field.placeholder || "" });
    if (field.min !== undefined) node.min = field.min;
    if (field.size) node.size = field.size;
  }
  node.addEventListener(field.kind === "select" ? "change" : "input", () => onInput(node.value));
  if (field.kind === "textarea") node.classList.add("wide");
  return node;
}

// The list of commands for an event (or for its fork). `commands` is edited in place.
function createCommandList(commands, getForkName) {
  const box = el("div", { className: "commands" });

  const typeOptions = [...Object.entries(COMMAND_TYPES).map(([value, def]) => ({ value, label: def.label })), { value: CUSTOM, label: "Custom command..." }];
  const addType = fieldSelect({ title: "Command type", options: typeOptions }, "speak");
  const addButton = el("button", { type: "button", className: "secondary", textContent: "Add command" });
  addButton.addEventListener("click", () => {
    const def = COMMAND_TYPES[addType.value];
    if (!def) commands.push({ type: "raw", args: "" });
    else {
      const defaults = addType.value === "fork" ? [getForkName()] : def.defaults;
      commands.push({ type: addType.value, args: def.compose(defaults) });
    }
    render();
  });

  const row = (command, index) => {
    const def = COMMAND_TYPES[command.type];
    let values = def ? def.parse(command.args) : null;
    const custom = !values;

    const type = fieldSelect({ title: "Command type", options: typeOptions }, custom ? CUSTOM : command.type);
    type.addEventListener("change", () => {
      const next = COMMAND_TYPES[type.value];
      if (!next) {
        // Keep what was there as a custom command, so nothing typed is lost
        const text = command.type === "raw" ? command.args : `${command.type} ${command.args}`.trim();
        const space = text.indexOf(" ");
        Object.assign(command, space < 0 ? { type: text || "raw", args: "" } : { type: text.slice(0, space), args: text.slice(space + 1) });
      } else {
        command.type = type.value;
        command.args = next.compose(type.value === "fork" ? [getForkName()] : next.defaults);
      }
      render();
    });

    const move = (by) => {
      const target = index + by;
      if (target < 0 || target >= commands.length) return;
      [commands[index], commands[target]] = [commands[target], commands[index]];
      render();
    };
    const head = el(
      "div",
      { className: "entry-head" },
      el("span", { className: "step", textContent: String(index + 1) }),
      type,
      el("span", { className: "key" }),
      el("button", { type: "button", className: "secondary", textContent: "Up", disabled: index === 0, onclick: () => move(-1) }),
      el("button", { type: "button", className: "secondary", textContent: "Down", disabled: index === commands.length - 1, onclick: () => move(1) }),
      el("button", {
        type: "button",
        className: "secondary",
        textContent: "Remove",
        onclick: () => {
          commands.splice(index, 1);
          render();
        },
      })
    );

    let body;
    if (custom) {
      const name = el("input", { value: command.type === "raw" ? "" : command.type, title: "Command name", placeholder: "command", size: 14 });
      name.addEventListener("input", () => (command.type = name.value.trim() || "raw"));
      const args = el("input", { value: command.args, title: "Everything after the command name", placeholder: "arguments" });
      args.addEventListener("input", () => (command.args = args.value));
      body = el("div", { className: "command-fields" }, name, args);
    } else {
      body = el(
        "div",
        { className: "command-fields" },
        ...def.fields.map((field, i) =>
          commandField(field, values[i], (value) => {
            values[i] = value;
            command.args = def.compose(values);
          })
        )
      );
    }
    return el("div", { className: "entry command" }, head, body);
  };

  function render() {
    box.replaceChildren(
      ...(commands.length ? commands.map(row) : [el("p", { className: "empty", textContent: "No commands yet." })]),
      el("div", { className: "add-row" }, addType, addButton)
    );
  }
  render();
  return box;
}

function createEventsEditor(section) {
  const { title, hint } = section.dataset;
  let events = [];
  let loaded = false;

  const message = el("p", { className: "editor-message", hidden: true });
  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };

  const list = el("div");
  const addId = el("input", { placeholder: "Event ID, e.g. 9999016", title: "Event ID" });
  const addLocation = el("input", { placeholder: "Place, e.g. Beach", title: "Location", value: "Beach" });
  addLocation.setAttribute("list", "event-locations");
  const addButton = el("button", { type: "button", className: "secondary", textContent: "Add event" });
  const addRow = el("div", { className: "add-row" }, addId, addLocation, addButton);
  const datalists = [
    el("datalist", { id: "event-locations" }, ...COMMON_LOCATIONS.map((value) => el("option", { value }))),
  ];

  section.append(el("h2", { textContent: title }), el("p", { className: "hint", textContent: hint }), message, list, addRow, ...datalists);

  const labelOf = (event) => `${event.id || "(no ID)"} in ${event.location || "(no place)"}`;

  function card(event) {
    const summary = el("summary", { textContent: labelOf(event) });
    const refresh = () => (summary.textContent = labelOf(event));
    const text = (key, props) => {
      const input = el("input", { value: event[key], ...props });
      input.addEventListener("input", () => {
        event[key] = input.value;
        refresh();
      });
      return input;
    };
    const labelled = (label, node, note) => el("label", {}, el("span", { textContent: label }), node, ...(note ? [el("small", { textContent: note })] : []));

    const locationInput = text("location", { title: "Location" });
    locationInput.setAttribute("list", "event-locations");

    // Conditions are optional: one line each
    const conditionBox = el("div");
    const renderConditions = () => {
      conditionBox.replaceChildren(
        ...event.conditions.map((condition, i) => {
          const input = el("input", { value: condition, placeholder: "e.g. f {name} 1000" });
          input.addEventListener("input", () => (event.conditions[i] = input.value));
          return el(
            "div",
            { className: "add-row" },
            input,
            el("button", {
              type: "button",
              className: "secondary",
              textContent: "Remove",
              onclick: () => {
                event.conditions.splice(i, 1);
                renderConditions();
              },
            })
          );
        }),
        el("button", {
          type: "button",
          className: "secondary",
          textContent: "Add condition",
          onclick: () => {
            event.conditions.push("");
            renderConditions();
          },
        })
      );
    };
    renderConditions();

    const skippable = el("input", { type: "checkbox", checked: event.skippable });
    skippable.addEventListener("change", () => (event.skippable = skippable.checked));

    // The fork is optional: the name the player's answer jumps to, and its own commands
    const forkName = el("input", { value: event.forkName || "", placeholder: "e.g. carry_it_forward" });
    const forkBox = el("div");
    const hasFork = el("input", { type: "checkbox", checked: event.forkName !== undefined });
    const renderFork = () => {
      forkName.hidden = !hasFork.checked;
      forkBox.replaceChildren(...(hasFork.checked ? [createCommandList(event.forkCommands, () => event.forkName || "")] : []));
    };
    hasFork.addEventListener("change", () => {
      if (hasFork.checked) {
        event.forkName = forkName.value;
        event.forkCommands = event.forkCommands || [{ type: "end", args: "" }];
      } else {
        delete event.forkName;
        delete event.forkCommands;
      }
      renderFork();
    });
    forkName.addEventListener("input", () => (event.forkName = forkName.value));
    renderFork();

    const details = el(
      "details",
      { className: "entry event", open: !!event.open },
      summary,
      labelled("Event ID", text("id", { title: "Event ID" }), "A unique number. Part of the event's key in the game."),
      labelled("Place", locationInput, "The map the event happens in (Data/Events/<place>)."),
      el("div", { className: "label" }, el("span", { textContent: "Conditions" }), conditionBox,
        el("small", { textContent: "All optional. Examples: f {name} 1000 (friendship points), t 600 1200 (time of day), w sunny (weather)." })),
      el("h4", { textContent: "Setup" }),
      labelled("Starting music", text("music", { title: "Starting music" }), "A track name, or none."),
      labelled("Viewport", text("viewport", { title: "Viewport" }), "The map tile the camera starts on, as x y."),
      labelled("Actors", text("actors", { title: "Actors" }), "Who is in the scene and where: name x y facing, repeated (e.g. farmer 15 16 0 {name} 11 10 0)."),
      el("label", { className: "check" }, skippable, el("span", { textContent: "Skippable" })),
      el("h4", { textContent: "Commands" }),
      createCommandList(event.commands, () => event.forkName || ""),
      el("h4", { textContent: "Fork" }),
      el("label", { className: "check" }, hasFork, el("span", { textContent: "This event has a fork (a question's answer jumps to it)" })),
      forkName,
      forkBox,
      el("button", {
        type: "button",
        className: "secondary",
        textContent: "Remove event",
        onclick: () => {
          events = events.filter((e) => e !== event);
          render();
        },
      })
    );
    details.addEventListener("toggle", () => (event.open = details.open));
    return details;
  }

  function render() {
    list.replaceChildren(...(events.length ? events.map(card) : [el("p", { className: "empty", textContent: "None yet." })]));
  }

  addButton.addEventListener("click", () => {
    const id = addId.value.trim();
    const location = addLocation.value.trim();
    if (!/^\w+$/.test(id)) return showMessage("Give the event an ID (letters and numbers only).");
    if (!/^\w+$/.test(location)) return showMessage("Give the place the event happens in, e.g. Beach.");
    if (events.some((e) => e.id === id && e.location === location)) return showMessage(`${id} already exists in ${location}.`);
    showMessage("");
    events.push({
      id,
      location,
      conditions: [],
      music: "none",
      viewport: "10 10",
      actors: "farmer 10 12 0 {name} 10 10 0",
      skippable: true,
      commands: [{ type: "end", args: "" }],
      open: true,
    });
    addId.value = "";
    render();
  });

  return {
    async load(folder) {
      showMessage("");
      try {
        events = (await api(`/api/events?folder=${encodeURIComponent(folder)}`)).events;
        loaded = true;
      } catch (err) {
        events = [];
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
        await postJson("/api/events", { folder, events: events.map(({ open, ...event }) => event) });
        showMessage("");
      } catch (err) {
        showMessage(err.message);
        throw new Error(`${title}: ${err.message}`);
      }
    },
  };
}

const editors = [
  ...[...document.querySelectorAll(".dialogue-editor")].map(createEditor),
  ...[...document.querySelectorAll(".gift-editor")].map(createGiftTastesEditor),
  ...[...document.querySelectorAll(".events-editor")].map(createEventsEditor),
];
const loadEditors = () => Promise.all(editors.map((editor) => editor.load(folderSelect.value)));
async function saveEditors() {
  for (const editor of editors) await editor.save(folderSelect.value);
}

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
  document.querySelectorAll(".preview audio").forEach((audio) => audio.pause()); // don't keep playing from a hidden tab
  try {
    history.replaceState(null, "", `#${name}`); // a refresh stays on this tab
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
showTab(location.hash.slice(1));

init(); // last, so everything above is defined before the first load
