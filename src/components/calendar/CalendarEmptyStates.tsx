import { CalendarOff, EyeOff, Plug, RefreshCw } from "lucide-react";
import { Button, Card, Desc, Eyebrow } from "@/components/primitives";

/**
 * Zero connected calendars renders an explanation, never an empty grid. An
 * empty week reads as "you have no meetings", which is a lie of layout.
 */
export const NotConnected = ({ orgNames, onConnect }: { orgNames: string[]; onConnect: () => void }) => (
  <Card ungated>
    <div className="vo-empty">
      <Eyebrow>No calendar connected</Eyebrow>
      <Desc>
        I can't see your schedule for {orgNames.join(", ") || "your organisations"} yet.
        Connect a calendar and I'll help spot conflicts across your businesses and prepare for what's next.
        Until then, I won't assume your day is clear.
      </Desc>
      <Button variant="primary" onClick={onConnect}>
        <Plug size={14} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />
        Connect a calendar
      </Button>
    </div>
  </Card>
);

/** Connected and genuinely empty — a different sentence, deliberately. */
export const EmptyWindow = ({ label }: { label: string }) => (
  <Card>
    <div className="vo-empty">
      <Eyebrow>Nothing scheduled</Eyebrow>
      <Desc>{label} is clear across every connected calendar. This is your real schedule, not a missing one.</Desc>
    </div>
  </Card>
);

export const AllHidden = ({ onRestore }: { onRestore: () => void }) => (
  <Card>
    <div className="vo-empty">
      <Eyebrow>Every calendar is switched off</Eyebrow>
      <Desc>Nothing can render while all calendars are hidden. Turn at least one back on.</Desc>
      <Button variant="primary" onClick={onRestore}>
        <EyeOff size={14} aria-hidden style={{ marginRight: 6, verticalAlign: "-2px" }} />
        Show all calendars
      </Button>
    </div>
  </Card>
);

export const SyncBanner = ({
  broken, syncing, onReconnect,
}: { broken: { account_email: string; status: string }[]; syncing: boolean; onReconnect: () => void }) => {
  if (broken.length) {
    return (
      <Card ungated>
        <div className="vo-between" style={{ gap: "var(--s-3)", flexWrap: "wrap" }}>
          <span className="vo-meta" style={{ color: "var(--warn-txt)" }}>
            <CalendarOff size={13} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
            {broken.map((b) => b.account_email).join(", ")} needs reconnecting. Events below are the last
            ones we read, and may be stale.
          </span>
          <Button size="sm" variant="primary" onClick={onReconnect}>Reconnect</Button>
        </div>
      </Card>
    );
  }
  if (syncing) {
    return (
      <span className="vo-meta">
        <RefreshCw size={12} aria-hidden style={{ verticalAlign: "-2px", marginRight: 5 }} />
        First sync running — the grid fills as events land.
      </span>
    );
  }
  return null;
};
