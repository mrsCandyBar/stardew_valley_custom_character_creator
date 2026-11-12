const form = document.getElementById("form");
const folderSelect = document.getElementById("folder");
const status = document.getElementById("status");
const output = document.getElementById("output");
const buildButton = document.getElementById("build");
const modFolderName = document.getElementById("modFolderName");

const DETAIL_FIELDS = [
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

function updateModFolderName() {
  modFolderName.value = `[CP] ${form.sdvName.value}-${form.newCharacterName.value}`;
}

async function loadDetails() {
  try {
    const details = await api(`/api/mod-details?folder=${encodeURIComponent(folderSelect.value)}`);
    for (const key of DETAIL_FIELDS) form[key].value = details[key];
    updateModFolderName();
    setStatus("");
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function init() {
  try {
    const { folders } = await api("/api/characters");
    folderSelect.innerHTML = folders.map((f) => `<option>${f}</option>`).join("");
    if (folders.length) await loadDetails();
    else setStatus("No character folders found in characters/.", true);
  } catch (err) {
    setStatus(`${err.message}. Is server.js running?`, true);
  }
}

folderSelect.addEventListener("change", loadDetails);
form.sdvName.addEventListener("input", updateModFolderName);
form.newCharacterName.addEventListener("input", updateModFolderName);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const details = {};
  for (const key of DETAIL_FIELDS) details[key] = form[key].value;

  buildButton.disabled = true;
  output.hidden = true;
  setStatus("Building...");
  try {
    const result = await api("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: folderSelect.value, sdvName: form.sdvName.value.trim(), details }),
    });
    output.textContent = result.output;
    output.hidden = false;
    setStatus("Built. Opened the folder in Explorer.");
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

init();
