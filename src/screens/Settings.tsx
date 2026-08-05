import { Sun, Moon, ExternalLink, ShieldCheck } from "lucide-react";
import { useAppState, ANY_ORG } from "@/lib/AppState";
import { Card, Desc, Eyebrow, SectionHead, Title, Tag, Face } from "@/components/primitives";
import {
  ColorRow,
  Field,
  HealthBadge,
  ImageWell,
  Segmented,
  Surface,
  Toggle,
} from "@/components/SettingsParts";
import { useKovaData } from "@/data/live/KovaData";
import { setGuardrail, useGuardrails } from "@/data/guardrailStore";
import { EVENTS } from "@/data/mock";

/**
 * Settings — identity you can see change.
 *
 * Every control on this screen writes to AppState, which the rail, the
 * dashboard header and every face in the app already read. Nothing here is
 * a form that needs saving: the preview panes are the real components, not
 * mockups of them, so a colour lands everywhere the instant it is picked.
 */

const initialsOf = (name: string) =>
  name
    .replace(/[^A-Za-z0-9 .]/g, "")
    .split(/[ .]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "??";

/* ---------------------------------------------------------------- profile */

const ProfileSection = () => {
  const { me, setMyColor, setMyPhoto, orgs } = useAppState();
  const uwazi = orgs.find((o) => o.id === "uwazi") ?? orgs[0];

  return (
    <Card>
      <div className="vo-set-grid">
        <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
          <div className="vo-stack" style={{ gap: 2 }}>
            <Title>Your profile</Title>
            <Desc>{me.name} · Founder</Desc>
          </div>

          <Field label="Photo">
            <ImageWell
              label="Upload a profile photo"
              image={me.photo}
              initials={me.initials}
              color={me.color}
              onPick={setMyPhoto}
              onClear={() => setMyPhoto(undefined)}
            />
            {/* Say what the thing does. The alternative is a user who
                uploads a headshot, closes the tab, and finds it gone. */}
            <div className="vo-note">
              Photos stay in this browser session — nothing is uploaded. Refresh and
              you are back to initials.
            </div>
          </Field>

          <Field label="Accent colour">
            <ColorRow value={me.color} onChange={setMyColor} label="Profile colour" />
          </Field>
        </div>

        {/* The list is the point: a colour picker with no map of its blast
            radius makes people afraid to touch it. */}
        <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
          <Eyebrow>Where this shows up</Eyebrow>

          <Surface title="Top bar">
            <div className="vo-row" style={{ gap: "var(--s-2)" }}>
              <Face initials={me.initials} photo={me.photo} color={me.color} title={me.name} />
              <span className="vo-title" style={{ fontSize: "var(--t-body)" }}>
                Good morning, {me.name}
              </span>
            </div>
          </Surface>

          <Surface title="Chat messages">
            <div className="vo-row" style={{ alignItems: "flex-start", gap: "var(--s-2)" }}>
              <Face initials={me.initials} photo={me.photo} color={me.color} title={me.name} />
              <div className="vo-stack" style={{ gap: 0 }}>
                <span className="vo-meta">
                  <strong style={{ color: "var(--ink)" }}>{me.name}</strong> · 09:12
                </span>
                <span style={{ fontSize: "var(--t-body)" }}>
                  Pushing the venue walkthrough to Thursday.
                </span>
              </div>
            </div>
          </Surface>

          <Surface title="Digital card">
            <div className="vo-minicard" style={{ borderTopColor: me.color }}>
              <Face
                initials={me.initials}
                photo={me.photo}
                color={me.color}
                size="lg"
                title={me.name}
              />
              <div className="vo-stack" style={{ gap: 0 }}>
                <span className="vo-title" style={{ fontSize: "var(--t-body)" }}>{me.name}</span>
                <span className="vo-meta">Founder · {uwazi.name}</span>
              </div>
            </div>
          </Surface>

          <Surface title="Assigned tasks">
            <div className="vo-row" style={{ gap: "var(--s-2)" }}>
              <span className="vo-check" aria-hidden />
              <span style={{ fontSize: "var(--t-body)", flex: 1, minWidth: 0 }}>
                Sign Uwazi funding doc
              </span>
              <Face initials={me.initials} photo={me.photo} color={me.color} title={me.name} />
            </div>
          </Surface>
        </div>
      </div>
    </Card>
  );
};

/* ----------------------------------------------------------------- orgs */

const OrgRow = ({ id }: { id: string }) => {
  const { orgs, setOrgColor, setOrgLogo, scope } = useAppState();
  const org = orgs.find((o) => o.id === id);
  if (!org) return null;

  const initials = initialsOf(org.name);
  const dayEvent = EVENTS.find((e) => e.org === org.id);

  return (
    <div className="vo-org-row">
      <div className="vo-stack" style={{ gap: "var(--s-3)" }}>
        <div className="vo-row">
          <Face
            initials={initials}
            photo={org.logo}
            color={org.color}
            shape="square"
            size="lg"
            title={org.name}
          />
          <div className="vo-stack" style={{ gap: 0, minWidth: 0 }}>
            <span className="vo-title" style={{ fontSize: "var(--t-body)" }}>{org.name}</span>
            <span className="vo-meta">{org.role}</span>
          </div>
          {scope === org.id ? <Tag tone="accent">Current scope</Tag> : null}
        </div>

        <ColorRow value={org.color} onChange={(c) => setOrgColor(org.id, c)} label={org.name} />

        <ImageWell
          label={`Upload a logo for ${org.name}`}
          image={org.logo}
          initials={initials}
          color={org.color}
          shape="square"
          onPick={(url) => setOrgLogo(org.id, url)}
          onClear={() => setOrgLogo(org.id, undefined)}
        />
      </div>

      {/* Same four surfaces the colour actually drives, live. */}
      <div className="vo-org-preview">
        <div className="vo-eyebrow">Drives</div>
        <div className="vo-row" style={{ gap: "var(--s-3)", alignItems: "stretch" }}>
          <span className="vo-strip vo-strip-demo" style={{ background: org.color }} aria-hidden />
          <div className="vo-stack" style={{ gap: "var(--s-2)", flex: 1, minWidth: 0 }}>
            <span className="vo-meta">Workspace strip and switcher</span>
            <div className="vo-row" style={{ gap: "var(--s-2)" }}>
              <span className="vo-dot" style={{ background: org.color }} />
              <span className="vo-meta">Org dots · project lines</span>
            </div>
            <div className="vo-spine" style={{ borderLeftColor: org.color }}>
              <span className="vo-meta">
                {dayEvent ? `${dayEvent.at} ${dayEvent.title}` : "No events today"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrgsSection = () => {
  const { orgs } = useAppState();
  const ventures = orgs.filter((o) => o.id !== "all");
  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Organisations</Title>
          <Desc>
            One colour per venture, used everywhere that venture appears — the rail
            strip, the switcher, project lines, calendar spines and every org dot. A
            logo replaces the initials in all of them.
          </Desc>
        </div>
        {ventures.map((o) => (
          <OrgRow key={o.id} id={o.id} />
        ))}
      </div>
    </Card>
  );
};

/* ---------------------------------------------------------- connections */

const ConnectionsSection = () => {
  const { orgs } = useAppState();
  const nameFor = (id: string) =>
    id === ANY_ORG ? "All ventures" : orgs.find((o) => o.id === id)?.name ?? id;

  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Connections</Title>
          <Desc>
            A failing source is worse than a missing one, because the brief still
            renders and reads complete. Anything not healthy here is named in the
            daily brief footer.
          </Desc>
        </div>

        <div className="vo-conn-list">
          {connections.map((c) => (
            <div key={c.id} className="vo-conn" data-health={c.health}>
              <div className="vo-stack" style={{ gap: 2, minWidth: 0 }}>
                <span className="vo-row" style={{ gap: "var(--s-2)" }}>
                  <span className="vo-title" style={{ fontSize: "var(--t-body)" }}>{c.name}</span>
                  <span className="vo-meta">{nameFor(c.org)}</span>
                </span>
                <span className="vo-meta">{c.detail}</span>
                <span className="vo-meta">{c.scopes}</span>
              </div>
              <div className="vo-row" style={{ gap: "var(--s-2)" }}>
                <HealthBadge health={c.health} />
                <button type="button" className="vo-link">
                  {c.health === "off" ? "Connect" : "Manage"}
                  <ExternalLink size={12} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------ guardrails */

const GuardrailsSection = () => {
  const values = useGuardrails();
  const { guardrails } = useKovaData();
  const allowed = guardrails.filter((g) => !g.locked);
  const locked = guardrails.filter((g) => g.locked);

  return (
    <Card>
      <div className="vo-stack" style={{ gap: "var(--s-4)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Guardrails</Title>
          <Desc>What agents may do on their own. Reading and drafting are yours to set.</Desc>
        </div>

        <div className="vo-toggle-list">
          {allowed.map((g) => (
            <Toggle
              key={g.id}
              id={`gr-${g.id}`}
              label={g.label}
              detail={g.detail}
              checked={values[g.id]}
              onChange={(v) => setGuardrail(g.id, v)}
            />
          ))}
        </div>

        <div className="vo-policy" id="gate-policy">
          <div className="vo-row" style={{ gap: "var(--s-2)", alignItems: "flex-start" }}>
            <ShieldCheck size={15} strokeWidth={1.75} aria-hidden style={{ marginTop: 2 }} />
            <Desc>
              The four below cannot be switched on, here or anywhere else. Approval
              before an agent acts in the world is the product — a settings screen that
              offered a way off would be lying about one or the other.
            </Desc>
          </div>
        </div>

        <div className="vo-toggle-list">
          {locked.map((g) => (
            <Toggle
              key={g.id}
              id={`gr-${g.id}`}
              label={g.label}
              detail={g.detail}
              checked={false}
              locked
              reason={g.reason}
            />
          ))}
        </div>
      </div>
    </Card>
  );
};

/* ------------------------------------------------------------ appearance */

const AppearanceSection = () => {
  const { theme, setTheme } = useAppState();
  return (
    <Card>
      <div className="vo-between" style={{ flexWrap: "wrap", gap: "var(--s-3)" }}>
        <div className="vo-stack" style={{ gap: 2 }}>
          <Title>Appearance</Title>
          {/* Same state the rail toggle writes, so the two can never disagree. */}
          <Desc>Shared with the theme toggle at the bottom of the rail.</Desc>
        </div>
        <Segmented
          name="Theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "dark", label: "Dark", icon: <Moon size={14} strokeWidth={1.75} aria-hidden /> },
            { value: "light", label: "Light", icon: <Sun size={14} strokeWidth={1.75} aria-hidden /> },
          ]}
        />
      </div>
    </Card>
  );
};

/* ---------------------------------------------------------------- screen */

export const Settings = () => (
  <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
    <div>
      <Eyebrow>System</Eyebrow>
      <h1 className="vo-head" style={{ fontSize: 26, marginTop: 4 }}>
        Settings
      </h1>
    </div>

    <section>
      <SectionHead title="Your profile" />
      <ProfileSection />
    </section>

    <section>
      <SectionHead title="Organisations" />
      <OrgsSection />
    </section>

    <section>
      <SectionHead title="Connections" />
      <ConnectionsSection />
    </section>

    <section>
      <SectionHead title="Guardrails" />
      <GuardrailsSection />
    </section>

    <section>
      <SectionHead title="Appearance" />
      <AppearanceSection />
    </section>
  </div>
);

export default Settings;
