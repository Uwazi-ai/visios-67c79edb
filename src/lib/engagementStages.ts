// Org-aware engagement stage definitions for the Contacts CRM.

export interface Stage {
  id: string;
  label: string;
}

const DEFAULT_STAGES: Stage[] = [
  { id: "prospect", label: "Prospect" },
  { id: "active", label: "Active" },
  { id: "champion", label: "Champion" },
];

export const STAGES_BY_ORG: Record<string, Stage[]> = {
  uwazi: [
    { id: "prospect", label: "Prospect" },
    { id: "intro", label: "Intro" },
    { id: "active_partner", label: "Active Partner" },
    { id: "ecosystem", label: "Ecosystem" },
  ],
  bin: [
    { id: "new", label: "New" },
    { id: "engaged", label: "Engaged" },
    { id: "speaker_advisor", label: "Speaker/Advisor" },
    { id: "champion", label: "Champion" },
  ],
  cc: [
    { id: "lead", label: "Lead" },
    { id: "proposal", label: "Proposal" },
    { id: "active_client", label: "Active Client" },
    { id: "retained", label: "Retained" },
  ],
};

export function stagesForOrg(slug?: string | null): Stage[] {
  if (!slug) return DEFAULT_STAGES;
  return STAGES_BY_ORG[slug] ?? DEFAULT_STAGES;
}

export function stageLabel(slug: string | null | undefined, stageId: string | null | undefined): string {
  if (!stageId) return "—";
  const list = stagesForOrg(slug);
  return list.find((s) => s.id === stageId)?.label ?? stageId;
}
