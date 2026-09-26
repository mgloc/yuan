import { defineConfig } from "vite";
import { createApi } from "./server/api.ts";
import { databasePath } from "./server/store/config.ts";
import { SqliteRoomStore } from "./server/store/sqlite_store.ts";

export default defineConfig({
  plugins: [
    {
      name: "yuan-api",
      configureServer(server) {
        const store = new SqliteRoomStore(databasePath());
        const api = createApi({ store });
        server.middlewares.use((req, res, next) => api(req, res, next));
        server.httpServer?.once("close", () => store.close());
      },
    },
  ],
});
