import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Mail, Phone, Linkedin, Globe, Download, QrCode as QrIcon, ExternalLink } from "lucide-react";
import { ORG_COLORS } from "@/lib/orgs";
import { downloadVCard } from "@/lib/vcard";

export interface CardData {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
  company: string | null;
  tagline: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  card_theme: string;
  custom_links: Array<{ label: string; url: string }>;
  primary_org_slug: string | null;
}

interface Props {
  data: CardData;
  /** Full URL of this card page (for QR + share). */
  cardUrl?: string;
  /** Compact preview mode (hides QR + powered-by, scales padding). */
  compact?: boolean;
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export const CardPreview = ({ data, cardUrl, compact }: Props) => {
  const orgColor = (data.primary_org_slug && ORG_COLORS[data.primary_org_slug]) || "#6366F1";
  const isLight = data.card_theme === "light";
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!cardUrl) return;
    QRCode.toDataURL(cardUrl, {
      margin: 1,
      width: 240,
      color: { dark: isLight ? "#02020A" : "#FFFFFF", light: "#00000000" },
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [cardUrl, isLight]);

  const downloadQr = async () => {
    if (!cardUrl) return;
    const dataUrl = await QRCode.toDataURL(cardUrl, {
      margin: 2, width: 1024, color: { dark: "#02020A", light: "#FFFFFF" },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${data.username || "visi-card"}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const saveContact = () => {
    if (!data.display_name) return;
    downloadVCard({
      name: data.display_name,
      title: data.title,
      company: data.company,
      email: data.email,
      phone: data.phone,
      website: data.website_url,
      linkedin: data.linkedin_url,
    });
  };

  const bgGradient = isLight
    ? `linear-gradient(160deg, #F8FAFC 0%, #E2E8F0 60%, ${orgColor}22 100%)`
    : `linear-gradient(160deg, #02020A 0%, #0B1020 50%, ${orgColor}33 100%)`;

  const fg = isLight ? "#0F172A" : "#F8FAFC";
  const fgMuted = isLight ? "#475569" : "rgba(248,250,252,0.65)";
  const surfaceBorder = isLight ? "rgba(15,23,42,0.08)" : "rgba(255,255,255,0.08)";
  const surfaceBg = isLight ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.04)";
  const pad = compact ? 18 : 28;

  return (
    <div
      style={{
        background: bgGradient,
        color: fg,
        padding: pad,
        borderRadius: compact ? 22 : 0,
        minHeight: compact ? "auto" : "100%",
        display: "flex",
        flexDirection: "column",
        gap: compact ? 14 : 22,
        fontFamily: "Satoshi, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* Header: avatar + identity */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
        {data.avatar_url ? (
          <img
            src={data.avatar_url}
            alt={data.display_name ?? ""}
            width={compact ? 80 : 112}
            height={compact ? 80 : 112}
            style={{
              borderRadius: "50%", objectFit: "cover",
              border: `3px solid ${orgColor}`,
              boxShadow: `0 12px 40px ${orgColor}55`,
            }}
          />
        ) : (
          <div
            style={{
              width: compact ? 80 : 112, height: compact ? 80 : 112, borderRadius: "50%",
              background: `linear-gradient(135deg, ${orgColor}, ${orgColor}88)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: compact ? 28 : 40, fontWeight: 800,
              boxShadow: `0 12px 40px ${orgColor}55`,
            }}
          >
            {initialsOf(data.display_name)}
          </div>
        )}
        <div>
          <div style={{ fontSize: compact ? 20 : 26, fontWeight: 700, lineHeight: 1.15, fontFamily: "Monument Grotesk, Satoshi, sans-serif" }}>
            {data.display_name || "Unnamed"}
          </div>
          {(data.title || data.company) && (
            <div style={{ fontSize: compact ? 12 : 14, color: fgMuted, marginTop: 4 }}>
              {data.title}{data.title && data.company ? " · " : ""}{data.company}
            </div>
          )}
          {data.primary_org_slug && (
            <div
              style={{
                display: "inline-flex", marginTop: 10, padding: "4px 10px", borderRadius: 999,
                background: `${orgColor}22`, color: orgColor, border: `1px solid ${orgColor}55`,
                fontSize: 10, fontFamily: "JetBrains Mono, monospace", letterSpacing: 0.5, textTransform: "uppercase",
              }}
            >
              {data.primary_org_slug.toUpperCase()}
            </div>
          )}
          {data.tagline && (
            <div style={{ marginTop: 12, fontSize: compact ? 12 : 13, color: fgMuted, lineHeight: 1.5, maxWidth: 340 }}>
              {data.tagline}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {data.email && (
          <ActionBtn href={`mailto:${data.email}`} icon={<Mail size={14} />} label="Email" color={orgColor} fg={fg} bg={surfaceBg} border={surfaceBorder} />
        )}
        {data.phone && (
          <ActionBtn href={`tel:${data.phone}`} icon={<Phone size={14} />} label="Call" color={orgColor} fg={fg} bg={surfaceBg} border={surfaceBorder} />
        )}
        {data.linkedin_url && (
          <ActionBtn href={data.linkedin_url} icon={<Linkedin size={14} />} label="LinkedIn" color={orgColor} fg={fg} bg={surfaceBg} border={surfaceBorder} />
        )}
        {data.website_url && (
          <ActionBtn href={data.website_url} icon={<Globe size={14} />} label="Website" color={orgColor} fg={fg} bg={surfaceBg} border={surfaceBorder} />
        )}
      </div>

      {/* Save to contacts (primary) */}
      <button
        onClick={saveContact}
        disabled={!data.display_name}
        style={{
          padding: "12px 14px", borderRadius: 12, border: "none",
          background: orgColor, color: "#fff", fontWeight: 600, fontSize: 14,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          boxShadow: `0 8px 28px ${orgColor}55`,
        }}
      >
        <Download size={14} /> Save to Contacts
      </button>

      {/* Custom links */}
      {data.custom_links && data.custom_links.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.custom_links.slice(0, 5).map((l, i) => (
            <a
              key={i} href={l.url} target="_blank" rel="noopener noreferrer"
              style={{
                padding: "10px 14px", borderRadius: 10,
                background: surfaceBg, border: `1px solid ${surfaceBorder}`,
                color: fg, textDecoration: "none", fontSize: 13,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span>{l.label || l.url}</span>
              <ExternalLink size={12} style={{ color: fgMuted }} />
            </a>
          ))}
        </div>
      )}

      {/* QR + powered by */}
      {!compact && cardUrl && (
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {qrDataUrl && (
            <div style={{
              padding: 10, borderRadius: 14, background: surfaceBg, border: `1px solid ${surfaceBorder}`,
            }}>
              <img src={qrDataUrl} alt="QR code for this card" width={140} height={140} />
            </div>
          )}
          <button
            onClick={downloadQr}
            style={{
              padding: "6px 12px", borderRadius: 999, border: `1px solid ${surfaceBorder}`,
              background: "transparent", color: fgMuted, fontSize: 11, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <QrIcon size={11} /> Download QR
          </button>
          <div style={{ fontSize: 10, color: fgMuted, marginTop: 6, fontFamily: "JetBrains Mono, monospace" }}>
            Powered by Visi OS
          </div>
        </div>
      )}

      {/* hidden canvas for download fallback */}
      <canvas ref={qrCanvasRef} style={{ display: "none" }} />
    </div>
  );
};

const ActionBtn = ({ href, icon, label, color, fg, bg, border }: { href: string; icon: React.ReactNode; label: string; color: string; fg: string; bg: string; border: string }) => (
  <a
    href={href}
    target={href.startsWith("http") ? "_blank" : undefined}
    rel="noopener noreferrer"
    style={{
      padding: "10px 12px", borderRadius: 10, background: bg, border: `1px solid ${border}`,
      color: fg, textDecoration: "none", fontSize: 13, fontWeight: 500,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    }}
  >
    <span style={{ color }}>{icon}</span> {label}
  </a>
);
