import { useState } from "react";
import { X } from "lucide-react";
import type { Opportunity } from "@/hooks/useFundraising";
import { STATUS_OPTIONS, URGENCY_OPTIONS } from "./constants";

interface Props {
  onClose: () => void;
  onCreate: (input: Partial<Opportunity> & { name: string; organization: string }) => void | Promise<void>;
}

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  border: "1px solid #2a2a2a",
  color: "#fff",
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 13,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  fontFamily: "var(--font-mono, monospace)",
  marginBottom: 4,
  display: "block",
};

export function NewOpportunityModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [type, setType] = useState<string>("vc");
  const [entity, setEntity] = useState("UWAZI.AI");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [phase, setPhase] = useState(1);
  const [urgency, setUrgency] = useState<string>("soon");
  const [status, setStatus] = useState<string>("not started");
  const [committed, setCommitted] = useState("");
  const [assigned, setAssigned] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !organization.trim()) return;
    setSubmitting(true);
    await onCreate({
      name: name.trim(),
      organization: organization.trim(),
      type,
      entity: entity.trim() || "UWAZI.AI",
      target_amount: target.trim() || null,
      deadline: deadline.trim() || null,
      phase,
      urgency,
      status,
      committed_amount: Number(committed.replace(/[^0-9.]/g, "")) || 0,
      assigned_to: assigned.trim() || null,
      next_action: nextAction.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-xl rounded-xl flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        style={{ background: "#0e0e0e", border: "1px solid #1e1e1e", padding: 20 }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
            New Opportunity
          </h2>
          <button type="button" onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Organization *</label>
            <input style={inputStyle} value={organization} onChange={(e) => setOrganization(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Entity</label>
            <input style={inputStyle} value={entity} onChange={(e) => setEntity(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
              {["accelerator", "vc", "grant"].map((t) => <option key={t} value={t} style={{ background: "#0e0e0e" }}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phase</label>
            <select style={inputStyle} value={phase} onChange={(e) => setPhase(Number(e.target.value))}>
              {[1, 2, 3, 4].map((p) => <option key={p} value={p} style={{ background: "#0e0e0e" }}>P{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Urgency</label>
            <select style={inputStyle} value={urgency} onChange={(e) => setUrgency(e.target.value)}>
              {URGENCY_OPTIONS.map((u) => <option key={u} value={u} style={{ background: "#0e0e0e" }}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s} style={{ background: "#0e0e0e" }}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Target amount</label>
            <input style={inputStyle} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="$500K" />
          </div>
          <div>
            <label style={labelStyle}>Deadline</label>
            <input style={inputStyle} value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="Jun 15 / Q3 2026" />
          </div>
          <div>
            <label style={labelStyle}>Committed ($)</label>
            <input style={inputStyle} value={committed} onChange={(e) => setCommitted(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={labelStyle}>Assigned to</label>
            <input style={inputStyle} value={assigned} onChange={(e) => setAssigned(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label style={labelStyle}>Next action</label>
            <input style={inputStyle} value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2"
            style={{ background: "#1a1a1a", color: "#fff", fontSize: 13, border: "1px solid #2a2a2a" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !organization.trim()}
            className="rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
            style={{ background: "#9bd34b", color: "#0a0a0a", fontSize: 13 }}
          >
            {submitting ? "Adding…" : "Add Opportunity"}
          </button>
        </div>
      </form>
    </div>
  );
}
