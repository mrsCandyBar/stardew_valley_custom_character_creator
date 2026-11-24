// Events: the fields inside a command (speech, emote picker, music, text and number fields).
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// A line of speech: a clickable portrait face and the words, like the dialogue pages. The face is the "$n" the words start with.
// In the form it is one line of plain text, cut off with an ellipsis. Clicking it opens the portrait and a text box in the preview pane.
// `panes` collects this field's pane owner so the command list can close it when the list is redrawn.
function dialogueField(words, onInput, panes = []) {
  const m = /^(\$\d+)([\s\S]*)$/.exec(words);
  const state = { face: m ? m[1] : null, text: m ? m[2] : words }; // no "$n" at the start means the default (neutral) face
  const emit = () => onInput((state.face ?? "") + state.text);
  let refresh = () => {};
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
  const line = paneLine({
    text: () => (state.face ?? "") + state.text,
    emptyText: "Click to write what they say",
    title: "Speak",
    panes,
    build: () => {
      const text = el("textarea", { value: state.text, rows: 5, title: "Words", placeholder: "What they say" });
      text.addEventListener("input", () => {
        state.text = text.value;
        emit();
        refresh();
      });
      const pane = el("div", { className: "preview-body centered" },
        speechBox(text, faceButton(reaction, assetUrl("portrait"))),
        el("p", { className: "hint", textContent: "Click the portrait for the next face. Edits here and in the form stay in step." }));
      return { pane, focus: text };
    },
  });
  refresh = line.refresh;
  return line.node;
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
    emoteDialog = createDialog({ className: "emote-dialog", head: [el("strong", { textContent: "Choose an emote", style: "flex:1" })] }, grid);
    emoteDialog.grid = grid;
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
