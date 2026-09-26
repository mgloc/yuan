import { defineConfig } from "vite";
import { createApi } from "./server/api.ts";

export default defineConfig({
  plugins: [
    {
      name: "yuan-api",
      configureServer(server) {
        const api = createApi();
        server.middlewares.use((req, res, next) => api(req, res, next));
      },
    },
  ],
});
