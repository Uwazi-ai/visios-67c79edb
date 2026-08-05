import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { isIOS, isStandalone } from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "visi.pwa.installBannerDismissedAt";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < DISMISS_MS;
  } catch {
    return false;
  }
}

export const InstallBanner = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);

    if (isIOS()) {
      // iOS Safari has no beforeinstallprompt — show manual instructions
      setShowIos(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
  }, []);

  if (hidden) return null;
  if (!deferred && !showIos) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setHidden(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setHidden(true);
    else dismiss();
  };

  return (
    <div
      className="fixed left-3 right-3 z-50 glass-elevated flex items-center gap-3 px-3 py-2.5"
      style={{
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        maxWidth: 480,
        margin: "0 auto",
      }}
      role="dialog"
      aria-label="Install Kova"
    >
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)", color: "#fff", fontWeight: 900 }}
      >
        V
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          Install Kova
        </div>
        <div className="t-mono" style={{ fontSize: 10 }}>
          {deferred ? (
            "Quick access from your home screen"
          ) : (
            <>Tap <Share size={10} className="inline -mt-0.5" /> Share → Add to Home Screen</>
          )}
        </div>
      </div>
      {deferred && (
        <button onClick={install} className="btn-primary" style={{ fontSize: 12 }}>
          <Download size={12} /> Install
        </button>
      )}
      <button onClick={dismiss} className="btn-icon" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
};
