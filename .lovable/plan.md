# Contacts & CRM Page (Phase 3)

Build a relationship-first CRM at `/contacts` matching the existing dark-glass design system (semantic tokens, `.glass`, `.org-pill`, `ORG_COLORS`). Replaces the current `ContactsPage` placeholder.

## 1. Database (one migration)

Extend `contacts`:
- `linkedin_url text`, `phone text`, `engagement_stage text default 'prospect'`

Create `contact_interactions`:
- `id, contact_id (fk → contacts on delete cascade), org_id, type (check: email|meeting|call|note|task), title, summary, occurred_at, source default 'manual', external_id, created_at`
- RLS: org members read/write/update/delete via `is_org_member`
- Unique index on `(contact_id, source, external_id)` for upsert dedupe

## 2. Routing

- `App.tsx`: replace `ContactsPage` import with new `src/pages/Contacts.tsx`
- Remove `ContactsPage` from `EmptyPages.tsx`
- URL param `?id=<contact_id>` opens that contact in the detail panel

## 3. Page layout (`src/pages/Contacts.tsx`)

Three-column grid inside `AppShell`:

```text
┌─────────────────────────────────────────────────────────────┐
│  Header: "Contacts"  · Health widget (🟢🟡🔴)  · [+ Add]   │
│  Stale-60d banner (conditional)                             │
├──────────────┬─────────────────────────────┬────────────────┤
│ List ~320px  │ Detail (flex-1)             │ Engagements    │
│ search       │ name / org / email          │ ~280px         │
│ filter chips │ days-since badge            │ stage columns  │
│ contact rows │ action bar                  │ draggable      │
│              │ interaction history         │ cards          │
│              │ AI follow-up card           │                │
└──────────────┴─────────────────────────────┴────────────────┘
```

All panels use `.glass` containers, semantic tokens only, Lucide icons (`User, Building2, Mail, Calendar, Phone, Clock, AlertTriangle, Sparkles, Plus`).

## 4. Components (under `src/components/contacts/`)

- `ContactList.tsx` — search, filter chips (org / type / staleness), scrollable list, stale dots
- `ContactDetail.tsx` — header, days-since badge (green/amber/red), action bar, hosts history + AI card
- `InteractionHistory.tsx` — last 10 from `contact_interactions`, "Load more"
- `AISuggestionCard.tsx` — calls `ai-draft-email` edge function (reused) for follow-up suggestion + draft modal
- `EngagementBoard.tsx` — mini Kanban, stage labels per active org slug, native HTML5 drag/drop, updates `engagement_stage`
- `ContactModal.tsx` — add/edit form (org-aware stage dropdown)
- `RelationshipHealth.tsx` — counts active/warming/cold
- `StaleBanner.tsx`

Org stage map (in `src/lib/engagementStages.ts`):
- `uwazi`: Prospect → Intro → Active Partner → Ecosystem
- `bin`: New → Engaged → Speaker/Advisor → Champion
- `cc`: Lead → Proposal → Active Client → Retained
- fallback: Prospect → Active → Champion

## 5. Gmail + Calendar enrichment

Client-side hook `useContactEnrichment(orgId)` runs once on page mount:

1. Calls existing `gmail-list-threads` edge function for last 30 days
2. Calls existing `calendar-list-events` edge function for ±30 days
3. For each thread/event, extract participant emails; find matching contact in current org; upsert `contact_interactions` (dedupe via `(contact_id, source, external_id)`); update `contacts.last_touched_at` to max date
4. Header shows `Loader2` spinner → "Synced just now"
5. Non-blocking: page renders immediately

## 6. AI follow-up

Reuse `ai-draft-email` edge function with a system prompt for "next-step suggestion" mode. Prompt includes contact name, org name, `last_touched_at`, last 3 interaction summaries. Display response as italic text + "Draft Email" button → opens modal that calls the same function in "warm follow-up" mode and shows editable draft.

## 7. Filtering & deep-link

- Active org from `OrgContext` filters list (or "all" shows everything)
- Filter chips: All / per-org / People-Companies / Stale 30/60/90
- `?id=` URL param syncs with selected contact via `useSearchParams`

## 8. Empty state

Centered card with simple inline SVG (two circles + connecting line), heading, subheading, [+ Add Contact] and [Sync Gmail] buttons.

## Files

**New**
- `supabase/migrations/<ts>_contacts_crm.sql`
- `src/pages/Contacts.tsx`
- `src/lib/engagementStages.ts`
- `src/lib/contactsHealth.ts` (days-since + bucket helpers)
- `src/hooks/useContactEnrichment.ts`
- `src/components/contacts/ContactList.tsx`
- `src/components/contacts/ContactDetail.tsx`
- `src/components/contacts/InteractionHistory.tsx`
- `src/components/contacts/AISuggestionCard.tsx`
- `src/components/contacts/EngagementBoard.tsx`
- `src/components/contacts/ContactModal.tsx`
- `src/components/contacts/RelationshipHealth.tsx`
- `src/components/contacts/StaleBanner.tsx`

**Edited**
- `src/App.tsx` (swap import)
- `src/pages/EmptyPages.tsx` (remove `ContactsPage`)

## Out of scope

- New edge functions (reuse `gmail-list-threads`, `calendar-list-events`, `ai-draft-email`)
- Changes to Calendar / Dashboard deep-link sources (this page accepts `?id=`; updating callers can be a follow-up)
- Server-side cron enrichment (client-side on mount is sufficient for v1)
