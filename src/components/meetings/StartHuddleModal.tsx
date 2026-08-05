import { useEffect, useMemo, useState } from "react";
import { X, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrgMember {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onStarted?: () => void;
}

export default function StartHuddleModal({ open, onClose, onStarted }: Props) {
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const [name, setName] = useState("Quick Huddle");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("Quick Huddle");
      setSelected(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const { data: myMs } = await supabase
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", user.id);
      const myOrgIds = (myMs ?? []).map((m) => m.org_id);
      const scoped =
        activeOrgId && activeOrgId !== "all"
          ? myOrgIds.filter((id) => id === activeOrgId)
          : myOrgIds;
      if (scoped.length === 0) {
        if (!cancelled) setMembers([]);
        return;
      }
      const { data: ms } = await supabase
        .from("org_memberships")
        .select("user_id")
        .in("org_id", scoped);
      const otherIds = Array.from(
        new Set((ms ?? []).map((r) => r.user_id).filter((id) => id !== user.id)),
      );
      if (otherIds.length === 0) {
        if (!cancelled) setMembers([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", otherIds);
      if (cancelled) return;
      setMembers(
        (profs ?? []).sort((a, b) =>
          (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, activeOrgId]);

  const orgColor = useMemo(() => "#22C55E", []);

  if (!open) return null;

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Huddle name required");
      return;
    }
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 60000);
    const attendees = members.filter((m) => selected.has(m.id)).map((m) => m.email);

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("calendar-create-event", {
        body: {
          summary: name.trim(),
          start: start.toISOString(),
          end: end.toISOString(),
          description: "Started from Kova huddle",
          attendees,
          addMeet: true,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const link = data?.event?.hangoutLink as string | undefined;
      toast.success("Huddle started");
      if (link) window.open(link, "_blank", "noopener,noreferrer");
      onStarted?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start huddle");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md flex flex-col gap-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <Zap size={16} style={{ color: orgColor }} />
          <h2 className="t-section flex-1" style={{ fontSize: 14 }}>Start huddle</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-glass"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="t-mono" style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Invite</label>
          {members.length === 0 ? (
            <div className="t-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              No teammates available in this org.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = selected.has(m.id);
                const name = m.display_name ?? m.email;
                return (
                  <button
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                      background: on ? `${orgColor}1A` : "var(--bg-glass-1)",
                      color: on ? orgColor : "var(--text-muted)",
                      border: `1px solid ${on ? orgColor : "var(--border-glass)"}`,
                      boxShadow: on ? `0 0 16px ${orgColor}55` : "none",
                      transition: "all 0.18s",
                      opacity: on ? 1 : 0.7,
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Creates a Google Meet link instantly
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost" disabled={submitting}>Cancel</button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-1.5"
              style={{
                height: 34,
                padding: "0 16px",
                borderRadius: 8,
                background: orgColor,
                color: "#0A0A0A",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 12,
                boxShadow: `0 0 20px ${orgColor}66`,
              }}
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Start Huddle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
