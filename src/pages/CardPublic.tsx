import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CardPreview, type CardData } from "@/components/card/CardPreview";

interface ProfileQuery {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
  company: string | null;
  tagline: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  card_theme: string | null;
  custom_links: unknown;
  primary_org_id: string | null;
}

const CardPublic = () => {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    document.title = `${username ?? "Card"} · Kova`;
  }, [username]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!username) return;
      setLoading(true);
      const { data: profile, error } = await supabase
        .from("profiles_public")
        .select("username, display_name, avatar_url, title, company, tagline, linkedin_url, website_url, card_theme, custom_links, primary_org_id")
        .eq("username", username)
        .maybeSingle();

      if (!active) return;

      if (error || !profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Look up org slug if we have one (uses the safe public view)
      let orgSlug: string | null = null;
      const p = profile as ProfileQuery;
      if (p.primary_org_id) {
        const { data: org } = await supabase
          .from("orgs_public")
          .select("slug")
          .eq("id", p.primary_org_id)
          .maybeSingle();
        orgSlug = (org?.slug as string | undefined) ?? null;
      }

      const links = Array.isArray(p.custom_links) ? (p.custom_links as unknown as Array<{ label: string; url: string }>) : [];

      setData({
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        title: p.title,
        company: p.company,
        tagline: p.tagline,
        email: null,
        phone: null,
        linkedin_url: p.linkedin_url,
        website_url: p.website_url,
        card_theme: p.card_theme || "dark",
        custom_links: links,
        primary_org_slug: orgSlug,
      });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [username]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#02020A", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#02020A", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "Satoshi, sans-serif", padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Card not found</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>This Visi card doesn't exist yet.</div>
        <Link to="/" style={{ marginTop: 12, color: "#6366F1", fontSize: 13 }}>Go to Kova →</Link>
      </div>
    );
  }

  const cardUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div style={{ minHeight: "100vh", background: data.card_theme === "light" ? "#F8FAFC" : "#02020A" }}>
      <div style={{ maxWidth: 460, margin: "0 auto", minHeight: "100vh" }}>
        <CardPreview data={data} cardUrl={cardUrl} />
      </div>
    </div>
  );
};

export default CardPublic;
