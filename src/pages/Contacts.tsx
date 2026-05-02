import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, RefreshCw, Loader2, Users, Camera } from "lucide-react";
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
import { useContactEnrichment } from "@/hooks/useContactEnrichment";
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

  const activeOrg = useMemo(() => {
    if (!activeOrgId || activeOrgId === "all") return null;
    return orgs.find((o) => o.id === activeOrgId) ?? null;
  }, [orgs, activeOrgId]);

  const loadContacts = async () => {
    setLoading(true);
    let q = supabase
      .from("contacts")
      .select("id, org_id, name, email, company, role, last_touched_at, created_at, notes, linkedin_url, phone, engagement_stage")
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

  // Sync URL param
  useEffect(() => {
    const id = params.get("id");
    if (id !== selectedId) setSelectedId(id);
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
          <h1 className="t-hero" style={{ fontSize: 36 }}>Contacts</h1>
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
        <div className="flex items-center gap-3">
          <RelationshipHealth contacts={filteredForActiveOrg} />
          <button onClick={() => { setEditing(false); setModalOpen(true); }} className="btn-primary">
            <Plus size={12} /> Add Contact
          </button>
        </div>
      </div>

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
        <div className="flex gap-4 flex-1 min-h-0">
          <ContactList
            contacts={contacts}
            orgs={orgsForList}
            selectedId={selectedId}
            onSelect={handleSelect}
            initialStale={forceStale}
            key={`list-${forceStale}-${refreshTick}`}
          />
          <div className="flex-1 min-w-0 flex">
            {selected ? (
              <ContactDetail
                contact={selected}
                org={selectedOrg ? { id: selectedOrg.id, slug: selectedOrg.slug, name: selectedOrg.name } : null}
                onEdit={() => { setEditing(true); setModalOpen(true); }}
                onChanged={loadContacts}
                refreshKey={refreshTick}
              />
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
        </div>
      )}

      <ContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(id) => { handleSelect(id); loadContacts(); }}
        orgs={orgsForList}
        defaultOrgId={activeOrg?.id ?? null}
        contact={editing ? selected : null}
      />
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
