import type { CSSProperties } from "react";
import { CircleDot } from "lucide-react";
import { Reveal, StatusDot } from "./shared";

const diagnostics = [
  { label: "retrieval", status: "pass", evidence: "4 order records matched customer_id" },
  { label: "model", status: "warn", evidence: "selected legacy tool from ambiguous schema" },
  { label: "tool", status: "fail", evidence: "order_id received as display reference" },
  { label: "external API", status: "fail", evidence: "GET /orders/ORD-9921 returned 404" },
  { label: "evaluator", status: "pass", evidence: "failure category confirmed · 0.91" },
] as const;

export function ProblemSection() {
  return (
    <section id="product" className="content-section problem-section page-shell">
      <Reveal className="section-copy">
        <div className="section-kicker mono">01 / DIAGNOSE</div>
        <h2>The failure is never just the final answer.</h2>
        <p>
          A wrong answer can begin in retrieval, tool selection, malformed arguments, an external
          API, a timeout, hallucination, or the evaluator itself.
        </p>
        <blockquote>
          The output is the symptom. <strong>The trace is the evidence.</strong>
        </blockquote>
      </Reveal>
      <Reveal className="diagnostic-matrix observe-group" delay={100}>
        <div className="matrix-head mono">
          <span>PROBE</span>
          <span>RECORDED EVIDENCE</span>
          <span>STATE</span>
        </div>
        {diagnostics.map((item, index) => (
          <div
            className="matrix-row"
            key={item.label}
            style={{ "--step-index": index } as CSSProperties}
          >
            <span className="matrix-label mono">
              <StatusDot tone={item.status} />
              {item.label}
            </span>
            <span className="evidence-line">
              <i />
              <span>{item.evidence}</span>
            </span>
            <span className={`mono matrix-state matrix-${item.status}`}>{item.status}</span>
          </div>
        ))}
        <div className="matrix-foot mono">
          <CircleDot /> ROOT CAUSE / tool arguments
        </div>
      </Reveal>
    </section>
  );
}
