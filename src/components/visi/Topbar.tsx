import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, Plus, Bell, Menu } from "lucide-react";
import { useOrg } from "@/contexts/OrgContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { VisiLogo } from "./Logo";

const titleFor = (path: string): string => {
  if (path === "/") return "Dashboard";
  return path.slice(1).split("/")[0].replace(/^\w/, (c) => c.toUpperCase());
};

export const Topbar = () => {
  const loc = useLocation();
  const { orgs, activeOrgId } = useOrg();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const title = titleFor(loc.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header
      className="sticky z-40 flex items-center gap-2 px-3 md:px-5"
      style={{
        top: 0,
        height: `calc(56px + var(--safe-top))`,
        paddingTop: "var(--safe-top)",
        background: "rgba(2,2,10,0.72)",
        backdropFilter: "blur(40px)",
        WebkitBackdropFilter: "blur(40px)",
        borderBottom: "1px solid var(--border-glass)",
      }}
    >
      <button
        onClick={() => setDrawerOpen(true)}
        className="md:hidden btn-icon"
        aria-label="Open menu"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>

      <div className="md:hidden flex-1 flex items-center justify-center">
        <VisiLogo size={24} />
      </div>

      <div className="hidden md:flex items-center min-w-0">
        <span className="t-nav truncate" style={{ color: "var(--text-secondary)" }}>
          {activeOrgId === "all" ? "All Orgs" : activeOrg?.name ?? "Kova"}
        </span>
        <span className="slash">/</span>
        <span className="t-nav truncate" style={{ color: "var(--text-primary)" }}>{title}</span>
      </div>

      <div className="hidden md:flex flex-1 max-w-xl mx-auto relative">
        <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input
          className="input-glass"
          placeholder="Search anything…"
          style={{ paddingLeft: 34, paddingRight: 60, height: 36 }}
        />
        <kbd
          className="absolute right-3 top-1/2 -translate-y-1/2 t-mono"
          style={{
            background: "var(--bg-glass-2)", border: "1px solid var(--border-glass)",
            borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "var(--text-muted)",
          }}
        >
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-1 md:gap-2 ml-auto">
        <button className="btn-icon md:hidden" aria-label="Search" style={{ minWidth: 44, minHeight: 44 }}>
          <Search size={18} strokeWidth={1.5} />
        </button>
        <button className="btn-ghost hidden sm:inline-flex" style={{ height: 36, padding: "0 14px" }}>
          <Plus size={14} strokeWidth={1.5} /> Capture
        </button>
        <button className="btn-icon relative" title="Notifications" style={{ minWidth: 44, minHeight: 44 }}>
          <Bell size={18} strokeWidth={1.5} />
        </button>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[280px] border-r-0 [&>button]:hidden"
          style={{ background: "transparent" }}
          onClick={() => setDrawerOpen(false)}
        >
          <Sidebar variant="mobile" />
        </SheetContent>
      </Sheet>
    </header>
  );
};
