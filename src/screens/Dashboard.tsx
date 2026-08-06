import { useMemo, useRef, useState } from "react";
import "@/design/dashboard.css";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { useDashboardSummary, type PendingProposal } from "@/hooks/useDashboardSummary";
import { Button } from "@/components/primitives";
import { ProposalDrawer, agentLabel } from "@/components/dashboard/ProposalDrawer";

/**
 * Dashboard — a triage surface, not a metrics screen.
 *
 * One question, answered above the fold: across everything I run, what needs
 * me right now? The commit queue is first because it is the only module whose
 * work cannot proceed without a person. Everything under it is context.
 *
 * No mock data lives here or in its children. Every number comes from
 * get_dashboard_summary, and every module checks `connections` before it
 * renders a figure — a zero shown to a tenant that never connected anything
 * reads as a broken product.
 */

const time12 = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const Module = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="dsh-mod">
    <h3>{title}</h3>
    {children}
  </section>
);

const Skeleton = ({ h = 16, w = "100%" }: { h?: number; w?: string }) => (
  <div className="dsh-skel" style={{ height: h, width: w }} />
);

const NotConnected = ({ copy, onConnect }: { copy: string; onConnect: () => void }) => (
  <>
    <p>{copy}</p>
    <div>
      <Button variant="quiet" size="sm" onClick={onConnect}>
        Connect
      </Button>
    </div>
  </>
);

const ScopeBar = ({ onNavigate }: { onNavigate: (s: string) => void }) => {
  const { orgs, scopeOrgId, setScope, atOrgLimit, orgLimit, planLabel } = useWorkspaceScope();
  const [open, setOpen] = useState(false);
  const current = orgs.find((o) => o.id === scopeOrgId);

  return (
    <div className="dsh-scopebar">
      <div className="dsh-switch">
        <Button variant="quiet" onClick={() => setOpen((v) => !v)}>
          {current ? current.name : "All Organizations"} ▾
        </Button>
        {open ? (
          <div className="dsh-switch-menu" role="listbox">
            <button
              type="button"
              className="dsh-switch-item"
              role="option"
              aria-checked={scopeOrgId === null}
              onClick={() => {
                setScope(null);
                setOpen(false);
              }}
            >
              <span className="dsh-dot" style={{ background: "var(--a-500)" }} />
              All Organizations
            </button>
            {orgs.map((o) => (
              <button
                key={o.id}
                type="button"
                className="dsh-switch-item"
                role="option"
                aria-checked={scopeOrgId === o.id}
                onClick={() => {
                  setScope(o.id);
                  setOpen(false);
                }}
              >
                <span className="dsh-dot" style={{ background: o.identity_color }} />
                {o.name}
                {o.is_demo ? (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-2)" }}>
                    Demo
                  </span>
                ) : null}
              </button>
            ))}
            <button
              type="button"
              className="dsh-switch-item"
              data-locked={atOrgLimit || undefined}
              disabled={atOrgLimit}
              onClick={() => {
                setOpen(false);
                onNavigate("settings");
              }}
            >
              {atOrgLimit ? "🔒" : "+"} New organization
              {atOrgLimit ? (
                <span style={{ marginLeft: "auto", fontSize: 11 }}>
                  {planLabel} includes {orgLimit}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const Dashboard = ({ navigate }: { navigate?: (screen: string) => void }) => {
  const go = navigate ?? (() => {});
  const { scopeOrgId, orgs } = useWorkspaceScope();
  const { data, loading, error, refetch } = useDashboardSummary(scopeOrgId);

  const [open, setOpen] = useState<PendingProposal | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  const undoTimer = useRef<number | null>(null);

  const proposals = useMemo(
    () => (data?.pending_proposals ?? []).filter((p) => !hidden.includes(p.id)),
    [data, hidden],
  );

  const orgsSpanned = useMemo(
    () => new Set(proposals.map((p) => p.org_id)).size,
    [proposals],
  );

  const anythingConnected = (data?.connections.total ?? 0) > 0;

  const dismiss = async (p: PendingProposal) => {
    setHidden((h) => [...h, p.id]);
    setUndo({ id: p.id, title: p.title });
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from("proposals")
      .update({
        status: "dismissed",
        decided_at: new Date().toISOString(),
        decided_by: auth?.user?.id ?? null,
      })
      .eq("id", p.id);

    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => {
      setUndo(null);
      void refetch();
    }, 10000);
  };

  const undoDismiss = async () => {
    if (!undo) return;
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    await supabase
      .from("proposals")
      .update({ status: "pending", decided_at: null, decided_by: null })
      .eq("id", undo.id);
    setHidden((h) => h.filter((x) => x !== undo.id));
    setUndo(null);
    void refetch();
  };

  const commit = async (id: string) => {
    const { data: auth } = await supabase.auth.getUser();
    await supabase
      .from("proposals")
      .update({
        status: "committed",
        decided_at: new Date().toISOString(),
        decided_by: auth?.user?.id ?? null,
      })
      .eq("id", id);
    setOpen(null);
    setHidden((h) => [...h, id]);
    void refetch();
  };

  if (error) {
    return (
      <div className="dsh">
        <ScopeBar onNavigate={go} />
        <div className="dsh-err">
          <span>The dashboard could not be loaded. Switch organization or try again.</span>
          <Button variant="quiet" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const scopeName = orgs.find((o) => o.id === scopeOrgId)?.name;

  return (
    <div className="dsh">
      <ScopeBar onNavigate={go} />

      <div className="dsh-greet">
        <h1>Good morning.</h1>
        {loading ? (
          <div style={{ marginTop: 8 }}>
            <Skeleton h={14} w="320px" />
          </div>
        ) : (
          <p>
            {proposals.length === 0
              ? scopeName
                ? `Nothing waiting on you in ${scopeName}.`
                : "Nothing waiting on you across your organizations."
              : `${proposals.length} thing${proposals.length === 1 ? "" : "s"} need your commit across ${orgsSpanned} organization${orgsSpanned === 1 ? "" : "s"}.`}
          </p>
        )}
      </div>

      {/* 01 — the only module holding work that cannot proceed without a person */}
      <section>
        <h2
          style={{
            margin: "0 0 var(--s-3)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-2)",
          }}
        >
          Needs your commit
        </h2>

        {loading ? (
          <div className="dsh-queue">
            <div className="dsh-mod"><Skeleton h={14} w="60%" /><Skeleton h={18} /><Skeleton h={32} w="140px" /></div>
            <div className="dsh-mod"><Skeleton h={14} w="60%" /><Skeleton h={18} /><Skeleton h={32} w="140px" /></div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="dsh-mod">
            {anythingConnected ? (
              <p>
                Nothing is waiting on you. Agents put work here as they find it — you decide
                whether it ships.
              </p>
            ) : (
              <NotConnected
                copy="Connect a source and Kova's agents start drafting replies, holds and tasks here for you to approve. Nothing they write reaches a real system until you commit it."
                onConnect={() => go("connect")}
              />
            )}
          </div>
        ) : (
          <div className="dsh-queue">
            {proposals.map((p) => (
              <article className="dsh-prop" key={p.id}>
                <span className="dsh-prop-edge" style={{ background: p.identity_color }} />
                <div className="dsh-prop-meta">
                  <span className="dsh-dot" style={{ background: p.identity_color }} />
                  {p.org_name}
                  <span className="ai-mark">
                    <span className="ai-dot" aria-hidden />
                    {agentLabel(p.agent_key)}
                  </span>
                </div>
                <p className="dsh-prop-title">{p.title}</p>
                <div className="dsh-prop-actions">
                  <Button variant="quiet" size="sm" onClick={() => setOpen(p)}>
                    Review
                  </Button>
                  <Button variant="quiet" size="sm" onClick={() => void dismiss(p)}>
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 02 — context */}
      <div className="dsh-grid3">
        <Module title="Today">
          {loading ? (
            <><Skeleton h={14} /><Skeleton h={14} w="70%" /></>
          ) : !data?.today.calendar_connected ? (
            <NotConnected
              copy="Connect Google Calendar to see one day across every organization you run."
              onConnect={() => go("connect")}
            />
          ) : data.today.events.length === 0 ? (
            <p>No meetings today.</p>
          ) : (
            data.today.events.map((e) => (
              <div className="dsh-row" key={e.id}>
                <span className="dsh-dot" style={{ background: e.identity_color ?? "var(--a-500)" }} />
                <time>{time12(e.start_at)}</time>
                <span>{e.title}</span>
              </div>
            ))
          )}
        </Module>

        <Module title="Inbox">
          {loading ? (
            <><Skeleton h={30} w="60px" /><Skeleton h={14} w="80%" /></>
          ) : !data?.inbox.gmail_connected ? (
            <NotConnected
              copy="Connect Gmail and Kova surfaces the threads waiting on a reply, with drafts already written."
              onConnect={() => go("connect")}
            />
          ) : (
            <>
              <div className="dsh-figure">{data.inbox.needs_reply}</div>
              <p>
                {data.inbox.needs_reply === 0
                  ? "Nothing waiting on a reply."
                  : "drafted replies waiting on you."}
              </p>
            </>
          )}
        </Module>

        <Module title="Tasks">
          {loading ? (
            <><Skeleton h={30} w="60px" /><Skeleton h={14} w="80%" /></>
          ) : !anythingConnected ? (
            <NotConnected
              copy="Tasks appear here once a source is connected — extracted from mail, meetings and documents, then approved by you."
              onConnect={() => go("connect")}
            />
          ) : (
            <>
              <div className="dsh-figure">{data?.tasks.due_today ?? 0}</div>
              <p>
                due today
                {data && data.tasks.overdue > 0 ? ` · ${data.tasks.overdue} overdue` : ""}
              </p>
            </>
          )}
        </Module>
      </div>

      {/* 03 — connection health */}
      <section>
        <h2
          style={{
            margin: "0 0 var(--s-3)",
            fontSize: 11,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-2)",
          }}
        >
          Connection health
        </h2>
        <div className="dsh-mod">
          {loading ? (
            <><Skeleton h={14} /><Skeleton h={14} w="60%" /></>
          ) : !anythingConnected ? (
            <NotConnected
              copy="Nothing is connected yet. Kova has no data of its own — every number on this page comes from a source you connect."
              onConnect={() => go("connect")}
            />
          ) : (
            <>
              {data!.connections.rows.map((c) => (
                <div className="dsh-row" key={`${c.org_id}-${c.provider}`}>
                  <span className="dsh-dot" style={{ background: c.identity_color }} />
                  <span style={{ minWidth: 140 }}>{c.provider.replace(/_/g, " ")}</span>
                  <span
                    style={{
                      color:
                        c.status === "connected"
                          ? "var(--st-ok)"
                          : c.status === "error" || c.status === "expired"
                            ? "var(--st-warn)"
                            : "var(--text-2)",
                      fontSize: 12,
                    }}
                  >
                    {c.status}
                  </span>
                  {c.last_error ? (
                    <span style={{ color: "var(--text-2)", fontSize: 12 }}>{c.last_error}</span>
                  ) : c.last_sync_at ? (
                    <time>{time12(c.last_sync_at)}</time>
                  ) : null}
                </div>
              ))}
              <div>
                <Button variant="quiet" size="sm" onClick={() => go("connect")}>
                  Manage connections
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      {open ? (
        <ProposalDrawer proposal={open} onClose={() => setOpen(null)} onCommit={commit} />
      ) : null}

      {undo ? (
        <div className="dsh-toast" role="status">
          <span>Dismissed “{undo.title}”.</span>
          <Button variant="quiet" size="sm" onClick={() => void undoDismiss()}>
            Undo
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;
