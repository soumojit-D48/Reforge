import type { CSSProperties } from "react";
import { Check, ChevronDown, Search, ShieldCheck, XCircle, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { Reveal, StatusDot } from "./shared";

const runEvents = [["14:08:22.104", "run.started"], ["14:08:22.246", "span.created"], ["14:08:23.992", "tool.returned"], ["14:08:24.118", "run.status_changed"]] as const;
const suites = [["tool-selection/orders", "pass", "48ms"], ["retrieval/missing-id", "pass", "62ms"], ["arguments/order-ref", "failed", "51ms"], ["arguments/order-ref", "fixed", "49ms"]] as const;

export function ProductTour() {
  return (
    <section className="content-section tour-section">
      <div className="page-shell">
        <Reveal className="section-heading-row tour-heading">
          <div>
            <div className="section-kicker mono">04 / INSTRUMENTS</div>
            <h2>Trace-native by construction.</h2>
          </div>
          <p>Purpose-built surfaces for finding causes—not decorating symptoms.</p>
        </Reveal>
        <div className="instrument-grid">
          <Reveal className="instrument-panel timeline-panel">
            <div className="panel-title">
              <div>
                <span className="mono">TIMELINE</span>
                <h3>Nested evidence, in order.</h3>
              </div>
              <Search />
            </div>
            <div className="mini-trace">
              {[
                ["agent.run", "6.9s", 0],
                ["retrieval.search_orders", "142ms", 1],
                ["llm.select_tool", "1.8s", 1],
                ["tool.get_order_status", "318ms", 2],
              ].map(([name, time, depth], index) => (
                <div
                  className="mini-trace-row"
                  key={String(name)}
                  style={{ paddingLeft: `${Number(depth) * 20 + 10}px` }}
                >
                  <ChevronDown className={index === 3 ? "rotate-icon" : ""} />
                  <StatusDot tone={index === 3 ? "fixed" : "signal"} />
                  <span className="mono">{name}</span>
                  <strong className="mono">{time}</strong>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="instrument-panel intelligence-panel" delay={80}>
            <div className="panel-title">
              <div>
                <span className="mono">FAILURE INTELLIGENCE</span>
                <h3>A hypothesis, not a verdict.</h3>
              </div>
              <Zap />
            </div>
            <div className="confidence-orbit">
              <div>
                <strong>0.91</strong>
                <span className="mono">CONFIDENCE</span>
              </div>
            </div>
            <div className="classification">
              <span className="mono">SUGGESTED CATEGORY</span>
              <strong>invalid_tool_args</strong>
              <p>The display reference was passed where an internal order ID was required.</p>
            </div>
            <div className="confirmation-row">
              <Button size="sm" className="confirm-button">
                <Check /> Confirm
              </Button>
              <Button size="sm" variant="outline">
                Override
              </Button>
            </div>
          </Reveal>
          <Reveal className="instrument-panel live-panel" delay={120}>
            <div className="panel-title">
              <div>
                <span className="mono">LIVE EXECUTION</span>
                <h3>The run, as it happens.</h3>
              </div>
              <span className="live-label mono">
                <StatusDot tone="signal" /> LIVE
              </span>
            </div>
            <div className="event-stream">
              {runEvents.map(([time, event], index) => (
                <div key={event}>
                  <span className="mono">{time}</span>
                  <i style={{ "--step-index": index } as CSSProperties} />
                  <strong className="mono">{event}</strong>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal className="instrument-panel regression-panel" delay={160}>
            <div className="panel-title">
              <div>
                <span className="mono">REGRESSION SUITE</span>
                <h3>The fix stays fixed.</h3>
              </div>
              <ShieldCheck />
            </div>
            <div className="suite-table">
              <div className="suite-head mono">
                <span>CASE</span>
                <span>RESULT</span>
                <span>TIME</span>
              </div>
              {suites.map(([name, state, time]) => (
                <div className={`suite-row suite-${state}`} key={`${name}-${state}`}>
                  <span className="mono">{name}</span>
                  <strong className="mono">{state}</strong>
                  <span className="mono">{time}</span>
                </div>
              ))}
            </div>
            <div className="reintroduced-note">
              <XCircle />
              <span>
                <strong>Failure reintroduced in build #c14e</strong>Blocked before deploy · fixed in
                #c162
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
