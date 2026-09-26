import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { createApi } from "./api.ts";

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = join(import.meta.dirname, "..", "dist");
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};

const api = createApi();

createServer((req, res) => api(req, res, () => serveStatic(req.url ?? "/", res))).listen(PORT, () => {
  console.log(`Yuan server on http://localhost:${PORT}`);
});

function serveStatic(url: string, res: ServerResponse) {
  const path = normalize(decodeURIComponent(new URL(url, "http://localhost").pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidate = join(STATIC_DIR, path);
  const file = candidate.startsWith(STATIC_DIR) && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(STATIC_DIR, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404).end("Run npm run build first");
    return;
  }
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}
