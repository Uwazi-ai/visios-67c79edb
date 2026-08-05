import { useMemo } from "react";
import { Bento, Card, Col, Desc, Eyebrow, SectionHead } from "@/components/primitives";
import { AgentCard } from "@/components/AgentsParts";
import { AGENTS, hitRate } from "@/data/agents";
import { useAppState } from "@/lib/AppState";

/**
 * Agents — run history and hit rate. The number that matters is how often
 * the agent was right, not how many things it flagged.
 */
const Agents = () => {
  const { orgs, inScope } = useAppState();
  const rows = useMemo(() => AGENTS.filter((a) => inScope(a.org)), [inScope]);
  const colorOf = (id: string) => orgs.find((o) => o.id === id)?.color ?? "var(--ws-all)";

  const calls = rows.reduce((s, a) => s + hitRate(a).calls, 0);
  const correct = rows.reduce((s, a) => s + hitRate(a).correct, 0);

  return (
    <div className="vo-stack" style={{ gap: "var(--s-5)" }}>
      <SectionHead
        title="Agents"
        action={
          <span className="vo-meta">
            {rows.length} agents · {calls} calls in 14 days, {correct} were right
          </span>
        }
      />

      <Card ungated>
        <div className="vo-stack" style={{ gap: "var(--s-2)" }}>
          <Eyebrow>How these are scored</Eyebrow>
          <Desc>
            Every agent is measured on calls it can be wrong about, checked against what
            actually happened afterwards. "Issues found" is not a score — an agent that
            flags everything scores highest on it and is worth nothing.
          </Desc>
        </div>
      </Card>

      <Bento>
        {rows.map((a) => (
          <Col key={a.id} span={6}>
            <Card>
              <AgentCard agent={a} accent={colorOf(a.org)} />
            </Card>
          </Col>
        ))}
      </Bento>
    </div>
  );
};

export default Agents;
