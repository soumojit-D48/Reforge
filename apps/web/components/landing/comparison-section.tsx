import { CheckCircle2, GitCompareArrows, ShieldCheck, XCircle } from "lucide-react";
import { Reveal } from "./shared";

export function ComparisonSection() {
  return (
    <section className="content-section comparison-section page-shell">
      <Reveal className="comparison-heading">
        <div className="section-kicker mono">03 / VERIFY</div>
        <h2>One change. Every consequence.</h2>
        <p>Original and replay stay distinct from input to evaluation.</p>
      </Reveal>
      <Reveal className="comparison-shell observe-group" delay={100}>
        <div className="comparison-column original-column">
          <div className="comparison-label">
            <span className="mono">ORIGINAL / run_0184</span>
            <span className="status-pill status-failure">
              <XCircle /> NOT FIXED
            </span>
          </div>
          <div className="result-code mono">wrong_tool</div>
          <dl>
            <div>
              <dt>HTTP response</dt>
              <dd className="failure-text">404</dd>
            </div>
            <div>
              <dt>Evaluation score</dt>
              <dd>0.32</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>8.4s</dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd>invalid_tool_args</dd>
            </div>
          </dl>
        </div>
        <div className="resolution-rail">
          <div className="resolution-icon">
            <GitCompareArrows />
          </div>
          {[
            ["model", "changed"],
            ["retrieval", "mocked"],
            ["tool response", "fresh"],
            ["prompt", "reused"],
          ].map(([field, state]) => (
            <div className="resolution-row" key={field}>
              <span>{field}</span>
              <strong className={`mono state-${state}`}>{state}</strong>
            </div>
          ))}
        </div>
        <div className="comparison-column replay-column">
          <div className="comparison-label">
            <span className="mono">REPLAY / run_0184_r1</span>
            <span className="status-pill status-fixed">
              <CheckCircle2 /> FIXED
            </span>
          </div>
          <div className="result-code mono">get_order_status</div>
          <dl>
            <div>
              <dt>HTTP response</dt>
              <dd className="fixed-text">200</dd>
            </div>
            <div>
              <dt>Evaluation score</dt>
              <dd>0.94</dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>6.9s</dd>
            </div>
            <div>
              <dt>Error</dt>
              <dd>none</dd>
            </div>
          </dl>
        </div>
        <div className="comparison-note mono">
          <ShieldCheck /> Every field is labeled. Nothing is silently mixed.
        </div>
      </Reveal>
    </section>
  );
}
