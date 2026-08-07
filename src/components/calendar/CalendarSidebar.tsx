import { useMemo } from "react";
import { AlertTriangle, CalendarDays } from "lucide-react";
import { Card, Eyebrow } from "@/components/primitives";
import { addDays, sameDay, startOfWeek } from "@/lib/calendarTime";
import type { CalendarAccount } from "@/hooks/useCalendar";
import type { ScopeOrg } from "@/lib/WorkspaceScope";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Sidebar — mini-month, per-calendar toggles with identity swatches, and
 * the conflict count. Unconnected orgs stay in the list, greyed, with a way
 * to connect: hiding them makes a partial connection look complete.
 */
export const CalendarSidebar = ({
  anchor,
  onPick,
  accounts,
  orgs,
  orgsWithAccounts,
  hidden,
  onToggle,
  crossCount,
  sameCount,
  onConnect,
}: {
  anchor: Date;
  onPick: (d: Date) => void;
  accounts: CalendarAccount[];
  orgs: ScopeOrg[];
  orgsWithAccounts: Set<string>;
  hidden: Record<string, boolean>;
  onToggle: (accountId: string) => void;
  crossCount: number;
  sameCount: number;
  onConnect: () => void;
}) => {
  const monthDays = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const today = new Date();

  return (
    <div className="cal-side">
      <Card>
        <div className="cal-side-block">
          <Eyebrow>
            {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </Eyebrow>
          <div className="cal-mini">
            {DOW.map((d, i) => (
              <span key={i} className="cal-mini-h">{d}</span>
            ))}
            {monthDays.map((d) => (
              <button
                key={d.toISOString()}
                type="button"
                className="cal-mini-d"
                data-out={d.getMonth() !== anchor.getMonth() ? "true" : undefined}
                data-today={sameDay(d, today) ? "true" : undefined}
                data-sel={sameDay(d, anchor) ? "true" : undefined}
                onClick={() => onPick(d)}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="cal-side-block">
          <Eyebrow>Calendars</Eyebrow>
          {accounts.map((a) => {
            const org = orgById.get(a.org_id);
            const color = a.color_override ?? org?.identity_color ?? "var(--dim)";
            const off = !!hidden[a.id];
            return (
              <button
                key={a.id}
                type="button"
                className="cal-toggle"
                data-off={off ? "true" : undefined}
                onClick={() => onToggle(a.id)}
                aria-pressed={!off}
              >
                <span className="cal-box" data-on={!off ? "true" : undefined} aria-hidden />
                <span className="cal-swatch" style={{ background: color }} aria-hidden />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.display_name ?? org?.name ?? a.account_email}
                </span>
              </button>
            );
          })}

          {orgs
            .filter((o) => !orgsWithAccounts.has(o.id))
            .map((o) => (
              <button
                key={o.id}
                type="button"
                className="cal-toggle"
                data-unconnected="true"
                onClick={onConnect}
                title={`Connect a calendar for ${o.name}`}
              >
                <span className="cal-box" aria-hidden />
                <span className="cal-swatch" style={{ background: o.identity_color, opacity: 0.35 }} aria-hidden />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.name} — connect
                </span>
              </button>
            ))}
        </div>
      </Card>

      <Card>
        <div className="cal-side-block">
          <Eyebrow>Conflicts</Eyebrow>
          {crossCount === 0 && sameCount === 0 ? (
            <span className="vo-meta">
              <CalendarDays size={12} aria-hidden style={{ verticalAlign: "-2px", marginRight: 4 }} />
              Nothing overlaps in this window.
            </span>
          ) : (
            <>
              {crossCount > 0 && (
                <span className="vo-meta" style={{ color: "var(--warn-txt)", fontWeight: 700 }}>
                  <AlertTriangle size={12} aria-hidden style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  {crossCount} across entities
                </span>
              )}
              {sameCount > 0 && (
                <span className="vo-meta">{sameCount} within one entity</span>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
