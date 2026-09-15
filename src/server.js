import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BibleCorpus } from "./bible/corpus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const corpus = new BibleCorpus(path.join(rootDir, "data", "bibles"));
const port = Number(process.env.PORT) || 5173;

await corpus.load();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/versions") {
      return sendJson(response, corpus.listVersions());
    }

    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q") ?? "";
      const versions = url.searchParams.getAll("version");
      const results = corpus.search(query, { versions });
      return sendJson(response, { results });
    }

    return sendStatic(response, url.pathname);
  } catch (error) {
    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Bible Study Agent running at http://localhost:${port}`);
});

function sendJson(response, value) {
  response.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
}

async function sendStatic(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));
  const relativePath = path.relative(publicDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": contentTypeFor(filePath) });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}
