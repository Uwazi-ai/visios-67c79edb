import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

const MIGRATIONS = new URL('../supabase/migrations/', import.meta.url);

// A fresh in-memory database with every brain migration applied in order.
export async function freshDb() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;`);
  for (const file of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  return db;
}

export function reporter() {
  const ok = (m) => console.log('PASS', m);
  const bad = (m) => {
    console.log('FAIL', m);
    process.exitCode = 1;
  };
  const check = (cond, m) => (cond ? ok(m) : bad(m));
  async function expectErr(db, sql, m) {
    try {
      await db.exec(sql);
      bad(m);
    } catch (e) {
      ok(`${m} -> ${e.message.split('\n')[0]}`);
    }
  }
  function expectThrow(fn, m) {
    try {
      fn();
      bad(m);
    } catch (e) {
      ok(`${m} -> ${e.message.split('\n')[0]}`);
    }
  }
  return { ok, bad, check, expectErr, expectThrow };
}
