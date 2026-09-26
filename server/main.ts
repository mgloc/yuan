import { createServer } from "node:http";
import { join } from "node:path";
import { createApi } from "./api.ts";
import { staticFiles } from "./static.ts";
import { databasePath } from "./store/config.ts";
import { SqliteRoomStore } from "./store/sqlite_store.ts";

const PORT = Number(process.env.PORT ?? 8787);

const store = new SqliteRoomStore(databasePath());
const api = createApi({ store, trustProxy: process.env.YUAN_TRUST_PROXY === "1" });
const serveStatic = staticFiles(join(import.meta.dirname, "..", "dist"));

const server = createServer((req, res) => api(req, res, () => serveStatic(req.url ?? "/", res))).listen(PORT, () => {
  console.log(`Yuan server on http://localhost:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.closeAllConnections();
    server.close(() => store.close().then(() => process.exit(0)));
  });
}
