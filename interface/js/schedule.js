// Schedule stops and the map used to place them.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// --- Schedule stops ---
// A schedule is a list of stops, one line each: "<time> <place> <x> <y> <facing>" with an optional animation/dialogue after it.
// Every stop is a row of four toggles (time, location, position, facing); a toggle opens that setting's editor.
// A line that isn't in that form (e.g. "GOTO Mon" or an "a1740" arrival time) is kept as a plain text line.
const STOP_PATTERN = /^(\d{3,4}) (\S+) (-?\d+) (-?\d+) ([0-3])(?: (.+))?$/;
const STOP_TIMES = []; // 6:00 am to 10:00 pm in 30-minute steps
for (let t = 600; t <= 2200; t += t % 100 === 30 ? 70 : 30) STOP_TIMES.push(t);
const ARROWS = ["↑", "→", "↓", "←"]; // up, right, down, left, the same order as FACING
const facingChoices = ARROWS.map((arrow, i) => [i, arrow, `Face ${["up", "right", "down", "left"][i]}`]); // for toggleButtons

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

  const times = STOP_TIMES.includes(stop.time) ? STOP_TIMES : [...STOP_TIMES, stop.time].sort((a, b) => a - b);
  const timeSelect = el("select", { title: "Time" }, ...times.map((t) => el("option", { value: String(t), textContent: clockLabel(t) })));
  timeSelect.value = String(stop.time);
  timeSelect.addEventListener("change", () => {
    stop.time = Number(timeSelect.value);
    onChange();
  });
  const placeSelect = choiceSelect(LOCATIONS, stop.place, "Map");
  placeSelect.addEventListener("change", () => {
    stop.place = placeSelect.value;
    onChange();
    view.show();
  });
  const pickers = el("div", { className: "stop-pickers" },
    el("label", {}, el("span", { textContent: "Time " }), timeSelect), el("label", {}, el("span", { textContent: "Map " }), placeSelect),
    el("label", {}, el("span", { textContent: "Zoom " }), zoomSelect));
  const { buttons: facingButtons, refresh: refreshFacing } = toggleButtons(facingChoices, (i) => stop.facing === i, (i) => {
    stop.facing = i;
    onChange();
    refreshFacing();
    drawOverlay();
  });
  const arrows = el("div", { className: "map-arrows", hidden: true }, ...facingButtons); // floats over the map's top right corner
  const frame = el("div", { className: "map-frame" }, scroll, arrows);

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

  const node = el("div", { className: "map-panel" }, pickers, message,
    el("small", { textContent: "Click or drag on the map to choose the tile. The arrow is the way they face. Numbered dots are the other stops on this map." }), frame);
  const view = {
    node,
    async show() {
      message.hidden = true;
      try {
        loaded = await loadMap(stop.place);
      } catch (err) {
        loaded = null;
        scroll.hidden = arrows.hidden = true;
        message.textContent = `${stop.place}: ${err.message}`;
        message.hidden = false;
        return;
      }
      if (!zoom) zoom = Math.min(4, Math.max(1, Math.floor(560 / (loaded.map.width * TILE))));
      zoomSelect.value = String(zoom);
      scroll.hidden = arrows.hidden = false;
      drawStage();
      scroll.scrollLeft = (stop.x + 0.5) * tileSize() - scroll.clientWidth / 2; // bring the stop into view
      scroll.scrollTop = (stop.y + 0.5) * tileSize() - scroll.clientHeight / 2;
    },
  };
  return view;
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
      previewTitle.textContent = `Stop ${i + 1}: ${clockLabel(stop.time)}, ${placeLabel(stop.place)}`;
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
    const remove = removeX("Remove this stop", () => {
      closeEditors();
      stops.splice(i, 1);
      sync();
      draw();
    });
    if (stop.raw !== undefined) {
      const input = el("input", { value: stop.raw, title: "A line the editor doesn't have controls for", placeholder: "e.g. GOTO Mon" });
      input.addEventListener("input", () => {
        stop.raw = input.value;
        sync();
      });
      return el("div", { className: "stop" }, el("div", { className: "stop-head" }, el("span", { className: "step", textContent: i + 1 }), input, remove));
    }

    // One read-only field showing the stop's line; clicking it opens the time, map and tile editor in the preview pane
    const field = el("input", { className: "stop-value", readOnly: true, title: "Click to edit this stop", value: composeStop(stop) });
    const refresh = () => {
      field.value = composeStop(stop);
      field.classList.toggle("selected", stopPaneOwner !== null && stop.open === "position");
    };
    summaries.set(stop, refresh);
    field.addEventListener("click", () => {
      if (stop.open === "position") return;
      closeEditors();
      stop.open = "position";
      openMap(stop, i);
      draw();
    });
    refresh();
    return el("div", { className: "stop" }, el("div", { className: "stop-head" }, el("span", { className: "step", textContent: i + 1 }), field, remove));
  }

  const addStop = actionButton("Add stop", () => {
    closeEditors();
    const last = stops.findLast((s) => s.raw === undefined);
    stops.push({ time: last ? Math.min(2600, last.time + 100) : 600, place: last?.place || "Town", x: last?.x ?? 0, y: last?.y ?? 0, facing: last?.facing ?? 2, extra: "" });
    sync();
    draw();
  });
  function draw() {
    summaries.clear();
    root.replaceChildren(...stops.map(stopRow), addStop);
  }
  draw();
  return root;
}
