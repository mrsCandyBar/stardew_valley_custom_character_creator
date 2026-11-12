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
