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
    let connectionString = process.env.DATABASE_URL!;
    if (process.env.DB_SSH_HOST) {
      const { databaseTunnel } = await import("./database-tunnel");
      const port = await databaseTunnel();
      const url = new URL(connectionString);
      url.hostname = "127.0.0.1";
      url.port = String(port);
      connectionString = url.toString();
    }
    return (globals.tajamDatabase = connectPostgres(connectionString));
  }
  // Never open or create a local database in a serverless deployment.
  const { getStore } = await import("./store");
  return (globals.tajamDatabase ??= getStore());
}
