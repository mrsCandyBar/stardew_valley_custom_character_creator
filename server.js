// Tiny local helper for the interface. No dependencies.
// Start it with `node server.js`, then open http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const PORT = 3000;
const ROOT = __dirname;
const INTERFACE_DIR = path.join(ROOT, "interface");
const CHARACTERS_DIR = path.join(ROOT, "characters");

// Only these fields are read from / written to modDetails.json
const MOD_FIELDS = [
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
  // Only accept JSON posts so other websites can't trigger writes or builds.
  if (req.method === "POST" && !(req.headers["content-type"] || "").startsWith("application/json")) {
    return send(res, 415, { error: "Expected JSON" });
  }

  if (req.method === "GET" && url.pathname === "/api/characters") {
    return send(res, 200, { folders: listCharacters() });
  }

  if (req.method === "GET" && url.pathname === "/api/mod-details") {
    const folder = url.searchParams.get("folder") || "";
    const file = detailsPath(folder);
    if (!fs.existsSync(file)) return send(res, 404, { error: `No modDetails.json in ${folder}` });
    return send(res, 200, pickFields(JSON.parse(fs.readFileSync(file, "utf8"))));
  }

  if (req.method === "POST" && url.pathname === "/api/build") {
    const { folder, sdvName, details } = await readBody(req);
    if (!folder || !sdvName) return send(res, 400, { error: "A character folder and the Stardew character name are required." });
    const file = detailsPath(folder);
    if (!fs.existsSync(path.dirname(file))) return send(res, 404, { error: `Folder not found: ${folder}` });

    const clean = pickFields(details || {});
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
