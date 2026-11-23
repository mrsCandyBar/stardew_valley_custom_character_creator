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
  "UpdateKey",
];

const updateMode = document.getElementById("updateMode");
const updateKeyRow = document.getElementById("updateKeyRow");

// The key field only shows (and is only required) when the user chooses to add one
function syncUpdateMode() {
  const add = updateMode.value === "add";
  updateKeyRow.hidden = !add;
  form.UpdateKey.required = add;
}
updateMode.addEventListener("change", syncUpdateMode);

// --- Preview pane: the dedicated space on the right for sprites, the map, expanded dialogue and so on ---
// One thing is shown at a time. Whoever shows something passes an onClose, so it can tidy up when replaced or closed.
const previewPane = document.getElementById("preview-pane");
const previewTitle = document.getElementById("preview-title");
const previewContent = document.getElementById("preview-content");
let paneClose = null;

function showInPane(title, node, onClose) {
  const previous = paneClose;
  paneClose = null; // so the previous owner's own clearing doesn't touch the new content
  previous?.();
  paneClose = onClose || (() => {});
  previewTitle.textContent = title;
  previewContent.replaceChildren(node);
  previewPane.classList.add("has-content");
}

// Empty the pane, but only if `owner` is still what is showing
function clearPane(owner) {
  if (owner && paneClose !== owner) return;
  const close = paneClose;
  paneClose = null;
  previewContent.replaceChildren();
  previewPane.classList.remove("has-content");
  close?.();
}

const closePane = () => clearPane();
document.getElementById("preview-close").addEventListener("click", closePane);
document.addEventListener("keydown", (e) => e.key === "Escape" && !document.querySelector("dialog[open]") && closePane());

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
  if (updateMode.value === "ignore") details.UpdateKey = "";
  return details;
}

function updateModFolderName() {
  modFolderName.value = `[CP] ${form.SDV_Name.value}-${form.newCharacterName.value}`;
}

async function loadDetails() {
  try {
    const details = await api(`/api/mod-details?folder=${encodeURIComponent(folderSelect.value)}`);
    for (const key of DETAIL_FIELDS) form[key].value = details[key];
    updateMode.value = details.UpdateKey ? "add" : "ignore";
    syncUpdateMode();
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
    setStatus(`Saved the details, dialogue, marriage dialogue, festivals, schedule, gift tastes and events to ${folderSelect.value}`);
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

// Previews are view-only: nothing here changes the files. Portraits show each face, sprites play the in-game animations.
const stopTimers = [];
const PORTRAIT_TILE = 64; // each face in the sheet is 64x64, two per row
const SPRITE_W = 16; // each sprite frame is 16x32, four per row
const SPRITE_H = 32;
const SPRITE_COLUMNS = 4;
// Standard NPC layout: four frames per facing, in the order down, right, up, left. The walk cycle plays them in order.
const WALK_CYCLES = [["Walk down", 0], ["Walk right", 4], ["Walk up", 8], ["Walk left", 12]];

// Named animations: [label, first frame, last frame]. These play slowly so each pose can be seen.
const SLOW_MS = 600;
const ACTION_ANIMATIONS = [
  ["Drinking", 16, 19],
  ["Drunk", 20, 22],
  ["Piano", 24, 27],
  ["Bar stool", 28, 31],
  ["Reading", 32, 34],
  ["Speech", 36, 39],
  ["Fishing", 40, 43, 2], // a 4th number joins that many frames side by side into one wider sprite: 40+41, then 42+43
  ["Flower dance", 44, 47],
  ["Wedding", 48, 51],
];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Couldn't load the image."));
    image.src = url;
  });
}

// Draws one frame of a sheet onto a canvas, scaled up with crisp pixels
function drawTile(canvas, image, sx, sy, w, h, scale) {
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, sx, sy, w, h, 0, 0, canvas.width, canvas.height);
}

function portraitPreview(image) {
  const count = Math.floor(image.width / PORTRAIT_TILE) * Math.floor(image.height / PORTRAIT_TILE);
  const columns = Math.floor(image.width / PORTRAIT_TILE);
  const faceAt = (canvas, n, scale) => drawTile(canvas, image, (n % columns) * PORTRAIT_TILE, Math.floor(n / columns) * PORTRAIT_TILE, PORTRAIT_TILE, PORTRAIT_TILE, scale);

  const big = el("canvas", { className: "preview-big" });
  const caption = el("p", { className: "hint" });
  const thumbs = [];
  const select = (n) => {
    faceAt(big, n, 3);
    caption.textContent = `Face $${n}. Use it in dialogue by starting a line with $${n}.`;
    thumbs.forEach((t, i) => t.classList.toggle("current", i === n));
  };
  const grid = el(
    "div",
    { className: "face-grid" },
    ...Array.from({ length: count }, (_, n) => {
      const canvas = el("canvas");
      faceAt(canvas, n, 1);
      const button = el("button", { type: "button", className: "thumb", title: `$${n}`, onclick: () => select(n) }, canvas, el("span", { textContent: `$${n}` }));
      thumbs.push(button);
      return button;
    })
  );
  select(0);
  return el("div", { className: "preview-body" }, el("div", { className: "preview-stage" }, big, caption), grid);
}

function spritePreview(image) {
  const columns = Math.max(1, Math.floor(image.width / SPRITE_W));
  const total = columns * Math.floor(image.height / SPRITE_H);
  const SCALE = 6;
  const frameAt = (canvas, n, scale, span = 1) => drawTile(canvas, image, (n % columns) * SPRITE_W, Math.floor(n / columns) * SPRITE_H, SPRITE_W * span, SPRITE_H, scale);

  const stage = el("canvas", { className: "preview-big" });
  const caption = el("p", { className: "hint" });
  let frames = [0];
  let step = 0;
  let timer = null;
  const thumbs = [];

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  const show = () => {
    const { n, span } = frames[step % frames.length];
    frameAt(stage, n, SCALE, span);
    thumbs.forEach((t, i) => t.classList.toggle("current", i >= n && i < n + span));
  };
  const play = (list, label, ms = 180) => {
    stop();
    // a frame is a number, or { n, span } for a wider sprite made of several frames side by side in one row
    frames = list.map((f) => (typeof f === "number" ? { n: f, span: 1 } : f)).filter(({ n, span }) => n >= 0 && n + span <= total && Math.floor(n / columns) === Math.floor((n + span - 1) / columns));
    if (!frames.length) return void (caption.textContent = `No frames in range (0 to ${total - 1}).`);
    step = 0;
    caption.textContent = `${label}: frames ${frames.map(({ n, span }) => (span > 1 ? range(n, n + span - 1).join("+") : n)).join(", ")}`;
    show();
    if (frames.length > 1) {
      timer = setInterval(() => {
        step += 1;
        show();
      }, ms);
    }
  };
  stopTimers.push(stop);

  const buttons = [
    ...WALK_CYCLES.map(([label, first]) => el("button", { type: "button", className: "secondary", textContent: label, onclick: () => play([first, first + 1, first + 2, first + 3], label) })),
    el("button", { type: "button", className: "secondary", textContent: "Stand", onclick: () => play([0], "Standing") }),
  ];
  const actionButtons = ACTION_ANIMATIONS.map(([label, first, last, span = 1]) => {
    const list = range(first, last).filter((n) => (n - first) % span === 0).map((n) => ({ n, span }));
    return el("button", { type: "button", className: "secondary", textContent: label, onclick: () => play(list, `${label} (slow)`, SLOW_MS) });
  });

  // Anything else in the sheet (sitting, kissing, fishing or other custom frames): type the frame numbers, in order
  const custom = el("input", { placeholder: "Frames, e.g. 16,17,18", title: "Frame numbers to play in order" });
  const playCustom = () => play(custom.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isInteger), "Custom");
  custom.addEventListener("keydown", (event) => event.key === "Enter" && (event.preventDefault(), playCustom()));
  const customRow = el("div", { className: "add-row" }, custom, el("button", { type: "button", className: "secondary", textContent: "Play frames", onclick: playCustom }));

  const grid = el(
    "div",
    { className: "frame-grid" },
    ...Array.from({ length: total }, (_, n) => {
      const canvas = el("canvas");
      frameAt(canvas, n, 2);
      const button = el("button", { type: "button", className: "thumb", title: `Frame ${n}`, onclick: () => play([n], `Frame ${n}`) }, canvas, el("span", { textContent: n }));
      thumbs.push(button);
      return button;
    })
  );

  play([0, 1, 2, 3], "Walk down");
  return el("div", { className: "preview-body" }, el("div", { className: "preview-stage" }, stage, caption), el("div", { className: "asset-buttons wrap" }, ...buttons), el("div", { className: "asset-buttons wrap" }, ...actionButtons), customRow, grid);
}

const PREVIEW_TITLES = { portrait: "Portraits", sprite: "Sprites", music: "Music" };

// Asset previews open in the preview pane. The pane calls row.close when something else replaces them.
async function showPreview(row) {
  const kind = row.dataset.kind;
  const preview = el("div", { className: "preview" });
  row.preview = preview;
  row.close = () => {
    preview.querySelector("audio")?.pause();
    stopTimers.splice(0).forEach((stop) => stop());
    row.preview = null;
    row.querySelector(".view").classList.remove("selected");
  };
  showInPane(PREVIEW_TITLES[kind], preview, row.close);
  row.querySelector(".view").classList.add("selected");
  if (kind === "music") {
    const audio = el("audio", { controls: true, src: assetUrl(kind) });
    preview.replaceChildren(audio);
    audio.play().catch(() => {}); // fine if the browser blocks autoplay; the controls still work
    return;
  }
  preview.replaceChildren(el("p", { className: "hint", textContent: "Loading..." }));
  try {
    const image = await loadImage(assetUrl(kind));
    if (row.preview !== preview) return; // closed while loading
    stopTimers.splice(0).forEach((stop) => stop());
    preview.replaceChildren(kind === "portrait" ? portraitPreview(image) : spritePreview(image));
  } catch (err) {
    if (row.preview === preview) preview.replaceChildren(el("p", { className: "editor-message", textContent: err.message }));
  }
}

function hidePreview(row) {
  if (row.preview) clearPane(row.close);
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
  view.addEventListener("click", () => (row.preview ? hidePreview(row) : showPreview(row)));

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
      if (row.preview) showPreview(row); // refresh an open preview
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
  dayCard: true, // shown as one card per day, with a row per heart count inside
  title: "Day dialogue",
  empty: "None yet. Days and heart counts are optional.",
  addLabel: "Add day",
  fields: [
    { title: "Day", options: options(DAYS) },
    { title: "Heart count (optional)", options: [{ value: "", label: "No heart count" }, ...options(range(1, MAX_HEARTS), (h) => `${"♥".repeat(h)} (${h})`)] },
  ],
  parse(key) {
    const match = new RegExp(`^(${DAYS.join("|")})(\\d{1,2})?$`).exec(key);
    if (!match) return null;
    if (match[2] === undefined) return [match[1], ""];
    return inRange(match[2], 1, MAX_HEARTS) ? [match[1], match[2]] : null;
  },
  compose: ([day, hearts]) => day + hearts,
};

// The game's festivals (Data/Festivals/<id>), with the year and married variants of what an NPC says there.
// A key is "<id>" or "<id>:<variant>", which festivalChange.js turns into <Name>, <Name>_y2, <Name>_spouse or <Name>_spouse_y2.
const FESTIVALS = [
  ["spring13", "Egg Festival (spring 13)"],
  ["spring24", "Flower Dance (spring 24)"],
  ["summer11", "Luau (summer 11)"],
  ["summer28", "Dance of the Moonlight Jellies (summer 28)"],
  ["fall16", "Stardew Valley Fair (fall 16)"],
  ["fall27", "Spirit's Eve (fall 27)"],
  ["winter8", "Festival of Ice (winter 8)"],
  ["winter25", "Feast of the Winter Star (winter 25)"],
];
const FESTIVAL_VARIANTS = [
  ["", "Year 1"],
  ["y2", "Year 2 onwards"],
  ["spouse", "Married, year 1"],
  ["spouse_y2", "Married, year 2 onwards"],
];
const composeFestival = (festival, variant) => (variant ? `${festival}:${variant}` : festival);
const festivalGroup = {
  title: "Festival dialogue",
  empty: "None yet. Pick a festival and when it is, then add it.",
  addLabel: "Add festival dialogue",
  fields: [
    { title: "Festival", options: FESTIVALS.map(([value, label]) => ({ value, label })) },
    { title: "When", options: FESTIVAL_VARIANTS.map(([value, label]) => ({ value, label })) },
  ],
  parse(key) {
    const [festival, variant = ""] = key.split(":");
    const known = FESTIVALS.some(([id]) => id === festival) && FESTIVAL_VARIANTS.some(([v]) => v === variant);
    return known && key === composeFestival(festival, variant) ? [festival, variant] : null;
  },
  compose: ([festival, variant]) => composeFestival(festival, variant),
};

// Keys the game looks for beyond day + hearts, offered in the "Other" dropdown (anything else can be typed as a custom key).
// Compiled from the keys used in this project's templates and Stardew's dialogue modding docs; {name} becomes the replaced character's name.
const numbered = (prefix, from, to) => range(from, to).map((n) => `${prefix}${n}`);
const SEASON_DAY_KEYS = SEASONS.flatMap((season) => DAYS.map((day) => `${season}_${day}`));
const DIALOGUE_KEYS = [
  { label: "First meeting & gifts", keys: ["Introduction", "AcceptGift", "AcceptGift_Positive", "AcceptGift_Neutral", "AcceptGift_Negative", "AcceptBirthdayGift_Positive", "AcceptBirthdayGift_Neutral", "AcceptBirthdayGift_Negative"] },
  { label: "Festivals (what they say at the festival itself is in the Festivals tab)", keys: ["FlowerDance_Accept", "FlowerDance_Accept_Spouse", "FlowerDance_Decline", "wonEggHunt", "wonIceFishing", "SquidFest"] },
  { label: "Beach resort", keys: ["Resort", "Resort_Entering", "Resort_Leaving", "Resort_Bar", "Resort_Chair", "Resort_Shore", "Resort_Towel", "Resort_Umbrella", "Resort_Wander"] },
  { label: "Special", keys: ["GreenRain", "danceRejection", "divorced", "dumped"] },
  { label: "Season + weekday", keys: SEASON_DAY_KEYS },
  { label: "Numbered lines (one to eight)", keys: ["one", "two", "three", "four", "five", "six", "seven", "eight"] },
];
const MARRIAGE_KEYS = [
  { label: "Indoors", keys: [...numbered("Indoor_Day_", 0, 4), ...numbered("Indoor_Night_", 0, 4), "Indoor_Morning_{name}", "Indoor_Night_{name}", "OneRoom_{name}"] },
  { label: "Outdoors & rain", keys: [...numbered("Outdoor_", 0, 4), "Outdoor_{name}", ...numbered("Rainy_Day_", 0, 4), ...numbered("Rainy_Night_", 0, 4), "Rainy_Day_{name}", "Rainy_Night_{name}"] },
  { label: "Mood", keys: [...numbered("Good_", 0, 2), ...numbered("Neutral_", 0, 2), ...numbered("Bad_", 0, 2)] },
  { label: "Their own routine", keys: ["patio_{name}", "spouseRoom_{name}", "funLeave_{name}", "funReturn_{name}", "jobLeave_{name}", "jobReturn_{name}"] },
  { label: "Children", keys: [...numbered("OneKid_", 0, 3), ...numbered("TwoKids_", 0, 3)] },
];
const SCHEDULE_KEYS = [
  { label: "Common", keys: ["default", "Rain", "Rain2", "GreenRain", "marriage"] },
  { label: "Married weekday", keys: DAYS.map((day) => `marriage_${day}`) },
];

const EDITORS = {
  dialogue: {
    groups: [dayHeartsGroup],
    otherTitle: "Other dialogue",
    otherPlaceholder: "e.g. Introduction, one, FlowerDance_Decline",
    suggestions: DIALOGUE_KEYS,
  },
  marriage: {
    groups: [dayHeartsGroup],
    otherTitle: "Other dialogue",
    otherPlaceholder: "e.g. Indoor_Morning_{name}, fun_12",
    suggestions: MARRIAGE_KEYS,
  },
  festival: {
    groups: [festivalGroup],
    noOther: true, // only the festivals the game has, so there is no free-typed key
    suggestions: [],
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
    suggestions: SCHEDULE_KEYS,
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
  const { groups, otherTitle, otherPlaceholder, suggestions, noOther } = EDITORS[type];
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
  const dayPickers = {}; // group index -> the "Add day" dropdown and button, kept to the days without a card yet
  // Replace a dropdown's choices, keeping the current pick when it is still there
  const setChoices = (select, choices) => {
    const current = select.value;
    select.replaceChildren(...choices.map((o) => el("option", { value: o.value, textContent: o.label })));
    if (choices.some((o) => o.value === current)) select.value = current;
  };

  // One block per group: heading, cards, and a row of dropdowns to add another
  groups.forEach((group, index) => {
    const list = el("div");
    // A day-card group only picks the day here; heart counts are added inside each day's card
    const selects = (group.dayCard ? group.fields.slice(0, 1) : group.fields).map((field) => fieldSelect(field, field.options[0].value));
    const button = el("button", { type: "button", className: "secondary", textContent: group.addLabel });
    button.addEventListener("click", () => {
      const key = group.compose(group.dayCard ? [selects[0].value, ""] : selects.map((s) => s.value));
      if (hasKey(key)) return showMessage(`${key} already exists.`);
      add({ key, text: "", group: index });
    });
    const row = el("div", { className: "add-row" }, ...selects, button);
    if (group.dayCard) dayPickers[index] = { select: selects[0], row };
    lists.push(list);
    addRows.push(row);
    section.append(el("div", { className: "entry-group" }, el("h3", { textContent: group.title }), list, row));
  });

  const otherList = el("div");
  // A dropdown of known keys that aren't used yet, plus "Custom key" which shows a text box for anything else
  const CUSTOM = "\u0000custom";
  const addSelect = el("select", { title: "Key" });
  const addKey = el("input", { placeholder: otherPlaceholder, title: "Custom key", hidden: true });
  const addOtherButton = el("button", { type: "button", className: "secondary", textContent: "Add" });
  const otherRow = el("div", { className: "add-row" }, addSelect, addKey, addOtherButton);
  addRows.push(otherRow);
  if (!noOther) section.append(el("div", { className: "entry-group" }, el("h3", { textContent: otherTitle }), otherList, otherRow));

  function refreshSuggestions() {
    const current = addSelect.value;
    const sets = suggestions
      .map(({ label, keys }) => ({ label, keys: keys.filter((key) => !hasKey(key)) }))
      .filter((set) => set.keys.length);
    addSelect.replaceChildren(
      ...sets.map(({ label, keys }) => el("optgroup", { label }, ...keys.map((key) => el("option", { value: key, textContent: key })))),
      el("option", { value: CUSTOM, textContent: "Custom key…" })
    );
    addSelect.value = [...addSelect.options].some((o) => o.value === current) ? current : addSelect.options[0].value;
    addKey.hidden = addSelect.value !== CUSTOM;
  }
  addSelect.addEventListener("change", () => {
    addKey.hidden = addSelect.value !== CUSTOM;
    if (!addKey.hidden) addKey.focus();
  });
  addKey.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addOtherButton.click();
  });
  addOtherButton.addEventListener("click", () => {
    const key = (addSelect.value === CUSTOM ? addKey.value : addSelect.value).trim();
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
    const dayRow = entry.group !== OTHER && groups[entry.group].dayCard; // a heart-count row inside a day card
    if (entry.group !== OTHER) {
      const group = groups[entry.group];
      const values = group.parse(entry.key);
      const selects = group.fields.map((field, i) => fieldSelect(field, values[i]));
      const shown = dayRow ? selects.slice(1) : selects; // the day is the card's title
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
      head.append(...shown);
      if (!dayRow) head.append(label);
    } else {
      const key = el("input", { value: entry.key, title: "Key" });
      key.addEventListener("input", () => (entry.key = key.value));
      head.append(key);
    }
    const body = el("div");
    const toggle = el("button", {
      type: "button",
      className: "secondary",
      textContent: entry.expanded ? "Minimize" : "Expand",
      onclick: () => {
        entry.expanded = !entry.expanded;
        toggle.textContent = entry.expanded ? "Minimize" : "Expand";
        drawBody();
      },
    });
    // Dialogue and marriage dialogue: a one-line input beside the key (click it to edit in the preview pane) and an x.
    // Schedule keeps its Expand button and text box.
    const compact = type !== "schedule";
    const multiline = () => entry.text.includes("\n");
    // Plain text that looks part of the card: one line, cut off with an ellipsis, click to edit in the pane
    const inline = el("button", { type: "button", className: "line-text" });
    const refreshInline = () => {
      const text = multiline() ? entry.text.split("\n").join("  ↵  ") : entry.text;
      inline.textContent = text || "Click to write what they say";
      inline.classList.toggle("empty-line", !text);
      inline.title = text || "";
    };
    refreshInline();
    inline.addEventListener("click", () => {
      if (entry.expanded) return;
      entry.expanded = true;
      drawBody();
    });
    const removeButton = el("button", {
      type: "button",
      className: compact ? "secondary remove-x" : "secondary",
      textContent: compact ? "×" : "Remove",
      title: "Remove",
      onclick: () => {
        clearPane(paneClosed);
        entries = entries.filter((e) => e !== entry);
        render();
      },
    });
    const isSchedule = type === "schedule"; // stops with their own toggles, no Expand button
    if (compact) head.append(inline, removeButton);
    else head.append(...(isSchedule ? [] : [toggle]), removeButton);
    let currentPane = null;

    // Collapsed: one text box, a line per section. Expanded: each line as a face + text row, like the generic reactions.
    // A line's face is written as a leading "$n" (only if the face was picked or already there).
    // The expanded editor opens in the preview pane; the pane calls this when it is closed or replaced.
    const paneClosed = () => {
      entry.expanded = false;
      toggle.textContent = "Expand";
      currentPane = null;
      drawBody();
    };
    let stopsNode = null;
    function drawBody() {
      if (isSchedule) return body.replaceChildren((stopsNode ??= scheduleStops(entry)));
      card.classList.toggle("viewing", Boolean(entry.expanded));
      if (compact) {
        if (!entry.expanded) {
          clearPane(paneClosed);
          refreshInline();
          body.replaceChildren();
          return;
        }
      } else if (!entry.expanded) {
        clearPane(paneClosed);
        const text = el("textarea", { value: entry.text, rows: Math.max(2, entry.text.split("\n").length), placeholder: "One line per section" });
        text.addEventListener("input", () => (entry.text = text.value));
        body.replaceChildren(text);
        return;
      }
      body.replaceChildren(compact ? "" : el("p", { className: "hint", textContent: "Editing in the preview pane on the right." }));
      const pane = el("div", { className: type === "schedule" ? "preview-body" : "preview-body centered" });
      currentPane = pane;
      showInPane(entry.key || "Dialogue", pane, paneClosed);
      drawLines(pane);
    }
    function drawLines(pane) {
      const lines = entry.text.split("\n").map((raw) => {
        const match = /^\$([0-8])/.exec(raw);
        return { face: match ? `$${match[1]}` : "$0", explicit: Boolean(match), text: match ? raw.slice(2) : raw };
      });
      const sync = () => {
        entry.text = lines.map((l) => (l.explicit ? l.face : "") + l.text).join("\n");
        refreshInline();
      };
      const rows = lines.map((line) => {
        const reaction = {
          get face() {
            return line.face;
          },
          set face(value) {
            line.face = value;
            line.explicit = true;
            sync();
          },
          get text() {
            return line.text;
          },
          set text(value) {
            line.text = value;
            sync();
          },
        };
        const row = type === "schedule" ? reactionFields(reaction) : dialogueBox(reaction);
        const removeLine = el("button", {
          type: "button",
          className: "secondary",
          textContent: "×",
          title: "Remove this line",
          hidden: lines.length < 2,
          onclick: () => {
            lines.splice(lines.indexOf(line), 1);
            sync();
            drawLines(pane);
          },
        });
        return el("div", { className: "dialogue-line" }, row, removeLine);
      });
      const addLine = el("button", {
        type: "button",
        className: "secondary",
        textContent: "Add line",
        onclick: () => {
          lines.push({ face: "$0", explicit: false, text: "" });
          sync();
          drawLines(pane);
        },
      });
      pane.replaceChildren(...rows, addLine);
    }
    const card = el("div", { className: dayRow ? "entry-row" : "entry" }, head, body);
    drawBody();
    return card;
  }

  // A clickable portrait face and a text box bound to one { face, text } object
  const reactionFields = (reaction) => {
    const face = faceButton(reaction, assetUrl("portrait"));
    const text = el("textarea", { value: reaction.text, rows: 2, placeholder: "What they say" });
    text.addEventListener("input", () => (reaction.text = text.value));
    return el("div", { className: "reaction-row" }, text, face);
  };

  // The game-style box used in the preview pane: text on the left, framed portrait on the right
  const dialogueBox = (reaction) => {
    const face = faceButton(reaction, assetUrl("portrait"));
    const text = el("textarea", { value: reaction.text, rows: 5, placeholder: "What they say" });
    text.addEventListener("input", () => (reaction.text = text.value));
    return el("div", { className: "dialogue-box" }, text, face);
  };

  function render() {
    if (type === "schedule") clearPane(stopPaneOwner); // a stop's map belongs to the cards drawn before this
    const none = (text) => el("p", { className: "empty", textContent: text });
    groups.forEach((group, index) => {
      // Sort by each dropdown's position, so Mon, Mon2, Mon4 ... Tue and spring, spring:1 ... summer read in order
      const rank = (e) => group.parse(e.key).reduce((total, v, i) => total * 100 + group.fields[i].options.findIndex((o) => o.value === v), 0);
      const mine = entries.filter((e) => e.group === index).sort((a, b) => rank(a) - rank(b));
      if (!group.dayCard) return lists[index].replaceChildren(...(mine.length ? mine.map(card) : [none(group.empty)]));
      const days = DAYS.filter((day) => mine.some((e) => group.parse(e.key)[0] === day));
      const freeDays = group.fields[0].options.filter((o) => !days.includes(o.value));
      setChoices(dayPickers[index].select, freeDays);
      dayPickers[index].row.hidden = !loaded || !freeDays.length; // nothing left to add: hide the picker
      lists[index].replaceChildren(...(days.length ? days.map((day) => dayCard(group, index, day, mine.filter((e) => group.parse(e.key)[0] === day))) : [none(group.empty)]));
    });
    const others = entries.filter((e) => e.group === OTHER);
    otherList.replaceChildren(...(others.length ? others.map(card) : [none("None yet.")]));
    refreshSuggestions();
  }

  // One card per day: its heart-count dialogue rows, and a picker to add another heart count
  function dayCard(group, index, day, rows) {
    const free = group.fields[1].options.filter((o) => !hasKey(group.compose([day, o.value])));
    const select = el("select", { title: group.fields[1].title });
    setChoices(select, free);
    const button = el("button", { type: "button", className: "secondary", textContent: "Add heart count" });
    const addRow = el("div", { className: "add-row", hidden: !free.length }, select, button); // nothing left to add: hide it
    button.addEventListener("click", () => {
      const key = group.compose([day, select.value]);
      if (hasKey(key)) return showMessage(`${key} already exists.`);
      add({ key, text: "", group: index });
    });
    return el("div", { className: "entry day-card" }, el("h4", { textContent: day }), ...rows.map(card), addRow);
  }

  function add(entry) {
    entries.push(entry);
    showMessage("");
    render();
  }

  function setLoaded(ok) {
    loaded = ok;
    for (const row of addRows) row.hidden = !ok;
    // The day pickers also hide when every day is taken; render() settles that
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

// --- Schedule stops ---
// A schedule is a list of stops, one line each: "<time> <place> <x> <y> <facing>" with an optional animation/dialogue after it.
// Every stop is a row of four toggles (time, location, position, facing); a toggle opens that setting's editor.
// A line that isn't in that form (e.g. "GOTO Mon" or an "a1740" arrival time) is kept as a plain text line.
const STOP_PATTERN = /^(\d{3,4}) (\S+) (-?\d+) (-?\d+) ([0-3])(?: (.+))?$/;
const STOP_TIMES = []; // 6:00 am to 2:00 am (2600) in 10-minute steps, the game's own clock
for (let t = 600; t <= 2600; t += t % 100 === 50 ? 50 : 10) STOP_TIMES.push(t);
const ARROWS = ["↑", "→", "↓", "←"]; // up, right, down, left, the same order as FACING

const parseStop = (line) => {
  const m = STOP_PATTERN.exec(line.trim());
  return m ? { time: Number(m[1]), place: m[2], x: Number(m[3]), y: Number(m[4]), facing: Number(m[5]), extra: m[6] || "" } : { raw: line };
};
const composeStop = (s) => (s.raw !== undefined ? s.raw : `${s.time} ${s.place} ${s.x} ${s.y} ${s.facing}${s.extra ? ` ${s.extra}` : ""}`);
const placeLabel = (place) => (LOCATIONS.find(([v]) => v === place) || [place, place])[1];

let stopPaneOwner = null; // the close handler of the stop whose map is in the preview pane

// The map for one stop's position: click or drag to put them on a tile. Other stops on the same map are shown as numbered dots.
function createStopMap(stop, stops, onChange) {
  let zoom = 0;
  let loaded = null;
  const message = el("p", { className: "editor-message", hidden: true });
  const stage = el("canvas");
  const overlay = el("canvas", { className: "map-overlay" });
  const scroll = el("div", { className: "map-scroll", hidden: true }, el("div", { className: "map-stack" }, stage, overlay));
  const zoomSelect = fieldSelect({ title: "Zoom", options: options([1, 2, 3, 4], (z) => `${z}x`) }, "2");
  const tileSize = () => TILE * zoom;

  const number = (key, title) => {
    const input = el("input", { type: "number", value: stop[key], title });
    input.addEventListener("input", () => {
      if (input.value === "") return;
      stop[key] = Math.round(Number(input.value));
      onChange();
      drawOverlay();
    });
    return input;
  };
  const xInput = number("x", "Tile across");
  const yInput = number("y", "Tile down");
  const facingButtons = FACING.map((o, i) =>
    el("button", { type: "button", className: "secondary mode", textContent: ARROWS[i], title: `Face ${o.label}`, onclick: () => { stop.facing = i; onChange(); refreshFacing(); drawOverlay(); } })
  );
  const refreshFacing = () => facingButtons.forEach((b, i) => b.classList.toggle("selected", stop.facing === i));
  refreshFacing();
  const toolbar = el("div", { className: "map-toolbar" },
    el("label", {}, "x ", xInput), el("label", {}, "y ", yInput), ...facingButtons, el("span", { className: "grow" }), el("label", {}, el("span", { textContent: "Zoom " }), zoomSelect));

  function drawStage() {
    if (!loaded) return;
    const { map, base } = loaded;
    for (const canvas of [stage, overlay]) {
      canvas.width = map.width * tileSize();
      canvas.height = map.height * tileSize();
    }
    const ctx = stage.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, stage.width, stage.height);
    drawOverlay();
  }

  function drawOverlay() {
    if (!loaded) return;
    const ts = tileSize();
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    // Where the other stops on this map are, in order
    stops.forEach((other, i) => {
      if (other === stop || other.raw !== undefined || other.place !== stop.place) return;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.strokeStyle = "#2f2a22";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((other.x + 0.5) * ts, (other.y + 0.5) * ts, Math.max(6, ts * 0.35), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2f2a22";
      ctx.font = `bold ${Math.max(9, ts * 0.45)}px sans-serif`;
      ctx.fillText(i + 1, (other.x + 0.5) * ts, (other.y + 0.5) * ts + 1);
    });
    // The stop being placed, with an arrow for the way they face
    const [x, y] = [stop.x * ts, stop.y * ts];
    ctx.fillStyle = "#d6405aaa";
    ctx.strokeStyle = "#d6405a";
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, ts, ts);
    ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
    const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][stop.facing] || [0, 0];
    const [cx, cy] = [x + ts / 2, y + ts / 2];
    ctx.strokeStyle = ctx.fillStyle = "#fff";
    ctx.lineWidth = Math.max(2, ts / 8);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * ts * 0.4, cy + dy * ts * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + dx * ts * 0.4, cy + dy * ts * 0.4, Math.max(2, ts / 8), 0, 2 * Math.PI);
    ctx.fill();
    ctx.textAlign = "start";
  }

  let dragging = false;
  const place = (e) => {
    const rect = overlay.getBoundingClientRect();
    const tile = { x: Math.floor((e.clientX - rect.left) / tileSize()), y: Math.floor((e.clientY - rect.top) / tileSize()) };
    if (tile.x === stop.x && tile.y === stop.y) return;
    Object.assign(stop, tile);
    xInput.value = tile.x;
    yInput.value = tile.y;
    onChange();
    drawOverlay();
  };
  overlay.addEventListener("pointerdown", (e) => {
    if (!loaded) return;
    dragging = true;
    overlay.setPointerCapture(e.pointerId);
    place(e);
  });
  overlay.addEventListener("pointermove", (e) => dragging && place(e));
  overlay.addEventListener("pointerup", () => (dragging = false));
  overlay.addEventListener("pointercancel", () => (dragging = false));
  zoomSelect.addEventListener("change", () => {
    zoom = Number(zoomSelect.value);
    drawStage();
  });

  const node = el("div", { className: "map-panel" }, message, toolbar,
    el("small", { textContent: "Click or drag on the map to choose the tile. The arrow is the way they face. Numbered dots are the other stops on this map." }), scroll);
  return {
    node,
    async show() {
      try {
        loaded = await loadMap(stop.place);
      } catch (err) {
        message.textContent = `${stop.place}: ${err.message}`;
        message.hidden = false;
        return;
      }
      if (!zoom) zoom = Math.min(4, Math.max(1, Math.floor(560 / (loaded.map.width * TILE))));
      zoomSelect.value = String(zoom);
      scroll.hidden = false;
      drawStage();
      scroll.scrollLeft = (stop.x + 0.5) * tileSize() - scroll.clientWidth / 2; // bring the stop into view
      scroll.scrollTop = (stop.y + 0.5) * tileSize() - scroll.clientHeight / 2;
    },
  };
}

// The stops of one schedule entry. Reads and writes entry.text (one line per stop), so saving needs nothing new.
function scheduleStops(entry) {
  const stops = entry.text.split("\n").filter((line) => line.trim()).map(parseStop);
  const root = el("div", { className: "stops" });
  const sync = () => (entry.text = stops.map(composeStop).join("\n"));

  const closeEditors = () => {
    if (stopPaneOwner) clearPane(stopPaneOwner); // the owner redraws us when the pane closes
    stops.forEach((s) => (s.open = null));
  };
  function openMap(stop, i) {
    const view = createStopMap(stop, stops, () => {
      sync();
      summaries.get(stop)?.();
    });
    const owner = () => {
      if (stopPaneOwner === owner) stopPaneOwner = null;
      if (stop.open === "position") stop.open = null;
      draw();
    };
    stopPaneOwner = owner;
    showInPane(`Stop ${i + 1}: ${clockLabel(stop.time)}, ${placeLabel(stop.place)}`, view.node, owner);
    view.show();
  }

  const summaries = new Map(); // stop -> a function refreshing its toggle labels
  function stopRow(stop, i) {
    const remove = el("button", {
      type: "button", className: "secondary remove-x", textContent: "×", title: "Remove this stop",
      onclick: () => {
        closeEditors();
        stops.splice(i, 1);
        sync();
        draw();
      },
    });
    if (stop.raw !== undefined) {
      const input = el("input", { value: stop.raw, title: "A line the editor doesn't have controls for", placeholder: "e.g. GOTO Mon" });
      input.addEventListener("input", () => {
        stop.raw = input.value;
        sync();
      });
      return el("div", { className: "stop" }, el("div", { className: "stop-head" }, el("span", { className: "step", textContent: i + 1 }), input, remove));
    }

    const chips = {};
    const toggle = (kind, label) => {
      const chip = el("button", {
        type: "button", className: "chip", ariaPressed: "false",
        onclick: () => {
          const wasOpen = stop.open === kind;
          closeEditors();
          if (!wasOpen) {
            stop.open = kind;
            if (kind === "position") openMap(stop, i);
          }
          draw();
        },
      });
      chips[kind] = [chip, label];
      return chip;
    };
    const refresh = () => {
      const text = {
        time: `🕐 ${clockLabel(stop.time)}`,
        place: `📍 ${placeLabel(stop.place)}`,
        position: `⌖ ${stop.x}, ${stop.y}`,
        facing: `${ARROWS[stop.facing]} ${FACING[stop.facing].label}`,
      };
      for (const [kind, [chip]] of Object.entries(chips)) {
        chip.textContent = text[kind];
        chip.classList.toggle("selected", stop.open === kind);
        chip.setAttribute("aria-pressed", String(stop.open === kind));
      }
    };
    summaries.set(stop, refresh);
    const head = el("div", { className: "stop-head" }, el("span", { className: "step", textContent: i + 1 }),
      toggle("time", "Time"), toggle("place", "Location"), toggle("position", "Position"), toggle("facing", "Facing"), remove);
    refresh();

    let editor = null;
    if (stop.open === "time") {
      const select = el("select", { title: "Time" }, ...(STOP_TIMES.includes(stop.time) ? STOP_TIMES : [...STOP_TIMES, stop.time].sort((a, b) => a - b)).map((t) => el("option", { value: String(t), textContent: clockLabel(t) })));
      select.value = String(stop.time);
      const clock = el("div", { className: "clock-holder" }, createClock(stop.time, stop.time + 20));
      select.addEventListener("change", () => {
        stop.time = Number(select.value);
        sync();
        refresh();
        clock.replaceChildren(createClock(stop.time, stop.time + 20));
      });
      editor = el("div", { className: "time-row" }, clock, el("label", {}, el("span", { textContent: "They arrive at " }), select));
    } else if (stop.open === "place") {
      const select = choiceSelect(LOCATIONS, stop.place, "Location");
      select.addEventListener("change", () => {
        stop.place = select.value;
        sync();
        refresh();
      });
      editor = el("div", { className: "add-row" }, select, el("small", { textContent: "Then pick the exact tile with Position." }));
    } else if (stop.open === "facing") {
      editor = el("div", { className: "add-row" }, ...FACING.map((o, n) =>
        el("button", {
          type: "button", className: `secondary mode${stop.facing === n ? " selected" : ""}`, textContent: `${ARROWS[n]} ${o.label}`,
          onclick: () => {
            stop.facing = n;
            sync();
            draw();
          },
        })
      ));
    } else if (stop.open === "position") {
      editor = el("p", { className: "hint", textContent: "Choosing the tile in the preview pane on the right." });
    }
    return el("div", { className: "stop" }, head, ...(editor ? [el("div", { className: "stop-editor" }, editor)] : []));
  }

  const addStop = el("button", {
    type: "button", className: "secondary", textContent: "Add stop",
    onclick: () => {
      closeEditors();
      const last = stops.findLast((s) => s.raw === undefined);
      stops.push({ time: last ? Math.min(2600, last.time + 100) : 600, place: last?.place || "Town", x: last?.x ?? 0, y: last?.y ?? 0, facing: last?.facing ?? 2, extra: "" });
      sync();
      draw();
    },
  });
  function draw() {
    summaries.clear();
    root.replaceChildren(...stops.map(stopRow), addStop);
  }
  draw();
  return root;
}

// --- Gift tastes ---
// Three parts: the character's generic reactions (a face + text each), the item ids for each category,
// and optional explicit reactions for specific items. Face and item are dropdowns for now.
// TODO (README): swap both dropdowns for clickable pictures.
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
    const done = el("button", { type: "button", textContent: "Done" });
    const close = el("button", { type: "button", className: "secondary", textContent: "Cancel" });
    const table = el("table", { className: "item-table" }, thead, tbody);
    itemDialog = el("dialog", { className: "item-dialog" }, el("div", { className: "item-dialog-head" }, search, done, close), el("div", { className: "item-scroll" }, table, empty));
    Object.assign(itemDialog, { search, tbody, thead, empty, done });
    close.addEventListener("click", () => itemDialog.close());
    itemDialog.addEventListener("click", (event) => event.target === itemDialog && itemDialog.close()); // click on the backdrop
    document.body.append(itemDialog);
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
  const addItem = el("button", { type: "button", className: "secondary", textContent: "Add item" });
  const addRow = el("div", { className: "add-row" });
  const specificBody = el("div", { hidden: true }, itemList, addRow);
  const toggleSpecific = el("button", {
    type: "button",
    className: "secondary",
    textContent: "Show specific items",
    onclick: () => {
      specificBody.hidden = !specificBody.hidden;
      toggleSpecific.textContent = specificBody.hidden ? "Show specific items" : "Hide specific items";
    },
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
    const view = el("button", { type: "button", className: "secondary", textContent: "View" });
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

      const choose = el("button", {
        type: "button",
        className: "secondary",
        textContent: "Add",
        onclick: async () => {
          const ticked = await pickItem(items, ids(), true);
          if (!ticked) return;
          const known = new Set(items.map((i) => i.id));
          // keep ids the table doesn't know (negative categories etc.) and the order of what was already there
          const kept = ids().filter((id) => !known.has(id) || ticked.includes(id));
          tastes.categories[name] = [...kept, ...ticked.filter((id) => !kept.includes(id))];
          draw();
        },
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
            const remove = el("button", {
              type: "button",
              className: "secondary remove-x",
              textContent: "×",
              title: "Remove",
              
              onclick: () => {
                closePane();
                tastes.items = tastes.items.filter((e) => e !== entry);
                render();
              },
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

// --- Events ---
// An event is a few required settings (id, place, music, viewport, actors) plus optional conditions,
// "skippable", and a list of commands. Each command is { type, args } and is written "<type> <args>" at build time.
// A command type that has a definition below gets its own fields; anything else is a "custom" command (type + args typed in).
const FACING = options([0, 1, 2, 3], (n) => ["up", "right", "down", "left"][n]);
const CUSTOM = "custom";
const actorText = { kind: "text", title: "Who", placeholder: "{name}", narrow: true };
const actorAndWords = (label, wordsKind = "textarea") => ({
  label,
  fields: [actorText, { kind: wordsKind, title: "Words", placeholder: wordsKind === "dialogue" ? "What they say" : "A $1 at the start changes the portrait" }],
  defaults: ["{name}", ""],
  inHead: 2,
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
  speak: actorAndWords("Speak", "dialogue"),
  textAboveHead: actorAndWords("Text above head", "text"),
  pause: {
    label: "Pause",
    fields: [{ kind: "number", title: "Milliseconds", min: 0, small: true }],
    defaults: ["500"],
    parse: spaced(/^(\d+)$/),
    compose: ([ms]) => ms,
  },
  move: {
    label: "Move",
    fields: [actorText, { kind: "number", title: "Tiles right (negative is left)" }, { kind: "number", title: "Tiles down (negative is up)" }, { kind: "select", title: "Face", options: FACING }],
    defaults: ["farmer", "0", "0", "2"],
    hide: [1, 2, 3], // set with "Show on map" instead
    parse: spaced(/^(\S+) (-?\d+) (-?\d+) ([0-3])$/),
    compose: (values) => values.join(" "),
  },
  emote: {
    label: "Emote",
    fields: [actorText, { kind: "emote", title: "Emote" }],
    defaults: ["{name}", "32"],
    inHead: 2,
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
    fields: [{ kind: "music", title: "Track" }],
    defaults: ["sweet"],
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
  end: noFields("End"),
};

// Maps with a Data/Events/<place> file in the game: [value, label]
const LOCATIONS = [
  ["Farm", "Farm"], ["FarmHouse", "Farmhouse"], ["Cellar", "Cellar"], ["Town", "Pelican Town"], ["Beach", "Beach"], ["Forest", "Cindersap Forest"],
  ["Mountain", "Mountain"], ["Backwoods", "Backwoods"], ["BusStop", "Bus Stop"], ["Woods", "Secret Woods"], ["Railroad", "Railroad"], ["Desert", "Calico Desert"],
  ["Mine", "The Mines"], ["Sewer", "Sewers"], ["WitchSwamp", "Witch's Swamp"], ["Tent", "Linus' Tent"], ["Temp", "Temporary map (cutscenes)"],
  ["ArchaeologyHouse", "Museum / Library"], ["ElliottHouse", "Elliott's Cabin"], ["Saloon", "Stardrop Saloon"], ["SeedShop", "Pierre's General Store"],
  ["Hospital", "Harvey's Clinic"], ["HarveyRoom", "Harvey's Room"], ["Blacksmith", "Clint's Blacksmith"], ["AnimalShop", "Marnie's Ranch"],
  ["ScienceHouse", "Carpenter's Shop"], ["SebastianRoom", "Sebastian's Room"], ["Sunroom", "Robin's Sunroom"], ["HaleyHouse", "2 Willow Lane (Haley & Emily)"],
  ["JoshHouse", "1 River Road (Alex)"], ["LeahHouse", "Leah's Cottage"], ["ManorHouse", "Mayor's Manor"], ["Trailer", "Trailer (Penny)"],
  ["Trailer_Big", "Trailer (upgraded)"], ["WizardHouse", "Wizard's Tower"], ["SandyHouse", "Oasis"], ["Club", "Casino"], ["BathHouse_Pool", "Spa pool"],
  ["CommunityCenter", "Community Center"],
];

// Music tracks usable as the event's starting music (or "playMusic"): [value, label]
const MUSIC = [
  ["none", "None (silent)"],
  ["spring1", "Spring 1"], ["spring2", "Spring 2"], ["spring3", "Spring 3"], ["summer1", "Summer 1"], ["summer2", "Summer 2"], ["summer3", "Summer 3"],
  ["fall1", "Fall 1"], ["fall2", "Fall 2"], ["fall3", "Fall 3"], ["winter1", "Winter 1"], ["winter2", "Winter 2"], ["winter3", "Winter 3"],
  ["sweet", "Sweet (romantic)"], ["tribal", "Tribal"], ["wavy", "Wavy"], ["woodsTheme", "Secret Woods"], ["SettlingIn", "Settling In"], ["springtown", "Spring Town"],
  ["ragtime", "Ragtime"], ["echos", "Echos"], ["CloudCountry", "Cloud Country"], ["crane_game", "Crane game"], ["distantBanjo", "Distant Banjo"], ["desolate", "Desolate"],
  ["jaunty", "Jaunty"], ["heavy", "Heavy"], ["libraryTheme", "Library"], ["marlon", "Marlon"], ["musicboxsong", "Music box"], ["night_market", "Night market"],
  ["Orange", "Orange"], ["playful", "Playful"], ["poppy", "Poppy"], ["sadpiano", "Sad piano"], ["shimmeringbastion", "Shimmering Bastion"], ["tickTock", "Tick tock"],
  ["WizardSong", "Wizard"], ["EarthMine", "Earth Mine"], ["FrogCave", "Frog Cave"], ["Icicles", "Icicles"], ["Cavern", "Cavern"], ["moonlightJellies", "Moonlight Jellies"],
];
const OTHER_CHOICE = "__other__";

// A dropdown of [value, label] choices. A value that isn't in the list (e.g. typed by hand earlier) is kept as its own choice.
function choiceSelect(choices, value, title) {
  const list = choices.some(([v]) => v === value) || value === "" ? choices : [...choices, [value, `${value} (custom)`]];
  const select = el("select", { title }, ...list.map(([v, label]) => el("option", { value: v, textContent: label })));
  select.value = value;
  return select;
}

// --- Conditions ---
// Friendship (f), time of day (t) and weather (w) get their own controls; any other condition stays a line of text.
const HOUR_CHOICES = [];
for (let t = 600; t <= 2600; t += 50) HOUR_CHOICES.push(t % 100 ? t - 20 : t); // 600, 630, 700 ... 2600
const clockLabel = (t) => {
  const h = Math.floor(t / 100) % 24;
  const m = String(t % 100).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}${t >= 2400 ? " (next day)" : ""}`;
};
const WEATHER = [["sunny", "☀️", "Sunny"], ["rainy", "🌧️", "Rainy"]];
const MAX_EVENT_HEARTS = 14;
const POINTS_PER_HEART = 250;
const SVG_NS = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, ...children) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
};

// A 24-hour clock face: midnight at the bottom, noon at the top. The day half is bright, the night half dark,
// and the chosen time range is drawn over it.
function createClock(start, end) {
  const C = 50, R = 44;
  const hoursOf = (time) => (((Math.floor(time / 100) + (time % 100) / 60) % 24) + 24) % 24;
  const point = (time) => {
    const angle = (hoursOf(time) / 24) * 2 * Math.PI; // 0 = midnight, at the bottom
    return [C - R * Math.sin(angle), C + R * Math.cos(angle)];
  };
  const wedge = (from, to, fill, extra = {}) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    const span = (((hoursOf(to) - hoursOf(from)) % 24) + 24) % 24;
    return svg("path", { d: `M ${C} ${C} L ${x1} ${y1} A ${R} ${R} 0 ${span > 12 ? 1 : 0} 0 ${x2} ${y2} Z`, fill, ...extra });
  };
  const node = svg("svg", { viewBox: "0 0 100 100", width: 96, height: 96, class: "clock", role: "img", "aria-label": `${clockLabel(start)} to ${clockLabel(end)}` });
  node.append(
    svg("circle", { cx: C, cy: C, r: R, fill: "#1f2a4d" }),
    wedge(600, 1800, "#ffe7a0"), // day: 6am to 6pm
    ...(hoursOf(start) === hoursOf(end) ? [] : [wedge(start, end, "rgba(79,138,61,0.75)", { stroke: "#2f6a1f", "stroke-width": 1 })]),
    svg("circle", { cx: C, cy: C, r: R, fill: "none", stroke: "#2f2a22", "stroke-width": 2 })
  );
  const sun = svg("text", { x: C, y: 17, "text-anchor": "middle", "font-size": 10 });
  sun.textContent = "☀";
  const moon = svg("text", { x: C, y: 91, "text-anchor": "middle", "font-size": 10, fill: "#fff" });
  moon.textContent = "☾";
  node.append(sun, moon);
  return node;
}

// Edits event.conditions (a list of strings) through toggles. Anything it doesn't understand is kept as a text line.
function createConditions(event) {
  const parsed = {};
  const parse = (conditions) => {
    Object.assign(parsed, { friendship: null, who: "{name}", time: null, weather: null, other: [] });
    for (const condition of conditions) {
      let m;
      if (parsed.friendship === null && (m = /^f (\S+) (\d+)$/.exec(condition))) [parsed.who, parsed.friendship] = [m[1], Number(m[2])];
      else if (!parsed.time && (m = /^t (\d+) (\d+)$/.exec(condition))) parsed.time = [Number(m[1]), Number(m[2])];
      else if (!parsed.weather && (m = /^w (sunny|rainy)$/.exec(condition))) parsed.weather = m[1];
      else parsed.other.push(condition);
    }
  };
  parse(event.conditions);

  // The conditions as typed text, "/" between them. It always matches the toggles below.
  const summary = el("input", { value: event.conditions.join("/"), placeholder: "None. e.g. f {name} 1000/t 600 1200", title: "Conditions, separated by /" });
  const commit = () => {
    event.conditions = [
      ...(parsed.friendship !== null ? [`f ${parsed.who} ${parsed.friendship}`] : []),
      ...(parsed.time ? [`t ${parsed.time[0]} ${parsed.time[1]}`] : []),
      ...(parsed.weather ? [`w ${parsed.weather}`] : []),
      ...parsed.other.filter((condition) => condition.trim()),
    ];
    summary.value = event.conditions.join("/");
  };

  const box = el("div", { className: "conditions" });
  summary.addEventListener("input", () => {
    event.conditions = summary.value.split("/").map((c) => c.trim()).filter(Boolean);
    parse(event.conditions);
    render();
  });
  const section = (label, active, onToggle, body, note) => {
    const check = el("input", { type: "checkbox", checked: active });
    check.addEventListener("change", () => onToggle(check.checked));
    return el("div", { className: "condition" }, el("label", { className: "check" }, check, el("span", { textContent: label })), ...(active ? [body(), el("small", { textContent: note })] : []));
  };
  const toggle = (key, on, value) => {
    parsed[key] = on ? value : null;
    commit();
    render();
  };

  function render() {
    // Friendship: click heart n to need n hearts (250 points each); click the last full heart again to lower it
    const friendshipBody = () => {
      const hearts = Math.floor(parsed.friendship / POINTS_PER_HEART);
      const row = el("div", { className: "hearts" });
      for (let n = 1; n <= MAX_EVENT_HEARTS; n++) {
        row.append(el("button", {
          type: "button", className: `heart${n <= hearts ? " full" : ""}`, textContent: n <= hearts ? "♥" : "♡", title: `${n} heart${n === 1 ? "" : "s"} (${n * POINTS_PER_HEART} points)`,
          onclick: () => {
            parsed.friendship = (n === hearts ? n - 1 : n) * POINTS_PER_HEART;
            commit();
            render();
          },
        }));
      }
      return el("div", {}, row, el("span", { className: "heart-count", textContent: `${hearts} heart${hearts === 1 ? "" : "s"} = ${parsed.friendship} friendship points` }));
    };

    // Time of day: two dropdowns and a clock face showing the range
    const timeBody = () => {
      const timeOptions = (list, value) => (list.includes(value) ? list : [...list, value]).map((t) => el("option", { value: String(t), textContent: clockLabel(t) }));
      const from = el("select", { title: "From" }, ...timeOptions(HOUR_CHOICES, parsed.time[0]));
      const to = el("select", { title: "Until" });
      // "Until" only offers times from the start time onwards
      const fillTo = () => {
        const end = parsed.time[1];
        to.replaceChildren(...timeOptions(HOUR_CHOICES.filter((t) => t >= parsed.time[0]), end < parsed.time[0] ? parsed.time[0] : end));
        to.value = String(Math.max(end, parsed.time[0]));
      };
      from.value = String(parsed.time[0]);
      const clockHolder = el("div", { className: "clock-holder" }, createClock(...parsed.time));
      const change = () => {
        parsed.time = [Number(from.value), Math.max(Number(to.value), Number(from.value))];
        fillTo();
        commit();
        clockHolder.replaceChildren(createClock(...parsed.time));
      };
      fillTo();
      from.addEventListener("change", change);
      to.addEventListener("change", change);
      return el("div", { className: "time-row" }, clockHolder, el("div", { className: "time-fields" }, el("label", {}, el("span", { textContent: "From" }), from), el("label", {}, el("span", { textContent: "Until" }), to)));
    };

    // Weather: icon buttons
    const weatherBody = () =>
      el("div", { className: "weather" }, ...WEATHER.map(([value, icon, label]) =>
        el("button", {
          type: "button", className: `weather-option${parsed.weather === value ? " selected" : ""}`, title: label, ariaPressed: String(parsed.weather === value),
          onclick: () => {
            parsed.weather = value;
            commit();
            render();
          },
        }, el("span", { className: "weather-icon", textContent: icon }), el("span", { textContent: label }))
      ));

    const others = parsed.other.map((condition, i) => {
      const input = el("input", { value: condition, placeholder: "e.g. e 9999001 (another event seen first)" });
      input.addEventListener("input", () => {
        parsed.other[i] = input.value;
        commit();
      });
      return el("div", { className: "add-row" }, input, el("button", {
        type: "button", className: "secondary remove-x", textContent: "×", title: "Remove",
        onclick: () => {
          parsed.other.splice(i, 1);
          commit();
          render();
        },
      }));
    });

    box.replaceChildren(
      section("Friendship", parsed.friendship !== null, (on) => toggle("friendship", on, 2000), friendshipBody, "Each heart is 250 friendship points."),
      section("Time of day", parsed.time !== null, (on) => toggle("time", on, [600, 1200]), timeBody, "Day (6am to 6pm) is the bright half of the clock, night the dark half. The green wedge is when the event can start."),
      section("Weather", parsed.weather !== null, (on) => toggle("weather", on, "sunny"), weatherBody, "Rainy covers rain and storms; sunny is every other kind of weather."),
      el("div", { className: "condition" }, el("span", { className: "other-title", textContent: "Other conditions" }), ...others, el("button", {
        type: "button", className: "secondary", textContent: "Add condition",
        onclick: () => {
          parsed.other.push("");
          render();
        },
      }))
    );
  }
  render();
  // The text input stays in the form; the toggles live in `panel`, which the event card shows in the preview pane
  return { input: summary, panel: el("div", { className: "preview-body" }, box) };
}

// A line of speech: a clickable portrait face and the words, like the dialogue pages. The face is the "$n" the words start with.
// In the form it is one line of plain text, cut off with an ellipsis. Clicking it opens the portrait and a text box in the preview pane.
// `panes` collects this field's pane owner so the command list can close it when the list is redrawn.
function dialogueField(words, onInput, panes = []) {
  const m = /^(\$\d+)([\s\S]*)$/.exec(words);
  const state = { face: m ? m[1] : null, text: m ? m[2] : words }; // no "$n" at the start means the default (neutral) face
  const emit = () => onInput((state.face ?? "") + state.text);
  const inline = el("button", { type: "button", className: "line-text" });
  const refresh = () => {
    const line = ((state.face ?? "") + state.text).split("\n").join("  ↵  ");
    inline.textContent = line || "Click to write what they say";
    inline.classList.toggle("empty-line", !line);
    inline.title = line;
  };
  refresh();
  const reaction = {
    get face() {
      return state.face ?? "$0";
    },
    set face(value) {
      state.face = value;
      emit();
      refresh();
    },
  };
  let card = null;
  let open = false;
  const closed = () => {
    open = false;
    card?.classList.remove("viewing");
  };
  panes.push(closed);
  inline.addEventListener("click", () => {
    if (open) return;
    const text = el("textarea", { value: state.text, rows: 5, title: "Words", placeholder: "What they say" });
    text.addEventListener("input", () => {
      state.text = text.value;
      emit();
      refresh();
    });
    const pane = el("div", { className: "preview-body centered" },
      el("div", { className: "dialogue-box" }, text, faceButton(reaction, assetUrl("portrait"))),
      el("p", { className: "hint", textContent: "Click the portrait for the next face. Edits here and in the form stay in step." }));
    showInPane("Speak", pane, closed);
    open = true;
    card = inline.closest(".entry");
    card?.classList.add("viewing");
    text.focus();
  });
  return inline;
}

// --- Emote picker ---
// gameSprites/emotes.png is the game's emote sheet: 16px frames, four to a row. An emote's number is its first frame (4, 8, 12 ...).
const EMOTE_COLUMNS = 4;
const EMOTE_ROWS = 16;
const EMOTE_SCALE = 3;
const emoteIcon = (n, scale = EMOTE_SCALE) => {
  const size = 16 * scale;
  const icon = el("span", { className: "emote-icon" });
  icon.style.cssText = `width:${size}px;height:${size}px;background-image:url("/gameSprites/emotes.png");background-size:${EMOTE_COLUMNS * size}px ${EMOTE_ROWS * size}px;background-position:-${(n % EMOTE_COLUMNS) * size}px -${Math.floor(n / EMOTE_COLUMNS) * size}px`;
  return icon;
};
let emoteDialog = null;
function chooseEmote(current, onChoose) {
  if (!emoteDialog) {
    const grid = el("div", { className: "emote-grid" });
    const close = el("button", { type: "button", className: "secondary", textContent: "Close" });
    emoteDialog = el("dialog", { className: "item-dialog emote-dialog" }, el("div", { className: "item-dialog-head" }, el("strong", { textContent: "Choose an emote", style: "flex:1" }), close), el("div", { className: "item-scroll" }, grid));
    emoteDialog.grid = grid;
    close.addEventListener("click", () => emoteDialog.close());
    emoteDialog.addEventListener("click", (event) => event.target === emoteDialog && emoteDialog.close());
    document.body.append(emoteDialog);
  }
  emoteDialog.grid.replaceChildren(
    ...Array.from({ length: EMOTE_ROWS - 1 }, (_, i) => (i + 1) * EMOTE_COLUMNS).map((n) =>
      el(
        "button",
        {
          type: "button",
          className: `emote-choice${String(n) === String(current) ? " current" : ""}`,
          title: `Emote ${n}`,
          onclick: () => {
            onChoose(String(n));
            emoteDialog.close();
          },
        },
        emoteIcon(n),
        el("span", { textContent: n })
      )
    )
  );
  emoteDialog.showModal();
}
function emoteField(value, onInput) {
  const button = el("button", { type: "button", className: "emote-button", title: "Choose an emote" });
  const draw = () => {
    const n = Number(value);
    button.replaceChildren(...(value !== "" && Number.isInteger(n) && n >= 0 && n < EMOTE_COLUMNS * EMOTE_ROWS ? [emoteIcon(n)] : []), el("span", { textContent: value === "" ? "Choose..." : value }));
  };
  button.addEventListener("click", () =>
    chooseEmote(value, (chosen) => {
      value = chosen;
      onInput(chosen);
      draw();
    })
  );
  draw();
  return button;
}

function commandField(field, value, onInput, panes) {
  if (field.kind === "dialogue") return dialogueField(value, onInput, panes);
  if (field.kind === "emote") return emoteField(value, onInput);
  if (field.kind === "music") {
    // The game's tracks, plus the character's own uploaded one
    const tracks = [...(eventCustomTrack ? [[eventCustomTrack, `Your track: ${eventCustomTrack}`]] : []), ...MUSIC.filter(([v]) => v !== "none")];
    const select = choiceSelect(tracks, value, field.title);
    select.addEventListener("change", () => onInput(select.value));
    return select;
  }
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
  if (field.narrow) node.classList.add("narrow");
  if (field.small) node.classList.add("small");
  return node;
}

// A fork is two commands in the script, a "question" then a "fork": `question fork0 "Question#Answer one#Answer two"` and `fork <name>`.
// The editor shows the pair as one Fork card. The fork's own steps live in the event's forkCommands (shown under the main steps).
const FORK_CARD = "__fork__";
// A Repeat is { type: "repeat", times, commands: [...] }. It is not a game command: the build writes its commands out `times` times.
const REPEAT = "repeat";
const openGenerators = new WeakSet(); // Repeat blocks whose frame generator is open (editor-only state)
const collapsedRepeats = new WeakSet(); // Repeat blocks the user has folded away (editor-only state)
// The commands as the game will play them, with every Repeat written out
const flatten = (list) => list.flatMap((c) => (c.type === REPEAT ? Array.from({ length: c.times }, () => flatten(c.commands)).flat() : [c]));
const parseQuestion = (args) => {
  const match = /^(fork\d+) "(.*)"$/s.exec(args);
  if (!match) return null;
  const [question, ...answers] = match[2].split("#");
  return { orientation: match[1], question, answers };
};
const composeQuestion = ({ orientation, question, answers }) => `${orientation} "${[question, ...answers].join("#")}"`;
const FORK_ORIENTATIONS = [["fork0", "fork0"], ["fork1", "fork1"]];

// The question as one line of plain text, cut off with an ellipsis; clicking it edits the whole question in the preview pane.
function questionField(state, onInput, panes) {
  const inline = el("button", { type: "button", className: "line-text" });
  const refresh = () => {
    inline.textContent = state.question || "Click to write the question";
    inline.classList.toggle("empty-line", !state.question);
    inline.title = state.question;
  };
  refresh();
  let card = null;
  let open = false;
  const closed = () => {
    open = false;
    card?.classList.remove("viewing");
  };
  panes.push(closed);
  inline.addEventListener("click", () => {
    if (open) return;
    const text = el("textarea", { value: state.question, rows: 5, title: "Question", placeholder: "What the player is asked" });
    text.addEventListener("input", () => {
      state.question = text.value.replaceAll("#", ""); // a # would start a new answer
      onInput();
      refresh();
    });
    const pane = el("div", { className: "preview-body centered" },
      el("div", { className: "dialogue-box" }, text),
      el("p", { className: "hint", textContent: "The question the player sees. Edits here and in the form stay in step." }));
    showInPane("Question", pane, closed);
    open = true;
    card = inline.closest(".entry");
    card?.classList.add("viewing");
    text.focus();
  });
  return inline;
}

// The list of commands for an event (or for its fork). `commands` is edited in place.
// `forks` is how this list reaches the event's fork: { name(), has(), create(name), setName(name), remove() }, or null inside the fork itself (no forks within forks).
// `nested` is true for the list inside a Repeat block (no forks or Repeat blocks in there); `onChange` is called after each redraw.
function createCommandList(commands, forks, map, { nested = false, onChange = () => {} } = {}) {
  const box = el("div", { className: "commands" });
  const rowOf = new Map(); // command -> its row, for the Up/Down animation
  const panes = []; // pane owners of the speech fields below, closed whenever the list is redrawn
  let units = []; // what is drawn: one command each, except a question + fork pair, which is one Fork card

  const rowTypes = [...Object.entries(COMMAND_TYPES).map(([value, def]) => ({ value, label: def.label })), { value: CUSTOM, label: "Custom command..." }];
  const repeatType = { value: REPEAT, label: "Repeat (a group of commands, played several times)" };
  const addTypes = [...(forks ? [{ value: FORK_CARD, label: "Fork (question, answers and steps)" }] : []), ...(nested ? [] : [repeatType]), ...rowTypes];
  const addType = fieldSelect({ title: "Command type", options: addTypes }, "speak");
  const addButton = el("button", { type: "button", className: "secondary", textContent: "Add command" });
  // An event has one fork, so once it has one the Fork option can't be added again
  const syncAdd = () => {
    const blocked = addType.value === FORK_CARD && forks.has();
    addButton.disabled = blocked;
    addButton.title = blocked ? "This event already has a fork" : "";
  };
  addType.addEventListener("change", syncAdd);
  // Adds the command type picked in the dropdown at `position` (the end by default)
  const insertCommand = (position = commands.length) => {
    if (addType.value === FORK_CARD && forks.has()) return; // an event has one fork
    if (addType.value === FORK_CARD) {
      const name = `fork_${forks.eventId()}`;
      commands.splice(position, 0, { type: "question", args: composeQuestion({ orientation: "fork0", question: "", answers: ["", ""] }) }, { type: "fork", args: name });
      forks.create(name); // the fork's own steps appear under these ones, ready to fill in
    } else if (addType.value === REPEAT) {
      commands.splice(position, 0, { type: REPEAT, times: 3, commands: [{ type: "showFrame", args: "{name} 0" }, { type: "pause", args: "100" }] });
    } else {
      const def = COMMAND_TYPES[addType.value];
      commands.splice(position, 0, def ? { type: addType.value, args: def.compose(def.defaults) } : { type: "raw", args: "" });
    }
    render();
  };
  addButton.addEventListener("click", () => insertCommand());

  const unitsOf = () => {
    const out = [];
    for (let i = 0; i < commands.length; i++) {
      const [q, f] = [commands[i], commands[i + 1]];
      if (forks && q.type === "question" && f && f.type === "fork" && /^\S+$/.test(f.args) && parseQuestion(q.args)) {
        out.push({ commands: [q, f], fork: true });
        i++;
      } else out.push({ commands: [q], repeat: q.type === REPEAT });
    }
    return out;
  };

  // The arrows and x at the right of a card's head
  const controls = (unit, index) => {
    const move = (by) => {
      const target = index + by;
      if (target < 0 || target >= units.length) return;
      const before = new Map(commands.map((c) => [c, rowOf.get(c).getBoundingClientRect().top]));
      [units[index], units[target]] = [units[target], units[index]];
      commands.splice(0, commands.length, ...units.flatMap((u) => u.commands));
      render();
      // Slide each command from where it was to where it is now, and flash the one that was moved, so the change can be seen
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      for (const c of commands) {
        const node = rowOf.get(c);
        const shift = before.get(c) - node.getBoundingClientRect().top;
        if (shift) node.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration: 350, easing: "ease-in-out" });
      }
      rowOf.get(unit.commands[0]).animate([{ boxShadow: "0 0 0 3px var(--accent)", backgroundColor: "#e6f2dc" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 900, easing: "ease-out" });
    };
    return [
      el("button", { type: "button", className: "secondary arrow", textContent: "↑", title: "Move up", disabled: index === 0, onclick: () => move(-1) }),
      el("button", { type: "button", className: "secondary arrow", textContent: "↓", title: "Move down", disabled: index === units.length - 1, onclick: () => move(1) }),
      el("button", {
        type: "button",
        className: "secondary arrow",
        textContent: "+",
        title: "Add a command after this one (the type chosen under the list)",
        onclick: () => insertCommand(commands.indexOf(unit.commands[unit.commands.length - 1]) + 1),
      }),
      ...(unit.fork ? [] : [el("button", {
        type: "button",
        className: "secondary arrow",
        textContent: "⧉",
        title: "Duplicate this command (right below it)",
        onclick: () => {
          commands.splice(commands.indexOf(unit.commands[0]) + 1, 0, structuredClone(unit.commands[0]));
          render();
        },
      })]),
      el("button", {
        type: "button",
        className: "secondary remove-x",
        textContent: "×",
        title: unit.fork ? "Remove the fork and its steps" : "Remove",
        onclick: () => {
          if (unit.fork && forks.stepCount() > 1 && !confirm(`Remove this fork and its ${forks.stepCount()} steps?`)) return;
          commands.splice(commands.indexOf(unit.commands[0]), unit.commands.length);
          if (unit.fork) forks.remove();
          render();
        },
      }),
    ];
  };

  // The Fork card: question, fork0/fork1, the fork's name and the answers
  const forkRow = (unit, index) => {
    const [q, f] = unit.commands;
    const state = parseQuestion(q.args);
    const commit = () => (q.args = composeQuestion(state));
    const orientation = choiceSelect(FORK_ORIENTATIONS, state.orientation, "Fork orientation (fork0 or fork1)");
    orientation.addEventListener("change", () => {
      state.orientation = orientation.value;
      commit();
    });
    const name = el("input", { value: f.args, title: "Fork name: the entry the answer jumps to", placeholder: "fork name" });
    name.classList.add("fork-name");
    name.addEventListener("input", () => {
      name.value = name.value.replace(/\W/g, "");
      f.args = name.value;
      forks.setName(name.value);
    });
    const answers = state.answers.map((answer, i) => {
      const input = el("input", { value: answer, title: `Answer ${i + 1}`, placeholder: `Answer ${i + 1}` });
      input.addEventListener("input", () => {
        state.answers[i] = input.value.replaceAll("#", "");
        commit();
      });
      return el("div", { className: "answer-row" }, el("span", { className: "step", textContent: `${i + 1}.` }), input, el("button", {
        type: "button", className: "secondary remove-x", textContent: "×", title: "Remove this answer", disabled: state.answers.length < 2,
        onclick: () => {
          state.answers.splice(i, 1);
          commit();
          render();
        },
      }));
    });
    const addAnswer = el("button", {
      type: "button", className: "secondary", textContent: "Add answer",
      onclick: () => {
        state.answers.push("");
        commit();
        render();
      },
    });
    const head = el("div", { className: "entry-head" }, el("strong", { className: "fork-label", textContent: "Fork" }), orientation, name, el("span", { className: "key" }), ...controls(unit, index));
    const body = el("div", { className: "command-fields fork-fields" }, questionField(state, commit, panes), ...answers, el("div", {}, addAnswer));
    return el("div", { className: "entry command cmd-fork" }, head, body);
  };

  // The Repeat card: a group of commands (its own list) played `times` times. Collapsing it hides the group to keep a long list short.
  const repeatRow = (unit, index) => {
    const command = unit.commands[0];
    // A Repeat saved by an older server has lost its group; show it as an empty one rather than failing
    if (!Array.isArray(command.commands)) command.commands = [];
    command.times = Math.min(99, Math.max(1, Math.floor(Number(command.times)) || 1));
    delete command.args;
    const summary = el("span", { className: "repeat-summary" });
    const refreshSummary = () => {
      const count = command.commands.length;
      summary.textContent = `${count} command${count === 1 ? "" : "s"} × ${command.times} = ${count * command.times} played`;
    };
    const times = el("input", { type: "number", min: 1, max: 99, value: command.times, title: "How many times to play the group", className: "small" });
    times.addEventListener("input", () => {
      command.times = Math.min(99, Math.max(1, Math.floor(Number(times.value)) || 1));
      refreshSummary();
    });
    const inner = createCommandList(command.commands, null, map, { nested: true, onChange: refreshSummary });
    const collapsed = collapsedRepeats.has(command);
    inner.hidden = collapsed;
    const toggle = el("button", {
      type: "button", className: "secondary arrow", textContent: collapsed ? "▸" : "▾", title: collapsed ? "Show the group" : "Hide the group",
      onclick: () => {
        const hide = !inner.hidden;
        inner.hidden = hide;
        hide ? collapsedRepeats.add(command) : collapsedRepeats.delete(command);
        toggle.textContent = hide ? "▸" : "▾";
        toggle.title = hide ? "Show the group" : "Hide the group";
      },
    });
    refreshSummary();

    // Frame generator: adds a "Show frame" + "Pause" pair for every frame from the first to the last (counting down if the last is smaller)
    const num = (value, title, small = true) => el("input", { type: "number", min: 0, value, title, className: small ? "small" : "" });
    const who = el("input", { value: "{name}", title: "Who", className: "narrow" });
    const [from, to, wait] = [num(0, "First frame"), num(7, "Last frame"), num(100, "Pause between frames (ms)")];
    const generate = el("div", { className: "frame-generator", hidden: !openGenerators.has(command) },
      el("span", { textContent: "Show frames" }), who, from, el("span", { textContent: "to" }), to, el("span", { textContent: "pausing" }), wait, el("span", { textContent: "ms" }),
      el("button", {
        type: "button", className: "secondary", textContent: "Add to group", title: "Adds a Show frame and a Pause for each frame, at the end of the group",
        onclick: () => {
          const [a, b, ms] = [from, to, wait].map((input) => Math.max(0, Math.floor(Number(input.value)) || 0));
          const step = a <= b ? 1 : -1;
          for (let f = a; f !== b + step; f += step) command.commands.push({ type: "showFrame", args: `${who.value.trim() || "{name}"} ${f}` }, { type: "pause", args: String(ms) });
          openGenerators.add(command);
          render();
        },
      }));
    const generatorToggle = el("button", {
      type: "button", className: "secondary", textContent: "Frames…", title: "Fill the group with a run of frames",
      onclick: () => {
        generate.hidden = !generate.hidden;
        generate.hidden ? openGenerators.delete(command) : openGenerators.add(command);
      },
    });
    const head = el("div", { className: "entry-head" }, toggle, el("strong", { className: "fork-label", textContent: "Repeat" }), times, summary, el("span", { className: "key" }), generatorToggle, ...controls(unit, index));
    return el("div", { className: "entry command cmd-repeat" }, head, generate, inner);
  };

  const row = (unit, index) => {
    if (unit.fork) return forkRow(unit, index);
    if (unit.repeat) return repeatRow(unit, index);
    const command = unit.commands[0];
    const def = COMMAND_TYPES[command.type];
    let values = def ? def.parse(command.args) : null;
    const custom = !values;

    const type = fieldSelect({ title: "Command type", options: rowTypes }, custom ? CUSTOM : command.type);
    type.addEventListener("change", () => {
      const next = COMMAND_TYPES[type.value];
      if (!next) {
        // Keep what was there as a custom command, so nothing typed is lost
        const text = command.type === "raw" ? command.args : `${command.type} ${command.args}`.trim();
        const space = text.indexOf(" ");
        Object.assign(command, space < 0 ? { type: text || "raw", args: "" } : { type: text.slice(0, space), args: text.slice(space + 1) });
      } else {
        command.type = type.value;
        command.args = next.compose(next.defaults);
      }
      render();
    });

    // A Move can be set by clicking its destination on the map
    const choosing = !!map.picked() && map.picked().command === command;
    const mapButton = command.type === "move" && !custom
      ? [el("button", { type: "button", className: `secondary map-pick${choosing ? " selected" : ""}`, textContent: choosing ? "Choosing on map" : "Show on map", onclick: () => map.pick({ commands, command, rerender: render }) })]
      : [];
    // The first field (two for speech, text above head and emote) sits beside the type dropdown; any others go on a line below.
    // A Move's tiles and facing are hidden: "Show on map" sets them.
    let first = [];
    let rest = [];
    if (custom) {
      const name = el("input", { value: command.type === "raw" ? "" : command.type, title: "Command name", placeholder: "command", size: 14 });
      name.addEventListener("input", () => (command.type = name.value.trim() || "raw"));
      const args = el("input", { value: command.args, title: "Everything after the command name", placeholder: "arguments" });
      args.addEventListener("input", () => (command.args = args.value));
      [first, rest] = [[name], [args]];
    } else {
      // A Move shows the exact string that is written to the event ("who x y facing"), editable as an override
      // for when "Show on map" didn't set the tiles or facing as expected.
      let exact = null;
      if (command.type === "move") {
        exact = el("input", { value: command.args, title: "The exact move: who, tiles right, tiles down, facing (0 up, 1 right, 2 down, 3 left). Edit it to override.", className: "exact-move", spellcheck: false });
        const check = () => exact.classList.toggle("invalid", !def.parse(exact.value));
        check();
        exact.addEventListener("input", () => {
          command.args = exact.value;
          const parsed = def.parse(exact.value);
          if (parsed) values.splice(0, values.length, ...parsed); // keep the other fields in step
          check();
          map.changed();
        });
      }
      const shown = def.fields
        .map((field, i) =>
          commandField(field, values[i], (value) => {
            values[i] = value;
            command.args = def.compose(values);
            if (exact) {
              exact.value = command.args;
              exact.classList.remove("invalid");
            }
            map.changed();
          }, panes)
        )
        .filter((_, i) => !(def.hide || []).includes(i));
      first = shown.slice(0, def.inHead || 1);
      rest = shown.slice(def.inHead || 1);
      if (exact) rest.push(el("label", { className: "exact-label" }, el("span", { textContent: "Exact move" }), exact));
    }

    const head = el("div", { className: "entry-head" }, type, ...first, el("span", { className: "key" }), ...mapButton, ...controls(unit, index));
    return el("div", { className: `entry command${custom ? "" : ` cmd-${command.type}`}${choosing ? " viewing" : ""}` }, head, ...(rest.length ? [el("div", { className: "command-fields" }, ...rest)] : []));
  };

  function render() {
    panes.splice(0).forEach((owner) => clearPane(owner)); // a speech open in the pane belongs to a row that is about to be replaced
    rowOf.clear();
    units = unitsOf();
    const nodes = units.map((unit, i) => {
      const node = row(unit, i);
      unit.commands.forEach((c) => rowOf.set(c, node));
      return node;
    });
    box.replaceChildren(
      ...(nodes.length ? nodes : [el("p", { className: "empty", textContent: "No commands yet." })]),
      el("div", { className: "add-row" }, addType, addButton)
    );
    if (forks) syncAdd();
    map.changed();
    onChange();
  }
  // Highlights the Move being chosen on the map, without redrawing (the map closing must not rebuild rows)
  const sync = () => {
    for (const [command, node] of rowOf) {
      const on = !!map.picked() && map.picked().command === command;
      node.classList.toggle("viewing", on);
      const button = node.querySelector(".map-pick");
      if (button) {
        button.classList.toggle("selected", on);
        button.textContent = on ? "Choosing on map" : "Show on map";
      }
    }
  };
  map.register(box, render, sync);
  render();
  return box;
}

// --- Map view for the viewport and actors ---
// Draws the event's map (from the game's unpacked maps) so the viewport and actors can be set by clicking and dragging.
const TILE = 16; // pixels per tile in the game's tilesheets
const VIEW_TILES = [20, 11.25]; // the game window (1280x720 at 64px a tile), in tiles
const ACTOR_COLORS = ["#d6405a", "#3b7dd8", "#e0a020", "#8a4fb8", "#2f9e7a", "#d86f2a"];
const mapCache = new Map(); // place -> Promise of { map, base: a canvas with the whole map drawn at 1 pixel per source pixel }

function loadMap(place) {
  if (!mapCache.has(place)) {
    const promise = (async () => {
      const map = await api(`/api/map?name=${encodeURIComponent(place)}`);
      const sheets = await Promise.all(map.tilesets.map((set) => (set.found ? loadImage(`/api/map-image?name=${encodeURIComponent(set.image)}`) : null)));
      const base = el("canvas", { width: map.width * TILE, height: map.height * TILE });
      const ctx = base.getContext("2d");
      for (const layer of map.layers) {
        if (layer.name === "Paths") continue; // game logic, not scenery
        layer.tiles.forEach((gid, i) => {
          const id = gid & 0x1fffffff; // the top bits are flip flags
          if (!id) return;
          let s = -1;
          map.tilesets.forEach((set, k) => set.firstgid <= id && (s < 0 || set.firstgid > map.tilesets[s].firstgid) && (s = k));
          const set = map.tilesets[s];
          if (!set || !sheets[s]) return;
          const index = id - set.firstgid;
          ctx.drawImage(sheets[s], (index % set.columns) * set.tileWidth, Math.floor(index / set.columns) * set.tileHeight, set.tileWidth, set.tileHeight, (i % map.width) * TILE, Math.floor(i / map.width) * TILE, TILE, TILE);
        });
      }
      return { map, base };
    })();
    promise.catch(() => mapCache.delete(place)); // try again next time, e.g. after the maps are added
    mapCache.set(place, promise);
  }
  return mapCache.get(place);
}

// "farmer 15 16 0 Elliott 11 10 0" <-> [{ name, x, y, facing }]. Null if the text isn't made of whole "name x y facing" groups.
function parseActors(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length % 4) return null;
  const actors = [];
  for (let i = 0; i < words.length; i += 4) {
    const [name, x, y, facing] = words.slice(i, i + 4);
    if (![x, y, facing].every((n) => /^-?\d+$/.test(n))) return null;
    actors.push({ name, x: Number(x), y: Number(y), facing: Number(facing) });
  }
  return actors;
}
const composeActors = (actors) => actors.map((a) => `${a.name} ${a.x} ${a.y} ${a.facing}`).join(" ");
const parseViewport = (text) => {
  const m = /^\s*(-?\d+)\s+(-?\d+)\s*$/.exec(text);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};

// The editor under an event's Viewport/Actors fields. `onChange` is told when a drag or list edit changed event.viewport / event.actors.
function createMapEditor(event, onChange, onPick, onUnpick) {
  let zoom = 0;
  let loaded = null; // { map, base } for the place currently shown
  let mode = "viewport";
  let drag = null;
  let picked = null; // { commands, command, rerender }: the Move command whose destination is being chosen on the map
  const showAllPaths = el("input", { type: "checkbox" });
  showAllPaths.addEventListener("change", () => drawOverlay());
  const banner = el("div", { className: "map-banner", hidden: true });

  // Every Move in the event, in order, with where the actor starts and ends. The start is the actor's tile in the Actors field
  // moved along by their earlier Moves (the fork's Moves carry on from the end of the main ones).
  function replaySteps() {
    const actors = parseActors(event.actors) || []; // moved along as the Moves are replayed
    const position = new Map(actors.map((a) => [a.name, a]));
    const steps = [];
    for (const list of [event.commands, event.forkCommands || []]) {
      for (const command of flatten(list)) {
        const m = command.type === "move" && /^(\S+) (-?\d+) (-?\d+) ([0-3])/.exec(command.args);
        if (!m) continue;
        const actor = position.get(m[1]);
        const from = actor ? { x: actor.x, y: actor.y } : null;
        const to = from && { x: from.x + Number(m[2]), y: from.y + Number(m[3]) };
        // `before` is where everyone stands as this step begins
        steps.push({ command, who: m[1], from, to, n: steps.length + 1, before: actors.map((a) => ({ ...a })) });
        if (actor) Object.assign(actor, to, { facing: Number(m[4]) });
      }
    }
    return steps;
  }

  const message = el("p", { className: "editor-message", hidden: true });
  const stage = el("canvas");
  const overlay = el("canvas", { className: "map-overlay" });
  const scroll = el("div", { className: "map-scroll", hidden: true }, el("div", { className: "map-stack" }, stage, overlay));
  const actorList = el("div", { className: "map-actors" });
  const zoomSelect = fieldSelect({ title: "Zoom", options: options([1, 2, 3, 4], (z) => `${z}x`) }, "2");
  const modeButtons = [["viewport", "Camera (viewport)"], ["actors", "Actors"]].map(([value, label]) =>
    el("button", { type: "button", className: "secondary mode", textContent: label, onclick: () => { mode = value; refreshModes(); } })
  );
  const refreshModes = () => modeButtons.forEach((b, i) => b.classList.toggle("selected", ["viewport", "actors"][i] === mode));
  refreshModes();
  const hint = el("small", { textContent: "" });
  const updateHint = () => (hint.textContent = mode === "viewport" ? "Click or drag on the map to place the camera. The bright box is what the player sees (about 20 x 11 tiles)." : "Drag an actor to move them. Click an actor to turn them (the arrow is the way they face).");

  const toolbar = el("div", { className: "map-toolbar" }, ...modeButtons, el("span", { className: "grow" }),
    el("label", { className: "check-inline" }, showAllPaths, el("span", { textContent: " Show all move paths" })), el("span", { className: "grow" }), el("label", {}, el("span", { textContent: "Zoom " }), zoomSelect));
  const tileSize = () => TILE * zoom;

  // --- drawing ---
  function drawStage() {
    if (!loaded) return;
    const { map, base } = loaded;
    for (const canvas of [stage, overlay]) {
      canvas.width = map.width * tileSize();
      canvas.height = map.height * tileSize();
    }
    const ctx = stage.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, stage.width, stage.height);
    drawOverlay();
  }

  function drawOverlay() {
    if (!loaded) return;
    const ts = tileSize();
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const view = parseViewport(event.viewport);
    if (view) {
      const [w, h] = VIEW_TILES;
      const left = (view.x + 0.5 - w / 2) * ts;
      const top = (view.y + 0.5 - h / 2) * ts;
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.rect(0, 0, overlay.width, overlay.height);
      ctx.rect(left, top, w * ts, h * ts);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#ffd84d";
      ctx.lineWidth = 2;
      ctx.strokeRect(left, top, w * ts, h * ts);
      ctx.fillStyle = "#ffd84d";
      ctx.fillRect((view.x + 0.35) * ts, (view.y + 0.35) * ts, 0.3 * ts, 0.3 * ts);
    }

    // Move paths: all of them if asked for, otherwise just the one being chosen
    const actorNames = (parseActors(event.actors) || []).map((a) => a.name);
    for (const step of replaySteps()) {
      const isPicked = !!picked && step.command === picked.command;
      if (!step.to || !(showAllPaths.checked || isPicked)) continue;
      const color = ACTOR_COLORS[Math.max(0, actorNames.indexOf(step.who)) % ACTOR_COLORS.length];
      const [x1, y1, x2, y2] = [step.from.x + 0.5, step.from.y + 0.5, step.to.x + 0.5, step.to.y + 0.5].map((n) => n * ts);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const stroke = (style, width) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      if (isPicked) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(step.from.x * ts + 1, step.from.y * ts + 1, ts - 2, ts - 2); // where they start this step
        ctx.setLineDash([]);
        stroke("#fff", Math.max(4, ts / 4));
      }
      stroke(color, Math.max(2, ts / 8));
      if (x1 !== x2 || y1 !== y2) {
        ctx.fillStyle = isPicked ? "#fff" : color;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ts * 0.4 * Math.cos(angle - 0.5), y2 - ts * 0.4 * Math.sin(angle - 0.5));
        ctx.lineTo(x2 - ts * 0.4 * Math.cos(angle + 0.5), y2 - ts * 0.4 * Math.sin(angle + 0.5));
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, Math.max(7, ts * 0.4), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(9, ts * 0.5)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(step.n, (x1 + x2) / 2, (y1 + y2) / 2 + 1);
      ctx.textAlign = "start";
    }

    // While choosing a move, everyone is shown where they stand at that step, so the destination can be judged against them
    const pickedStep = picked && replaySteps().find((st) => st.command === picked.command);
    (pickedStep ? pickedStep.before : parseActors(event.actors) || []).forEach((actor, i) => {
      const color = ACTOR_COLORS[i % ACTOR_COLORS.length];
      const x = actor.x * ts;
      const y = actor.y * ts;
      ctx.fillStyle = color + "aa";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, ts, ts);
      ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      // an arrow towards the way they face: 0 up, 1 right, 2 down, 3 left
      const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][actor.facing] || [0, 0];
      const cx = x + ts / 2;
      const cy = y + ts / 2;
      ctx.strokeStyle = "#fff";
      ctx.fillStyle = "#fff";
      ctx.lineWidth = Math.max(2, ts / 8);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * ts * 0.4, cy + dy * ts * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + dx * ts * 0.4, cy + dy * ts * 0.4, Math.max(2, ts / 8), 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = `bold ${Math.max(11, ts * 0.6)}px sans-serif`;
      ctx.textBaseline = "bottom";
      const label = actor.name === "{name}" ? "NPC" : actor.name;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#000";
      ctx.strokeText(label, x, y - 1);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x, y - 1);
    });
  }

  // --- the actor list under the map ---
  function renderActors() {
    const actors = parseActors(event.actors);
    if (!actors) {
      actorList.replaceChildren(el("p", { className: "hint", textContent: "The Actors text isn't in the form name x y facing, so it can't be shown on the map. Fix it above to see the actors." }));
      return;
    }
    const save = () => {
      event.actors = composeActors(actors);
      onChange();
      drawOverlay();
    };
    const rows = actors.map((actor, i) => {
      const name = el("input", { value: actor.name, title: "Who", size: 10 });
      name.addEventListener("input", () => {
        actor.name = name.value.replace(/\s+/g, "") || "actor";
        save();
      });
      const number = (key, title) => {
        const input = el("input", { type: "number", value: actor[key], title });
        input.addEventListener("input", () => {
          if (input.value === "") return;
          actor[key] = Math.round(Number(input.value));
          save();
        });
        return input;
      };
      const facing = fieldSelect({ title: "Facing", options: FACING }, String(actor.facing));
      facing.addEventListener("change", () => {
        actor.facing = Number(facing.value);
        save();
      });
      return el("div", { className: "add-row actor-row" },
        el("span", { className: "swatch", style: `background:${ACTOR_COLORS[i % ACTOR_COLORS.length]}` }), name,
        el("label", {}, "x ", number("x", "Tile across")), el("label", {}, "y ", number("y", "Tile down")), facing,
        el("button", { type: "button", className: "secondary remove-x", textContent: "×", title: "Remove", onclick: () => { actors.splice(i, 1); save(); renderActors(); } }));
    });
    actorList.replaceChildren(...rows, el("button", {
      type: "button",
      className: "secondary",
      textContent: "Add actor",
      onclick: () => {
        const view = parseViewport(event.viewport) || { x: 5, y: 5 };
        const name = !actors.some((a) => a.name === "farmer") ? "farmer" : !actors.some((a) => a.name === "{name}") ? "{name}" : `actor${actors.length + 1}`;
        actors.push({ name, x: view.x, y: view.y, facing: 2 });
        save();
        renderActors();
      },
    }));
  }

  // --- mouse ---
  const tileAt = (e) => {
    const rect = overlay.getBoundingClientRect();
    return { x: Math.floor((e.clientX - rect.left) / tileSize()), y: Math.floor((e.clientY - rect.top) / tileSize()) };
  };
  overlay.addEventListener("pointerdown", (e) => {
    if (!loaded) return;
    const tile = tileAt(e);
    if (picked) return chooseDestination(tile);
    if (mode === "viewport") {
      drag = { kind: "viewport" };
      event.viewport = `${tile.x} ${tile.y}`;
    } else {
      const actors = parseActors(event.actors);
      const index = actors ? actors.findLastIndex((a) => a.x === tile.x && a.y === tile.y) : -1;
      if (index < 0) return;
      drag = { kind: "actor", index, moved: false, from: tile };
    }
    overlay.setPointerCapture(e.pointerId);
    onChange();
    drawOverlay();
  });
  overlay.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const tile = tileAt(e);
    if (drag.kind === "viewport") {
      if (event.viewport !== `${tile.x} ${tile.y}`) {
        event.viewport = `${tile.x} ${tile.y}`;
        onChange();
        drawOverlay();
      }
      return;
    }
    const actors = parseActors(event.actors);
    const actor = actors && actors[drag.index];
    if (!actor || (actor.x === tile.x && actor.y === tile.y)) return;
    drag.moved = true;
    Object.assign(actor, tile);
    event.actors = composeActors(actors);
    onChange();
    drawOverlay();
  });
  const endDrag = () => {
    if (drag && drag.kind === "actor" && !drag.moved) {
      // a click without a drag turns the actor to face the next way
      const actors = parseActors(event.actors);
      if (actors && actors[drag.index]) {
        actors[drag.index].facing = (actors[drag.index].facing + 1) % 4;
        event.actors = composeActors(actors);
        onChange();
      }
    }
    if (drag) {
      drag = null;
      renderActors();
      drawOverlay();
    }
  };
  overlay.addEventListener("pointerup", endDrag);
  overlay.addEventListener("pointercancel", endDrag);

  // --- choosing a Move's destination ---
  function updateBanner() {
    const step = picked && replaySteps().find((st) => st.command === picked.command);
    banner.hidden = !picked;
    if (!picked) return;
    banner.replaceChildren(
      el("span", { textContent: step && step.from ? `Step ${step.n}: click the tile ${step.who} should walk to (from ${step.from.x}, ${step.from.y}). Everyone is shown where they stand at this step. A corner becomes two moves.` : `${step && step.who} isn't in the Actors field, so there's no start tile to move from. Add them above.` }),
      el("button", { type: "button", className: "secondary", textContent: "Done", onclick: () => api_pick(null) })
    );
  }
  function chooseDestination(tile) {
    const step = replaySteps().find((st) => st.command === picked.command);
    const m = /^(\S+) (-?\d+) (-?\d+) ([0-3])/.exec(picked.command.args);
    if (!step || !step.from || !m) return;
    const [dx, dy] = [tile.x - step.from.x, tile.y - step.from.y];
    if (dx && dy) {
      // A move only goes in a straight line: walk across first, then up or down
      picked.command.args = `${m[1]} ${dx} 0 ${dx > 0 ? 1 : 3}`;
      const second = { type: "move", args: `${m[1]} 0 ${dy} ${m[4]}` };
      picked.commands.splice(picked.commands.indexOf(picked.command) + 1, 0, second);
      picked.command = second;
    } else {
      picked.command.args = `${m[1]} ${dx} ${dy} ${m[4]}`;
    }
    picked.rerender();
    updateBanner();
    drawOverlay();
  }
  function api_pick(info) {
    picked = info && picked && picked.command === info.command ? null : info; // choosing the same one again turns it off
    if (picked) {
      mode = "actors"; // opened from a Move: the Actors tool is the one wanted afterwards
      refreshModes();
      updateHint();
      setOpen(true);
    }
    updateBanner();
    drawOverlay();
    onPick();
  }

  // --- loading ---
  async function show() {
    message.hidden = true;
    scroll.hidden = true;
    loaded = null;
    try {
      loaded = await loadMap(event.location);
    } catch (err) {
      message.textContent = `${event.location}: ${err.message}`;
      message.hidden = false;
      return;
    }
    if (!zoom) zoom = Math.min(4, Math.max(1, Math.floor(900 / (loaded.map.width * TILE))));
    zoomSelect.value = String(zoom);
    scroll.hidden = false;
    drawStage();
    renderActors();
    updateBanner();
  }
  zoomSelect.addEventListener("change", () => {
    zoom = Number(zoomSelect.value);
    drawStage();
  });
  modeButtons.forEach((b) => b.addEventListener("click", updateHint));
  updateHint();

  // The map lives in the preview pane on the right so it stays in view while the form scrolls
  let isOpen = false;
  const closeFromPane = () => {
    isOpen = false;
    if (picked) {
      // The map is gone, so the Move is no longer being chosen: only the highlight changes, the rows are not redrawn
      picked = null;
      onUnpick();
    }
  };
  function setOpen(open) {
    if (open === isOpen) return;
    if (open) {
      isOpen = true;
      showInPane("Map", panel, closeFromPane); // replaces whatever else was showing, including another map
      show();
    } else {
      clearPane(closeFromPane);
    }
  }
  const panel = el("div", { className: "map-panel" }, message, toolbar, hint, banner, scroll, actorList);
  return {
    // Clicking the Viewport or Actors field opens the map on the matching tool
    open(nextMode) {
      mode = nextMode;
      refreshModes();
      updateHint();
      setOpen(true);
    },
    // The Move commands' "Show on map" buttons
    pick: api_pick,
    picked: () => picked,
    drawPaths: () => {
      drawOverlay();
      updateBanner();
    },
    // The Viewport/Actors text changed (typed by hand)
    redraw() {
      drawOverlay();
      if (!drag) renderActors();
    },
    // The Place changed
    setLocation() {
      if (isOpen) show();
    },
  };
}

let eventCustomTrack = ""; // the id of the character's uploaded track, for the Play music command's dropdown
let eventAudio = null; // the music preview currently playing, if any

function createEventsEditor(section) {
  const { title, hint } = section.dataset;
  let events = [];
  let customTrack = ""; // the id of the character's uploaded track, if there is one
  let loaded = false;
  let disableDefaults = true; // true: only this character's events; false: blended with the game's own events

  const message = el("p", { className: "editor-message", hidden: true });
  const showMessage = (text) => {
    message.textContent = text;
    message.hidden = !text;
  };

  const defaultsToggle = el("input", { type: "checkbox", checked: true });
  defaultsToggle.addEventListener("change", () => (disableDefaults = defaultsToggle.checked));
  const defaultsRow = el("label", { className: "hint", title: "Needs the game's unpacked events (see the README). If they can't be found, the build warns and the game's events stay on." },
    defaultsToggle, " Replace the game's events: turn off this character's own Stardew Valley events so only the ones below play. Untick to blend them.");

  const list = el("div");
  const addId = el("input", { placeholder: "Event ID, e.g. 9999016", title: "Event ID" });
  const addLocation = choiceSelect(LOCATIONS, "Beach", "Place");
  const addButton = el("button", { type: "button", className: "secondary", textContent: "Add event" });
  const addRow = el("div", { className: "add-row" }, addId, addLocation, addButton);
  section.append(el("h2", { textContent: title }), el("p", { className: "hint", textContent: hint }), defaultsRow, message, list, addRow);

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

    const locationInput = choiceSelect(LOCATIONS, event.location, "Place");
    locationInput.addEventListener("change", () => {
      event.location = locationInput.value;
      refresh();
      mapEditor.setLocation();
      render();
    });

    // Viewport and actors: text fields, plus the map view that edits the same two values
    const viewportInput = text("viewport", { title: "Viewport" });
    const actorsInput = text("actors", { title: "Actors" });
    const mapEditor = createMapEditor(
      event,
      () => {
        viewportInput.value = event.viewport;
        actorsInput.value = event.actors;
      },
      () => refreshLists(),
      () => lists.forEach((l) => l.sync())
    );
    viewportInput.addEventListener("input", () => mapEditor.redraw());
    // The command lists (main and fork) share the map: their Move commands can be chosen on it
    let lists = [];
    const refreshLists = () => {
      lists = lists.filter((l) => l.box.isConnected);
      lists.forEach((l) => l.render());
    };
    const mapHooks = {
      register: (box, render, sync) => lists.push({ box, render, sync }),
      picked: () => mapEditor.picked(),
      pick: (info) => mapEditor.pick(info),
      changed: () => mapEditor.drawPaths(),
    };
    actorsInput.addEventListener("input", () => mapEditor.redraw());
    // Clicking (or tabbing into) the viewport or actors field shows the map in the preview pane
    for (const [input, mode] of [[viewportInput, "viewport"], [actorsInput, "actors"]]) {
      input.addEventListener("click", () => mapEditor.open(mode));
      input.addEventListener("focus", () => mapEditor.open(mode));
    }

    // Conditions: the text input stays here, the toggles open in the preview pane when it is clicked
    const conditions = createConditions(event);
    let conditionsOpen = false;
    const showConditions = () => {
      if (conditionsOpen) return;
      showInPane("Conditions", conditions.panel, () => (conditionsOpen = false));
      conditionsOpen = true;
    };
    conditions.input.addEventListener("click", showConditions);
    conditions.input.addEventListener("focus", showConditions);

    // Music: a dropdown of the known tracks, or "Other" to type one
    const musicBox = el("div", { className: "music-row" });
    const choices = [...(customTrack ? [[customTrack, `Your track: ${customTrack}`]] : []), ...MUSIC];
    const known = choices.some(([v]) => v === event.music);
    const musicSelect = choiceSelect([...choices, [OTHER_CHOICE, "Other (type a track name)..."]], known ? event.music : OTHER_CHOICE, "Starting music");
    // Only the character's own uploaded track can be previewed; the game's tracks are locked in its sound bank
    const playButton = el("button", { type: "button", className: "secondary", textContent: "Play" });
    const syncPlay = () => {
      const playable = !!customTrack && musicSelect.value === customTrack;
      playButton.disabled = !playable;
      playButton.title = playable ? "Preview your uploaded track" : "Only your own uploaded track can be previewed here";
    };
    playButton.addEventListener("click", () => {
      if (eventAudio && !eventAudio.paused) {
        eventAudio.pause();
        playButton.textContent = "Play";
        return;
      }
      eventAudio?.pause();
      eventAudio = new Audio(assetUrl("music"));
      eventAudio.addEventListener("ended", () => (playButton.textContent = "Play"));
      eventAudio.play().then(() => (playButton.textContent = "Stop")).catch(() => {});
    });
    const musicCustom = el("input", { value: known ? "" : event.music, placeholder: "Track name", title: "Track name", hidden: known });
    musicSelect.addEventListener("change", () => {
      const other = musicSelect.value === OTHER_CHOICE;
      event.music = other ? musicCustom.value : musicSelect.value;
      musicCustom.hidden = !other;
      eventAudio?.pause();
      playButton.textContent = "Play";
      syncPlay();
      if (other) musicCustom.focus();
    });
    musicCustom.addEventListener("input", () => (event.music = musicCustom.value));
    musicBox.append(musicSelect, playButton, musicCustom);
    syncPlay();

    const skippable = el("input", { type: "checkbox", checked: event.skippable });
    skippable.addEventListener("change", () => (event.skippable = skippable.checked));

    // The fork is added with a Fork command in the steps: that creates the fork's own steps here, to run when its answer is chosen
    const forkBox = el("div");
    const forkTitle = el("p", { className: "hint" });
    const setForkTitle = () => (forkTitle.textContent = `Runs when the answer takes the fork "${event.forkName}".`);
    const renderFork = () => {
      setForkTitle();
      forkBox.replaceChildren(...(event.forkName !== undefined
        ? [forkTitle, createCommandList(event.forkCommands, null, mapHooks)]
        : [el("p", { className: "empty", textContent: "No fork. Add a Fork command to the steps above and its own steps appear here." })]));
    };
    const forks = {
      eventId: () => event.id,
      has: () => event.forkName !== undefined,
      stepCount: () => (event.forkCommands || []).length,
      create(name) {
        event.forkName = name;
        event.forkCommands = event.forkCommands || [{ type: "end", args: "" }];
        renderFork();
      },
      setName(name) {
        event.forkName = name;
        setForkTitle();
      },
      remove() {
        delete event.forkName;
        delete event.forkCommands;
        renderFork();
      },
    };
    renderFork();

    const details = el(
      "details",
      { className: "entry event", open: !!event.open },
      summary,
      labelled("Event ID", text("id", { title: "Event ID" }), "A unique number. Part of the event's key in the game."),
      labelled("Place", locationInput, "The map the event happens in (Data/Events/<place>)."),
      el("div", { className: "field" }, el("span", { textContent: "Conditions" }), el("div", {}, conditions.input,
        el("small", { textContent: "All optional. Click to switch on hearts, time of day or weather in the preview panel, or type them separated by /." }))),
      el("h4", { textContent: "Setup" }),
      labelled("Starting music", musicBox, "The track playing as the event opens. Pick None for silence. Play previews your uploaded track (Assets tab); Stardew's own tracks can't be previewed here."),
      labelled("Viewport", viewportInput, "The map tile the camera starts on, as x y."),
      labelled("Actors", actorsInput, "Who is in the scene and where: name x y facing, repeated (e.g. farmer 15 16 0 {name} 11 10 0). Click the viewport or actors to show the map."),
      el("label", { className: "check indent" }, skippable, el("span", { textContent: "Skippable" })),
      el("h4", { textContent: "Commands" }),
      createCommandList(event.commands, forks, mapHooks),
      el("h4", { textContent: "Fork steps" }),
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

  // Events in the same place sit together (places in the order they first appear), as they are written to the game
  function groupByLocation() {
    const order = [...new Set(events.map((e) => e.location))];
    events = events
      .map((e, i) => [e, i])
      .sort((a, b) => order.indexOf(a[0].location) - order.indexOf(b[0].location) || a[1] - b[1])
      .map(([e]) => e);
  }

  function render() {
    closePane();
    groupByLocation();
    const nodes = [];
    let last;
    for (const event of events) {
      if (event.location !== last) {
        last = event.location;
        nodes.push(el("h3", { textContent: event.location || "(no place)" }));
      }
      nodes.push(card(event));
    }
    list.replaceChildren(...(nodes.length ? nodes : [el("p", { className: "empty", textContent: "None yet." })]));
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
        const result = await api(`/api/events?folder=${encodeURIComponent(folder)}`);
        events = result.events;
        disableDefaults = result.disableDefaultEvents;
        defaultsToggle.checked = disableDefaults;
        loaded = true;
      } catch (err) {
        events = [];
        loaded = false;
        showMessage(err.message);
      }
      try {
        const music = (await api(`/api/assets?folder=${encodeURIComponent(folder)}`)).music;
        customTrack = music.exists ? music.name.replace(/\.[^.]+$/, "") : "";
        eventCustomTrack = customTrack;
      } catch {
        customTrack = "";
        eventCustomTrack = "";
      }
      addRow.hidden = !loaded;
      defaultsRow.hidden = !loaded;
      render();
    },
    async save(folder) {
      if (!loaded) return;
      try {
        groupByLocation();
        // "open" is only for the page, so it isn't saved
        await postJson("/api/events", { folder, disableDefaultEvents: disableDefaults, events: events.map(({ open, ...event }) => event) });
        showMessage("");
      } catch (err) {
        showMessage(err.message);
        throw new Error(`${title}: ${err.message}`);
      }
    },
  };
}

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
  const addButton = el("button", { type: "button", className: "secondary", textContent: "Add letter" });
  const addRow = el("div", { className: "add-row" }, addId, addButton);
  section.append(el("h2", { textContent: title }), el("p", { className: "hint", textContent: hint }), message, list, addRow);

  const field = (label, control, note) => el("div", { className: "field" }, el("span", { textContent: label }), el("div", {}, control, ...(note ? [el("small", { textContent: note })] : [])));
  const bind = (letter, key, node, event = "input") => {
    node.addEventListener(event, () => (letter[key] = node.value));
    return node;
  };
  const number = (letter, key, min, max) => {
    const node = el("input", { type: "number", min, max, value: letter[key] });
    node.addEventListener("input", () => (letter[key] = Number(node.value) || 0));
    return node;
  };

  function showLetter(letter) {
    preview = letter;
    showInPane(`Letter: ${letter.id}`, letterPreview(letter, items), () => (preview = null));
  }

  function giftRows(letter) {
    const box = el("div");
    const draw = () => {
      box.replaceChildren(
        ...letter.items.map((entry) => {
          const count = el("input", { type: "number", min: 1, max: 999, value: entry.count, title: "How many" });
          count.addEventListener("input", () => (entry.count = Number(count.value) || 1));
          const remove = el("button", {
            type: "button",
            className: "secondary remove-x",
            textContent: "×",
            title: "Remove",
            onclick: () => {
              letter.items = letter.items.filter((e) => e !== entry);
              draw();
            },
          });
          const pick = itemButton(items, () => entry.item, (id) => {
            if (letter.items.some((e) => e !== entry && e.item === id)) {
              showMessage(`(O)${id} is already attached to ${letter.id}.`);
              return false; // keep showing the old item
            }
            showMessage("");
            entry.item = id;
          });
          return el("div", { className: "add-row" }, pick, count, remove);
        })
      );
      let next = "74";
      const choose = itemButton(items, () => next, (id) => void (next = id));
      const add = el("button", { type: "button", className: "secondary", textContent: "Attach item" });
      add.addEventListener("click", () => {
        if (letter.items.some((e) => e.item === next)) return showMessage(`(O)${next} is already attached to ${letter.id}.`);
        showMessage("");
        letter.items.push({ item: next, count: 1 });
        draw();
      });
      box.append(el("div", { className: "add-row" }, choose, add));
    };
    draw();
    return box;
  }

  function card(letter) {
    const subject = bind(letter, "subject", el("input", { value: letter.subject, placeholder: "The title in the mailbox" }));
    const text = bind(letter, "text", el("textarea", { value: letter.text, rows: 7, placeholder: "Dear @,", title: "Letter text" }));
    const trigger = bind(letter, "trigger", choiceSelect(MAIL_TRIGGERS, letter.trigger, "When to send"), "change");
    const delivery = bind(letter, "delivery", choiceSelect(MAIL_DELIVERY, letter.delivery, "Where it arrives"), "change");
    const condition = bind(letter, "condition", el("input", { value: letter.condition, placeholder: "e.g. PLAYER_HAS_MAIL Current SomeOtherLetter Received" }));
    const once = el("input", { type: "checkbox", checked: letter.once !== false });
    once.addEventListener("change", () => (letter.once = once.checked));

    const refresh = () => preview === letter && showLetter(letter);
    for (const node of [subject, text]) node.addEventListener("input", refresh);

    const view = el("button", { type: "button", className: "secondary", textContent: "Preview", onclick: () => (preview === letter ? closePane() : showLetter(letter)) });
    const remove = el("button", {
      type: "button",
      className: "secondary remove-x",
      textContent: "×",
      title: "Remove this letter",
      onclick: () => {
        if (preview === letter) closePane();
        mail = mail.filter((l) => l !== letter);
        render();
      },
    });
    const summary = el("summary", { textContent: `${letter.id}${letter.subject ? ` - ${letter.subject}` : ""}` });
    subject.addEventListener("input", () => (summary.textContent = `${letter.id}${letter.subject ? ` - ${letter.subject}` : ""}`));
    const details = el(
      "details",
      { className: "entry event", open: !!letter.open },
      summary,
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
      el("div", { className: "add-row" }, view, remove)
    );
    details.addEventListener("toggle", () => (letter.open = details.open));
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
  eventAudio?.pause();
  closePane(); // the pane belongs to the tab that filled it; this also stops any audio playing in it
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
