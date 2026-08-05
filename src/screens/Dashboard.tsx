import { useState } from "react";
import { useAppState } from "@/lib/AppState";
import { PROPOSALS, Proposal, ProposalStatus, byScope } from "@/data/mock";
import { Bento, Col, Desc, Eyebrow, GatedButton, SectionHead } from "@/components/primitives";
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
   * Approval state lives on the records, in state, keyed by id — never in
   * the DOM and never derived from a class name. A re-render rebuilds the
   * cards from this array, so an approved item stays approved.
   */
  const [records, setRecords] = useState<Proposal[]>(PROPOSALS);
  const setStatus = (id: string, status: ProposalStatus) =>
    setRecords((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));

  const proposals = byScope(records, scope);
  const pending = proposals.filter((p) => p.status === "pending");

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <div>
        <Eyebrow>{workspace.name}</Eyebrow>
        <h1 className="vo-head" style={{ fontSize: 26, marginTop: 4 }}>
          Good morning, {me.name}
        </h1>
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
              variant="primary"
              onClick={() => go("tasks")}
            >
              Plan my day
            </GatedButton>
          }
        />
        <Bento>
          {proposals.map((p) => (
            <Col span={6} key={p.id}>
              <AgentProposalCard
                proposal={p}
                onApprove={() => setStatus(p.id, "approved")}
                onReject={() => setStatus(p.id, "rejected")}
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
