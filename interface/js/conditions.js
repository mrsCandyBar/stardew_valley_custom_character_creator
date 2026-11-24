// Events: conditions (friendship, time of day, weather).
// Loaded as a plain script (see index.html): it shares globals with the other files in this folder.

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
      return controlRow(input, removeX("Remove", () => {
        parsed.other.splice(i, 1);
        commit();
        render();
      }));
    });

    box.replaceChildren(
      section("Friendship", parsed.friendship !== null, (on) => toggle("friendship", on, 2000), friendshipBody, "Each heart is 250 friendship points."),
      section("Time of day", parsed.time !== null, (on) => toggle("time", on, [600, 1200]), timeBody, "Day (6am to 6pm) is the bright half of the clock, night the dark half. The green wedge is when the event can start."),
      section("Weather", parsed.weather !== null, (on) => toggle("weather", on, "sunny"), weatherBody, "Rainy covers rain and storms; sunny is every other kind of weather."),
      el("div", { className: "condition" }, el("span", { className: "other-title", textContent: "Other conditions" }), ...others, actionButton("Add condition", () => {
        parsed.other.push("");
        render();
      }))
    );
  }
  render();
  // The text input stays in the form; the toggles live in `panel`, which the event card shows in the preview pane
  return { input: summary, panel: el("div", { className: "preview-body" }, box) };
}
