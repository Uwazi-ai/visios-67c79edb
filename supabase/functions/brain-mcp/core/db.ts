// The smallest database surface the tools need. The edge function backs it
// with postgres.js over SUPABASE_DB_URL; the tests back it with PGlite.

export type Row = Record<string, unknown>;

export interface Queryable {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}

// Every statement runs as service_role inside a transaction. The brain tables
// force row level security with no policies, so only a role that bypasses it
// can read them. This also keeps the function off the postgres superuser.
export function asServiceRole<T>(db: Db, fn: (q: Queryable) => Promise<T>): Promise<T> {
  return db.tx(async (q) => {
    await q.query("set local role service_role");
    return fn(q);
  });
}
