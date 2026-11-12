// Tiny local helper for the interface. No dependencies.
// Start it with `node server.js`, then open http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const INTERFACE_DIR = path.join(ROOT, "interface");
const CHARACTERS_DIR = path.join(ROOT, "characters");
const TEMPLATE_DIR = path.join(ROOT, "templates", "character");

// Only these fields are read from / written to modDetails.json
const MOD_FIELDS = [
  "SDV_Name",
  "folderLocation",
  "newCharacterName",
  "Name",
  "Author",
  "Version",
  "Description",
  "UniqueID",
  "MinimumApiVersion",
];

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function listCharacters() {
  if (!fs.existsSync(CHARACTERS_DIR)) return [];
  return fs
    .readdirSync(CHARACTERS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(CHARACTERS_DIR, d.name, "modDetails.json")))
    .map((d) => path.join("characters", d.name).replace(/\\/g, "/"));
}

function detailsPath(folder) {
  return path.join(path.resolve(ROOT, folder), "modDetails.json");
}

function pickFields(source) {
  const out = {};
  for (const key of MOD_FIELDS) out[key] = String(source[key] ?? "");
  return out;
}

// The three uploadable assets. Portrait and sprite use the fixed file names the changes/*.js files load;
// music keeps the uploaded name, which is recorded in music.json for musicChange.js.
const ASSETS = {
  portrait: { file: "custom_portraits.png", type: "image/png", magic: "\x89PNG" },
  sprite: { file: "custom_sprites.png", type: "image/png", magic: "\x89PNG" },
  music: { type: "audio/ogg", magic: "OggS" },
};
const MAX_UPLOAD = 50 * 1024 * 1024;

// Only accept folders that are real characters, so a request can't point anywhere else.
function characterDir(folder) {
  const clean = String(folder || "").replace(/\\/g, "/");
  return listCharacters().includes(clean) ? path.resolve(ROOT, clean) : null;
}

function readMusicFile(dir) {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(dir, "music.json"), "utf8")).file || "");
  } catch {
    return "";
  }
}

function assetFile(dir, kind) {
  const asset = ASSETS[kind];
  if (!asset) return null;
  const name = kind === "music" ? readMusicFile(dir) : asset.file;
  return name ? path.join(dir, "assets", name) : null;
}

// Keyed lists: { entries: [{ key, lines: [...] }] }. Marriage keys may contain "{name}", schedule keys a ":" (spring:1).
const ENTRY_FILES = { dialogue: "dialogue.json", marriage: "marriageDialogue.json", schedule: "schedule.json" };
const ENTRY_KEY = /^[\w.{}:-]{1,80}$/;

function cleanEntries(body) {
  if (!Array.isArray(body)) throw new Error("Expected a list of entries.");
  const seen = new Set();
  return body.map((item) => {
    const key = String(item?.key ?? "").trim();
    if (!ENTRY_KEY.test(key)) throw new Error(`"${key}" isn't a valid key (letters, numbers, _ - . : { } only).`);
    if (seen.has(key)) throw new Error(`The key ${key} is used twice.`);
    seen.add(key);
    const lines = (Array.isArray(item.lines) ? item.lines : []).map(String).filter((line) => line.trim() !== "");
    if (!lines.length) throw new Error(`${key} needs at least one line.`);
    return { key, lines };
  });
}

// Gift tastes: { generic: {love, like, neutral, dislike, hate: {face, text}}, categories: {loves ... neutral: [ids]}, items: [{item, face, text}] }
const GENERIC_TASTES = ["love", "like", "neutral", "dislike", "hate"];
const TASTE_CATEGORIES = ["loves", "likes", "dislikes", "hates", "neutral"];

function cleanReaction(source, label) {
  const face = String(source?.face ?? "");
  if (!/^\$[0-8]$/.test(face)) throw new Error(`${label}: the sprite face must be $0 to $8.`);
  // The text is kept exactly as typed (no trimming), apart from line breaks, which the game can't use here.
  const text = String(source?.text ?? "").replace(/\s*\r?\n\s*/g, " ");
  if (!text.trim()) throw new Error(`${label} needs some text.`);
  if (text.includes("/")) throw new Error(`${label}: the text can't contain a "/" (it separates the sections).`);
  return { face, text };
}

function cleanGiftTastes(body) {
  const generic = {};
  for (const name of GENERIC_TASTES) generic[name] = cleanReaction(body?.generic?.[name], `The ${name} reaction`);

  const categories = {};
  for (const name of TASTE_CATEGORIES) {
    const list = body?.categories?.[name];
    categories[name] = (Array.isArray(list) ? list : []).map((id) => String(id).trim()).filter(Boolean);
    for (const id of categories[name]) {
      if (!/^-?\w+$/.test(id)) throw new Error(`"${id}" in ${name} isn't a valid item number (use numbers separated by spaces).`);
    }
    if (!categories[name].length) throw new Error(`${name} needs at least one entry.`);
  }

  const seen = new Set();
  const items = (Array.isArray(body?.items) ? body.items : []).map((entry) => {
    const item = String(entry?.item ?? "");
    if (!/^\d{1,6}$/.test(item)) throw new Error(`"${item}" isn't a valid item number.`);
    if (seen.has(item)) throw new Error(`The item (O)${item} is used twice.`);
    seen.add(item);
    return { item, ...cleanReaction(entry, `Item (O)${item}`) };
  });
  return { generic, categories, items };
}

// Events: { events: [{ id, location, conditions, music, viewport, actors, skippable, commands: [{type, args}], forkName?, forkCommands? }] }
// The pieces are joined with "/" at build time, so none of them may contain one.
function oneLine(value, label, { required = true } = {}) {
  const text = String(value ?? "").replace(/\s*\r?\n\s*/g, " ");
  if (required && !text.trim()) throw new Error(`${label} can't be empty.`);
  if (text.includes("/")) throw new Error(`${label} can't contain a "/" (it separates the event commands).`);
  return text;
}

function cleanCommands(list, label) {
  return (Array.isArray(list) ? list : []).map((command, i) => {
    const where = `${label}, command ${i + 1}`;
    const type = String(command?.type ?? "");
    if (type !== "raw" && !/^\w+$/.test(type)) throw new Error(`${where}: the command type must be one word.`);
    return { type, args: oneLine(command?.args, where, { required: false }) };
  });
}

function cleanEvents(body) {
  if (!Array.isArray(body)) throw new Error("Expected a list of events.");
  const keys = new Set();
  return body.map((event) => {
    const id = String(event?.id ?? "").trim();
    if (!/^\w+$/.test(id)) throw new Error(`"${id}" isn't a valid event ID (letters and numbers only).`);
    const label = `Event ${id}`;
    const location = String(event?.location ?? "").trim();
    if (!/^\w+$/.test(location)) throw new Error(`${label}: the location must be a map name like Beach or ElliottHouse.`);
    const conditions = (Array.isArray(event.conditions) ? event.conditions : []).map((c, i) => oneLine(c, `${label}, condition ${i + 1}`).trim());
    const out = {
      id,
      location,
      conditions,
      music: oneLine(event.music, `${label}: the starting music`).trim(),
      viewport: oneLine(event.viewport, `${label}: the viewport`).trim(),
      actors: oneLine(event.actors, `${label}: the actors`).trim(),
      skippable: !!event.skippable,
      commands: cleanCommands(event.commands, label),
    };

    const forkName = String(event.forkName ?? "").trim();
    if (forkName) {
      if (!/^\w+$/.test(forkName)) throw new Error(`${label}: the fork name must be letters, numbers and _ only.`);
      out.forkName = forkName;
      out.forkCommands = cleanCommands(event.forkCommands, `${label} fork`);
    }

    for (const key of [`${location}|${[id, ...conditions].join("/")}`, ...(forkName ? [`${location}|${forkName}`] : [])]) {
      if (keys.has(key)) throw new Error(`${label}: "${key.split("|")[1]}" is used twice in ${location}.`);
      keys.add(key);
    }
    return out;
  });
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_UPLOAD) {
        reject(new Error("File is too large (50 MB max)."));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function openInExplorer(dir) {
  const [cmd, args] =
    process.platform === "win32" ? ["explorer", [dir]] : process.platform === "darwin" ? ["open", [dir]] : ["xdg-open", [dir]];
  // explorer.exe exits with 1 even on success, so the result is ignored.
  execFile(cmd, args, () => {});
}

function runBuild(name, folder) {
  return new Promise((resolve) => {
    execFile(process.execPath, ["build.js", "--name", name, "--folder", folder], { cwd: ROOT }, (error, stdout, stderr) => {
      resolve({ ok: !error, output: `${stdout}${stderr}`.trim() });
    });
  });
}

async function handleApi(req, res, url) {
  // Only accept JSON (or raw file) posts. Neither content type is allowed in a cross-site form post,
  // so other websites can't trigger writes or builds.
  const contentType = req.headers["content-type"] || "";
  const isUpload = url.pathname === "/api/asset";
  if (req.method === "POST" && !contentType.startsWith(isUpload ? "application/octet-stream" : "application/json")) {
    return send(res, 415, { error: isUpload ? "Expected a file upload" : "Expected JSON" });
  }

  // Dialogue, marriage dialogue and schedule lists (type is "dialogue", "marriage" or "schedule").
  if (url.pathname === "/api/entries") {
    const body = req.method === "POST" ? await readBody(req) : {};
    const dir = characterDir(req.method === "POST" ? body.folder : url.searchParams.get("folder"));
    const fileName = ENTRY_FILES[req.method === "POST" ? body.type : url.searchParams.get("type")];
    if (!dir || !fileName) return send(res, 404, { error: "Unknown character folder or list type" });
    const file = path.join(dir, fileName);

    if (req.method === "GET") {
      if (!fs.existsSync(file)) return send(res, 404, { error: `No ${fileName} in this character folder.` });
      return send(res, 200, { entries: JSON.parse(fs.readFileSync(file, "utf8")).entries || [] });
    }
    if (req.method === "POST") {
      let entries;
      try {
        entries = cleanEntries(body.entries);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
      fs.writeFileSync(file, JSON.stringify({ entries }, null, 2) + "\n");
      return send(res, 200, { saved: fileName, count: entries.length });
    }
  }

  // Gift tastes (giftTastes.json).
  if (url.pathname === "/api/gift-tastes") {
    const body = req.method === "POST" ? await readBody(req) : {};
    const dir = characterDir(req.method === "POST" ? body.folder : url.searchParams.get("folder"));
    if (!dir) return send(res, 404, { error: "Unknown character folder" });
    const file = path.join(dir, "giftTastes.json");

    if (req.method === "GET") {
      if (!fs.existsSync(file)) return send(res, 404, { error: "No giftTastes.json in this character folder." });
      return send(res, 200, JSON.parse(fs.readFileSync(file, "utf8")));
    }
    if (req.method === "POST") {
      let data;
      try {
        data = cleanGiftTastes(body.tastes);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
      return send(res, 200, { saved: "giftTastes.json", count: data.items.length });
    }
  }

  // Events (events.json).
  if (url.pathname === "/api/events") {
    const body = req.method === "POST" ? await readBody(req) : {};
    const dir = characterDir(req.method === "POST" ? body.folder : url.searchParams.get("folder"));
    if (!dir) return send(res, 404, { error: "Unknown character folder" });
    const file = path.join(dir, "events.json");

    if (req.method === "GET") {
      if (!fs.existsSync(file)) return send(res, 404, { error: "No events.json in this character folder." });
      return send(res, 200, { events: JSON.parse(fs.readFileSync(file, "utf8")).events || [] });
    }
    if (req.method === "POST") {
      let events;
      try {
        events = cleanEvents(body.events);
      } catch (err) {
        return send(res, 400, { error: err.message });
      }
      fs.writeFileSync(file, JSON.stringify({ events }, null, 2) + "\n");
      return send(res, 200, { saved: "events.json", count: events.length });
    }
  }

  // Which assets a character has, for the Assets section.
  if (req.method === "GET" && url.pathname === "/api/assets") {
    const dir = characterDir(url.searchParams.get("folder"));
    if (!dir) return send(res, 404, { error: "Unknown character folder" });
    const out = {};
    for (const kind of Object.keys(ASSETS)) {
      const file = assetFile(dir, kind);
      out[kind] = { exists: !!file && fs.existsSync(file), name: file ? path.basename(file) : "" };
    }
    return send(res, 200, out);
  }

  // Streams one asset so the page can show or play it.
  if (req.method === "GET" && url.pathname === "/api/asset") {
    const dir = characterDir(url.searchParams.get("folder"));
    const kind = url.searchParams.get("kind");
    const file = dir && assetFile(dir, kind);
    if (!file || !fs.existsSync(file)) return send(res, 404, { error: "No file uploaded yet" });
    res.writeHead(200, { "Content-Type": ASSETS[kind].type, "Cache-Control": "no-store" });
    return res.end(fs.readFileSync(file));
  }

  // Saves an uploaded file into the character's assets/ folder.
  if (req.method === "POST" && url.pathname === "/api/asset") {
    const dir = characterDir(url.searchParams.get("folder"));
    const kind = url.searchParams.get("kind");
    const asset = ASSETS[kind];
    if (!dir || !asset) return send(res, 404, { error: "Unknown character folder or asset" });

    const data = await readRaw(req);
    if (!data.length || data.subarray(0, 4).toString("latin1") !== asset.magic) {
      return send(res, 400, { error: kind === "music" ? "That isn't an .ogg file." : "That isn't a .png file." });
    }

    let name = asset.file;
    if (kind === "music") {
      // Keep the uploaded name, limited to safe characters, since it ends up in content.json.
      const base = path.basename(String(url.searchParams.get("name") || "")).replace(/\.ogg$/i, "");
      const safe = base.replace(/[^\w.-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
      if (!safe) return send(res, 400, { error: "The music file needs a name." });
      name = `${safe}.ogg`;
    }

    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "assets", name), data);
    if (kind === "music") fs.writeFileSync(path.join(dir, "music.json"), JSON.stringify({ file: name }, null, 2) + "\n");
    return send(res, 200, { saved: `assets/${name}`, name });
  }

  if (req.method === "GET" && url.pathname === "/api/characters") {
    return send(res, 200, { folders: listCharacters() });
  }

  // Creates characters/<Replacing>-<NewName> from templates/character with the names filled in.
  if (req.method === "POST" && url.pathname === "/api/characters") {
    const { replacing = "", newName = "" } = await readBody(req);
    const sdvName = String(replacing).trim();
    const newCharacterName = String(newName).trim();
    const valid = /^\w[\w '.-]{0,39}$/;
    if (!valid.test(sdvName) || !valid.test(newCharacterName)) {
      return send(res, 400, { error: "Names need letters or numbers (spaces, - _ ' . are allowed), up to 40 characters." });
    }

    const folderName = `${sdvName}-${newCharacterName}`.replace(/\s+/g, "_");
    const dest = path.join(CHARACTERS_DIR, folderName);
    if (fs.existsSync(dest)) return send(res, 409, { error: `characters/${folderName} already exists.` });

    fs.cpSync(TEMPLATE_DIR, dest, { recursive: true });
    fs.mkdirSync(path.join(dest, "assets"), { recursive: true });

    const idPart = (s) => s.replace(/[^A-Za-z0-9]/g, "");
    const details = {
      SDV_Name: sdvName,
      folderLocation: "./dist",
      newCharacterName,
      Name: `My Character Replacement - ${sdvName} to ${newCharacterName}`,
      Author: "YourName",
      Version: "1.0.0",
      Description: `Replaces ${sdvName} with ${newCharacterName}.`,
      UniqueID: `YourName.${idPart(sdvName)}To${idPart(newCharacterName)}`,
      MinimumApiVersion: "4.0.0",
    };
    fs.writeFileSync(path.join(dest, "modDetails.json"), JSON.stringify(pickFields(details), null, 2) + "\n");
    return send(res, 201, { folder: `characters/${folderName}` });
  }

  if (req.method === "GET" && url.pathname === "/api/mod-details") {
    const folder = url.searchParams.get("folder") || "";
    const file = detailsPath(folder);
    if (!fs.existsSync(file)) return send(res, 404, { error: `No modDetails.json in ${folder}` });
    return send(res, 200, pickFields(JSON.parse(fs.readFileSync(file, "utf8"))));
  }

  // Saves the form to the selected character's modDetails.json (which must already exist).
  if (req.method === "POST" && url.pathname === "/api/mod-details") {
    const { folder, details } = await readBody(req);
    const file = detailsPath(folder || "");
    if (!folder || !fs.existsSync(file)) return send(res, 404, { error: `No modDetails.json in ${folder}` });
    fs.writeFileSync(file, JSON.stringify(pickFields(details || {}), null, 2) + "\n");
    return send(res, 200, { saved: file });
  }

  if (req.method === "POST" && url.pathname === "/api/build") {
    const { folder, details } = await readBody(req);
    const clean = pickFields(details || {});
    const sdvName = clean.SDV_Name.trim();
    if (!folder || !sdvName) return send(res, 400, { error: "A character folder and the Stardew character name are required." });
    const file = detailsPath(folder);
    if (!fs.existsSync(file)) return send(res, 404, { error: `No modDetails.json in ${folder}` });

    fs.writeFileSync(file, JSON.stringify(clean, null, 2) + "\n");

    const result = await runBuild(sdvName, folder);
    if (!result.ok) return send(res, 500, { error: "Build failed", output: result.output });

    const outDir = path.resolve(ROOT, clean.folderLocation, `[CP] ${sdvName}-${clean.newCharacterName}`);
    if (fs.existsSync(outDir)) openInExplorer(outDir);
    return send(res, 200, { output: result.output, outDir });
  }

  return send(res, 404, { error: "Not found" });
}

function serveStatic(res, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const file = path.resolve(INTERFACE_DIR, rel);
  if (!file.startsWith(INTERFACE_DIR + path.sep) || !fs.existsSync(file)) return send(res, 404, "Not found", "text/plain");
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || "application/octet-stream");
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith("/api/")) await handleApi(req, res, url);
      else serveStatic(res, url.pathname);
    } catch (err) {
      send(res, 500, { error: err.message });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Interface running at http://localhost:${PORT}`));
