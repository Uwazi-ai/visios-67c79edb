import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface Props {
  onStartVision: () => void;
  onExplore: () => void;
}

export const Step4Vision = ({ onStartVision, onExplore }: Props) => {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="t-section mb-1">Meet Vision, your AI Chief of Staff</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Vision manages your team's day. It surfaces what's urgent, keeps everyone
          aligned, and briefs you every morning.
        </p>
      </div>
      <div
        className="flex gap-3 items-start p-4 rounded-xl"
        style={{ background: "#1a1a2e", border: "1px solid var(--border-glass)" }}
      >
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{
            width: 32,
            height: 32,
            background: "rgba(37,99,235,0.18)",
            color: "#2563EB",
          }}
        >
          <Sparkles size={16} strokeWidth={1.5} />
        </div>
        <div>
          <div className="t-mono mb-1" style={{ fontSize: 10, color: "#2563EB" }}>
            ✦ VISION
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5 }}>
            Good morning. Here's what needs your attention today — 3 calendar
            conflicts, 2 high-priority replies, and a contract that's been waiting
            since Tuesday.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onExplore}>
          Explore the workspace
        </Button>
        <Button onClick={onStartVision} style={{ background: "#2563EB", color: "white" }}>
          Start with Vision
        </Button>
      </div>
    </div>
  );
};
