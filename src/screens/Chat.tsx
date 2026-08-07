import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import "@/design/chat.css";
import { Button, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import { ProposalDrawer, agentLabel } from "@/components/dashboard/ProposalDrawer";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { useVisionChat, type ChatMessage } from "@/hooks/useVisionChat";
import type { PendingProposal } from "@/hooks/useDashboardSummary";

/**
 * Chat — the conversational surface of Vision by Kova.
 *
 * Two things are load-bearing and neither is prompt wording:
 *  · the answer is grounded in the operator's own rows, and says which ones
 *  · every side effect stops at a proposal card and waits for a person
 *
 * The product is never named after the model that runs it.
 */

const STARTERS = [
  "What needs me today?",
  "Where am I the bottleneck this week?",
  "Draft a reply to the last thing that came in",
  "What did I say I'd do and haven't?",
];

const REF_LABEL: Record<string, string> = {
  mail: "mail",
  event: "calendar",
  task: "task",
  proposal: "proposal",
  contact: "contact",
  org: "organization",
};

const ContextChips = ({ refs }: { refs: ChatMessage["context_refs"] }) => {
  const [open, setOpen] = useState(false);
  if (!refs?.length) return null;
  const counts = refs.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = (acc[r.kind] ?? 0) + 1;
    return acc;
  }, {});
  return (
    <div className="vc-ctx">
      <button type="button" className="vc-ctx-toggle" onClick={() => setOpen((o) => !o)}>
        Read {refs.length} record{refs.length === 1 ? "" : "s"} ·{" "}
        {Object.entries(counts)
          .map(([k, n]) => `${n} ${REF_LABEL[k] ?? k}`)
          .join(", ")}
      </button>
      {open ? (
        <ul className="vc-ctx-list">
          {refs.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <span className="vc-ctx-kind">{REF_LABEL[r.kind] ?? r.kind}</span>
              {r.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

/** Proposed, not done. Dashed until a person commits it. */
const ProposalCard = ({
  proposal,
  onReview,
  onDismiss,
}: {
  proposal: PendingProposal & { status?: string };
  onReview: () => void;
  onDismiss: () => void;
}) => {
  const decided = proposal.status && proposal.status !== "pending";
  return (
    <div className="vc-prop" data-decided={decided ? "true" : undefined}>
      <div className="vc-prop-head">
        <span className="vc-dot" style={{ background: proposal.identity_color }} />
        <span className="vc-prop-org">{proposal.org_name}</span>
        <span className="ai-mark">
          <span className="ai-dot" aria-hidden />
          {agentLabel(proposal.agent_key)}
        </span>
        <span className="vc-prop-kind">{proposal.kind.replace(/_/g, " ")}</span>
      </div>
      <div className="vc-prop-title">{proposal.title}</div>
      {proposal.rationale ? <p className="vc-prop-why">{proposal.rationale}</p> : null}
      {decided ? (
        <div className="vc-prop-state">
          {proposal.status === "committed" ? "Committed by you" : "Dismissed"}
        </div>
      ) : (
        <div className="vc-prop-actions">
          <Button variant="quiet" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button onClick={onReview}>Review to commit</Button>
        </div>
      )}
    </div>
  );
};

const Chat = () => {
  const { scopeOrgId, orgs } = useWorkspaceScope();
  const scopeName = scopeOrgId ? orgs.find((o) => o.id === scopeOrgId)?.name : null;
  const vc = useVisionChat(scopeOrgId);
  const [draft, setDraft] = useState("");
  const [review, setReview] = useState<PendingProposal | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const active = vc.conversations.find((c) => c.id === vc.activeId) ?? null;
  const personaKey = active?.persona_key ?? "chief_of_staff";
  const personaName =
    vc.personas.find((p) => p.key === personaKey)?.display_name ?? "Chief of Staff";

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [vc.messages, vc.pendingText]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [vc.activeId, vc.streaming]);

  const grouped = useMemo(
    () =>
      vc.conversations.reduce<Record<string, typeof vc.conversations>>((acc, c) => {
        const day = new Date(c.last_message_at).toDateString();
        (acc[day] ??= []).push(c);
        return acc;
      }, {}),
    [vc.conversations],
  );

  const ask = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    let id = vc.activeId;
    if (!id) {
      const convo = await vc.newConversation(personaKey);
      if (!convo) return;
      id = convo.id;
    }
    setDraft("");
    await vc.send(id, body);
  };

  return (
    <div>
      <SectionHead
        title="Chat"
        action={
          <Button onClick={() => void vc.newConversation(personaKey)} variant="quiet">
            <Plus size={14} strokeWidth={1.75} aria-hidden /> New conversation
          </Button>
        }
      />

      <div className="vc-grid">
        <aside className="vc-rail">
          <div className="vc-rail-head">
            <Eyebrow>{scopeName ?? "All organizations"}</Eyebrow>
          </div>
          {vc.conversations.length === 0 ? (
            <p className="vc-rail-empty">
              No conversations in {scopeName ?? "any organization"} yet.
            </p>
          ) : null}
          {Object.entries(grouped).map(([day, list]) => (
            <div key={day} className="vc-rail-group">
              <div className="vc-rail-day">{day}</div>
              {list.map((c) => (
                <div
                  key={c.id}
                  className="vc-rail-row"
                  data-active={c.id === vc.activeId ? "true" : undefined}
                >
                  <button type="button" className="vc-rail-btn" onClick={() => vc.setActiveId(c.id)}>
                    <span className="vc-rail-title">{c.title ?? "New conversation"}</span>
                    <span className="vc-rail-meta">
                      {vc.personas.find((p) => p.key === c.persona_key)?.display_name ?? c.persona_key}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="vc-rail-del"
                    aria-label={`Archive ${c.title ?? "conversation"}`}
                    onClick={() => vc.archive(c.id)}
                  >
                    <Trash2 size={13} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </aside>

        <section className="vc-pane">
          <header className="vc-head">
            <div>
              <div className="vc-head-title">
                <span className="ai-mark">
                  <span className="ai-dot" aria-hidden />
                  Vision
                </span>
                <span className="vc-head-persona">{personaName}</span>
              </div>
              <div className="vc-head-meta">
                Reading {scopeName ?? "every organization you belong to"}. Vision proposes; you
                commit.
              </div>
            </div>
            <label className="vc-persona-pick">
              <span className="vc-visually-hidden">Persona</span>
              <select
                value={personaKey}
                onChange={(e) => {
                  if (active) vc.setPersona(active.id, e.target.value);
                  else vc.newConversation(e.target.value);
                }}
              >
                {vc.personas.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </label>
          </header>

          <div className="vc-feed" ref={feedRef}>
            {vc.messages.length === 0 && !vc.streaming ? (
              <div className="vc-empty">
                <Eyebrow>Nothing asked yet</Eyebrow>
                <Desc>
                  Ask across {scopeName ?? "every organization you run"}. Vision answers from your
                  mail, calendar, tasks and contacts — and names the records it read, so you can
                  check the reading rather than trust the sentence.
                </Desc>
                <div className="vc-starters">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" className="vc-starter" onClick={() => ask(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {vc.messages.map((m) => (
              <article key={m.id} className="vc-msg" data-role={m.role}>
                <div className="vc-avatar" data-role={m.role} aria-hidden>
                  {m.role === "user" ? "You" : "V"}
                </div>
                <div className="vc-body">
                  {m.role === "assistant" ? <ContextChips refs={m.context_refs} /> : null}
                  <p className="vc-text">{m.content}</p>
                  {(m.proposal_ids ?? []).map((pid) =>
                    vc.proposals[pid] ? (
                      <ProposalCard
                        key={pid}
                        proposal={vc.proposals[pid] as PendingProposal & { status?: string }}
                        onReview={() => setReview(vc.proposals[pid])}
                        onDismiss={() => vc.dismissProposal(pid)}
                      />
                    ) : null,
                  )}
                  {m.error ? <div className="vc-err">{m.error}</div> : null}
                </div>
              </article>
            ))}

            {vc.streaming ? (
              <article className="vc-msg" data-role="assistant">
                <div className="vc-avatar" data-role="assistant" aria-hidden>
                  V
                </div>
                <div className="vc-body">
                  {vc.pendingRefs.length ? <ContextChips refs={vc.pendingRefs} /> : null}
                  <p className="vc-text">
                    {vc.pendingText || <span className="vc-thinking">Reading your records…</span>}
                  </p>
                </div>
              </article>
            ) : null}

            {vc.error ? <div className="vc-err">{vc.error}</div> : null}
          </div>

          <form
            className="vc-composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <textarea
              ref={inputRef}
              className="vc-input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              placeholder={`Ask ${personaName} about ${scopeName ?? "any of your organizations"}…`}
              aria-label="Ask Vision"
            />
            <div className="vc-composer-foot">
              {vc.streaming ? (
                <Button variant="quiet" onClick={vc.stop}>
                  Stop
                </Button>
              ) : null}
              <Button onClick={() => ask(draft)} disabled={!draft.trim() || vc.streaming}>
                Ask
              </Button>
            </div>
          </form>
        </section>
      </div>

      {review ? (
        <ProposalDrawer
          proposal={review}
          onClose={() => setReview(null)}
          onCommit={async (id) => {
            await vc.commitProposal(id);
            setReview(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default Chat;
