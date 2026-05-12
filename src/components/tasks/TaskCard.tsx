import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast } from "date-fns";
import type { Task } from "@/hooks/useTasks";
import type { Org } from "@/lib/orgs";
import type { MemberInfo } from "@/hooks/useOrgMembersMap";
import { AssigneeAvatar } from "./AssigneeAvatar";

const PRIORITY_STYLES: Record<string, { color: string; glow?: string }> = {
  urgent: { color: "#EF4444", glow: "0 0 8px rgba(239,68,68,0.6)" },
  high: { color: "#F59E0B" },
  normal: { color: "#3B82F6" },
  low: { color: "rgba(255,255,255,0.20)" },
};

interface Props {
  task: Task;
  org?: Org;
  projectName?: string;
  assignee?: MemberInfo;
  onClick: () => void;
  draggable?: boolean;
}

export const TaskCard = ({ task, org, projectName, assignee, onClick, draggable = true }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });

  const pri = PRIORITY_STYLES[task.priority ?? "normal"] ?? PRIORITY_STYLES.normal;
  const overdue = task.due_at && isPast(new Date(task.due_at)) && task.status !== "done";

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className="glass p-3 cursor-pointer hover:bg-white/[0.06] transition-colors group"
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: pri.color,
            boxShadow: pri.glow,
            marginTop: 5,
            flexShrink: 0,
          }}
        />
        <div
          className="text-[13px] leading-snug flex-1"
          style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 500, color: "var(--text-primary)" }}
        >
          {task.title}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {projectName && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-glass-2)",
                border: "1px solid var(--border-glass)",
                color: "var(--text-secondary)",
              }}
            >
              {projectName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {task.due_at && (
            <span
              className="t-mono text-[10px]"
              style={{ color: overdue ? "#EF4444" : "var(--text-muted)" }}
            >
              {format(new Date(task.due_at), "MMM d")}
            </span>
          )}
          <AssigneeAvatar member={assignee} size={16} />
        </div>
      </div>

      {org && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: org.color,
            borderRadius: "0 0 var(--radius) var(--radius)",
          }}
        />
      )}
    </div>
  );
};
