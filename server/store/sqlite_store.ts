import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RoomState } from "../room.ts";
import { MIGRATIONS } from "./migrations.ts";
import type { RoomStore, StoredRoom } from "./store.ts";

const MEMORY = ":memory:";

interface RoomRow {
  state: string;
  version: number;
}

export class SqliteRoomStore implements RoomStore {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== MEMORY) {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;");
    this.migrate();
  }

  async load(code: string): Promise<StoredRoom | null> {
    const row = this.db.prepare("SELECT state, version FROM rooms WHERE code = ?").get(code) as RoomRow | undefined;
    return row === undefined ? null : { state: JSON.parse(row.state) as RoomState, version: row.version };
  }

  async insert(state: RoomState, now: number): Promise<boolean> {
    const result = this.db
      .prepare("INSERT INTO rooms (code, version, state, created_at, updated_at) VALUES (?, 1, ?, ?, ?) ON CONFLICT (code) DO NOTHING")
      .run(state.code, JSON.stringify(state), now, now);
    return result.changes === 1;
  }

  async save(state: RoomState, version: number, now: number): Promise<boolean> {
    const result = this.db
      .prepare("UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE code = ? AND version = ?")
      .run(JSON.stringify(state), now, state.code, version);
    return result.changes === 1;
  }

  async delete(code: string): Promise<boolean> {
    return this.db.prepare("DELETE FROM rooms WHERE code = ?").run(code).changes === 1;
  }

  async count(): Promise<number> {
    return (this.db.prepare("SELECT COUNT(*) AS count FROM rooms").get() as { count: number }).count;
  }

  async deleteIdle(before: number, keep: readonly string[]): Promise<number> {
    const excluded = keep.length === 0 ? "" : ` AND code NOT IN (${keep.map(() => "?").join(", ")})`;
    return Number(this.db.prepare(`DELETE FROM rooms WHERE updated_at < ?${excluded}`).run(before, ...keep).changes);
  }

  async close() {
    if (this.db.isOpen) {
      this.db.close();
    }
  }

  private migrate() {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)");
    const applied = new Set(
      (this.db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(({ version }) => version),
    );
    for (const migration of MIGRATIONS.filter(({ version }) => !applied.has(version))) {
      this.db.exec("BEGIN");
      try {
        migration.statements.forEach((statement) => this.db.exec(statement));
        this.db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(migration.version, Date.now());
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    }
  }
}
