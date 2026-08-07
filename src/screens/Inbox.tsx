import { useCallback, useEffect, useMemo, useState } from "react";
import "@/design/inbox.css";
import { supabase } from "@/integrations/supabase/client";
import { SectionHead } from "@/components/primitives";
import { useWorkspaceScope } from "@/lib/WorkspaceScope";
import { useInbox, type MailMessage } from "@/hooks/useInbox";
import { CategoryChips } from "@/components/inbox/CategoryChips";
import { MailList } from "@/components/inbox/MailList";
import { ReadingPane } from "@/components/inbox/ReadingPane";
import { FilterEmpty, InboxZero, NoSelection, NotConnected } from "@/components/inbox/EmptyStates";
import { CATEGORIES, type Category } from "@/data/mailCategories";

/**
 * Inbox — a Gmail-shaped client over every organisation at once.
 *
 * The one rule this screen exists to get right: category is what a message is,
 * triage is whether you are finished with it. They never write each other, and
 * every list query drops done/archived, so a handled message leaves its
 * category view the instant it is handled.
 */
const Inbox = ({ navigate }: { navigate: (id: string) => void }) => {
  const { orgs, scopeOrgId } = useWorkspaceScope();
  const {
    loading, messages, accounts, orgsWithAccounts, proposalFor,
    setTriage, setCategory, markRead, reload,
  } = useInbox(scopeOrgId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cats, setCats] = useState<Set<Category>>(new Set());
  const [needsReplyOnly, setNeedsReplyOnly] = useState(false);
  const [dismissedStrip, setDismissedStrip] = useState(false);
  const [mobileReading, setMobileReading] = useState(false);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const orgName = useCallback((id: string) => orgById.get(id)?.name ?? "Unassigned", [orgById]);
  const orgColor = useCallback(
    (id: string) => orgById.get(id)?.identity_color ?? "var(--t-dim)",
    [orgById],
  );

  const visible = useMemo(() => {
    let list = messages;
    if (cats.size) list = list.filter((m) => cats.has(m.category));
    if (needsReplyOnly) list = list.filter((m) => m.needs_reply);
    return list;
  }, [messages, cats, needsReplyOnly]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of messages) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [messages]);

  const needsReplyCount = useMemo(
    () => messages.filter((m) => m.needs_reply).length,
    [messages],
  );

  const selected = useMemo(
    () => visible.find((m) => m.id === selectedId) ?? null,
    [visible, selectedId],
  );

  const open = useCallback(
    (m: MailMessage) => {
      setSelectedId(m.id);
      setMobileReading(true);
      if (m.is_unread) markRead(m.id);
    },
    [markRead],
  );

  /** Handling a message opens the next one — the queue keeps moving. */
  const advance = useCallback(
    (fromId: string) => {
      const i = visible.findIndex((m) => m.id === fromId);
      const next = visible[i + 1] ?? visible[i - 1] ?? null;
      setSelectedId(next?.id ?? null);
      if (!next) setMobileReading(false);
    },
    [visible],
  );

  const triage = useCallback(
    (id: string, status: MailMessage["triage_status"]) => {
      advance(id);
      setTriage(id, status);
    },
    [advance, setTriage],
  );

  /* Gmail muscle memory: e archive, j/k navigate, r focuses the composer. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && /input|textarea/i.test(t.tagName)) return;
      if (!visible.length) return;
      const i = visible.findIndex((m) => m.id === selectedId);
      if (e.key === "j") { e.preventDefault(); open(visible[Math.min(i + 1, visible.length - 1)] ?? visible[0]); }
      if (e.key === "k") { e.preventDefault(); open(visible[Math.max(i - 1, 0)] ?? visible[0]); }
      if (e.key === "e" && selectedId) { e.preventDefault(); triage(selectedId, "archived"); }
      if (e.key === "r") {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>(".mb-textarea")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selectedId, open, triage]);

  const scopedOrgs = scopeOrgId ? orgs.filter((o) => o.id === scopeOrgId) : orgs;
  const unconnected = scopedOrgs.filter((o) => !orgsWithAccounts.has(o.id));
  const noAccounts = accounts.length === 0;
  const broken = accounts.filter((a) => a.status === "error" || a.status === "expired");

  if (!loading && noAccounts) {
    return (
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <SectionHead title="Inbox" />
        <NotConnected orgNames={scopedOrgs.map((o) => o.name)} onConnect={() => navigate("connect")} />
      </div>
    );
  }

  const activeCatCopy =
    cats.size === 1
      ? CATEGORIES.find((c) => cats.has(c.key))?.empty ?? "Nothing here."
      : needsReplyOnly
        ? "Nobody is waiting on a reply."
        : "Nothing matches those filters.";

  return (
    <div className="mb-shell" data-reading={mobileReading ? "true" : undefined}>
      <div className="mb-listpane">
        <div className="mb-listhead">
          <SectionHead
            title="Inbox"
            action={<span className="vo-meta">{visible.length} open</span>}
          />
          <CategoryChips
            counts={counts}
            selected={cats}
            onToggle={(c) =>
              setCats((prev) => {
                const next = new Set(prev);
                next.has(c) ? next.delete(c) : next.add(c);
                return next;
              })
            }
            needsReplyCount={needsReplyCount}
            needsReplyOn={needsReplyOnly}
            onToggleNeedsReply={() => setNeedsReplyOnly((v) => !v)}
          />
        </div>

        {broken.length ? (
          <div className="mb-banner" role="alert">
            <strong>{broken[0].email_address}</strong>{" "}
            {broken[0].status === "expired"
              ? "needs reconnecting. Mail below is cached and may be stale."
              : `stopped syncing: ${broken[0].last_error ?? "unknown error"}`}
            <button type="button" className="mb-link" onClick={() => navigate("connect")}>
              Reconnect
            </button>
          </div>
        ) : null}

        {!dismissedStrip && !scopeOrgId && unconnected.length ? (
          <div className="mb-strip">
            <span>
              Not connected: {unconnected.map((o) => o.name).join(", ")}
            </span>
            <button type="button" className="mb-link" onClick={() => setDismissedStrip(true)}>
              Dismiss
            </button>
          </div>
        ) : null}

        {!loading && visible.length === 0 ? (
          messages.length === 0 ? <InboxZero /> : <FilterEmpty copy={activeCatCopy} />
        ) : (
          <MailList
            messages={visible}
            selectedId={selectedId}
            onSelect={open}
            showIdentity={!scopeOrgId}
            orgColor={orgColor}
            orgName={orgName}
            hasDraft={(id) => !!proposalFor(id)}
            loading={loading}
          />
        )}
      </div>

      <div className="mb-readpane">
        {selected ? (
          <ReadingPane
            key={selected.id}
            message={selected}
            proposal={proposalFor(selected.id)}
            orgName={orgName(selected.org_id)}
            isDemo={!!orgById.get(selected.org_id)?.is_demo}
            onBack={() => setMobileReading(false)}
            onTriage={(s) => triage(selected.id, s)}
            onCategory={(c) => setCategory(selected.id, c)}
            onSent={() => { advance(selected.id); reload(); }}
            onReloadProposals={reload}
          />
        ) : (
          <NoSelection />
        )}
      </div>
    </div>
  );
};

export default Inbox;

/** Kept for callers that want a manual sync trigger. */
export async function syncAccount(mailAccountId: string) {
  return await supabase.functions.invoke("gmail-sync", { body: { mail_account_id: mailAccountId } });
}
