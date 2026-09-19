import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  FIELDS,
  fingerprint,
  validateContent,
  type Content,
  type ContentInput,
} from "./domain";
export function createStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(
    `CREATE TABLE IF NOT EXISTS content (id TEXT PRIMARY KEY, payload TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)`,
  );
  const hydrate = (row: unknown): Content => {
    const r = row as {
      id: string;
      payload: string;
      createdAt: string;
      updatedAt: string;
    };
    return {
      ...JSON.parse(r.payload),
      id: r.id,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  };
  const list = () =>
    db
      .prepare("SELECT * FROM content ORDER BY createdAt DESC, id")
      .all()
      .map(hydrate);
  const clean = (input: unknown) => {
    const result = validateContent(input);
    if (Object.keys(result.errors).length)
      throw new Error(Object.values(result.errors).join(" "));
    return result.data;
  };
  const insert = (data: ContentInput) => {
    const id = randomUUID();
    const time = new Date().toISOString();
    db.prepare("INSERT INTO content VALUES (?, ?, ?, ?)").run(
      id,
      JSON.stringify(data),
      time,
      time,
    );
    return { ...data, id, createdAt: time, updatedAt: time };
  };
  return {
    list,
    create: (input: unknown) => insert(clean(input)),
    update: (id: string, input: unknown) => {
      const data = clean(input);
      const time = new Date().toISOString();
      const result = db
        .prepare("UPDATE content SET payload=?, updatedAt=? WHERE id=?")
        .run(JSON.stringify(data), time, id);
      return result.changes
        ? hydrate(db.prepare("SELECT * FROM content WHERE id=?").get(id))
        : null;
    },
    remove: (id: string) =>
      db.prepare("DELETE FROM content WHERE id=?").run(id).changes > 0,
    import: (inputs: unknown[]) => {
      const rows = inputs.map(clean);
      return db.transaction(() => {
        const seen = new Set(list().map(fingerprint));
        let added = 0,
          skipped = 0;
        for (const data of rows) {
          const key = fingerprint(data);
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          insert(data);
          seen.add(key);
          added++;
        }
        return { added, skipped };
      })();
    },
    close: () => db.close(),
  };
}
type Store = ReturnType<typeof createStore>;
const globalStore = globalThis as typeof globalThis & { tajamStore?: Store };
export function getStore() {
  return (globalStore.tajamStore ??= createStore(
    process.env.TAJAM_DB_PATH || join(process.cwd(), "data", "tajam.db"),
  ));
}
