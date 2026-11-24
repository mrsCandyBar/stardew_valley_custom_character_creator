// Reusable UI building blocks shared by every editor in app.js. Plain script (no modules): loaded before app.js.
// Each helper returns a DOM node (or a small object holding one) and owns one behaviour that used to be copied around.

// --- Elements ---

// Make an element, assign `props` straight onto it and append the children
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// --- Buttons ---

// A text button. Secondary (outlined) by default; pass { className: "..." } to add classes, or `primary: true` for the plain look.
function actionButton(label, onclick, { primary = false, className = "", ...props } = {}) {
  const classes = [primary ? "" : "secondary", className].filter(Boolean).join(" ");
  return el("button", { type: "button", textContent: label, onclick, ...(classes && { className: classes }), ...props });
}

// The small "×" that removes a row, card or chip. `title` is the tooltip, e.g. "Remove this stop".
const removeX = (title, onclick, props = {}) => actionButton("×", onclick, { className: "remove-x", title, ...props });

// A small square button holding one symbol (↑ ↓ + ⧉ ▸ ...)
const arrowButton = (symbol, title, onclick, props = {}) => actionButton(symbol, onclick, { className: "arrow", title, ...props });

// The row that sits under a list: dropdowns / inputs followed by the button that adds another
const controlRow = (...children) => el("div", { className: "add-row" }, ...children);

// A row of buttons of which one (or none) is highlighted. `choices` is [[value, label, title?]...]; `isSelected(value)` says which.
// Returns { buttons, refresh } - call refresh() after the state changes to move the highlight.
function toggleButtons(choices, isSelected, onPick, { className = "mode" } = {}) {
  const buttons = choices.map(([value, label, title]) => actionButton(label, () => onPick(value), { className, title }));
  const refresh = () => buttons.forEach((b, i) => b.classList.toggle("selected", Boolean(isSelected(choices[i][0]))));
  refresh();
  return { buttons, refresh };
}

// --- Form controls ---

// Choices may be { value, label } objects or [value, label] pairs
const choiceValue = (c) => (Array.isArray(c) ? c[0] : c.value);
const choiceLabel = (c) => (Array.isArray(c) ? c[1] : c.label);
const optionNodes = (choices) => choices.map((c) => el("option", { value: String(choiceValue(c)), textContent: choiceLabel(c) }));

// A dropdown. A value that isn't in the list (e.g. typed by hand earlier) is kept as its own choice when `keepUnknown` is set.
function dropdown(choices, value, { keepUnknown = false, ...props } = {}) {
  const known = choices.some((c) => String(choiceValue(c)) === String(value)) || value === "" || value === undefined;
  const list = keepUnknown && !known ? [...choices, [value, `${value} (custom)`]] : choices;
  const select = el("select", props, ...optionNodes(list));
  if (value !== undefined) select.value = String(value);
  return select;
}

// Replace a dropdown's choices, keeping the current pick when it is still there
function setChoices(select, choices) {
  const current = select.value;
  select.replaceChildren(...optionNodes(choices));
  if (choices.some((c) => String(choiceValue(c)) === current)) select.value = current;
}

// Copy a control's value into `target[key]` whenever it changes. `parse` turns the text into what is stored (e.g. Number).
// Returns the control so it can be used inline.
function bindValue(node, target, key, { event = node.tagName === "SELECT" ? "change" : "input", parse = (v) => v } = {}) {
  node.addEventListener(event, () => (target[key] = parse(node.value)));
  return node;
}

// A checkbox bound to a boolean
function checkbox(checked, onChange, props = {}) {
  const box = el("input", { type: "checkbox", checked, ...props });
  box.addEventListener("change", () => onChange(box.checked));
  return box;
}

// A text area bound to `target[key]`
const textArea = (target, key, props = {}) => bindValue(el("textarea", { value: target[key], ...props }), target, key);

// --- Collapsible cards ---

// A <details> card. `summary` is a string or a list of nodes. `onToggle(open)` is called when it opens or closes.
function collapsible({ className = "entry", open = false, summary, onToggle }, ...body) {
  const details = el("details", { className, open });
  if (onToggle) details.addEventListener("toggle", () => onToggle(details.open));
  const head = el("summary", {}, ...(Array.isArray(summary) ? summary : [summary]));
  details.append(head, ...body);
  details.summary = head;
  return details;
}

// --- Dialogs ---

// A modal dialog with a heading row (anything in `head`, then a close button) and a scrolling body.
// Clicking the backdrop closes it. Returns the dialog, already added to the page; `dialog.body` is the scrolling area.
function createDialog({ className = "", head = [], closeLabel = "Close" }, ...body) {
  const scroll = el("div", { className: "item-scroll" }, ...body);
  const closeButton = actionButton(closeLabel, () => dialog.close());
  const dialog = el("dialog", { className: `item-dialog ${className}`.trim() }, el("div", { className: "item-dialog-head" }, ...head, closeButton), scroll);
  dialog.body = scroll;
  dialog.addEventListener("click", (event) => event.target === dialog && dialog.close()); // click on the backdrop
  document.body.append(dialog);
  return dialog;
}

// --- Pane-edited text ---

// A one-line, ellipsized summary of some text that opens a fuller editor in the preview pane when clicked
// (used for what a character says, the question of a fork, and a dialogue entry's text).
// `text()` is the current text, `emptyText` shows while it is empty. `open()` is called on click and should show the pane.
// Returns { node, refresh }.
function lineButton({ text, emptyText, onClick }) {
  const node = el("button", { type: "button", className: "line-text" });
  const refresh = () => {
    const value = text().split("\n").join("  ↵  ");
    node.textContent = value || emptyText;
    node.classList.toggle("empty-line", !value);
    node.title = value;
  };
  node.addEventListener("click", onClick);
  refresh();
  return { node, refresh };
}

// A lineButton whose editor lives in the preview pane. `build()` returns { pane, focus } for the opened editor.
// While it is open the card the button sits in is marked as "viewing". `panes` collects the close handler so a list can close
// every pane it owns when it redraws.
function paneLine({ text, emptyText, title, build, panes = [] }) {
  let card = null;
  let open = false;
  const closed = () => {
    open = false;
    card?.classList.remove("viewing");
  };
  panes.push(closed);
  const line = lineButton({
    text,
    emptyText,
    onClick: () => {
      if (open) return;
      const { pane, focus } = build(line.refresh);
      showInPane(title, pane, closed);
      open = true;
      card = line.node.closest(".entry");
      card?.classList.add("viewing");
      focus?.focus();
    },
  });
  return line;
}

// The game-style speech box shown in the preview pane: a text area (and optionally a portrait next to it)
const speechBox = (text, face) => el("div", { className: "dialogue-box" }, text, ...(face ? [face] : []));
