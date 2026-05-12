// Deterministic per-user color assignment for team calendar.
// Stable across sessions: hashes the user_id into the palette.
export const MEMBER_PALETTE: { name: string; hex: string }[] = [
  { name: "blue", hex: "#3B82F6" },
  { name: "violet", hex: "#8B5CF6" },
  { name: "emerald", hex: "#10B981" },
  { name: "orange", hex: "#F97316" },
  { name: "rose", hex: "#F43F5E" },
  { name: "cyan", hex: "#06B6D4" },
  { name: "amber", hex: "#F59E0B" },
  { name: "pink", hex: "#EC4899" },
  { name: "lime", hex: "#84CC16" },
  { name: "indigo", hex: "#6366F1" },
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function colorForMember(userId: string): string {
  if (!userId) return MEMBER_PALETTE[0].hex;
  return MEMBER_PALETTE[hashString(userId) % MEMBER_PALETTE.length].hex;
}
