import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Opportunity } from "@/hooks/useFundraising";
import { STATUS_COLOR, STATUS_OPTIONS, TYPE_COLOR, URGENCY_COLOR, URGENCY_OPTIONS } from "./constants";

interface Props {
  opp: Opportunity;
  onUpdate: (patch: Partial<Opportunity>) => void;
  onAddTask: () => void;
  onDelete?: () => void;
}

function EditableText({
  value, onSave, multiline, placeholder,
}: { value: string | null; onSave: (v: string) => void; multiline?: boolean; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing) {
    const Tag: any = multiline ? "textarea" : "input";
    return (
      <Tag
        autoFocus
        value={draft}
        onChange={(e: any) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== (value ?? "")) onSave(draft); }}
        onKeyDown={(e: any) => {
          if (e.key === "Enter" && !multiline) { e.currentTarget.blur(); }
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        className="w-full rounded px-1.5 py-1 text-sm outline-none"
        style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff", resize: "vertical", minHeight: multiline ? 60 : "auto" }}
      />
    );
  }
  return (
    <div
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="cursor-text rounded px-1.5 py-1 text-sm hover:bg-white/5 min-h-[26px]"
      style={{ color: value ? "#fff" : "var(--text-muted)" }}
    >
      {value || placeholder || "—"}
    </div>
  );
}

export function OpportunityCard({ opp, onUpdate, onAddTask, onDelete }: Props) {
  const declined = opp.status === "declined";
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: "#0e0e0e",
        border: `1px solid ${opp.status === "awarded" ? "#9bd34b" : "#1e1e1e"}`,
        opacity: declined ? 0.5 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="t-mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>#{opp.order_num}</span>
          <span
            className="rounded-full px-2 py-0.5"
            style={{
              background: `${TYPE_COLOR[opp.type]}22`,
              color: TYPE_COLOR[opp.type],
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {opp.type}
          </span>
          <select
            value={opp.phase}
            onChange={(e) => onUpdate({ phase: Number(e.target.value) })}
            className="rounded-full px-2 py-0.5 cursor-pointer"
            style={{ background: "#1a1a1a", color: "#fff", fontSize: 10, fontWeight: 500, border: "1px solid #2a2a2a" }}
          >
            {[1, 2, 3, 4].map((p) => <option key={p} value={p} style={{ background: "#0e0e0e" }}>P{p}</option>)}
          </select>
          <select
            value={opp.type}
            onChange={(e) => onUpdate({ type: e.target.value })}
            className="rounded-full px-2 py-0.5 cursor-pointer uppercase"
            style={{
              background: `${TYPE_COLOR[opp.type]}22`,
              color: TYPE_COLOR[opp.type],
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
              border: `1px solid ${TYPE_COLOR[opp.type]}55`,
            }}
          >
            {["accelerator", "vc", "grant"].map((t) => <option key={t} value={t} style={{ background: "#0e0e0e", color: "#fff" }}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onAddTask}
            className="rounded px-2 py-1 flex items-center gap-1"
            style={{ background: "#9bd34b22", color: "#9bd34b", fontSize: 11, fontWeight: 600 }}
          >
            <Plus size={12} /> Task
          </button>
          {onDelete && (
            <button
              onClick={() => { if (confirm(`Delete "${opp.name}"?`)) onDelete(); }}
              className="rounded px-1.5 py-1 hover:bg-white/5"
              style={{ color: "#e05252" }}
              title="Delete opportunity"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
          <EditableText value={opp.name} onSave={(v) => onUpdate({ name: v })} placeholder="Name…" />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          <EditableText value={opp.organization} onSave={(v) => onUpdate({ organization: v })} placeholder="Organization…" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>Entity</div>
          <EditableText value={opp.entity} onSave={(v) => onUpdate({ entity: v })} placeholder="Entity…" />
        </div>
        <div>
          <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>Target</div>
          <EditableText value={opp.target_amount} onSave={(v) => onUpdate({ target_amount: v })} placeholder="$…" />
        </div>
        <div className="col-span-2">
          <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>Deadline</div>
          <EditableText value={opp.deadline} onSave={(v) => onUpdate({ deadline: v })} placeholder="e.g. Jun 15 or Q3 2026" />
        </div>
        <div className="col-span-2">
          <div className="t-mono uppercase" style={{ fontSize: 9, color: "var(--text-muted)" }}>Committed ($)</div>
          <EditableText
            value={opp.committed_amount ? String(opp.committed_amount) : ""}
            onSave={(v) => onUpdate({ committed_amount: Number(v.replace(/[^0-9.]/g, "")) || 0 })}
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={opp.status}
          onChange={(e) => onUpdate({ status: e.target.value })}
          className="rounded px-2 py-1 text-xs font-medium"
          style={{
            background: `${STATUS_COLOR[opp.status]}22`,
            color: STATUS_COLOR[opp.status],
            border: `1px solid ${STATUS_COLOR[opp.status]}55`,
          }}
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ background: "#0e0e0e", color: "#fff" }}>{s}</option>)}
        </select>
        <select
          value={opp.urgency}
          onChange={(e) => onUpdate({ urgency: e.target.value })}
          className="rounded px-2 py-1 text-xs"
          style={{ background: "#1a1a1a", color: "#fff", border: "1px solid #2a2a2a" }}
        >
          {URGENCY_OPTIONS.map((u) => <option key={u} value={u} style={{ background: "#0e0e0e" }}>{u}</option>)}
        </select>
      </div>

      <div>
        <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>Assigned</div>
        <EditableText value={opp.assigned_to} onSave={(v) => onUpdate({ assigned_to: v })} placeholder="Assign…" />
      </div>

      <div>
        <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>Next Action</div>
        <EditableText value={opp.next_action} onSave={(v) => onUpdate({ next_action: v })} placeholder="Add next step…" />
      </div>

      <div>
        <div className="t-mono uppercase mb-1" style={{ fontSize: 9, color: "var(--text-muted)" }}>Notes</div>
        <EditableText value={opp.notes} onSave={(v) => onUpdate({ notes: v })} multiline placeholder="Add notes…" />
      </div>

      {opp.committed_amount > 0 && (
        <div
          className="rounded px-2 py-1.5 text-center"
          style={{ background: "#9bd34b22", color: "#9bd34b", fontSize: 12, fontWeight: 700 }}
        >
          Committed: ${Number(opp.committed_amount).toLocaleString()}
        </div>
      )}
    </div>
  );
}
