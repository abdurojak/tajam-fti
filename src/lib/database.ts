import { databaseMode } from "./runtime-config";
import { connectPostgres } from "./postgres-store";
import type { createStore } from "./store";
type Store =
  ReturnType<typeof connectPostgres> | ReturnType<typeof createStore>;
const globals = globalThis as typeof globalThis & { tajamDatabase?: Store };
export async function getDatabase(): Promise<Store> {
  const mode = databaseMode();
  if (globals.tajamDatabase) return globals.tajamDatabase;
  if (mode === "postgres") {
    return (globals.tajamDatabase = connectPostgres(process.env.DATABASE_URL!));
  }
  // Never open or create a local database in a serverless deployment.
  const { getStore } = await import("./store");
  return (globals.tajamDatabase ??= getStore());
}
