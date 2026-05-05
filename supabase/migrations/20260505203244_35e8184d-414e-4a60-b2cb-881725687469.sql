
-- Personal booking links per contact: host preselects time slots; contact picks one.

CREATE TABLE public.contact_booking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  host_user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Quick meeting',
  description text,
  duration_mins integer NOT NULL DEFAULT 30,
  location text,
  status text NOT NULL DEFAULT 'open', -- open | booked | canceled | expired
  invitee_name text,
  invitee_email text,
  booked_slot_id uuid,
  booked_at timestamptz,
  google_event_id text,
  meet_link text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cbl_host ON public.contact_booking_links(host_user_id);
CREATE INDEX idx_cbl_contact ON public.contact_booking_links(contact_id);

CREATE TABLE public.contact_booking_link_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.contact_booking_links(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cbls_link ON public.contact_booking_link_slots(link_id);

ALTER TABLE public.contact_booking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_booking_link_slots ENABLE ROW LEVEL SECURITY;

-- Host owns the link
CREATE POLICY "cbl: host can read own"
  ON public.contact_booking_links FOR SELECT
  USING (host_user_id = auth.uid());

CREATE POLICY "cbl: host can insert"
  ON public.contact_booking_links FOR INSERT
  WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "cbl: host can update"
  ON public.contact_booking_links FOR UPDATE
  USING (host_user_id = auth.uid());

CREATE POLICY "cbl: host can delete"
  ON public.contact_booking_links FOR DELETE
  USING (host_user_id = auth.uid());

-- Slots inherit access through link ownership
CREATE POLICY "cbls: host can read"
  ON public.contact_booking_link_slots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.contact_booking_links l
    WHERE l.id = link_id AND l.host_user_id = auth.uid()));

CREATE POLICY "cbls: host can insert"
  ON public.contact_booking_link_slots FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.contact_booking_links l
    WHERE l.id = link_id AND l.host_user_id = auth.uid()));

CREATE POLICY "cbls: host can delete"
  ON public.contact_booking_link_slots FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.contact_booking_links l
    WHERE l.id = link_id AND l.host_user_id = auth.uid()));

CREATE TRIGGER tr_cbl_updated_at
  BEFORE UPDATE ON public.contact_booking_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
