// Events: the list of commands, with forks and Repeat blocks.
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

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
  return paneLine({
    text: () => state.question,
    emptyText: "Click to write the question",
    title: "Question",
    panes,
    build: (refresh) => {
      const text = el("textarea", { value: state.question, rows: 5, title: "Question", placeholder: "What the player is asked" });
      text.addEventListener("input", () => {
        state.question = text.value.replaceAll("#", ""); // a # would start a new answer
        onInput();
        refresh();
      });
      const pane = el("div", { className: "preview-body centered" },
        speechBox(text),
        el("p", { className: "hint", textContent: "The question the player sees. Edits here and in the form stay in step." }));
      return { pane, focus: text };
    },
  }).node;
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
  const addButton = actionButton("Add command");
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

  const toolsOpen = new WeakSet(); // the commands whose tools are showing

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
    const group = el("div", { className: "btn-group", hidden: !toolsOpen.has(unit.commands[0]) }, ...[
      actionButton("↑", () => move(-1), { className: "arrow", title: "Move up", disabled: index === 0 }),
      actionButton("↓", () => move(1), { className: "arrow", title: "Move down", disabled: index === units.length - 1 }),
      actionButton("+", () => insertCommand(commands.indexOf(unit.commands[unit.commands.length - 1]) + 1), { className: "arrow", title: "Add a command after this one (the type chosen under the list)" }),
      ...(unit.fork ? [] : [actionButton("⧉", () => {
        commands.splice(commands.indexOf(unit.commands[0]) + 1, 0, structuredClone(unit.commands[0]));
        render();
      }, { className: "arrow", title: "Duplicate this command (right below it)" })]),
      removeX(unit.fork ? "Remove the fork and its steps" : "Remove", () => {
        if (unit.fork && forks.stepCount() > 1 && !confirm(`Remove this fork and its ${forks.stepCount()} steps?`)) return;
        commands.splice(commands.indexOf(unit.commands[0]), unit.commands.length);
        if (unit.fork) forks.remove();
        render();
      }),
    ]);
    // The tools stay tucked away until asked for; the choice is kept when the list redraws
    const toggle = el("button", { type: "button", className: "tools-toggle", title: "Show or hide this command's tools (move, add, duplicate, remove)", "aria-expanded": String(!group.hidden) });
    const refreshToggle = () => {
      toggle.textContent = group.hidden ? "⋯" : "›";
      toggle.setAttribute("aria-expanded", String(!group.hidden));
    };
    toggle.addEventListener("click", () => {
      group.hidden = !group.hidden;
      if (group.hidden) toolsOpen.delete(unit.commands[0]);
      else toolsOpen.add(unit.commands[0]);
      refreshToggle();
    });
    refreshToggle();
    return [group, toggle];
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
      return el("div", { className: "answer-row" }, el("span", { className: "step", textContent: `${i + 1}.` }), input, removeX("Remove this answer", () => {
        state.answers.splice(i, 1);
        commit();
        render();
      }, { disabled: state.answers.length < 2 }));
    });
    const addAnswer = actionButton("Add answer", () => {
      state.answers.push("");
      commit();
      render();
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
    const toggle = actionButton(collapsed ? "▸" : "▾", () => {
      const hide = !inner.hidden;
      inner.hidden = hide;
      hide ? collapsedRepeats.add(command) : collapsedRepeats.delete(command);
      toggle.textContent = hide ? "▸" : "▾";
      toggle.title = hide ? "Show the group" : "Hide the group";
    }, { className: "arrow", title: collapsed ? "Show the group" : "Hide the group" });
    refreshSummary();

    // Frame generator: adds a "Show frame" + "Pause" pair for every frame from the first to the last (counting down if the last is smaller)
    const num = (value, title, small = true) => el("input", { type: "number", min: 0, value, title, className: small ? "small" : "" });
    const who = el("input", { value: "{name}", title: "Who", className: "narrow" });
    const [from, to, wait] = [num(0, "First frame"), num(7, "Last frame"), num(100, "Pause between frames (ms)")];
    const generate = el("div", { className: "frame-generator", hidden: !openGenerators.has(command) },
      el("span", { textContent: "Show frames" }), who, from, el("span", { textContent: "to" }), to, el("span", { textContent: "pausing" }), wait, el("span", { textContent: "ms" }),
      actionButton("Add to group", () => {
        const [a, b, ms] = [from, to, wait].map((input) => Math.max(0, Math.floor(Number(input.value)) || 0));
        const step = a <= b ? 1 : -1;
        for (let f = a; f !== b + step; f += step) command.commands.push({ type: "showFrame", args: `${who.value.trim() || "{name}"} ${f}` }, { type: "pause", args: String(ms) });
        openGenerators.add(command);
        render();
      }, { title: "Adds a Show frame and a Pause for each frame, at the end of the group" }));
    const generatorToggle = actionButton("Frames…", () => {
      generate.hidden = !generate.hidden;
      generate.hidden ? openGenerators.delete(command) : openGenerators.add(command);
    }, { title: "Fill the group with a run of frames" });
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
      controlRow(addType, addButton)
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
