import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Hash, Zap, Rocket, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/AuthContext";
import { ORG_COLORS } from "@/lib/orgs";
import { toast } from "sonner";

export interface ChatChannel {
  id: string;
  name: string | null;
  org_id: string | null;
  is_dm: boolean;
  is_system: boolean;
  dm_participants: string[];
  unread?: number;
}

interface Props {
  channels: ChatChannel[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreated: () => void;
  onNewDm?: () => void;
}

export const ChannelList = ({ channels, activeId, onSelect, onCreated, onNewDm }: Props) => {
  const { orgs, activeOrgId } = useOrg();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const filter = (s: string) => s.toLowerCase().includes(search.toLowerCase());

  const groups = useMemo(() => {
    const visibleOrgs =
      activeOrgId === "all" || !activeOrgId ? orgs : orgs.filter((o) => o.id === activeOrgId);
    return visibleOrgs.map((o) => ({
      org: o,
      channels: channels.filter(
        (c) => c.org_id === o.id && !c.is_dm && !c.is_system && (!search || filter(c.name ?? "")),
      ),
      systems: channels.filter(
        (c) => c.org_id === o.id && c.is_system && (!search || filter(c.name ?? "")),
      ),
    }));
  }, [channels, orgs, activeOrgId, search]);

  const dms = channels.filter((c) => c.is_dm && (!search || filter(c.name ?? "")));

  async function createChannel() {
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!name) return;
    const orgId = activeOrgId && activeOrgId !== "all" ? activeOrgId : orgs[0]?.id;
    if (!orgId) {
      toast.error("Pick an org first");
      return;
    }
    const { error } = await supabase.from("channels").insert({
      org_id: orgId,
      name,
      type: "channel",
      is_dm: false,
      is_system: false,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`#${name} created`);
      setNewName("");
      setCreating(false);
      onCreated();
    }
  }

  return (
    <div
      className="hidden md:flex flex-col h-full"
      style={{
        width: 220,
        background: "rgba(2,2,10,0.55)",
        borderRight: "1px solid var(--border-glass)",
      }}
    >
      <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="t-card-title">Chat</div>
          <div className="flex items-center gap-1">
            {onNewDm && (
              <button
                className="btn-icon"
                style={{ width: 26, height: 26 }}
                onClick={onNewDm}
                title="New direct message"
              >
                <MessageSquarePlus size={14} strokeWidth={1.5} />
              </button>
            )}
            <button
              className="btn-icon"
              style={{ width: 26, height: 26 }}
              onClick={() => setCreating((v) => !v)}
              title="New channel"
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="input-glass"
            style={{ padding: "6px 8px 6px 24px", fontSize: 12 }}
          />
        </div>
        {creating && (
          <div className="mt-2 flex gap-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createChannel();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder="channel-name"
              className="input-glass"
              style={{ padding: "6px 8px", fontSize: 12 }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {groups.map(({ org, channels: chs, systems }) => (
          <div key={org.id} className="mb-3">
            <div
              className="t-mono px-3 py-1 flex items-center gap-2"
              style={{ fontSize: 9, textTransform: "uppercase" }}
            >
              <span
                className="org-dot"
                style={{ background: ORG_COLORS[org.slug] ?? org.color }}
              />
              {org.name}
            </div>
            {chs.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                active={c.id === activeId}
                onClick={() => onSelect(c.id)}
                color={ORG_COLORS[org.slug] ?? org.color}
              />
            ))}
            {systems.length > 0 && (
              <div className="mt-2">
                {systems.map((c) => (
                  <SystemRow
                    key={c.id}
                    channel={c}
                    active={c.id === activeId}
                    onClick={() => onSelect(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="mt-2">
          <div
            className="t-mono px-3 py-1 flex items-center justify-between"
            style={{ fontSize: 9, textTransform: "uppercase" }}
          >
            <span>Direct Messages</span>
            {onNewDm && (
              <button
                onClick={onNewDm}
                title="New direct message"
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                +
              </button>
            )}
          </div>
          {dms.length === 0 ? (
            <div className="px-3 py-1 t-mono" style={{ fontSize: 9, opacity: 0.6 }}>
              No conversations yet
            </div>
          ) : (
            dms.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                active={c.id === activeId}
                onClick={() => onSelect(c.id)}
                color={undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function ChannelRow({
  channel,
  active,
  onClick,
  color,
}: {
  channel: ChatChannel;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 mx-2 px-2 py-1.5 rounded-[8px] transition-colors"
      style={{
        background: active ? "var(--bg-glass-active)" : "transparent",
        border: active ? "1px solid var(--border-active)" : "1px solid transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        width: "calc(100% - 16px)",
      }}
    >
      <Hash size={12} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 500,
          flex: 1,
          textAlign: "left",
        }}
      >
        {channel.name}
      </span>
      {channel.unread ? (
        <span
          className="font-mono"
          style={{
            background: "rgba(37,99,235,0.85)",
            color: "white",
            fontSize: 9,
            fontWeight: 600,
            padding: "1px 6px",
            borderRadius: 999,
          }}
        >
          {channel.unread}
        </span>
      ) : null}
    </button>
  );
}

function SystemRow({
  channel,
  active,
  onClick,
}: {
  channel: ChatChannel;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = channel.name === "deploys" ? Rocket : Zap;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 mx-2 px-2 py-1.5 rounded-[8px] transition-colors"
      style={{
        background: active ? "var(--bg-glass-active)" : "transparent",
        border: active ? "1px solid var(--border-active)" : "1px solid transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        width: "calc(100% - 16px)",
      }}
    >
      <Icon size={12} strokeWidth={1.5} style={{ color: "#818cf8" }} />
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 500,
          flex: 1,
          textAlign: "left",
        }}
      >
        {channel.name}
      </span>
    </button>
  );
}
