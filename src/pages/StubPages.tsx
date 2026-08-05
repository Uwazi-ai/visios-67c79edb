import { Link } from "react-router-dom";
import { VisiLogo } from "@/components/visi/Logo";

interface Props { title: string }

const ComingSoon = ({ title }: Props) => {
  return (
    <div style={{ background: "#02020A", color: "white", minHeight: "100vh" }} className="flex flex-col">
      <header className="flex items-center justify-between px-5 md:px-8 h-16" style={{ borderBottom: "1px solid #1a1a2e" }}>
        <Link to="/"><VisiLogo size={28} showWordmark /></Link>
        <Link to="/" className="text-sm" style={{ color: "#9ca3af" }}>← Back home</Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-5">
        <div className="text-center p-10" style={{ background: "#0d0d14", border: "1px solid #1a1a2e", borderRadius: 16, maxWidth: 480 }}>
          <div style={{ fontFamily: "var(--font-mono, 'JetBrains Mono')", fontSize: 11, color: "#2563EB", letterSpacing: "0.1em" }}>
            COMING SOON
          </div>
          <h1 className="mt-3" style={{ fontFamily: "var(--font-display, 'Monument Extended')", fontSize: 36, letterSpacing: "-0.02em" }}>
            {title}
          </h1>
          <p className="mt-4 text-sm" style={{ color: "#9ca3af" }}>
            We're putting the finishing touches on this page.
          </p>
        </div>
      </main>
      <footer className="px-5 py-5 text-center text-xs" style={{ borderTop: "1px solid #1a1a2e", color: "#6b7280" }}>
        © 2026 Kova · Built by Uwazi.AI
      </footer>
    </div>
  );
};

export const TermsPage = () => <ComingSoon title="Terms of Service" />;
export const PrivacyPage = () => <ComingSoon title="Privacy Policy" />;
export const ChangelogPage = () => <ComingSoon title="Changelog" />;
export const RoadmapPage = () => <ComingSoon title="Roadmap" />;
export const AboutPage = () => <ComingSoon title="About Kova" />;
export const BlogPage = () => <ComingSoon title="Blog" />;

export default ComingSoon;
