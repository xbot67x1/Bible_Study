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

    if (url.pathname === "/api/references") {
      return sendJson(response, { versions: corpus.listReferenceIndex() });
    }

    if (url.pathname === "/api/reference-exists") {
      const reference = url.searchParams.get("reference") ?? "";
      const translation = url.searchParams.get("translation") ?? "";
      return sendJson(response, corpus.hasReference(reference, translation));
    }

    if (url.pathname === "/api/chat") {
      return handleChat(request, response);
    }

    return sendStatic(response, url.pathname);
  } catch (error) {
    response.writeHead(error.statusCode ?? 500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Bible Study Agent running at http://localhost:${port}`);
});

function sendJson(response, value, statusCode = 200) {
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
}

async function handleChat(request, response) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.5";

  if (request.method === "GET") {
    return sendJson(response, { configured: Boolean(apiKey), model });
  }

  if (request.method !== "POST") {
    return sendJson(response, { error: "Method not allowed." }, 405);
  }

  if (!apiKey) {
    return sendJson(response, {
      error: "Chat needs an OPENAI_API_KEY on the server. Add it to your environment, then restart the app."
    }, 503);
  }

  const body = await readJsonBody(request);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const input = messages
    .filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string")
    .slice(-30)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 6000) }));

  if (input.length === 0 || input.at(-1).role !== "user") {
    return sendJson(response, { error: "A user message is required." }, 400);
  }

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 900,
      instructions: "You are a warm, helpful assistant inside a Bible study app. Be concise, thoughtful, and honest about uncertainty. When discussing Scripture, distinguish the biblical text from interpretation and avoid inventing quotations or citations.",
      input
    })
  });
  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    return sendJson(response, {
      error: payload.error?.message || "OpenAI could not complete the request."
    }, apiResponse.status);
  }

  const message = extractResponseText(payload);
  if (!message) {
    return sendJson(response, { error: "OpenAI returned an empty response." }, 502);
  }

  return sendJson(response, { message, model });
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 100_000) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(raw || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text)
    .join("\n")
    .trim();
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
