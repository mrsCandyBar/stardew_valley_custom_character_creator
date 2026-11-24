// Events tab.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

let eventCustomTrack = ""; // the id of the character's uploaded track, for the Play music command's dropdown

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
  const addButton = actionButton("Add event");
  const addRow = controlRow(addId, addLocation, addButton);
  section.append(el("h2", { textContent: title }), el("p", { className: "hint", textContent: hint }), defaultsRow, message, list, addRow);

  const labelOf = (event) => `${event.id || "(no ID)"} in ${event.location || "(no place)"}`;

  function card(event) {
    let details;
    const refresh = () => (details.summary.textContent = labelOf(event));
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
    // Clicking the Place shows the map instead of the native list; the Place is swapped from the dropdown above the map
    locationInput.addEventListener("mousedown", (e) => {
      e.preventDefault();
      locationInput.focus();
      mapEditor.open(null);
    });
    locationInput.addEventListener("change", () => {
      // (keyboard changes)
      event.location = locationInput.value;
      refresh();
      mapEditor.setLocation();
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
      () => lists.forEach((l) => l.sync()),
      (place) => {
        locationInput.value = place;
        if (locationInput.value !== place) locationInput.append(el("option", { value: place, textContent: `${place} (custom)` }));
        locationInput.value = place;
        refresh();
      }
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
    for (const [input, mode] of [[viewportInput, "viewport"], [actorsInput, "actors"], [locationInput, null]]) {
      if (!mode) continue; // the Place is handled above
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
    const musicCustom = el("input", { value: known ? "" : event.music, placeholder: "Track name", title: "Track name", hidden: known });
    musicSelect.addEventListener("change", () => {
      const other = musicSelect.value === OTHER_CHOICE;
      event.music = other ? musicCustom.value : musicSelect.value;
      musicCustom.hidden = !other;
      if (other) musicCustom.focus();
    });
    musicCustom.addEventListener("input", () => (event.music = musicCustom.value));
    musicBox.append(musicSelect, musicCustom);

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

    details = collapsible(
      { className: "entry event", open: !!event.open, summary: labelOf(event), onToggle: (open) => (event.open = open) },
      el("div", { className: "setup-wrap" },
        collapsible({ className: "setup-card", open: true, summary: "Setup Scene" },
          el("div", { className: "event-row id-row" },
            labelled("Event ID", text("id", { title: "Event ID" }), "A unique number."),
            labelled("Conditions", conditions.input, "Optional. Click to set them in the preview panel."),
            labelled("Starting music", musicBox, "The track playing as the event opens.")),
          el("div", { className: "event-row place-row" },
            labelled("Place", locationInput, "The map the event happens in."),
            labelled("Viewport", viewportInput, "Camera start tile, x y."),
            labelled("Actors", actorsInput, "name x y facing, repeated."))),
        el("label", { className: "check skippable" }, skippable, el("span", { textContent: "Skippable" }))),
      el("h4", { textContent: "Commands" }),
      createCommandList(event.commands, forks, mapHooks),
      el("h4", { textContent: "Fork steps" }),
      forkBox,
      actionButton("Remove event", () => {
        events = events.filter((e) => e !== event);
        render();
      })
    );
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
