import { createReadStream, existsSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".exr": "image/x-exr",
};

const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
};

export function staticFiles(directory: string) {
  const root = resolve(directory);
  const index = join(root, "index.html");

  return (url: string, res: ServerResponse) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }
    const candidate = resolve(root, `.${pathname}`);
    const inside = candidate === root || candidate.startsWith(root + sep);
    const file = inside && existsSync(candidate) && statSync(candidate).isFile() ? candidate : index;
    if (!existsSync(file)) {
      res.writeHead(404).end("Run npm run build first");
      return;
    }
    res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  };
}
