import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/data/mailCategories";

/**
 * useInbox — one query per axis, and the triage exclusion is applied in the
 * query itself. Category and triage are independent: nothing here ever writes
 * one when the caller asked for the other.
 */

export interface MailMessage {
  id: string;
  org_id: string;
  mail_account_id: string;
  provider_message_id: string;
  provider_thread_id: string;
  from_name: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string;
  is_unread: boolean;
  has_attachments: boolean;
  category: Category;
  category_source: "pending" | "ai" | "user" | "rule";
  triage_status: "inbox" | "needs_reply" | "waiting" | "done" | "archived";
  needs_reply: boolean;
}

export interface MailAccount {
  id: string;
  org_id: string;
  email_address: string;
  display_name: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
}

export interface ReplyProposal {
  id: string;
  org_id: string;
  payload: { message_id?: string; thread_id?: string; draft_body?: string };
}

const HANDLED = ["done", "archived"];

export function useInbox(scopeOrgId: string | null) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [proposals, setProposals] = useState<ReplyProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    let mq = supabase
      .from("mail_messages")
      .select(
        "id,org_id,mail_account_id,provider_message_id,provider_thread_id,from_name,from_address,to_addresses,cc_addresses,subject,snippet,body_text,body_html,received_at,is_unread,has_attachments,category,category_source,triage_status,needs_reply",
      )
      .not("triage_status", "in", `(${HANDLED.join(",")})`)
      .order("received_at", { ascending: false })
      .limit(250);
    let aq = supabase
      .from("mail_accounts")
      .select("id,org_id,email_address,display_name,status,last_sync_at,last_error");
    let pq = supabase
      .from("proposals")
      .select("id,org_id,payload")
      .eq("kind", "email_reply")
      .eq("status", "pending");

    if (scopeOrgId) {
      mq = mq.eq("org_id", scopeOrgId);
      aq = aq.eq("org_id", scopeOrgId);
      pq = pq.eq("org_id", scopeOrgId);
    }

    const [m, a, p] = await Promise.allSettled([mq, aq, pq]);
    if (m.status === "fulfilled") {
      if (m.value.error) setError(m.value.error.message);
      setMessages((m.value.data ?? []) as unknown as MailMessage[]);
    }
    if (a.status === "fulfilled") setAccounts((a.value.data ?? []) as unknown as MailAccount[]);
    if (p.status === "fulfilled") setProposals((p.value.data ?? []) as unknown as ReplyProposal[]);
    setLoading(false);
  }, [scopeOrgId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  /** Triage only. Category is untouched, deliberately. */
  const setTriage = useCallback(
    async (id: string, status: MailMessage["triage_status"]) => {
      setMessages((prev) =>
        HANDLED.includes(status)
          ? prev.filter((m) => m.id !== id)
          : prev.map((m) => (m.id === id ? { ...m, triage_status: status } : m)),
      );
      const { data: auth } = await supabase.auth.getUser();
      await supabase
        .from("mail_messages")
        .update({
          triage_status: status,
          triaged_at: new Date().toISOString(),
          triaged_by: auth?.user?.id ?? null,
          ...(status === "done" || status === "archived" ? { needs_reply: false } : {}),
        })
        .eq("id", id);
    },
    [],
  );

  /** Category only. A human choice, so category_source becomes 'user'. */
  const setCategory = useCallback(async (id: string, category: Category) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, category, category_source: "user" } : m)),
    );
    await supabase
      .from("mail_messages")
      .update({ category, category_source: "user", categorized_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const markRead = useCallback(async (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_unread: false } : m)));
    await supabase.from("mail_messages").update({ is_unread: false }).eq("id", id);
  }, []);

  const proposalFor = useCallback(
    (messageId: string) => proposals.find((p) => p.payload?.message_id === messageId) ?? null,
    [proposals],
  );

  const orgsWithAccounts = useMemo(
    () => new Set(accounts.map((a) => a.org_id)),
    [accounts],
  );

  return {
    loading,
    error,
    messages,
    accounts,
    proposals,
    orgsWithAccounts,
    proposalFor,
    setTriage,
    setCategory,
    markRead,
    reload: load,
    setMessages,
  };
}
