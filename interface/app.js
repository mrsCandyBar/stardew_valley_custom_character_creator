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
    setStatus(`Saved the details, dialogue, marriage dialogue and schedule to ${folderSelect.value}`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    saveButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
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

const editors = [...document.querySelectorAll(".dialogue-editor")].map(createEditor);
const loadEditors = () => Promise.all(editors.map((editor) => editor.load(folderSelect.value)));
async function saveEditors() {
  for (const editor of editors) await editor.save(folderSelect.value);
}

init(); // last, so everything above is defined before the first load
