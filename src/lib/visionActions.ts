import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { NavigateFunction } from "react-router-dom";

export type VisionAction =
  | { action: "openAddEvent"; payload: Record<string, any> }
  | { action: "createTask"; payload: Record<string, any> }
  | { action: "draftEmail"; payload: { to?: string | string[]; cc?: string | string[]; bcc?: string | string[]; subject?: string; body?: string } }
  | { action: "searchDrive"; payload: { query: string } }
  | { action: "openDriveFile"; payload: { url?: string; fileId?: string } }
  | { action: "findTime"; payload: { attendees?: string[]; duration_mins?: number } };

/**
 * Parse the LAST fenced JSON block in an assistant response.
 * Returns the parsed action and the cleaned text (with the JSON block stripped).
 */
export function extractActionFromResponse(text: string): { action: VisionAction | null; cleanedText: string } {
  if (!text) return { action: null, cleanedText: text };

  // Match all ```json ... ``` blocks (also bare ``` { ... } ```)
  const re = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) lastMatch = m;
  if (!lastMatch) return { action: null, cleanedText: text };

  try {
    const parsed = JSON.parse(lastMatch[1]);
    if (parsed && typeof parsed.action === "string") {
      const cleaned = (text.slice(0, lastMatch.index) + text.slice(lastMatch.index + lastMatch[0].length)).trimEnd();
      return { action: parsed as VisionAction, cleanedText: cleaned };
    }
  } catch {
    /* not JSON */
  }
  return { action: null, cleanedText: text };
}

function buildGmailComposeUrl(payload: VisionAction extends { action: "draftEmail"; payload: infer P } ? P : any): string {
  const toList = (v: unknown) => Array.isArray(v) ? v.join(",") : (v ? String(v) : "");
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  const to = toList(payload?.to);
  const cc = toList(payload?.cc);
  const bcc = toList(payload?.bcc);
  if (to) params.set("to", to);
  if (cc) params.set("cc", cc);
  if (bcc) params.set("bcc", bcc);
  if (payload?.subject) params.set("su", String(payload.subject));
  if (payload?.body) params.set("body", String(payload.body));
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function handleVisionAction(
  action: VisionAction,
  ctx: { navigate: NavigateFunction; userId: string; activeOrgId: string | null },
): Promise<void> {
  switch (action.action) {
    case "openAddEvent":
      ctx.navigate("/calendar", { state: { openAddEvent: true, prefill: action.payload } });
      break;

    case "createTask": {
      const payload = action.payload ?? {};
      const insert: Record<string, any> = {
        title: payload.title ?? "Untitled task",
        description: payload.description ?? null,
        status: payload.status ?? "todo",
        priority: payload.priority ?? "normal",
        due_at: payload.due_at ?? null,
        org_id: payload.org_id ?? ctx.activeOrgId ?? null,
        created_by: ctx.userId,
        assignee_id: payload.assignee_id ?? ctx.userId,
      };
      const { error } = await supabase.from("tasks").insert(insert as any);
      if (error) {
        toast({ title: "Couldn't create task", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Task created", description: insert.title });
      }
      break;
    }

    case "draftEmail":
      window.open(buildGmailComposeUrl(action.payload ?? {}), "_blank", "noopener,noreferrer");
      break;

    case "searchDrive":
      // Surface as a Drive search in a new tab (drive-search edge function is optional)
      window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(action.payload?.query ?? "")}`, "_blank", "noopener,noreferrer");
      break;

    case "openDriveFile": {
      const url = action.payload?.url
        ?? (action.payload?.fileId ? `https://drive.google.com/file/d/${action.payload.fileId}/view` : null);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      break;
    }

    case "findTime":
      ctx.navigate("/calendar", { state: { openFindTime: true, attendees: action.payload?.attendees ?? [], duration_mins: action.payload?.duration_mins } });
      break;

    default:
      console.warn("Unknown Vision action", action);
  }
}
