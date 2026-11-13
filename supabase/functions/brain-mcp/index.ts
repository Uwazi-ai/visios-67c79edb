// brain-mcp: the shared brain for Myke OS, as a remote MCP server.
//
// Deno entry point. All behavior lives in ./core so it can be tested outside
// the edge runtime. This file only wires the runtime in:
//   - Postgres over SUPABASE_DB_URL (the brain schema is not on the REST API)
//   - token checks against Supabase Auth
//
// Environment (all set by Supabase for edge functions unless noted):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DB_URL
//   BRAIN_MCP_PUBLIC_URL  optional override for the public function URL
//   BRAIN_DB_POOL_MAX     optional connection pool size, default 3
//   BRAIN_PROTECTED_NAMES secret you set: comma separated first names of
//                         minors, so the minors rule follows them everywhere

import postgres from "postgres";
import { handleRequest } from "./core/server.ts";
import type { Db, Queryable } from "./core/db.ts";
import { setProtectedNames } from "./core/guardrails.ts";

// Private first names for the minors rule. Kept in a secret, never in code.
setProtectedNames((Deno.env.get("BRAIN_PROTECTED_NAMES") ?? "").split(","));

const need = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`brain-mcp is missing the ${name} environment variable`);
  return value;
};

const supabaseUrl = need("SUPABASE_URL").replace(/\/+$/, "");
const anonKey = need("SUPABASE_ANON_KEY");

// prepare: false keeps this working through a transaction-mode pooler.
const sql = postgres(need("SUPABASE_DB_URL"), {
  prepare: false,
  max: Number(Deno.env.get("BRAIN_DB_POOL_MAX") ?? 3),
  idle_timeout: 20,
});

// deno-lint-ignore no-explicit-any
const wrap = (runner: any): Queryable => ({
  // deno-lint-ignore no-explicit-any
  query: async (text: string, params: unknown[] = []) => [...(await runner.unsafe(text, params as any[]))] as any[],
});

const db: Db = {
  ...wrap(sql),
  // deno-lint-ignore no-explicit-any
  tx: (fn) => sql.begin((tx: any) => fn(wrap(tx))) as Promise<any>,
};

// Ask Supabase Auth who the token belongs to. This also catches revoked
// sessions, which checking the signature alone would not.
async function verifyToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return null;
    const user = await res.json();
    return typeof user?.id === "string" ? user.id : null;
  } catch (e) {
    console.error("brain-mcp token check failed:", e);
    return null;
  }
}

const deps = {
  db,
  verifyToken,
  publicUrl: (Deno.env.get("BRAIN_MCP_PUBLIC_URL") ?? `${supabaseUrl}/functions/v1/brain-mcp`).replace(/\/+$/, ""),
  issuer: `${supabaseUrl}/auth/v1`,
  authServerMetadataUrl: `${supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`,
};

Deno.serve(async (req) => {
  try {
    return await handleRequest(req, deps);
  } catch (e) {
    console.error("brain-mcp request failed:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
