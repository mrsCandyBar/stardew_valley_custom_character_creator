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
    loadDialogues();
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
    await saveDialogues();
    setStatus(`Saved the details, dialogue and marriage dialogue to ${folderSelect.value}`);
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
    await saveDialogues();
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

// --- Dialogue editors (dialogue and marriage dialogue share this) ---
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_HEARTS = 14;
const DAY_KEY = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{1,2})?$/;

// "Sun" -> { day: "Sun", hearts: 0 }, "Sun4" -> { day: "Sun", hearts: 4 }. Anything else is not a day key.
function parseDayKey(key) {
  const match = DAY_KEY.exec(key);
  if (!match) return null;
  if (match[2] === undefined) return { day: match[1], hearts: 0 };
  const hearts = Number(match[2]);
  return hearts >= 1 && hearts <= MAX_HEARTS && String(hearts) === match[2] ? { day: match[1], hearts } : null;
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function daySelect(value) {
  const select = el("select", { title: "Day" }, ...DAYS.map((d) => el("option", { value: d, textContent: d })));
  select.value = value;
  return select;
}

function heartsSelect(value) {
  const options = [el("option", { value: "", textContent: "No heart count" })];
  for (let h = 1; h <= MAX_HEARTS; h++) options.push(el("option", { value: String(h), textContent: `${h} hearts` }));
  const select = el("select", { title: "Heart count (optional)" }, ...options);
  select.value = value ? String(value) : "";
  return select;
}

function createDialogueEditor(section) {
  const { type, title, hint } = section.dataset;
  let entries = []; // { key, text (one line per section), kind: "day" | "other" }
  let loaded = false;

  section.append(
    el("h2", { textContent: title }),
    el("p", { className: "hint", textContent: hint }),
    el("p", { className: "editor-message", hidden: true })
  );
  const message = section.querySelector(".editor-message");
  const dayList = el("div");
  const otherList = el("div");

  const addDay = daySelect("Mon");
  const addHearts = heartsSelect(0);
  const addDayButton = el("button", { type: "button", className: "secondary", textContent: "Add day dialogue" });
  const addKey = el("input", { placeholder: "e.g. Introduction, one, Festival_Egg", title: "Dialogue key" });
  const addOtherButton = el("button", { type: "button", className: "secondary", textContent: "Add" });
  const addRows = [
    el("div", { className: "add-row" }, addDay, addHearts, addDayButton),
    el("div", { className: "add-row" }, addKey, addOtherButton),
  ];

  section.append(
    el("div", { className: "entry-group" }, el("h3", { textContent: "Day dialogue" }), dayList, addRows[0]),
    el("div", { className: "entry-group" }, el("h3", { textContent: "Other dialogue" }), otherList, addRows[1])
  );

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  const hasKey = (key, except) => entries.some((e) => e !== except && e.key === key);

  function card(entry) {
    const head = el("div", { className: "entry-head" });
    if (entry.kind === "day") {
      const parsed = parseDayKey(entry.key);
      const day = daySelect(parsed.day);
      const hearts = heartsSelect(parsed.hearts);
      const label = el("span", { className: "key", textContent: entry.key });
      const rename = () => {
        const key = day.value + hearts.value;
        if (hasKey(key, entry)) {
          showMessage(`${key} already exists.`);
          [day.value, hearts.value] = [parsed.day, parsed.hearts ? String(parsed.hearts) : ""];
          return;
        }
        showMessage("");
        parsed.day = day.value;
        parsed.hearts = Number(hearts.value);
        entry.key = key;
        label.textContent = key;
      };
      day.addEventListener("change", rename);
      hearts.addEventListener("change", rename);
      head.append(day, hearts, label);
    } else {
      const key = el("input", { value: entry.key, title: "Dialogue key" });
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
    const rank = (e) => {
      const p = parseDayKey(e.key);
      return DAYS.indexOf(p.day) * 100 + p.hearts;
    };
    const days = entries.filter((e) => e.kind === "day").sort((a, b) => rank(a) - rank(b));
    const others = entries.filter((e) => e.kind === "other");
    const none = (text) => el("p", { className: "empty", textContent: text });
    dayList.replaceChildren(...(days.length ? days.map(card) : [none("None yet. Days and heart counts are optional.")]));
    otherList.replaceChildren(...(others.length ? others.map(card) : [none("None yet.")]));
  }

  function add(entry) {
    entries.push(entry);
    showMessage("");
    render();
    return entry;
  }

  addDayButton.addEventListener("click", () => {
    const key = addDay.value + addHearts.value;
    if (hasKey(key)) return showMessage(`${key} already exists.`);
    add({ key, text: "", kind: "day" });
  });
  addOtherButton.addEventListener("click", () => {
    const key = addKey.value.trim();
    if (!key) return showMessage("Type a key first.");
    if (hasKey(key)) return showMessage(`${key} already exists.`);
    add({ key, text: "", kind: parseDayKey(key) ? "day" : "other" });
    addKey.value = "";
  });

  function setLoaded(ok) {
    loaded = ok;
    for (const row of addRows) row.hidden = !ok;
  }

  return {
    async load(folder) {
      showMessage("");
      try {
        const data = await api(`/api/dialogue?folder=${encodeURIComponent(folder)}&type=${type}`);
        entries = data.entries.map(({ key, lines }) => ({ key, text: lines.join("\n"), kind: parseDayKey(key) ? "day" : "other" }));
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
          if (!key) throw new Error("A dialogue entry has no key.");
          if (seen.has(key)) throw new Error(`The key ${key} is used twice.`);
          seen.add(key);
          if (!lines.length) throw new Error(`${key} needs at least one line of dialogue.`);
        }
        await postJson("/api/dialogue", { folder, type, entries: clean });
        showMessage("");
      } catch (err) {
        showMessage(err.message);
        throw new Error(`${title}: ${err.message}`);
      }
    },
  };
}

const dialogueEditors = [...document.querySelectorAll(".dialogue-editor")].map(createDialogueEditor);
const loadDialogues = () => Promise.all(dialogueEditors.map((editor) => editor.load(folderSelect.value)));
async function saveDialogues() {
  for (const editor of dialogueEditors) await editor.save(folderSelect.value);
}

init(); // last, so everything above is defined before the first load
