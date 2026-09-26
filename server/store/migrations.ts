export interface Migration {
  version: number;
  statements: string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE rooms (
        code TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        state TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )`,
      "CREATE INDEX rooms_updated_at ON rooms (updated_at)",
    ],
  },
];
