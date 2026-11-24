// Keyed list editors (dialogue, marriage dialogue, festival dialogue and schedule share this).
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

// --- Keyed list editors (dialogue, marriage dialogue and schedule share this) ---
// Each list is entries of { key, lines }. A "group" describes one kind of key that is built from
// one or more dropdowns (e.g. day + heart count), so every part of it is optional to add.
// Keys that match no group go in the "other" list, where the key is typed in.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SEASONS = ["spring", "summer", "fall", "winter"];
const MAX_HEARTS = 10;
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
  rowsInCard: true, // one collapsible card per festival, with a row per "when" inside
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
    otherGroup: (key) => key.split("_")[0] || key, // fun_12 and fun_3 share a "fun" card
    otherPlaceholder: "e.g. Introduction, one, FlowerDance_Decline",
    suggestions: DIALOGUE_KEYS,
  },
  marriage: {
    groups: [], // only the keys below, no day + heart count cards
    otherTitle: "Marriage dialogue",
    // The first word: up to the first "_", and a camelCase key is cut at its first capital (Bad_0 -> Bad, funLeave_{name} -> fun)
    otherGroup: (key) => {
      const first = key.split("_")[0];
      return /^[a-z]/.test(first) ? first.match(/^[a-z]+/)[0] : first || key;
    },
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
        typedKey: true,
        keyTitle: "Day, e.g. Mon",
        badKey: (key) => `"${key}" isn't a day. Use ${DAYS.join(", ")}.`,
        empty: "None yet. Optional.",
        addLabel: "Add day",
        fields: [{ title: "Day", options: options(DAYS) }],
        parse: (key) => (DAYS.includes(key) ? [key] : null),
        compose: ([day]) => day,
      },
      {
        title: "Season",
        typedKey: true,
        keyTitle: "Season, e.g. spring",
        badKey: (key) => `"${key}" isn't a season. Use ${SEASONS.join(", ")}.`,
        empty: "None yet. Optional.",
        addLabel: "Add season",
        fields: [{ title: "Season", options: SEASON_OPTIONS }],
        parse: (key) => (SEASONS.includes(key) ? [key] : null),
        compose: ([season]) => season,
      },
      {
        title: "Day of a season",
        typedKey: true,
        keyTitle: "Season and day, e.g. spring:3",
        badKey: (key) => `"${key}" isn't a day of a season. Use season:day, e.g. spring:3 (day 1 to ${MAX_SEASON_DAY}).`,
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

const fieldSelect = (field, value) => dropdown(field.options, value, { title: field.title });

function createEditor(section) {
  const { type, title, hint } = section.dataset;
  const { groups, otherTitle, otherPlaceholder, suggestions, noOther, otherGroup } = EDITORS[type];
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
  const pairPickers = {}; // group index -> the festival + when dropdowns, kept to the pairs without dialogue yet
  const simplePickers = {}; // group index -> the dropdown and row of a one-dropdown group (schedule day, season)
  const dayPickers = {}; // group index -> the "Add day" dropdown and button, kept to the days without a card yet

  // One block per group: heading, cards, and a row of dropdowns to add another
  groups.forEach((group, index) => {
    const list = el("div");
    // A day-card group only picks the day here; heart counts are added inside each day's card
    const selects = (group.dayCard ? group.fields.slice(0, 1) : group.fields).map((field) => fieldSelect(field, field.options[0].value));
    const button = actionButton(group.addLabel);
    button.addEventListener("click", () => {
      const key = group.compose(group.dayCard ? [selects[0].value, ""] : selects.map((s) => s.value));
      if (hasKey(key)) return showMessage(`${key} already exists.`);
      add({ key, text: "", group: index });
    });
    const row = controlRow(...selects, button);
    if (group.dayCard) dayPickers[index] = { select: selects[0], row };
    else if (group.fields.length === 1) simplePickers[index] = { select: selects[0], row }; // kept to the choices not used yet
    if (group.rowsInCard) {
      // Only offer festival + when pairs that have no dialogue yet
      const refreshWhen = () => {
        const festival = selects[0].value;
        setChoices(selects[1], group.fields[1].options.filter((o) => !hasKey(group.compose([festival, o.value]))));
      };
      selects[0].addEventListener("change", refreshWhen);
      pairPickers[index] = { selects, row, refreshWhen };
    }
    lists.push(list);
    addRows.push(row);
    section.append(el("div", { className: "entry-group part-day" }, el("h3", { textContent: group.title }), list, row));
  });

  const otherList = el("div");
  // A dropdown of known keys that aren't used yet, plus "Custom key" which shows a text box for anything else
  const CUSTOM = "\u0000custom";
  const addSelect = el("select", { title: "Key" });
  const addKey = el("input", { placeholder: otherPlaceholder, title: "Custom key", hidden: true });
  const addOtherButton = actionButton("Add");
  const otherRow = controlRow(addSelect, addKey, addOtherButton);
  addRows.push(otherRow);
  if (!noOther) section.append(el("div", { className: "entry-group part-other" }, el("h3", { textContent: otherTitle }), otherList, otherRow));

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

  function card(entry, inGroup = false) {
    const head = el("div", { className: "entry-head" });
    const dayRow = entry.group !== OTHER && (groups[entry.group].dayCard || groups[entry.group].rowsInCard); // a row inside a collapsible card, titled by the card
    if (entry.group !== OTHER && (groups[entry.group].rowsInCard || groups[entry.group].typedKey)) {
      // A row whose whole key is typed (e.g. spring24:spouse_y2, or Mon on a schedule), and must be one the game has
      const group = groups[entry.group];
      const key = el("input", { value: entry.key, title: group.keyTitle || "Key, e.g. spring24:spouse_y2" });
      key.addEventListener("change", () => {
        const next = key.value.trim();
        if (!group.parse(next)) {
          showMessage(group.badKey ? group.badKey(next) : `"${next}" isn't a festival key. Use a festival id, optionally followed by :y2, :spouse or :spouse_y2.`);
          key.value = entry.key;
        } else if (hasKey(next, entry)) {
          showMessage(`${next} already exists.`);
          key.value = entry.key;
        } else {
          showMessage("");
          entry.key = next;
          if (group.rowsInCard) openGroups.add(`${entry.group}:${group.parse(next)[0]}`); // it may have moved to another festival's card
          render();
        }
      });
      head.append(key);
    } else if (entry.group !== OTHER) {
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
    const toggle = actionButton(entry.expanded ? "Minimize" : "Expand", () => {
      entry.expanded = !entry.expanded;
      toggle.textContent = entry.expanded ? "Minimize" : "Expand";
      drawBody();
    });
    // Dialogue and marriage dialogue: a one-line input beside the key (click it to edit in the preview pane) and an x.
    // Schedule keeps its Expand button and text box.
    const compact = type !== "schedule";
    // Plain text that looks part of the card: one line, cut off with an ellipsis, click to edit in the pane
    const { node: inline, refresh: refreshInline } = lineButton({
      text: () => entry.text,
      emptyText: "Click to write what they say",
      onClick: () => {
        if (entry.expanded) return;
        entry.expanded = true;
        drawBody();
      },
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
        const removeLine = actionButton("×", () => {
          lines.splice(lines.indexOf(line), 1);
          sync();
          drawLines(pane);
        }, { title: "Remove this line", hidden: lines.length < 2 });
        return el("div", { className: "dialogue-line" }, row, removeLine);
      });
      const addLine = actionButton("Add line", () => {
        lines.push({ face: "$0", explicit: false, text: "" });
        sync();
        drawLines(pane);
      });
      pane.replaceChildren(...rows, addLine);
    }
    if (isSchedule) {
      // Each schedule is a collapsible: the key and remove button in the summary, the stops inside
      const details = collapsible({ className: "entry schedule-card", open: Boolean(entry.cardOpen), summary: head, onToggle: (open) => (entry.cardOpen = open) }, body);
      details.summary.addEventListener("keydown", (e) => e.target !== details.summary && e.stopPropagation()); // typing a space in the key must not toggle the card
      drawBody();
      return details;
    }
    const card = el("div", { className: dayRow || inGroup ? "entry-row" : "entry" }, head, body);
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
      if (group.rowsInCard) {
        const picker = pairPickers[index];
        const freeFestivals = group.fields[0].options.filter((f) => group.fields[1].options.some((o) => !hasKey(group.compose([f.value, o.value]))));
        setChoices(picker.selects[0], freeFestivals);
        picker.refreshWhen();
        picker.row.hidden = !loaded || !freeFestivals.length; // everything has dialogue: hide the picker
        const present = group.fields[0].options.filter((o) => mine.some((e) => group.parse(e.key)[0] === o.value));
        const cards = present.map((o) => {
          const rows = mine.filter((e) => group.parse(e.key)[0] === o.value);
          return groupCard(`${index}:${o.value}`, o.label, rows.map((e) => card(e)), rows.length, group.fields[1].options.length);
        });
        return lists[index].replaceChildren(...(cards.length ? cards : [none(group.empty)]));
      }
      if (simplePickers[index]) {
        const free = group.fields[0].options.filter((o) => !hasKey(group.compose([o.value])));
        setChoices(simplePickers[index].select, free);
        simplePickers[index].row.hidden = !loaded || !free.length; // all chosen: hide the picker
      }
      if (!group.dayCard) return lists[index].replaceChildren(...(mine.length ? mine.map((e) => card(e)) : [none(group.empty)]));
      const days = DAYS.filter((day) => mine.some((e) => group.parse(e.key)[0] === day));
      const freeDays = group.fields[0].options.filter((o) => !days.includes(o.value));
      setChoices(dayPickers[index].select, freeDays);
      dayPickers[index].row.hidden = !loaded || !freeDays.length; // nothing left to add: hide the picker
      lists[index].replaceChildren(...(days.length ? days.map((day) => dayCard(group, index, day, mine.filter((e) => group.parse(e.key)[0] === day))) : [none(group.empty)]));
    });
    // Alphabetical by key, numbers in natural order (fun_2 before fun_12)
    const others = entries
      .filter((e) => e.group === OTHER)
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true, sensitivity: "base" }));
    otherList.replaceChildren(...(others.length ? (otherGroup ? groupedOthers(others) : others.map((e) => card(e))) : [none("None yet.")]));
    refreshSuggestions();
  }

  // Which collapsible cards are open, kept across redraws
  const openGroups = new Set();
  // A collapsible card: a title, "(n out of m dialogues added)" while it is closed, then its rows
  function groupCard(id, title, rows, added, possible, footer) {
    return collapsible(
      {
        className: "entry group-card",
        open: openGroups.has(id),
        summary: [el("span", { className: "group-title", textContent: title }), el("span", { className: "group-count", textContent: `(${added} out of ${possible} dialogues added)` })],
        onToggle: (open) => (open ? openGroups.add(id) : openGroups.delete(id)),
      },
      ...rows,
      ...(footer ? [footer] : [])
    );
  }

  // The group an "other" entry belongs to
  const otherGroupId = (key) => `other:${otherGroup(key)}`;
  const knownKeys = suggestions.flatMap((set) => set.keys);

  // Other dialogue: one card per key prefix. A key that is alone and has no siblings stays a plain row.
  function groupedOthers(others) {
    const byName = new Map();
    for (const e of others) {
      const name = otherGroup(e.key);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(e);
    }
    return [...byName].map(([name, rows]) => {
      const possible = new Set([...knownKeys.filter((k) => otherGroup(k) === name), ...rows.map((e) => e.key)]).size;
      if (rows.length === 1 && possible === 1) return card(rows[0]);
      return groupCard(otherGroupId(rows[0].key), name, rows.map((e) => card(e, true)), rows.length, possible);
    });
  }

  // One card per day: its heart-count dialogue rows, and a picker to add another heart count
  function dayCard(group, index, day, rows) {
    const free = group.fields[1].options.filter((o) => !hasKey(group.compose([day, o.value])));
    const select = el("select", { title: group.fields[1].title });
    setChoices(select, free);
    const button = actionButton("Add heart count");
    const addRow = Object.assign(controlRow(select, button), { hidden: !free.length }); // nothing left to add: hide it
    button.addEventListener("click", () => {
      const key = group.compose([day, select.value]);
      if (hasKey(key)) return showMessage(`${key} already exists.`);
      add({ key, text: "", group: index });
    });
    return groupCard(`${index}:${day}`, day, rows.map((e) => card(e)), rows.length, group.fields[1].options.length, addRow);
  }

  // Open the card a new entry lands in, so it can be seen
  function openFor(entry) {
    if (entry.group === OTHER) return otherGroup && openGroups.add(otherGroupId(entry.key));
    const group = groups[entry.group];
    if (group.dayCard || group.rowsInCard) openGroups.add(`${entry.group}:${group.parse(entry.key)[0]}`);
  }

  function add(entry) {
    entries.push(entry);
    entry.expanded = false;
    entry.cardOpen = true; // a new schedule card opens so it can be seen
    openFor(entry);
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
