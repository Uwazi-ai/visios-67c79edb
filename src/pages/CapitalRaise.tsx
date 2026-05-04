import { useMemo, useState } from "react";
import { useFundraising, type Opportunity } from "@/hooks/useFundraising";
import { StatsBar } from "@/components/fundraising/StatsBar";
import { TimelineStrip } from "@/components/fundraising/TimelineStrip";
import { FilterBar, type FilterState } from "@/components/fundraising/FilterBar";
import { OpportunityCard } from "@/components/fundraising/OpportunityCard";
import { TasksPanel } from "@/components/fundraising/TasksPanel";
import { toast } from "@/hooks/use-toast";

const ACTIVE_SET = new Set(["researching", "drafting", "applied", "in review"]);

export default function CapitalRaise() {
  const { opportunities, tasks, loading, updateOpportunity, createTask, updateTask, deleteTask } = useFundraising();
  const [filters, setFilters] = useState<FilterState>({ type: "all", phase: "all", entity: "all", status: "all", sort: "order" });

  const entities = useMemo(() => Array.from(new Set(opportunities.map((o) => o.entity))), [opportunities]);

  const visible = useMemo(() => {
    let list = opportunities.slice();
    if (filters.type !== "all") list = list.filter((o) => o.type === filters.type);
    if (filters.phase !== "all") list = list.filter((o) => String(o.phase) === filters.phase);
    if (filters.entity !== "all") list = list.filter((o) => o.entity === filters.entity);
    if (filters.status !== "all") {
      list = list.filter((o) => {
        if (filters.status === "active") return ACTIVE_SET.has(o.status);
        return o.status === filters.status;
      });
    }
    list.sort((a, b) => {
      // declined sinks
      if ((a.status === "declined") !== (b.status === "declined")) return a.status === "declined" ? 1 : -1;
      switch (filters.sort) {
        case "deadline": return (a.deadline ?? "").localeCompare(b.deadline ?? "");
        case "amount": return (a.target_amount ?? "").localeCompare(b.target_amount ?? "");
        case "phase": return a.phase - b.phase || a.order_num - b.order_num;
        default: return a.order_num - b.order_num;
      }
    });
    return list;
  }, [opportunities, filters]);

  const handleStatusChange = async (opp: Opportunity, patch: Partial<Opportunity>) => {
    if (patch.status && patch.status !== opp.status) {
      const newStatus = patch.status as string;
      if (newStatus === "applied") {
        await updateOpportunity(opp.id, patch);
        if (confirm(`Add follow-up task for "${opp.name}" in 14 days?`)) {
          const due = new Date(); due.setDate(due.getDate() + 14);
          await createTask({
            opportunity_id: opp.id,
            title: `Follow up on ${opp.name}`,
            due_at: due.toISOString(),
            assigned_to: opp.assigned_to,
          });
          toast({ title: "Follow-up task created" });
        }
        return;
      }
      if (newStatus === "awarded") {
        const amtStr = prompt(`Amount committed by ${opp.name}? (USD)`, "0");
        const amt = Number((amtStr ?? "0").replace(/[^0-9.]/g, "")) || 0;
        await updateOpportunity(opp.id, { ...patch, committed_amount: amt });
        // simple confetti burst
        burstConfetti();
        toast({ title: "🎉 Awarded!", description: `${opp.name} — $${amt.toLocaleString()}` });
        return;
      }
    }
    await updateOpportunity(opp.id, patch);
  };

  const handleAddTask = async (opp: Opportunity) => {
    const title = prompt("Task title", opp.next_action ?? `Work on ${opp.name}`);
    if (!title) return;
    const dueStr = prompt("Due date (YYYY-MM-DD, optional)", "");
    const assignee = prompt("Assigned to", opp.assigned_to ?? "") ?? null;
    await createTask({
      opportunity_id: opp.id,
      title,
      due_at: dueStr ? new Date(dueStr).toISOString() : null,
      assigned_to: assignee,
    });
    toast({ title: "Task added" });
  };

  return (
    <div className="min-h-screen p-4 md:p-6 flex flex-col gap-5" style={{ background: "#080808" }}>
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="t-mono uppercase" style={{ fontSize: 10, color: "#9bd34b", letterSpacing: "0.1em" }}>UWAZI.AI · Fundraising</div>
          <h1 className="font-display mt-1" style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
            Capital Raise
          </h1>
        </div>
      </header>

      <StatsBar opps={opportunities} />
      <TimelineStrip opps={opportunities} />

      <FilterBar value={filters} onChange={setFilters} entities={entities} />

      {loading ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((o) => (
            <OpportunityCard
              key={o.id}
              opp={o}
              onUpdate={(patch) => handleStatusChange(o, patch)}
              onAddTask={() => handleAddTask(o)}
            />
          ))}
        </div>
      )}

      <TasksPanel tasks={tasks} opps={opportunities} onUpdate={updateTask} onDelete={deleteTask} />
    </div>
  );
}

function burstConfetti() {
  const colors = ["#9bd34b", "#a78bfa", "#5b9cf6", "#e5b84a"];
  const root = document.createElement("div");
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(root);
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    const size = 6 + Math.random() * 6;
    el.style.cssText = `position:absolute;left:50%;top:40%;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:2px;transform:translate(-50%,-50%);transition:transform 1.4s cubic-bezier(.2,.7,.2,1),opacity 1.4s;`;
    root.appendChild(el);
    requestAnimationFrame(() => {
      const x = (Math.random() - 0.5) * window.innerWidth;
      const y = (Math.random() - 0.2) * window.innerHeight;
      const r = (Math.random() - 0.5) * 720;
      el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`;
      el.style.opacity = "0";
    });
  }
  setTimeout(() => root.remove(), 1600);
}
