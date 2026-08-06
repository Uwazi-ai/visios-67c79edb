import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, Clock, Loader2, Calendar as CalIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VisiLogo } from "@/components/visi/Logo";

interface Slot { id: string; start_at: string; end_at: string }
interface Lookup {
  link: {
    id: string;
    token: string;
    title: string;
    description: string | null;
    duration_mins: number;
    location: string | null;
    status: string;
    invitee_name: string | null;
    invitee_email: string | null;
    booked_slot_id: string | null;
    booked_at: string | null;
    meet_link: string | null;
  };
  host: { id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  slots: Slot[];
  org: { name: string; color: string } | null;
}

const ContactMeetPublic = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ start: string; meetLink: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      if (!token || token.startsWith(":")) {
        setError("This page needs a real booking link, e.g. /meet/abc123.");
        setLoading(false);
        return;
      }
      try {
        const { data: res, error: e } = await supabase.functions.invoke("contact-link-lookup", { body: { token } });
        if (e) throw e;
        if ((res as { error?: string }).error) throw new Error((res as { error?: string }).error);
        const lk = res as Lookup;
        setData(lk);
        if (lk.link.invitee_name) setName(lk.link.invitee_name);
        if (lk.link.invitee_email) setEmail(lk.link.invitee_email);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load this link");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function submit() {
    if (!data || !picked || !name || !email) return;
    setSubmitting(true);
    try {
      const { data: res, error: e } = await supabase.functions.invoke("contact-link-confirm", {
        body: { token, slotId: picked.id, inviteeName: name, inviteeEmail: email },
      });
      if (e) throw e;
      const r = res as { ok?: boolean; error?: string; meetLink?: string | null; start?: string };
      if (r.error) throw new Error(r.error);
      setConfirmation({ start: r.start ?? picked.start_at, meetLink: r.meetLink ?? null });
    } catch (err) {
      alert(`Could not confirm: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin" /></div>
      ) : error || !data ? (
        <div className="glass p-8 text-center max-w-md mx-auto">
          <div className="t-section mb-2">Link not found</div>
          <div className="t-body">{error ?? "This booking link is no longer active."}</div>
        </div>
      ) : confirmation ? (
        <div className="glass-elevated p-8 text-center max-w-md mx-auto">
          <div className="mx-auto mb-4 inline-flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
            <Check size={28} style={{ color: "var(--sev-success)" }} />
          </div>
          <div className="t-hero mb-3" style={{ fontSize: 28 }}>You're booked!</div>
          <div className="t-body mb-1">{data.link.title}</div>
          <div className="t-mono mb-4" style={{ fontSize: 12 }}>
            {new Date(confirmation.start).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </div>
          {confirmation.meetLink && (
            <a href={confirmation.meetLink} target="_blank" rel="noreferrer" className="btn-primary">Open Google Meet</a>
          )}
          <div className="t-body mt-4" style={{ fontSize: 12 }}>A calendar invite was sent to {email}.</div>
        </div>
      ) : data.link.status !== "open" ? (
        <div className="glass p-8 text-center max-w-md mx-auto">
          <div className="t-section mb-2">Already booked</div>
          <div className="t-body">This time was already chosen. Reach out to {data.host?.display_name ?? "the host"} for another option.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-5 max-w-4xl mx-auto">
          <aside className="glass p-5 h-fit">
            {data.org && (
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3 t-mono"
                style={{ background: `${data.org.color}1F`, border: `1px solid ${data.org.color}66`, color: data.org.color, fontSize: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: data.org.color }} />
                {data.org.name}
              </div>
            )}
            <h1 className="t-hero" style={{ fontSize: 26, lineHeight: 1.05 }}>{data.link.title}</h1>
            <div className="t-mono mt-2 flex items-center gap-3" style={{ fontSize: 11 }}>
              <span className="inline-flex items-center gap-1.5"><Clock size={11} /> {data.link.duration_mins} MIN</span>
            </div>
            {data.link.description && <div className="t-body mt-3">{data.link.description}</div>}
            {data.host && (
              <div className="mt-5 flex items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--border-glass)" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: data.host.avatar_url ? `url(${data.host.avatar_url}) center/cover` : "linear-gradient(135deg, #2563EB, #6366F1)",
                }} />
                <div>
                  <div className="font-display font-bold" style={{ fontSize: 13, color: "var(--text-primary)" }}>{data.host.display_name ?? data.host.username}</div>
                  {data.host.username && <div className="t-mono" style={{ fontSize: 10 }}>@{data.host.username}</div>}
                </div>
              </div>
            )}
          </aside>

          <section className="glass p-5">
            <div className="t-card-title mb-3 flex items-center gap-2"><CalIcon size={12} /> Pick a time</div>
            {data.slots.length === 0 ? (
              <div className="t-body">No times offered yet.</div>
            ) : (
              <div className="space-y-2 mb-4">
                {data.slots.map((s) => {
                  const start = new Date(s.start_at);
                  const isPicked = picked?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setPicked(s)}
                      className={isPicked ? "glass-active w-full text-left p-3" : "glass w-full text-left p-3"}
                      style={{ borderRadius: 8 }}
                    >
                      <div className="font-display font-bold" style={{ fontSize: 13, color: "var(--text-primary)" }}>
                        {start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                      </div>
                      <div className="t-mono" style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {picked && (
              <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--border-glass)" }}>
                <div>
                  <div className="t-mono mb-1" style={{ fontSize: 10 }}>NAME *</div>
                  <input className="input-glass" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <div className="t-mono mb-1" style={{ fontSize: 10 }}>EMAIL *</div>
                  <input type="email" className="input-glass" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <button onClick={submit} disabled={submitting || !name || !email} className="btn-primary w-full">
                  {submitting && <Loader2 size={12} className="animate-spin" />} Confirm booking
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6"><VisiLogo /></div>
        {children}
      </div>
    </div>
  );
}

export default ContactMeetPublic;
