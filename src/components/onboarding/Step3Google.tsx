import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Check, Mail, Calendar } from "lucide-react";

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

export const Step3Google = ({ onNext, onSkip }: Props) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("google_refresh_token")
        .eq("id", user.id)
        .maybeSingle();
      if ((data as any)?.google_refresh_token) setConnected(true);
    })();
  }, [user]);

  const connect = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/onboarding`,
        scopes:
          "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-section mb-1">Connect your email and calendar</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          So Vision can read your inbox and book time on your behalf.
        </p>
      </div>
      <div className="space-y-2">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: "var(--bg-glass-1)" }}
        >
          <Mail size={16} strokeWidth={1.5} />
          <span className="flex-1 text-sm">Gmail</span>
          {connected ? (
            <Check size={16} style={{ color: "#22C55E" }} />
          ) : (
            <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              NOT CONNECTED
            </span>
          )}
        </div>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg"
          style={{ background: "var(--bg-glass-1)" }}
        >
          <Calendar size={16} strokeWidth={1.5} />
          <span className="flex-1 text-sm">Google Calendar</span>
          {connected ? (
            <Check size={16} style={{ color: "#22C55E" }} />
          ) : (
            <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
              NOT CONNECTED
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onSkip}>
          Skip for now
        </Button>
        {connected ? (
          <Button onClick={onNext} style={{ background: "#2563EB", color: "white" }}>
            Continue
          </Button>
        ) : (
          <Button onClick={connect} disabled={busy} style={{ background: "#2563EB", color: "white" }}>
            {busy ? "Connecting…" : "Connect Google Account"}
          </Button>
        )}
      </div>
    </div>
  );
};
