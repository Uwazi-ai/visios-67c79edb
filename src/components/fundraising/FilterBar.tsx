export interface FilterState {
  type: string;
  phase: string;
  entity: string;
  status: string;
  sort: "order" | "deadline" | "amount" | "phase";
}

export function FilterBar({ value, onChange, entities }: {
  value: FilterState;
  onChange: (v: FilterState) => void;
  entities: string[];
}) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => onChange({ ...value, [k]: v });

  const Sel = ({ label, val, opts, onChange }: { label: string; val: string; opts: string[]; onChange: (v: string) => void }) => (
    <div className="flex flex-col gap-1">
      <span className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>{label}</span>
      <select
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md px-2 py-1.5 text-sm"
        style={{ background: "#0e0e0e", border: "1px solid #1e1e1e", color: "#fff", minWidth: 110 }}
      >
        {opts.map((o) => <option key={o} value={o} style={{ background: "#0e0e0e" }}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <Sel label="Type" val={value.type} onChange={(v) => set("type", v)}
        opts={["all", "accelerator", "vc", "grant"]} />
      <Sel label="Phase" val={value.phase} onChange={(v) => set("phase", v)}
        opts={["all", "1", "2", "3", "4"]} />
      <Sel label="Entity" val={value.entity} onChange={(v) => set("entity", v)}
        opts={["all", ...entities]} />
      <Sel label="Status" val={value.status} onChange={(v) => set("status", v)}
        opts={["all", "active", "applied", "awarded", "watching"]} />
      <Sel label="Sort by" val={value.sort} onChange={(v) => set("sort", v as FilterState["sort"])}
        opts={["order", "deadline", "amount", "phase"]} />
    </div>
  );
}
