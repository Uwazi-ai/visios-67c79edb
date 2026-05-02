// Background enrichment: pulls recent Gmail threads + Calendar events and
// upserts contact_interactions for any matching contact in the active org(s).
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ContactRow {
  id: string;
  email: string | null;
  org_id: string | null;
}

interface UseEnrichmentOptions {
  contacts: ContactRow[];
  enabled: boolean;
  onComplete?: () => void;
}

interface State {
  syncing: boolean;
  syncedAt: Date | null;
  error: string | null;
}

const lowerEmail = (e?: string | null) => (e ? e.toLowerCase().trim() : "");

export function useContactEnrichment({ contacts, enabled, onComplete }: UseEnrichmentOptions) {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ syncing: false, syncedAt: null, error: null });
  const ranOnce = useRef(false);

  useEffect(() => {
    if (!user || !enabled || ranOnce.current || contacts.length === 0) return;
    ranOnce.current = true;
    let cancelled = false;

    (async () => {
      setState({ syncing: true, syncedAt: null, error: null });
      try {
        // Build email → contact map (only contacts that have an email)
        const map = new Map<string, ContactRow>();
        contacts.forEach((c) => {
          const e = lowerEmail(c.email);
          if (e) map.set(e, c);
        });

        const now = new Date();
        const past = new Date(now);
        past.setDate(past.getDate() - 30);
        const future = new Date(now);
        future.setDate(future.getDate() + 30);

        // Fire both fetches in parallel; tolerate either failing.
        const [gmailRes, calRes] = await Promise.allSettled([
          supabase.functions.invoke("gmail-list-threads"),
          supabase.functions.invoke("calendar-list-events", {
            body: { timeMin: past.toISOString(), timeMax: future.toISOString() },
          }),
        ]);

        type Inter = {
          contact_id: string;
          org_id: string | null;
          type: "email" | "meeting";
          title: string;
          summary: string | null;
          occurred_at: string;
          source: string;
          external_id: string;
        };
        const interactions: Inter[] = [];
        const lastTouch = new Map<string, string>(); // contact_id → ISO

        if (gmailRes.status === "fulfilled" && gmailRes.value?.data?.threads) {
          for (const t of gmailRes.value.data.threads as Array<{
            id: string; fromEmail: string; subject: string; snippet: string; date: string;
          }>) {
            const c = map.get(lowerEmail(t.fromEmail));
            if (!c) continue;
            const occurred = t.date ? new Date(t.date).toISOString() : new Date().toISOString();
            interactions.push({
              contact_id: c.id,
              org_id: c.org_id,
              type: "email",
              title: t.subject || "(no subject)",
              summary: t.snippet || null,
              occurred_at: occurred,
              source: "gmail",
              external_id: t.id,
            });
            const prev = lastTouch.get(c.id);
            if (!prev || occurred > prev) lastTouch.set(c.id, occurred);
          }
        }

        if (calRes.status === "fulfilled" && calRes.value?.data?.events) {
          for (const e of calRes.value.data.events as Array<{
            id: string; summary: string; start: string; attendees: string[]; description?: string;
          }>) {
            const attendees = e.attendees ?? [];
            const matched = new Set<ContactRow>();
            for (const a of attendees) {
              const c = map.get(lowerEmail(a));
              if (c) matched.add(c);
            }
            if (matched.size === 0) continue;
            const occurred = e.start ? new Date(e.start).toISOString() : new Date().toISOString();
            for (const c of matched) {
              interactions.push({
                contact_id: c.id,
                org_id: c.org_id,
                type: "meeting",
                title: e.summary || "(no title)",
                summary: e.description?.slice(0, 280) ?? null,
                occurred_at: occurred,
                source: "calendar",
                external_id: e.id,
              });
              // only update last_touched_at for past meetings
              if (occurred <= now.toISOString()) {
                const prev = lastTouch.get(c.id);
                if (!prev || occurred > prev) lastTouch.set(c.id, occurred);
              }
            }
          }
        }

        if (interactions.length > 0) {
          await supabase
            .from("contact_interactions")
            .upsert(interactions, { onConflict: "contact_id,source,external_id", ignoreDuplicates: false });
        }

        // Patch last_touched_at where the new max is more recent
        for (const [cid, iso] of lastTouch) {
          await supabase
            .from("contacts")
            .update({ last_touched_at: iso })
            .eq("id", cid)
            .or(`last_touched_at.is.null,last_touched_at.lt.${iso}`);
        }

        if (!cancelled) {
          setState({ syncing: false, syncedAt: new Date(), error: null });
          onComplete?.();
        }
      } catch (e) {
        if (!cancelled) {
          setState({ syncing: false, syncedAt: null, error: e instanceof Error ? e.message : "Sync failed" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, enabled, contacts.length]);

  return state;
}
