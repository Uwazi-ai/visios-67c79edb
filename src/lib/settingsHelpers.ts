import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function saveProfile(userId: string, patch: Record<string, any>, opts?: { silent?: boolean }) {
  const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
  if (error) {
    toast.error(error.message);
    return false;
  }
  if (!opts?.silent) toast.success("Saved ✓");
  return true;
}

export async function savePreferences(userId: string, current: Record<string, any>, patch: Record<string, any>) {
  const merged = { ...(current ?? {}), ...patch };
  return saveProfile(userId, { preferences: merged }, { silent: true });
}

export function debounce<T extends (...a: any[]) => void>(fn: T, ms = 500): T {
  let h: any;
  return ((...args: any[]) => {
    clearTimeout(h);
    h = setTimeout(() => fn(...args), ms);
  }) as T;
}

export async function ensureIntegrationRow(userId: string, provider: string) {
  const { data: existing } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (existing) return existing;
  const { data } = await supabase
    .from("integrations")
    .insert({ user_id: userId, provider, vision_enabled: true, metadata: {} })
    .select()
    .single();
  return data;
}
