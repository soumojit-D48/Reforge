import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, CircleAlert, Play } from "lucide-react";
import { Button } from "../ui/button";
import { Reveal, StatusDot } from "./shared";

const traceRows = [
  { kind: "retrieval", name: "search_orders", meta: "4 docs · 182ms", tone: "signal" },
  { kind: "llm_call", name: "select_tool", meta: "gpt-4.1-mini · 1.2s", tone: "neutral" },
  { kind: "tool_call", name: "getOrderStatus", meta: "404 Order not found", tone: "failure" },
  { kind: "error", name: "invalid_tool_args", meta: "confidence 0.91", tone: "failure" },
] as const;
const proofSteps = ["TRACE INGESTION", "SPAN TIMELINE", "ONE VARIABLE CHANGED", "SIDE-BY-SIDE DIFF", "REGRESSION LOCKED"];

function FailureSpecimen() {
  return (
    <div className="specimen-wrap specimen-v2" aria-label="Illustrative failed agent run and successful replay">
      <div className="specimen-label mono">FAILURE SPECIMEN / 0184</div>
      <div className="specimen-panel">
        <div className="specimen-header">
          <div>
            <span className="live-dot" aria-hidden="true" />
            <strong className="mono">run_0184</strong>
          </div>
          <div className="run-meta mono">
            <span className="status-pill status-failure">FAILED</span>
            <span>8.4s</span>
            <span>production</span>
          </div>
        </div>
        <div className="trace-body">
          <div className="trace-connector" aria-hidden="true">
            <span className="signal-traveler" />
          </div>
          {traceRows.map((row, index) => (
            <div
              className={`trace-row trace-row-${index} ${row.tone === "failure" ? "is-failed" : ""}`}
              key={row.name}
            >
              <span className="trace-node" aria-hidden="true" />
              <span className="trace-type mono">{row.kind}</span>
              <strong>{row.name}</strong>
              <span className="trace-value mono">{row.meta}</span>
              {index === 2 && <CircleAlert aria-hidden="true" />}
            </div>
          ))}
          <div className="replay-ghost">
            <span className="ghost-path" aria-hidden="true" />
            <span className="trace-type mono">replay_0184_a</span>
            <strong>get_order_status</strong>
            <span className="status-pill status-fixed">FIXED</span>
          </div>
        </div>
        <div className="specimen-footer">
          <span className="mono">
            Changed: <strong>tool arguments</strong>
          </span>
          <Button className="replay-button" size="sm">
            <Play /> Replay
          </Button>
        </div>
      </div>
      <p className="fixture-note mono">Illustrative trace · no live production data</p>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="hero-section">
      <div className="hero-grid page-shell">
        <Reveal className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" /> AI AGENT DEBUGGING / CONTROLLED REPLAY
          </div>
          <h1>
            Failures are <em>evidence.</em>
          </h1>
          <p className="hero-lede">
            Reforge shows you exactly where an AI agent went wrong, lets you change one variable,
            and proves whether the fix actually worked.
          </p>
          <div className="hero-actions">
            <Button asChild size="lg" className="primary-action">
              <Link href="/register">
                Start investigating <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="secondary-action">
              <Link href="#workflow">
                See the workflow <ArrowDown />
              </Link>
            </Button>
          </div>
          <div className="trust-line mono">
            <span>For tool-using agents</span>
            <span>trace-first</span>
            <span>reproducible by design</span>
          </div>
        </Reveal>
        <Reveal className="hero-visual" delay={140}>
          <FailureSpecimen />
        </Reveal>
      </div>
    </section>
  );
}

export function ProofStrip() {
  return (
    <section className="proof-strip observe-group" aria-label="Reforge workflow summary">
      <div className="page-shell proof-scroll">
        {proofSteps.map((step, index) => (
          <div
            className="proof-step"
            key={step}
            style={{ "--step-index": index } as CSSProperties}
          >
            <span className="mono">0{index + 1}</span>
            <strong>{step}</strong>
            {index < proofSteps.length - 1 && <ArrowRight aria-hidden="true" />}
          </div>
        ))}
      </div>
    </section>
  );
}
