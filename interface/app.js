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
    setStatus(`Saved to ${folderSelect.value}/modDetails.json`);
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

init();

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
    setAssetState(row, asset.exists ? `Current: ${asset.name}` : "Nothing uploaded yet.");
  }
}

for (const row of assetRows) {
  const kind = row.dataset.kind;
  const input = row.querySelector("input[type=file]");
  const view = row.querySelector(".view");

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
      if (!row.querySelector(".preview").hidden) showPreview(row); // refresh an open preview
    } catch (err) {
      setAssetState(row, err.message, true);
    } finally {
      input.value = "";
    }
  });
}
