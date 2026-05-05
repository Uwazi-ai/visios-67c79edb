import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, RefreshCw, Loader2, Users, Camera, Sparkles, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { ContactList } from "@/components/contacts/ContactList";
import { ContactDetail } from "@/components/contacts/ContactDetail";
import { EngagementBoard } from "@/components/contacts/EngagementBoard";
import { ContactModal } from "@/components/contacts/ContactModal";
import { CardScannerModal, type ScannedCard } from "@/components/contacts/CardScannerModal";
import { RelationshipHealth } from "@/components/contacts/RelationshipHealth";
import { StaleBanner } from "@/components/contacts/StaleBanner";
import { GmailAgentDrawer } from "@/components/contacts/GmailAgentDrawer";
import { AgentStatusBar } from "@/components/contacts/AgentStatusBar";
import { useContactEnrichment } from "@/hooks/useContactEnrichment";
import { usePendingReviewCount, useAgentSettings } from "@/hooks/useGmailAgent";
import { useSwipe } from "@/hooks/useSwipe";
import { useIsMobile } from "@/hooks/use-mobile";
import { bucket } from "@/lib/contactsHealth";
import { toast } from "sonner";

export interface ContactRow {
  id: string;
  org_id: string | null;
  name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  last_touched_at: string | null;
  created_at: string;
  notes: string | null;
  linkedin_url: string | null;
  phone: string | null;
  engagement_stage: string | null;
  visibility: "team" | "private";
  created_by: string | null;
}

const Contacts = () => {
  const { user } = useAuth();
  const { orgs, activeOrgId } = useOrg();
  const [params, setParams] = useSearchParams();

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("id"));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [forceStale, setForceStale] = useState<60 | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanPrefill, setScanPrefill] = useState<{
    name?: string | null; email?: string | null; company?: string | null;
    role?: string | null; linkedin_url?: string | null; phone?: string | null;
    notes?: string | null;
  } | null>(null);
  const [scanSource, setScanSource] = useState<string | undefined>(undefined);

  const [agentOpen, setAgentOpen] = useState(false);
  const [agentInitialPhase, setAgentInitialPhase] = useState<"config" | "review">("config");
  const { count: pendingCount, refresh: refreshPending } = usePendingReviewCount();
  const { settings: agentSettings } = useAgentSettings();

  const activeOrg = useMemo(() => {
    if (!activeOrgId || activeOrgId === "all") return null;
    return orgs.find((o) => o.id === activeOrgId) ?? null;
  }, [orgs, activeOrgId]);

  const loadContacts = async () => {
    setLoading(true);
    let q = supabase
      .from("contacts")
      .select("id, org_id, name, email, company, role, last_touched_at, created_at, notes, linkedin_url, phone, engagement_stage, visibility, created_by")
      .order("last_touched_at", { ascending: false, nullsFirst: false });
    const { data } = await q;
    setContacts((data ?? []) as ContactRow[]);
    setLoading(false);
    setRefreshTick((t) => t + 1);
  };

  useEffect(() => {
    if (user) loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Sync URL param + ?scan=true shortcut from PWA
  useEffect(() => {
    const id = params.get("id");
    if (id !== selectedId) setSelectedId(id);
    if (params.get("scan") === "true") {
      setScannerOpen(true);
      setParams((p) => {
        const next = new URLSearchParams(p);
        next.delete("scan");
        return next;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set("id", id);
      return next;
    }, { replace: true });
  };

  const handleScanned = (card: ScannedCard) => {
    // Map scanner result → ContactModal prefill shape
    const noteParts: string[] = [];
    if (card.address) noteParts.push(`Address: ${card.address}`);
    if (card.website) noteParts.push(`Website: ${card.website}`);
    if (card.notes) noteParts.push(card.notes);
    setScanPrefill({
      name: card.name,
      email: card.email,
      company: card.company,
      role: card.title,
      linkedin_url: card.linkedin,
      phone: card.phone,
      notes: noteParts.join("\n") || null,
    });
    setScanSource("card_scan");
    setEditing(false);
    setScannerOpen(false);
    setModalOpen(true);
  };

  // Background enrichment
  const enrichment = useContactEnrichment({
    contacts: contacts.map((c) => ({ id: c.id, email: c.email, org_id: c.org_id })),
    enabled: !loading && contacts.length > 0,
    onComplete: () => loadContacts(),
  });

  const orgsForList = orgs.map((o) => ({ id: o.id, slug: o.slug, name: o.name }));

  const filteredForActiveOrg = useMemo(() => {
    if (!activeOrg) return contacts;
    return contacts.filter((c) => c.org_id === activeOrg.id);
  }, [contacts, activeOrg]);

  const staleCount = useMemo(
    () => filteredForActiveOrg.filter((c) => bucket(c.last_touched_at) === "cold").length,
    [filteredForActiveOrg],
  );

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );
  const selectedOrg = selected
    ? orgs.find((o) => o.id === selected.org_id) ?? null
    : null;

  return (
    <div className="page-enter flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="t-hero text-2xl md:text-4xl">Contacts</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="t-mono">
              {filteredForActiveOrg.length} contact{filteredForActiveOrg.length === 1 ? "" : "s"}
              {activeOrg ? ` · ${activeOrg.name}` : " · All orgs"}
            </span>
            <span className="t-mono flex items-center gap-1.5">
              {enrichment.syncing ? (
                <>
                  <Loader2 size={10} className="animate-spin" /> Syncing Gmail & Calendar…
                </>
              ) : enrichment.syncedAt ? (
                <>
                  <RefreshCw size={10} /> Synced{" "}
                  {Math.floor((Date.now() - enrichment.syncedAt.getTime()) / 60000) < 1
                    ? "just now"
                    : `${Math.floor((Date.now() - enrichment.syncedAt.getTime()) / 60000)}m ago`}
                </>
              ) : null}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="hidden md:block"><RelationshipHealth contacts={filteredForActiveOrg} /></div>
          <button
            onClick={() => { setAgentInitialPhase("config"); setAgentOpen(true); }}
            className="btn-ghost"
            title="Find contacts from Gmail"
          >
            <Sparkles size={12} /> <Mail size={12} /> <span className="hidden sm:inline">Find Contacts</span><span className="sm:hidden">Find</span>
            {pendingCount > 0 && (
              <span className="badge" style={{ marginLeft: 6 }}>{pendingCount}</span>
            )}
          </button>
          <button onClick={() => setScannerOpen(true)} className="btn-ghost" title="Scan a business card">
            <Camera size={12} /> <span className="hidden sm:inline">Scan Card</span><span className="sm:hidden">Scan</span>
          </button>
          <button onClick={() => { setScanPrefill(null); setScanSource(undefined); setEditing(false); setModalOpen(true); }} className="btn-primary">
            <Plus size={12} /> <span className="hidden sm:inline">Add Contact</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Agent status bar */}
      <AgentStatusBar
        syncEnabled={agentSettings.gmail_contact_sync_enabled}
        syncing={false}
        lastSyncedAt={agentSettings.gmail_last_synced_at}
        pendingCount={pendingCount}
        onScanNow={() => { setAgentInitialPhase("config"); setAgentOpen(true); }}
        onReview={() => { setAgentInitialPhase("review"); setAgentOpen(true); }}
        onConfigureSync={() => { window.location.href = "/settings"; }}
      />

      {/* Stale banner */}
      <StaleBanner count={staleCount} onView={() => setForceStale(60)} />

      {/* Main 3-panel layout */}
      {loading ? (
        <div className="glass flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState onAdd={() => { setEditing(false); setModalOpen(true); }} />
      ) : (
        <SwipeableContacts
          selectedId={selectedId}
          onBack={() => { setSelectedId(null); setParams((p) => { const n = new URLSearchParams(p); n.delete("id"); return n; }, { replace: true }); }}
        >
          <div className={`${selectedId ? "hidden md:flex" : "flex"} flex-1 md:flex-initial min-h-0`}>
            <ContactList
              contacts={contacts}
              orgs={orgsForList}
              selectedId={selectedId}
              onSelect={handleSelect}
              initialStale={forceStale}
              key={`list-${forceStale}-${refreshTick}`}
            />
          </div>
          <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
            {selected ? (
              <div className="flex-1 min-w-0 flex flex-col">
                <button
                  onClick={() => { setSelectedId(null); setParams((p) => { const n = new URLSearchParams(p); n.delete("id"); return n; }, { replace: true }); }}
                  className="btn-ghost md:hidden mb-2 self-start"
                  style={{ fontSize: 11 }}
                >
                  ← Back
                </button>
                <ContactDetail
                  contact={selected}
                  org={selectedOrg ? { id: selectedOrg.id, slug: selectedOrg.slug, name: selectedOrg.name } : null}
                  onEdit={() => { setEditing(true); setModalOpen(true); }}
                  onChanged={loadContacts}
                  refreshKey={refreshTick}
                />
              </div>
            ) : (
              <div className="glass flex-1 flex flex-col items-center justify-center gap-2" style={{ color: "var(--text-muted)" }}>
                <Users size={28} />
                <span style={{ fontSize: 13 }}>Select a contact to view details</span>
              </div>
            )}
          </div>
          <EngagementBoard
            contacts={contacts}
            orgs={orgsForList}
            activeOrgSlug={activeOrg?.slug ?? null}
            onChanged={loadContacts}
            onSelect={handleSelect}
          />
        </SwipeableContacts>
      )}

      <ContactModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setScanPrefill(null); setScanSource(undefined); }}
        onSaved={(id) => {
          handleSelect(id);
          loadContacts();
          if (scanSource === "card_scan") {
            const orgName = orgs.find((o) => o.id === activeOrg?.id)?.name ?? "your CRM";
            toast.success(`Contact saved — added to ${orgName}`);
          }
          setScanPrefill(null);
          setScanSource(undefined);
        }}
        orgs={orgsForList}
        defaultOrgId={activeOrg?.id ?? null}
        contact={editing ? selected : null}
        prefill={scanPrefill}
        source={scanSource}
      />

      <CardScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onExtracted={handleScanned}
      />

      <GmailAgentDrawer
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        orgs={orgsForList}
        onContactsChanged={loadContacts}
        onPendingChanged={refreshPending}
        initialPhase={agentInitialPhase}
      />
    </div>
  );
};

const SwipeableContacts = ({
  selectedId,
  onBack,
  children,
}: {
  selectedId: string | null;
  onBack: () => void;
  children: React.ReactNode;
}) => {
  const isMobile = useIsMobile();
  const swipe = useSwipe({
    onSwipeRight: () => { if (isMobile && selectedId) onBack(); },
  });
  return (
    <div className="flex gap-4 flex-1 min-h-0" {...(isMobile ? swipe : {})}>
      {children}
    </div>
  );
};

const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <div className="glass flex-1 flex items-center justify-center p-10">
    <div className="text-center max-w-sm">
      <svg
        viewBox="0 0 120 80"
        className="mx-auto mb-4"
        width="120"
        height="80"
        aria-hidden="true"
      >
        <circle cx="30" cy="40" r="18" fill="none" stroke="var(--text-muted)" strokeWidth="2" />
        <circle cx="90" cy="40" r="18" fill="none" stroke="var(--text-muted)" strokeWidth="2" />
        <line x1="48" y1="40" x2="72" y2="40" stroke="var(--text-accent)" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="30" cy="32" r="5" fill="var(--text-muted)" />
        <circle cx="90" cy="32" r="5" fill="var(--text-muted)" />
      </svg>
      <h2 className="t-section mb-2">No contacts yet</h2>
      <p className="t-body mb-4">
        Add your first contact or sync Gmail to auto-import relationships.
      </p>
      <div className="flex justify-center gap-2">
        <button onClick={onAdd} className="btn-primary"><Plus size={12} /> Add Contact</button>
      </div>
    </div>
  </div>
);

export default Contacts;
