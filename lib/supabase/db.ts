import pg from "pg";

import { supabaseDbPassword, WEALTH_PROJECT_REF } from "@/lib/supabase/env";

const globalForDb = globalThis as typeof globalThis & {
  __jaDbPool?: pg.Pool;
};

function createPool() {
  if (!supabaseDbPassword) {
    throw new Error("Missing SUPABASE_DB_PASSWORD for server database access");
  }

  return new pg.Pool({
    host: "aws-1-eu-west-1.pooler.supabase.com",
    // Transaction mode (6543), not session mode (5432). On Vercel every function
    // instance keeps its own pool; in session mode each open connection holds one of
    // the pooler's few server slots (15), so a handful of instances exhausts it
    // (EMAXCONNSESSION). Transaction mode only holds a slot while a query runs.
    // Safe here because every query is a single statement: no BEGIN, SET or LISTEN.
    port: Number(process.env.SUPABASE_DB_POOLER_PORT ?? 6543),
    user: `postgres.${WEALTH_PROJECT_REF}`,
    database: "postgres",
    password: supabaseDbPassword,
    ssl: { rejectUnauthorized: false },
    max: 3,
    // Hand idle connections back quickly; serverless instances sit idle between requests.
    idleTimeoutMillis: 5_000,
    // Fail fast with a clear error rather than hanging the page if the pooler is busy.
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
}

export function getDbPool() {
  if (!globalForDb.__jaDbPool) {
    globalForDb.__jaDbPool = createPool();
  }
  return globalForDb.__jaDbPool;
}

export async function queryDb<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  const result = await getDbPool().query<T>(text, params);
  return result.rows;
}
