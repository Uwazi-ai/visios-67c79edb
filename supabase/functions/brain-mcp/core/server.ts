// brain-mcp HTTP layer: MCP Streamable HTTP transport plus the OAuth 2.1
// resource-server side of the MCP authorization spec.
//
// brain-mcp never issues tokens. Supabase Auth is the authorization server.
// This layer only:
//   1. tells clients where that server is (protected resource metadata),
//   2. checks the bearer token on every request,
//   3. maps the signed-in user to one agent identity,
//   4. speaks JSON-RPC for initialize, tools/list and tools/call.
//
// The transport is stateless: every POST is answered with plain JSON, there
// are no sessions and no server-initiated streams.

import { asServiceRole } from "./db.ts";
import type { Db } from "./db.ts";
import { callTool, listTools } from "./tools.ts";

export interface ServerDeps {
  db: Db;
  /** Returns the Supabase Auth user id for a valid access token, else null. */
  verifyToken(token: string): Promise<string | null>;
  /** Public URL of this function, for example https://ref.supabase.co/functions/v1/brain-mcp */
  publicUrl: string;
  /** Supabase Auth issuer, for example https://ref.supabase.co/auth/v1 */
  issuer: string;
  /** Where the issuer publishes its OAuth metadata. */
  authServerMetadataUrl: string;
  fetch?: typeof fetch;
}

const SERVER_INFO = { name: "brain-mcp", title: "Myke OS Brain", version: "0.1.0" };
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS =
  "The shared brain for Myke OS. Agents do not talk to each other, they read and write here. " +
  "Start with get_ontology for the reviewed truth about Myke and his ventures, and get_my_jobs for your work. " +
  "Anything you write lands in an inbox and is not truth until Kova reviews it. " +
  "Actions on the outside world need human approval through request_approval. " +
  "Money, journal content and the Ryana for Mayor campaign are out of scope and will be refused.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...headers },
  });

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function unauthorized(deps: ServerDeps, description: string) {
  const metadata = `${deps.publicUrl}/.well-known/oauth-protected-resource`;
  return json({ error: "unauthorized", error_description: description }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`,
  });
}

async function resolveAgent(deps: ServerDeps, req: Request): Promise<{ agent: string } | Response> {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return unauthorized(deps, "Sign in to use brain-mcp. Send an OAuth access token as a Bearer token.");

  const userId = await deps.verifyToken(match[1]);
  if (!userId) return unauthorized(deps, "The access token is invalid or expired. Sign in again.");

  const rows = await asServiceRole(deps.db, (q) =>
    q.query("select agent from brain.identities where auth_user_id = $1::uuid", [userId]));
  if (rows.length === 0) {
    return json({
      error: "forbidden",
      error_description: "This account is not a Myke OS agent. Sign in with the account assigned to this agent.",
    }, 403);
  }
  return { agent: rows[0].agent as string };
}

// deno-lint-ignore no-explicit-any
async function handleRpc(deps: ServerDeps, agent: string, msg: any): Promise<unknown | null> {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg?.id, -32600, "Invalid request. Send a JSON-RPC 2.0 message with a method.");
  }
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;

  switch (msg.method) {
    case "initialize": {
      const asked = msg.params?.protocolVersion;
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: `${INSTRUCTIONS} You are signed in as ${agent}.`,
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: listTools(agent) });
    case "tools/call": {
      const name = msg.params?.name;
      if (typeof name !== "string") return rpcError(msg.id, -32602, "tools/call needs params.name.");
      const result = await callTool(deps.db, agent, name, msg.params?.arguments);
      const text = typeof result.payload === "string" ? result.payload : JSON.stringify(result.payload, null, 2);
      const ok = result.status === "ok";
      const structured = ok && result.payload && typeof result.payload === "object" && !Array.isArray(result.payload);
      return rpcResult(msg.id, {
        content: [{ type: "text", text }],
        // Same data as the text, for clients that read structured results.
        ...(structured ? { structuredContent: JSON.parse(text) } : {}),
        isError: !ok,
      });
    }
    default:
      return rpcError(msg.id, -32601, `Method ${msg.method} is not supported. brain-mcp supports initialize, ping, tools/list and tools/call.`);
  }
}

export async function handleRequest(req: Request, deps: ServerDeps): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/\/+$/, "");

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // OAuth discovery. Open by design: clients read these before they sign in.
  if (req.method === "GET" && path.includes("/.well-known/oauth-protected-resource")) {
    return json({
      resource: deps.publicUrl,
      authorization_servers: [deps.issuer],
      bearer_methods_supported: ["header"],
      resource_name: SERVER_INFO.title,
    }, 200, { "Cache-Control": "public, max-age=300" });
  }
  // Older MCP clients look for the authorization server metadata on the MCP
  // server itself. Pass Supabase Auth's document through unchanged.
  if (req.method === "GET" && /\/\.well-known\/(oauth-authorization-server|openid-configuration)/.test(path)) {
    try {
      const upstream = await (deps.fetch ?? fetch)(deps.authServerMetadataUrl);
      if (!upstream.ok) throw new Error(`status ${upstream.status}`);
      return json(await upstream.json(), 200, { "Cache-Control": "public, max-age=300" });
    } catch (e) {
      console.error("brain-mcp could not load authorization server metadata:", e);
      return json({ error: "temporarily_unavailable", error_description: "Could not reach the authorization server." }, 502);
    }
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed", error_description: "brain-mcp accepts JSON-RPC over POST." }, 405, { Allow: "POST, OPTIONS" });
  }

  const identity = await resolveAgent(deps, req);
  if (identity instanceof Response) return identity;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error. The request body is not valid JSON."), 400);
  }

  if (Array.isArray(body)) {
    if (body.length === 0) return json(rpcError(null, -32600, "Invalid request. The batch is empty."), 400);
    const replies = [];
    // One at a time, so a batch cannot race itself past the rate limit.
    for (const msg of body) {
      const reply = await handleRpc(deps, identity.agent, msg);
      if (reply) replies.push(reply);
    }
    return replies.length ? json(replies) : new Response(null, { status: 202, headers: CORS });
  }
  const reply = await handleRpc(deps, identity.agent, body);
  return reply ? json(reply) : new Response(null, { status: 202, headers: CORS });
}
