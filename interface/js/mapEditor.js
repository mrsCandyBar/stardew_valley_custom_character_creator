// Events: the map for the viewport, actors and Move destinations.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

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
function createMapEditor(event, onChange, onPick, onUnpick, onPlace) {
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
  // Floating over the map while the Actors tool is on: the actors' keys (top left) and the way the chosen one faces (top right)
  let selectedActor = 0; // index into the Actors field
  const actorList = el("div", { className: "map-keys", hidden: true });
  const facingButtons = toggleButtons(facingChoices, () => false, (i) => {
      if (picked) {
        // Choosing a Move's destination: the arrows set the way the actor faces when the move ends
        picked.command.args = picked.command.args.replace(/^(\S+ -?\d+ -?\d+) [0-3]/, `$1 ${i}`);
        picked.rerender();
        refreshFacing();
        return;
      }
      const actors = parseActors(event.actors);
      if (!actors || !actors[selectedActor]) return;
      actors[selectedActor].facing = i;
      event.actors = composeActors(actors);
      onChange();
      drawOverlay();
      refreshFacing();
  }).buttons;
  const refreshFacing = () => {
    const actor = (parseActors(event.actors) || [])[selectedActor];
    // While a Move is being chosen the arrows show (and set) how the actor ends up facing, not how they start
    const m = picked && /^\S+ -?\d+ -?\d+ ([0-3])/.exec(picked.command.args);
    const facing = m ? Number(m[1]) : actor && actor.facing;
    facingButtons.forEach((b, i) => {
      b.classList.toggle("selected", (m || !!actor) && facing === i);
      b.disabled = !m && !actor;
    });
  };
  const arrows = el("div", { className: "map-arrows", hidden: true }, ...facingButtons);
  const zoomSelect = fieldSelect({ title: "Zoom", options: options([1, 2, 3, 4], (z) => `${z}x`) }, "2");
  const modes = toggleButtons([["viewport", "Viewport"], ["actors", "Actors"]], (value) => value === mode, (value) => {
    mode = value;
    refreshModes();
  });
  const modeButtons = modes.buttons;
  const hint = el("small", { textContent: "" });
  const pathsLabel = el("label", { className: "check-inline" }, showAllPaths, el("span", { textContent: " Show all move paths" }));
  // Viewport and Actors are a toggle: the actor list and move paths only show while editing actors
  const refreshModes = () => {
    modes.refresh();
    hint.textContent = mode === "viewport" ? "Click or drag on the map to place the camera. The bright box is what the player sees (about 20 x 11 tiles)." : "Drag an actor to move them. Click an actor to turn them (the arrow is the way they face).";
    pathsLabel.hidden = mode !== "actors";
    syncFloaters();
    drawOverlay();
  };
  const syncFloaters = () => {
    actorList.hidden = arrows.hidden = mode !== "actors" || scroll.hidden;
  };

  // The Place: only editable once the Place in the event card has been clicked. The close icon goes back to the Place chosen when it was opened.
  let placeAtOpen = event.location;
  const placeSelect = choiceSelect(LOCATIONS, event.location, "Place");
  const placeReset = actionButton("↩", undefined, { className: "place-reset", title: "Go back to the last Place selected", "aria-label": "Go back to the last Place selected" });
  function setPlaceEditable(editable) {
    if (editable) placeAtOpen = event.location;
    placeSelect.disabled = !editable;
    placeReset.disabled = !editable;
  }
  function changePlace(value) {
    if (!value || value === event.location) return;
    event.location = value;
    if (![...placeSelect.options].some((o) => o.value === value)) placeSelect.append(el("option", { value, textContent: `${value} (custom)` }));
    placeSelect.value = value;
    onPlace(value);
    show();
  }
  placeSelect.addEventListener("change", () => changePlace(placeSelect.value));
  placeReset.addEventListener("click", () => changePlace(placeAtOpen));
  setPlaceEditable(false);

  const toolbar = el("div", { className: "map-toolbar" }, el("div", { className: "place-pick" }, placeSelect, placeReset), el("div", { className: "mode-toggle" }, ...modeButtons), el("span", { className: "grow" }),
    pathsLabel, el("span", { className: "grow" }), el("label", {}, el("span", { textContent: "Zoom " }), zoomSelect));
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
      if (!step.to || !((showAllPaths.checked && mode === "actors") || isPicked)) continue;
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
    const endFacing = pickedStep && /^\S+ -?\d+ -?\d+ ([0-3])/.exec(picked.command.args);
    (pickedStep ? pickedStep.before : parseActors(event.actors) || []).forEach((actor, i) => {
      // the actor being moved shows the way they will face when the move ends
      if (endFacing && i === selectedActor) actor = { ...actor, facing: Number(endFacing[1]) };
      const color = ACTOR_COLORS[i % ACTOR_COLORS.length];
      const x = actor.x * ts;
      const y = actor.y * ts;
      ctx.fillStyle = color + "aa";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, ts, ts);
      ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      if (mode === "actors" && i === selectedActor) {
        // the chosen actor: a bright double outline
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 2, y - 2, ts + 4, ts + 4);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4, y - 4, ts + 8, ts + 8);
        ctx.strokeStyle = color;
      }
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

  // --- the actor keys floating over the map ---
  function renderActors() {
    const actors = parseActors(event.actors);
    if (!actors) {
      actorList.replaceChildren(el("p", { className: "hint", textContent: "The Actors text isn't in the form name x y facing, so it can't be shown on the map. Fix it in the form to see the actors." }));
      refreshFacing();
      return;
    }
    selectedActor = Math.max(0, Math.min(selectedActor, actors.length - 1));
    const save = () => {
      event.actors = composeActors(actors);
      onChange();
      drawOverlay();
    };
    const rows = actors.map((actor, i) => {
      const label = actor.name === "{name}" ? "NPC" : actor.name;
      const locked = !!picked; // choosing a Move's destination: the other actors, and removing or adding, stay out of the way
      const key = el("button", {
        type: "button", disabled: locked && i !== selectedActor, className: `actor-key${i === selectedActor ? " selected" : ""}`, title: `${actor.name}: click to choose, double-click to rename`,
        onclick: () => { selectedActor = i; renderActors(); drawOverlay(); },
        ondblclick: () => {
          const name = window.prompt("Actor name", actor.name);
          if (name && name.trim()) {
            actor.name = name.trim().replace(/\s+/g, "");
            save();
            renderActors();
          }
        },
      }, el("span", { className: "swatch", style: `background:${ACTOR_COLORS[i % ACTOR_COLORS.length]}` }), el("span", { textContent: label }));
      const remove = actionButton("×", () => {
        actors.splice(i, 1);
        if (selectedActor > i) selectedActor--;
        save();
        renderActors();
      }, { className: "remove-x", disabled: locked, title: `Remove ${actor.name}` });
      return el("div", { className: "actor-key-row" }, key, remove);
    });
    actorList.replaceChildren(...rows, actionButton("Add actor", () => {
      const view = parseViewport(event.viewport) || { x: 5, y: 5 };
      const name = !actors.some((a) => a.name === "farmer") ? "farmer" : !actors.some((a) => a.name === "{name}") ? "{name}" : `actor${actors.length + 1}`;
      actors.push({ name, x: view.x, y: view.y, facing: 2 });
      selectedActor = actors.length - 1;
      save();
      renderActors();
    }, { className: "add-actor", disabled: !!picked }));
    refreshFacing();
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
      selectedActor = index; // the arrows then turn this one
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
      actionButton("Done", () => api_pick(null))
    );
  }
  function chooseDestination(tile) {
    const step = replaySteps().find((st) => st.command === picked.command);
    const m = /^(\S+) (-?\d+) (-?\d+) ([0-3])/.exec(picked.command.args);
    if (!step || !step.from || !m) return;
    let [dx, dy] = [tile.x - step.from.x, tile.y - step.from.y];
    // A move only goes in a straight line from where the actor starts. A click off the line snaps to whichever line is nearer:
    // the click is |dy| tiles from the actor's row and |dx| tiles from their column.
    if (dx && dy) {
      if (Math.abs(dy) <= Math.abs(dx)) dy = 0;
      else dx = 0;
    }
    // They end up facing the way they walked (the arrows can still change that afterwards)
    const facing = dx ? (dx > 0 ? 1 : 3) : dy ? (dy > 0 ? 2 : 0) : m[4];
    picked.command.args = `${m[1]} ${dx} ${dy} ${facing}`;
    picked.rerender();
    refreshFacing();
    updateBanner();
    drawOverlay();
  }
  function api_pick(info) {
    picked = info && picked && picked.command === info.command ? null : info; // choosing the same one again turns it off
    if (picked) {
      mode = "actors"; // opened from a Move: the Actors tool is the one wanted afterwards
      // the actor being moved is the selected one
      const who = /^(\S+)/.exec(picked.command.args);
      const index = who ? (parseActors(event.actors) || []).findIndex((a) => a.name === who[1]) : -1;
      if (index >= 0) selectedActor = index;
      refreshModes();
      setOpen(true);
    }
    renderActors(); // while a Move is chosen, only its actor can be selected
    refreshFacing();
    updateBanner();
    drawOverlay();
    onPick();
  }

  // --- loading ---
  async function show() {
    message.hidden = true;
    scroll.hidden = true;
    syncFloaters();
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
    syncFloaters();
    drawStage();
    renderActors();
    updateBanner();
  }
  zoomSelect.addEventListener("change", () => {
    zoom = Number(zoomSelect.value);
    drawStage();
  });
  refreshModes();

  // The map lives in the preview pane on the right so it stays in view while the form scrolls
  let isOpen = false;
  const closeFromPane = () => {
    isOpen = false;
    if (picked) {
      // The map is gone, so the Move is no longer being chosen: only the highlight changes, the rows are not redrawn
      picked = null;
      renderActors();
      refreshFacing();
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
  const frame = el("div", { className: "map-frame" }, scroll, actorList, arrows);
  const panel = el("div", { className: "map-panel" }, message, toolbar, hint, banner, frame);
  return {
    // Clicking the Viewport or Actors field opens the map on the matching tool
    // Passing no tool means the Place was clicked: the Place dropdown here can then be used to swap the map
    open(nextMode) {
      if (nextMode) mode = nextMode;
      setPlaceEditable(!nextMode);
      refreshModes();
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
