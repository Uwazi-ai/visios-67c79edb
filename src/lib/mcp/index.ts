import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkspacesTool from "./tools/list-workspaces";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import searchKnowledgeTool from "./tools/search-knowledge";
import listContactsTool from "./tools/list-contacts";
import listAgentProposalsTool from "./tools/list-agent-proposals";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "kova-io",
  title: "Kova io",
  version: "0.1.0",
  instructions:
    "Tools for Kova, a multi-venture operating system. Call `list_workspaces` first to learn the workspace slugs, then filter tasks, contacts, knowledge and agent proposals by that slug. All data is scoped to the signed-in user. Agent proposals are read-only: a person approves them inside Kova.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listWorkspacesTool,
    listTasksTool,
    createTaskTool,
    searchKnowledgeTool,
    listContactsTool,
    listAgentProposalsTool,
  ],
});
