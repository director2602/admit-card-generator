import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type DB = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __acgPool?: Pool; __acgDb?: DB };

function create(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url, max: 10 });
  g.__acgPool = pool;
  return drizzle(pool, { schema });
}

export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    if (!g.__acgDb) g.__acgDb = create();
    const v = (g.__acgDb as unknown as Record<string | symbol, unknown>)[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(g.__acgDb) : v;
  },
});

export { schema };
