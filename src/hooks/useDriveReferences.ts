import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DriveReference = {
  id: string;
  org_id: string;
  conversation_id: string | null;
  file_id: string;
  drive_url: string;
  file_name: string;
  mime_type: string;
  icon_url: string | null;
  thumbnail_link: string | null;
  web_view_link: string;
  owner_email: string | null;
  externally_owned: boolean;
  file_modified_at: string | null;
  source: "picker" | "pasted" | "created";
  status: "ok" | "no_access" | "not_found" | "unenriched";
  metadata_fetched_at: string | null;
  created_at: string;
};

export type AccessParticipant = { userId: string; email: string; name: string; access: "ok" | "missing" | "unknown" };

export type AccessResult =
  | { state: "clean" | "gap"; participants: AccessParticipant[]; missing: AccessParticipant[]; total: number; cached: boolean }
  /** Kova could not verify access. It never claims a clean result it did not see. */
  | { state: "unknown"; reason: string; participants: AccessParticipant[]; cached: boolean };

/**
 * Drive references for a conversation.
 *
 * A reference stores no bytes and has no size ceiling. The metadata is a
 * snapshot taken at share time, because the person reading the card may have no
 * access to the file at all — the card has to render from Kova's row, not from
 * a live call in their session.
 */
export function useDriveReferences(conversationId: string | null) {
  const [refs, setRefs] = useState<DriveReference[]>([]);
  const [access, setAccess] = useState<Record<string, AccessResult>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) {
      setRefs([]);
      return;
    }
    const { data } = await supabase
      .from("drive_references")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setRefs((data ?? []) as DriveReference[]);
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invoke = async <T,>(fn: string, body: unknown): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke(fn, { body });
      if (err) throw err;
      if ((data as { error?: string })?.error) throw new Error((data as { message?: string; error: string }).message ?? (data as { error: string }).error);
      return data as T;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const addFromPicker = async (picked: { id: string; name: string; mimeType: string; url: string }) => {
    const res = await invoke<{ reference: DriveReference }>("drive-reference-create", {
      conversation_id: conversationId,
      picked,
    });
    if (res?.reference) setRefs((r) => [...r, res.reference]);
    return res?.reference ?? null;
  };

  const addFromUrl = async (url: string) => {
    const res = await invoke<{ reference: DriveReference }>("drive-reference-create", {
      conversation_id: conversationId,
      url,
    });
    if (res?.reference) setRefs((r) => [...r, res.reference]);
    return res?.reference ?? null;
  };

  /** Checked once per card, not per render — the server caches 5 minutes per file. */
  const checkAccess = useCallback(async (referenceId: string) => {
    const res = await invoke<AccessResult>("drive-check-access", { drive_reference_id: referenceId });
    if (res) setAccess((a) => ({ ...a, [referenceId]: res }));
    return res;
  }, []);

  const grantAccess = async (referenceId: string, emails: string[], role: "reader" | "commenter" | "writer") => {
    const res = await invoke<{ results: { email: string; ok: boolean; error?: string }[] }>("drive-grant-access", {
      drive_reference_id: referenceId,
      emails,
      role,
    });
    if (res) await checkAccess(referenceId);
    return res?.results ?? [];
  };

  const createDoc = async (type: "document" | "spreadsheet" | "presentation", title: string) => {
    const res = await invoke<{ reference: DriveReference; org_name: string; shared_with: string[] }>(
      "drive-create-doc",
      { conversation_id: conversationId, type, title },
    );
    if (res?.reference) setRefs((r) => [...r, res.reference]);
    return res;
  };

  const removeRef = async (referenceId: string) => {
    await supabase.from("drive_references").delete().eq("id", referenceId);
    setRefs((r) => r.filter((x) => x.id !== referenceId));
  };

  return { refs, access, busy, error, reload: load, addFromPicker, addFromUrl, checkAccess, grantAccess, createDoc, removeRef };
}
