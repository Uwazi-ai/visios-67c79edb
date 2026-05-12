import type { MemberInfo } from "@/hooks/useOrgMembersMap";

interface Props {
  member?: MemberInfo;
  size?: number;
  title?: string;
}

export const AssigneeAvatar = ({ member, size = 18, title }: Props) => {
  if (!member) return null;
  const label = member.display_name ?? member.email ?? "?";
  const initial = label.trim().slice(0, 1).toUpperCase();
  return (
    <span
      title={title ?? `Assigned to ${label}`}
      className="inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: "var(--bg-glass-2)",
        border: "1px solid var(--border-glass)",
        fontSize: Math.max(8, size - 10),
        fontWeight: 600,
        color: "var(--text-secondary)",
      }}
    >
      {member.avatar_url ? (
        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
};
