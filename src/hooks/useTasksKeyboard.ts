import { useEffect } from "react";

interface Opts {
  onNew: () => void;
  onSearch: () => void;
  onCycleView: () => void;
  onClose: () => void;
}

export function useTasksKeyboard({ onNew, onSearch, onCycleView, onClose }: Opts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable;
      if (e.key === "Escape") { onClose(); return; }
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") { e.preventDefault(); onNew(); }
      else if (e.key === "/") { e.preventDefault(); onSearch(); }
      else if (e.key === "v") { e.preventDefault(); onCycleView(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNew, onSearch, onCycleView, onClose]);
}
