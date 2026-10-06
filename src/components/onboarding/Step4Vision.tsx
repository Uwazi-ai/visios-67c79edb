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
        <h1 className="t-section mb-1">Meet Kova, your AI co-founder</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
          Kova is your AI co-founder across every business you run — keeping the threads
          together, taking on the busywork, and bringing you the decisions that need you.
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
            ✦ KOVA
          </div>
          <p style={{ color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5 }}>
            I'm Kova, your AI co-founder. Tell me what's on your plate. I'll help you
            find the next move, and I'll be straight with you about what I can see.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
        <Button variant="ghost" onClick={onExplore}>
          Explore the workspace
        </Button>
        <Button onClick={onStartVision} style={{ background: "#2563EB", color: "white" }}>
          Start with Kova
        </Button>
      </div>
    </div>
  );
};
