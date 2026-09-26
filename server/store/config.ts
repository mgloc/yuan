import { join } from "node:path";

export function databasePath(): string {
  return process.env.YUAN_DB ?? join(import.meta.dirname, "..", "..", "data", "yuan.sqlite");
}
