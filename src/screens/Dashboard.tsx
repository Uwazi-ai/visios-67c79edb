import { useAppState } from "@/lib/AppState";
import { byScope } from "@/data/mock";
import { useProposals, setProposalStatus } from "@/data/proposalStore";
import { Bento, Col, Desc, Eyebrow, Face, GatedButton, SectionHead } from "@/components/primitives";
import { DailyBrief } from "@/components/DailyBrief";
import { ThroughputCard, VelocityChart } from "@/components/Throughput";
import { AgentProposalCard } from "@/components/AgentProposals";

/**
 * Dashboard — reference implementation for every other screen.
 *
 * Order is deliberate: brief, throughput, proposals, velocity. The brief
 * decides what matters, throughput says whether the machine is moving,
 * proposals are the work waiting on a person, velocity is the reference
 * section underneath.
 */
export const Dashboard = ({ navigate }: { navigate?: (screen: string) => void }) => {
  const { scope, scopeOrg, me } = useAppState();
  const workspace = scopeOrg();
  const go = navigate ?? (() => {});

  /**
   * Approval state comes from the record store, never from the DOM and
   * never from a class name. Re-rendering — or leaving the screen and
   * coming back — rebuilds the cards from the records, so an approved
   * item stays approved.
   */
  const records = useProposals();

  const proposals = byScope(records, scope);
  const pending = proposals.filter((p) => p.status === "pending");


  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      {/* Top bar. The face reads the same identity Settings writes, so a new
          photo or accent lands here without a save step. */}
      <div className="vo-between" style={{ flexWrap: "wrap", gap: "var(--s-3)" }}>
        <div>
          <Eyebrow>{workspace.name}</Eyebrow>
          <h1 className="vo-head" style={{ fontSize: 26, marginTop: 4 }}>
            Good morning, {me.name}
          </h1>
        </div>
        <button type="button" className="vo-topface" onClick={() => go("settings")}>
          <Face initials={me.initials} photo={me.photo} color={me.color} size="lg" title={me.name} />
        </button>
      </div>

      <DailyBrief scope={scope} proposals={proposals} navigate={go} />

      <section>
        <SectionHead title="Throughput" />
        <Bento>
          <ThroughputCard scope={scope} />
        </Bento>
      </section>

      <section>
        <SectionHead
          title="Agent proposals"
          action={
            <GatedButton
              blockedCount={pending.length}
              variant="plain"
              readyLabel="Plan my day"
              onClick={() => go("tasks")}
            />

          }
        />
        <Bento>
          {proposals.map((p) => (
            <Col span={6} key={p.id}>
              <AgentProposalCard
                proposal={p}
                onApprove={() => setProposalStatus(p.id, "approved")}
                onReject={() => setProposalStatus(p.id, "rejected")}
              />
            </Col>
          ))}
          {proposals.length === 0 && (
            <Col span={12}>
              <Desc>Nothing proposed in this scope. Agents surface work here as it appears.</Desc>
            </Col>
          )}
        </Bento>
      </section>

      {/* Reference, not a step — so no index on the heading. */}
      <section>
        <SectionHead title="Velocity" />
        <Bento>
          <VelocityChart scope={scope} />
        </Bento>
      </section>
    </div>
  );
};

export default Dashboard;
