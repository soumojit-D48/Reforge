import type { CSSProperties } from "react";
import { Reveal } from "./shared";

const workflow = [
  ["01", "Capture", "Send a structured trace from the agent via SDK or API."],
  ["02", "Inspect", "Expand nested spans to see inputs, outputs, timings, and errors."],
  ["03", "Replay", "Change exactly one variable: prompt, model, tool arguments, retrieval config, or temperature."],
  ["04", "Compare", "See outputs, tool calls, latency, tokens, cost, and errors side by side."],
  ["05", "Lock it", "Save the fixed failure as a regression test and rerun it against future changes."],
] as const;

export function WorkflowSection() {
  return (
    <section id="workflow" className="content-section workflow-section">
      <div className="page-shell">
        <Reveal className="section-heading-row">
          <div>
            <div className="section-kicker mono">02 / INVESTIGATE</div>
            <h2>From failed run to permanent guardrail.</h2>
          </div>
          <p>One evidence chain. One controlled change. No silent substitutions.</p>
        </Reveal>
        <div className="workflow-rail observe-group">
          <div className="rail-line" aria-hidden="true">
            <span className="rail-cursor" />
          </div>
          {workflow.map(([number, title, body], index) => (
            <article
              className="workflow-stage"
              key={title}
              style={{ "--step-index": index } as CSSProperties}
            >
              <div className="stage-node">
                <span className="mono">{number}</span>
              </div>
              <div className="stage-copy">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
