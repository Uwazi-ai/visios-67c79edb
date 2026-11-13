// Runs the real brain-mcp request handler against an in-memory database.
// Node strips the TypeScript types on import, so this exercises the same code
// the edge function ships.
import { handleRequest } from '../../supabase/functions/brain-mcp/core/server.ts';
import { setProtectedNames } from '../../supabase/functions/brain-mcp/core/guardrails.ts';
import { freshDb } from './helpers.mjs';

// A made-up name. Real names live only in the BRAIN_PROTECTED_NAMES secret.
setProtectedNames(['Sam']);

export const AGENTS = ['kova', 'grok', 'chatgpt', 'muse', 'stevie'];
const userId = (i) => `00000000-0000-4000-8000-00000000000${i + 1}`;
const STRANGER = '00000000-0000-4000-8000-0000000000ff';

export async function startBrain() {
  const pg = await freshDb();
  for (const [i, agent] of AGENTS.entries()) {
    await pg.query('insert into brain.identities (auth_user_id, agent) values ($1, $2)', [userId(i), agent]);
  }

  const wrap = (runner) => ({ query: async (sql, params = []) => (await runner.query(sql, params)).rows });
  const deps = {
    db: { ...wrap(pg), tx: (fn) => pg.transaction((tx) => fn(wrap(tx))) },
    verifyToken: async (token) => {
      if (token === 'token-stranger') return STRANGER;
      const i = AGENTS.indexOf(token.replace(/^token-/, ''));
      return i === -1 ? null : userId(i);
    },
    publicUrl: 'https://example.test/functions/v1/brain-mcp',
    issuer: 'https://example.test/auth/v1',
    authServerMetadataUrl: 'https://example.test/.well-known/oauth-authorization-server/auth/v1',
    fetch: async () => new Response(JSON.stringify({ issuer: 'https://example.test/auth/v1' })),
  };

  const http = (method, path = '', { token, body } = {}) =>
    handleRequest(
      new Request(`${deps.publicUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
      deps,
    );

  let nextId = 1;
  const rpc = async (agent, method, params) => {
    const res = await http('POST', '', { token: `token-${agent}`, body: { jsonrpc: '2.0', id: nextId++, method, params } });
    return res.json();
  };

  // Calls a tool and returns { ok, data } on success or { ok: false, message }.
  const call = async (agent, name, args = {}) => {
    const reply = await rpc(agent, 'tools/call', { name, arguments: args });
    if (reply.error) return { ok: false, message: reply.error.message };
    const text = reply.result.content[0].text;
    return reply.result.isError ? { ok: false, message: text } : { ok: true, data: JSON.parse(text) };
  };

  return { pg, http, rpc, call };
}
