// Assets tab: portrait, sprite and music uploads and their previews.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

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
    ...WALK_CYCLES.map(([label, first]) => actionButton(label, () => play([first, first + 1, first + 2, first + 3], label))),
    actionButton("Stand", () => play([0], "Standing")),
  ];
  const actionButtons = ACTION_ANIMATIONS.map(([label, first, last, span = 1]) => {
    const list = range(first, last).filter((n) => (n - first) % span === 0).map((n) => ({ n, span }));
    return actionButton(label, () => play(list, `${label} (slow)`, SLOW_MS));
  });

  // Anything else in the sheet (sitting, kissing, fishing or other custom frames): type the frame numbers, in order
  const custom = el("input", { placeholder: "Frames, e.g. 16,17,18", title: "Frame numbers to play in order" });
  const playCustom = () => play(custom.value.split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isInteger), "Custom");
  custom.addEventListener("keydown", (event) => event.key === "Enter" && (event.preventDefault(), playCustom()));
  const customRow = controlRow(custom, actionButton("Play frames", playCustom));

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
