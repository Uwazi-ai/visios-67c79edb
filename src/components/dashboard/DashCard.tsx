import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  delay?: number;
}

export const DashCard = ({ title, icon: Icon, action, children, delay = 0 }: Props) => (
  <div className="glass card-enter p-5 flex flex-col" style={{ animationDelay: `${delay}ms`, minHeight: 280 }}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Icon size={16} strokeWidth={1.5} style={{ color: "var(--text-accent)" }} />
        <span className="t-card-title">{title}</span>
      </div>
      {action}
    </div>
    <div className="flex-1 flex flex-col gap-2 min-h-0">{children}</div>
  </div>
);

export const EmptyHint = ({ children }: { children: ReactNode }) => (
  <div className="flex-1 flex items-center justify-center text-center px-4 py-6">
    <p className="t-body" style={{ color: "var(--text-muted)", fontSize: 13 }}>{children}</p>
  </div>
);
